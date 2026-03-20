import { ReturnGoRMA, ReturnGoMetrics, BountyDashboardData, BountyMetricData, ProductStats, RmaShortInfo, FullReturnGoDashboardData } from '../types';
import { RETURNGO_LEVIS_STORE_URL } from '../constants';
import { format, parseISO, isValid, subDays, startOfDay, eachDayOfInterval, isSameDay, isAfter, differenceInDays } from 'date-fns';

const ACTIVE_STATUSES = "Pending,Approved,Received"; 
const COMPLETED_STATUSES = "Done";

// Bounty Apparel Config

const BOUNTY_STORES = [
  { name: "Diesel", url: "diesel-dev-south-africa.myshopify.com" },
  { name: "Hurley", url: "hurley-dev-south-africa.myshopify.com" },
  { name: "Jeep Apparel", url: "jeep-apparel-dev-south-africa.myshopify.com" },
  { name: "Reebok", url: "reebok-dev-south-africa.myshopify.com" },
  { name: "Superdry", url: "superdry-dev-south-africa.myshopify.com" }
];

const getHeaders = (shopName: string) => ({
    "x-shop-name": shopName,
    "Content-Type": "application/json",
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fix: Explicitly type dateStr parameter to avoid 'unknown' assignment error.
const normalizeDate = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null;
    return dateStr.replace(' ', 'T');
};

const fetchWithRetry = async (url: string, options?: RequestInit, retries = 3, backoff = 500): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const wait = retryAfter ? parseInt(retryAfter) * 1000 : backoff;
          await delay(wait);
          return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        if (!response.ok && response.status >= 500 && retries > 0) {
          await delay(backoff);
          return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        return response;
    } catch (e: any) {
        if (retries > 0) {
            await delay(backoff);
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw e;
    }
};

/**
 * Fetches a list of RMAs from ReturnGo
 */
export const fetchRmaList = async (shopName: string, statusList: string, pagesize: number = 100, updatedAfter?: string, breakdown?: string): Promise<any[]> => {
    let url = `/api/returngo/rmas?shopName=${shopName}&status=${statusList}&pagesize=${pagesize}`;
    
    if (updatedAfter) {
        url += `&updatedAfter=${updatedAfter}`;
    }
    if (breakdown) {
        url += `&breakdown=${breakdown}`;
    }

    const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: getHeaders(shopName)
    });

    if (!response.ok) {
        let errorMsg = `ReturnGo API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData.message) errorMsg = errorData.message;
        } catch (e) {
            // Not JSON, ignore
        }
        throw new Error(errorMsg);
    }
    
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        return data.rmas || [];
    } catch (e) {
        console.warn(`Failed to parse ReturnGo RMA list response as JSON. Body starts with: ${text.substring(0, 50)}`);
        return [];
    }
};

/**
 * Tests the connection to ReturnGo
 */
export const testReturnGoConnection = async (shopName: string): Promise<{ success: boolean; message: string }> => {
    try {
        const response = await fetch('/api/returngo/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopName })
        });
        
        let data;
        const text = await response.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            return { success: false, message: `Server error (${response.status}): ${response.statusText}\n${text.substring(0, 500)}` };
        }
        
        if (!response.ok) {
            return { success: false, message: data.message || 'Connection failed' };
        }
        return { success: true, message: data.message };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

/**
 * Tests the connection to ReturnGo and fetches the most recent RMA for each store
 */
export const testReturnGoRmas = async (appContext: string): Promise<Record<string, any>> => {
    try {
        const response = await fetch(`/api/returngo/test-rmas?appContext=${appContext}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
        }
        
        return await response.json();
    } catch (error: any) {
        console.error('Error testing ReturnGo RMAs:', error);
        throw error;
    }
};

/**
 * Fetches detailed info for a single RMA
 */
export const fetchRmaDetail = async (shopName: string, rmaId: string): Promise<any> => {
    const url = `/api/returngo/rma/${rmaId}?shopName=${shopName}`;
    
    const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: getHeaders(shopName)
    });

    if (!response.ok) return null;
    
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        return data.rma || data;
    } catch (e) {
        console.warn(`Failed to parse ReturnGo RMA detail response as JSON for RMA ${rmaId}. Body starts with: ${text.substring(0, 50)}`);
        return null;
    }
};

/**
 * Fetch Details for a batch of RMAs with concurrency control and enrich data
 */
const fetchDetailsForList = async (list: any[], shopName: string, onProgress?: (msg: string) => void): Promise<ReturnGoRMA[]> => {
    const detailedRmas: ReturnGoRMA[] = [];
    const CONCURRENCY_LIMIT = 5; // Limit concurrent fetches to 5
    
    for (let i = 0; i < list.length; i += CONCURRENCY_LIMIT) {
        const chunk = list.slice(i, i + CONCURRENCY_LIMIT);
        if (onProgress) onProgress(`Hydrating ${Math.min(i + CONCURRENCY_LIMIT, list.length)}/${list.length} records...`);
        
        const results: (ReturnGoRMA | null)[] = [];
        for (let j = 0; j < chunk.length; j++) {
            const rma = chunk[j];
            try {
                if (j > 0) await new Promise(resolve => setTimeout(resolve, 100)); // Stagger requests slightly within chunk
                const detail = await fetchRmaDetail(shopName, rma.rmaId);
                if (!detail) {
                    results.push(null);
                    continue;
                }

                const enrichedRma: ReturnGoRMA = { ...rma, ...detail };

                // Enrich customer name and order name
                enrichedRma.customerName = detail.customer?.name || null;
                enrichedRma.orderName = detail.orderName || detail.order_name || null;

                // Enrich tracking number
                if (detail.shipments && detail.shipments.length > 0) {
                    enrichedRma.trackingNumber = detail.shipments[0].trackingNumber || null;
                }

                // Enrich resolution type overall
                if (detail.items && detail.items.length > 0) {
                    const uniqueResolutionTypes = new Set(detail.items.map((item: any) => item.resolutionType));
                    enrichedRma.resolutionTypeOverall = uniqueResolutionTypes.size === 1 ? Array.from(uniqueResolutionTypes)[0] as string : "Mixed";
                } else {
                    enrichedRma.resolutionTypeOverall = "N/A";
                }

                // Determine resolution actioned status and date
                let resolutionActioned = false;
                let latestActionDate: Date | null = null;

                if (detail.transactions) {
                    detail.transactions.forEach((tx: any) => {
                        if (tx.status === 'Success' && (tx.type === 'Refund Paid' || tx.type === 'Store Credit')) {
                            resolutionActioned = true;
                            const txDate = parseISO(normalizeDate(tx.createdAt) || '');
                            if (isValid(txDate) && (!latestActionDate || txDate > latestActionDate)) {
                                latestActionDate = txDate;
                            }
                        }
                    });
                }

                if (detail.exchangeOrders && detail.exchangeOrders.length > 0) {
                    resolutionActioned = true;
                    detail.exchangeOrders.forEach((ex: any) => {
                        const exDate = parseISO(normalizeDate(ex.createdAt) || '');
                        if (isValid(exDate) && (!latestActionDate || exDate > latestActionDate)) {
                            latestActionDate = exDate;
                        }
                    });
                }
                enrichedRma.resolutionActioned = resolutionActioned;
                enrichedRma.resolutionActionedDate = latestActionDate ? latestActionDate.toISOString() : null;

                // Calculate days since resolution actioned
                if (enrichedRma.resolutionActioned && enrichedRma.resolutionActionedDate) {
                    enrichedRma.daysSinceResolutionActioned = differenceInDays(new Date(), parseISO(enrichedRma.resolutionActionedDate));
                } else {
                    enrichedRma.daysSinceResolutionActioned = null;
                }
                
                results.push(enrichedRma); 
            } catch (e) {
                console.error(`Failed to fetch/enrich RMA ${rma.rmaId}:`, e);
                results.push({ ...rma, customerName: null, orderName: null, trackingNumber: null, resolutionTypeOverall: "N/A", resolutionActioned: false, resolutionActionedDate: null, daysSinceResolutionActioned: null }); // Fallback to list object with defaults
            }
        }
        
        detailedRmas.push(...results.filter(Boolean) as ReturnGoRMA[]);
        await delay(150); // Rate limit protection
    }
    return detailedRmas;
};

const getApprovedDate = (r: ReturnGoRMA): string | null => {
    if (r.rmaSummary?.events) {
        const approvedEvent = r.rmaSummary.events.find((e: any) => e.status === 'Approved' || e.action === 'Approved');
        if (approvedEvent && approvedEvent.eventDate) {
            return normalizeDate(approvedEvent.eventDate);
        }
    }
    if (['Approved', 'ToShip', 'InTransit', 'Received', 'Done'].includes(r.status)) {
        return normalizeDate(r.lastUpdated || r.updatedAt || r.rma_updated_at);
    }
    return null;
};

const getReceivedDate = (r: ReturnGoRMA): string | null => {
    if (r.rmaSummary?.events) {
        const receivedEvent = r.rmaSummary.events.find((e: any) => e.status === 'Received' || e.action === 'Received');
        if (receivedEvent && receivedEvent.eventDate) {
            return normalizeDate(receivedEvent.eventDate);
        }
    }
    if (['Received', 'Done'].includes(r.status)) {
        return normalizeDate(r.lastUpdated || r.updatedAt || r.rma_updated_at);
    }
    return null;
};

/**
 * Aggregates high-level metrics and returns categorised RMA lists
 */
export const aggregateDashboardMetrics = async (
    shopName: string, 
    onProgress: (msg: string) => void
): Promise<FullReturnGoDashboardData> => {
    
    // 1. Fetch Active RMAs (Pending, Approved, Received)
    onProgress("Fetching Active Queue...");
    const statuses = ["Pending", "Approved", "Received"];
    let activeRmasList: any[] = [];
    for (const status of statuses) {
        const rmas = await fetchRmaList(shopName, status, 100);
        activeRmasList.push(...rmas);
        onProgress(`Fetching Active Queue: ${activeRmasList.length} RMAs found...`);
    }
    
    // 2. Fetch Completed RMAs (Last 7 Days)
    onProgress("Fetching Recent Completions...");
    const sevenDaysAgoDate = subDays(new Date(), 7);
    const sevenDaysAgoStr = format(sevenDaysAgoDate, "yyyy-MM-dd'T'00:00:00");
    const completedRmasList = await fetchRmaList(shopName, COMPLETED_STATUSES, 100, sevenDaysAgoStr);
    onProgress(`Fetched ${completedRmasList.length} Recent Completions.`);

    // 2b. Fetch Previous 7 Days for PoP Comparison
    onProgress("Fetching Historical Data for PoP...");
    const fourteenDaysAgoDate = subDays(new Date(), 14);
    const fourteenDaysAgoStr = format(fourteenDaysAgoDate, "yyyy-MM-dd'T'00:00:00");
    const previousCompletedRmasListRaw = await fetchRmaList(shopName, COMPLETED_STATUSES, 100, fourteenDaysAgoStr);
    const previousCompletedRmasList = previousCompletedRmasListRaw.filter(rma => {
        const updatedDate = parseISO(normalizeDate(rma.updatedAt || rma.rma_updated_at) || new Date().toISOString());
        return updatedDate < sevenDaysAgoDate;
    });
    onProgress(`Fetched ${previousCompletedRmasList.length} Historical RMAs.`);

    // 3. Hydrate Active RMAs
    onProgress(`Hydrating ${activeRmasList.length} Active RMAs...`);
    const activeRmas = await fetchDetailsForList(activeRmasList, shopName, onProgress);

    // 4. Hydrate Completed RMAs (to get accurate lastUpdated date)
    if (completedRmasList.length > 0) {
        onProgress(`Hydrating ${completedRmasList.length} Completed RMAs...`);
    }
    const completedRmas = await fetchDetailsForList(completedRmasList, shopName, onProgress);
    
    // 4b. Hydrate Previous Completed RMAs for financial PoP
    let previousCompletedRmas: ReturnGoRMA[] = [];
    if (previousCompletedRmasList.length > 0) {
        onProgress(`Hydrating ${previousCompletedRmasList.length} Historical RMAs...`);
        previousCompletedRmas = await fetchDetailsForList(previousCompletedRmasList, shopName, onProgress);
    }
    
    const statusCounts: any = { Pending: 0, ToShip: 0, InTransit: 0, Received: 0, Attention: 0, Done7d: 0 };
    const reasonCounts: Record<string, number> = {};
    const resolutionCounts: Record<string, number> = {};
    const policyCounts: Record<string, number> = {};
    const activeDateMap: Record<string, number> = {};
    const completedDateMap: Record<string, number> = {}; 
    const approvedDateMap: Record<string, number> = {}; 
    const receivedDateMap: Record<string, number> = {};
    
    // Advanced Metrics
    let revenueRetained = 0;
    let revenueLost = 0;
    let totalTTRDays = 0;
    let ttrCount = 0;
    let agingReturnsCount = 0;
    
    let previousRevenueRetained = 0;
    
    const retainedRmas: ReturnGoRMA[] = [];
    const lostRmas: ReturnGoRMA[] = [];
    const agingRmas: ReturnGoRMA[] = [];
    
    // Categorised RMA lists
    const rmaLists: FullReturnGoDashboardData['rmaLists'] = {
        Pending: [],
        ToShip: [],
        InTransit: [],
        Received: [],
        Attention: [],
        allActiveRmas: activeRmas,
        allCompletedRmas: completedRmas
    };

    // Product Map: SKU -> Stats
    const productMap: Record<string, ProductStats> = {};

    let totalValue = 0;
    let valueCount = 0;

    // Helper to get product map entry
    const getProductEntry = (sku: string, name: string) => {
        const key = sku || name || "Unknown";
        if (!productMap[key]) {
            productMap[key] = { name: name || "Unknown Product", sku: sku || "", activeCount: 0, doneCount: 0, totalValue: 0, activeRmas: [] };
        }
        return productMap[key];
    };

    // Process Active
    activeRmas.forEach(r => {
        const rawStatus = r.rmaSummary ? r.rmaSummary.status : r.status;
        
        // Status Bucket Logic
        let bucket = 'Other';
        if (rawStatus === 'Pending') {
            bucket = 'Pending';
            rmaLists.Pending.push(r);
        }
        else if (rawStatus === 'Received' || rawStatus === 'Validated') {
            bucket = 'Received';
            rmaLists.Received.push(r);
        }
        else if (rawStatus === 'Approved') {
            const hasTracking = r.shipments && r.shipments.length > 0 && r.shipments.some((s:any) => s.trackingNumber);
            bucket = hasTracking ? 'InTransit' : 'ToShip';
            if (hasTracking) {
                rmaLists.InTransit.push(r);
            } else {
                rmaLists.ToShip.push(r);
            }
        }

        if (statusCounts[bucket] !== undefined) statusCounts[bucket]++;

        // Attention Logic
        let needsAttention = false;
        if (r.isFlagged) needsAttention = true;
        if (r.transactions && r.transactions.some((t:any) => t.status === 'Failed' || t.status === 'Error')) needsAttention = true;
        if (needsAttention) {
            statusCounts['Attention']++;
            rmaLists.Attention.push(r);
        }

        // Financials & Products
        if (r.items) {
            r.items.forEach((item: any) => {
                const reason = item.returnReason || "Other";
                reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
                const res = item.resolutionType || "Unknown";
                resolutionCounts[res] = (resolutionCounts[res] || 0) + 1;
                
                const policy = item.policyRuleName || "Default Policy";
                policyCounts[policy] = (policyCounts[policy] || 0) + 1;
                
                const itemVal = item.paidPrice?.amount || 0;
                if (itemVal) {
                    totalValue += itemVal;
                    valueCount++;
                }

                const entry = getProductEntry(item.sku, item.productName);
                entry.activeCount++;
                entry.totalValue += itemVal;
                
                // Add Drill Down Info
                entry.activeRmas.push({
                    id: r.rmaId,
                    reason: reason,
                    resolution: res,
                    status: bucket
                });
            });
        }

        // Active Graph: Plot based on Creation Date
        // Fix: Use r.createdAt if rma_created_at is not available, as r.createdAt is guaranteed by ReturnGoRMA
        const createdDate = normalizeDate(r.createdAt || r.rmaSummary?.events?.[0]?.eventDate || r.rma_created_at) || new Date().toISOString();
        if (createdDate) {
            // Safe robust parsing
            try {
                // If T exists, split. If not, assumpt YYYY-MM-DD
                const dateKey = createdDate.includes('T') ? createdDate.split('T')[0] : createdDate.substring(0, 10);
                // Validate if it's a real date before adding
                if (parseISO(dateKey).toString() !== 'Invalid Date') {
                    activeDateMap[dateKey] = (activeDateMap[dateKey] || 0) + 1;
                }
                
                // Calculate Aging Returns (> 14 days old and still open)
                const parsedDate = parseISO(createdDate);
                if (isValid(parsedDate) && differenceInDays(new Date(), parsedDate) > 14 && rawStatus === 'Pending') {
                    agingReturnsCount++;
                    agingRmas.push(r);
                }
            } catch (e) {
                // Ignore invalid dates
            }
        }

        const approvedDate = getApprovedDate(r);
        if (approvedDate) {
            try {
                const aKey = approvedDate.includes('T') ? approvedDate.split('T')[0] : approvedDate.substring(0, 10);
                if (parseISO(aKey).toString() !== 'Invalid Date') {
                    approvedDateMap[aKey] = (approvedDateMap[aKey] || 0) + 1;
                }
            } catch (e) {}
        }

        const receivedDate = getReceivedDate(r);
        if (receivedDate) {
            try {
                const rKey = receivedDate.includes('T') ? receivedDate.split('T')[0] : receivedDate.substring(0, 10);
                if (parseISO(rKey).toString() !== 'Invalid Date') {
                    receivedDateMap[rKey] = (receivedDateMap[rKey] || 0) + 1;
                }
            } catch (e) {}
        }
    });

    // Process Completed (Trend 7 Days)
    statusCounts.Done7d = completedRmas.length;
    
    // Use hydrated completedRmas to get accurate date
    completedRmas.forEach(r => {
        // 1. For Completed Trend (when it was finished)
        // Prioritize lastUpdated from detailed object, then updatedAt, then rma_updated_at
        const dateStr = normalizeDate(r.lastUpdated || r.updatedAt || r.rma_updated_at) || new Date().toISOString();
        const dateKey = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.substring(0, 10);
        completedDateMap[dateKey] = (completedDateMap[dateKey] || 0) + 1;

        const approvedDate = getApprovedDate(r);
        if (approvedDate) {
            try {
                const aKey = approvedDate.includes('T') ? approvedDate.split('T')[0] : approvedDate.substring(0, 10);
                if (parseISO(aKey).toString() !== 'Invalid Date') {
                    approvedDateMap[aKey] = (approvedDateMap[aKey] || 0) + 1;
                }
            } catch (e) {}
        }

        const receivedDate = getReceivedDate(r);
        if (receivedDate) {
            try {
                const rKey = receivedDate.includes('T') ? receivedDate.split('T')[0] : receivedDate.substring(0, 10);
                if (parseISO(rKey).toString() !== 'Invalid Date') {
                    receivedDateMap[rKey] = (receivedDateMap[rKey] || 0) + 1;
                }
            } catch (e) {}
        }

        // 2. For Returns Requested Trend (when it was created)
        // We must include completed RMAs in the "Returns Requested" chart to show total volume
        const createdDate = normalizeDate(r.createdAt || r.rmaSummary?.events?.[0]?.eventDate || r.rma_created_at) || new Date().toISOString();
        if (createdDate) {
            const cKey = createdDate.includes('T') ? createdDate.split('T')[0] : createdDate.substring(0, 10);
            if (parseISO(cKey).toString() !== 'Invalid Date') {
                activeDateMap[cKey] = (activeDateMap[cKey] || 0) + 1;
            }
            
            // Calculate TTR (Time to Resolution)
            const cDate = parseISO(createdDate);
            const uDate = parseISO(dateStr);
            if (isValid(cDate) && isValid(uDate)) {
                totalTTRDays += Math.max(0, differenceInDays(uDate, cDate));
                ttrCount++;
            }
        }
        
        // Also process products for completed RMAs
        if (r.items) {
            let isRetained = false;
            let isLost = false;
            r.items.forEach((item: any) => {
                const entry = getProductEntry(item.sku, item.productName);
                entry.doneCount++;
                
                const reason = item.returnReason || "Other";
                reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
                resolutionCounts[item.resolutionType || "Unknown"] = (resolutionCounts[item.resolutionType || "Unknown"] || 0) + 1;
                
                const policy = item.policyRuleName || "Default Policy";
                policyCounts[policy] = (policyCounts[policy] || 0) + 1;

                // Calculate Revenue Retained vs Lost
                const itemVal = item.paidPrice?.amount || 0;
                const res = item.resolutionType || "Unknown";
                if (res.toLowerCase().includes('refund')) {
                    revenueLost += itemVal;
                    isLost = true;
                } else if (res.toLowerCase().includes('exchange') || res.toLowerCase().includes('store credit') || res.toLowerCase().includes('gift card')) {
                    revenueRetained += itemVal;
                    isRetained = true;
                }
            });
            if (isRetained && !retainedRmas.find(rma => rma.rmaId === r.rmaId)) retainedRmas.push(r);
            if (isLost && !lostRmas.find(rma => rma.rmaId === r.rmaId)) lostRmas.push(r);
        }
    });

    // Process Previous Completed RMAs for PoP
    previousCompletedRmas.forEach(r => {
        if (r.items) {
            r.items.forEach((item: any) => {
                const itemVal = item.paidPrice?.amount || 0;
                const res = item.resolutionType || "Unknown";
                if (res.toLowerCase().includes('exchange') || res.toLowerCase().includes('store credit') || res.toLowerCase().includes('gift card')) {
                    previousRevenueRetained += itemVal;
                }
            });
        }
    });

    // Calculate PoP Metrics
    const popReturnVolume = previousCompletedRmas.length > 0 
        ? ((completedRmas.length - previousCompletedRmas.length) / previousCompletedRmas.length) * 100 
        : 0;
        
    const popRevenueRetained = previousRevenueRetained > 0 
        ? ((revenueRetained - previousRevenueRetained) / previousRevenueRetained) * 100 
        : 0;


    // Graph Data Prep
    const activeTrend = Object.entries(activeDateMap)
        .sort((a,b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([date, count]) => {
            try {
                return { date: format(parseISO(date), 'dd MMM'), count };
            } catch (e) {
                return { date: date, count }; // Fallback
            }
        });

    const completedTrend = Object.entries(completedDateMap)
        .sort((a,b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([date, count]) => {
            try {
                return { date: format(parseISO(date), 'dd MMM'), count };
            } catch (e) {
                return { date: date, count }; // Fallback
            }
        });

    const approvedTrend = Object.entries(approvedDateMap)
        .sort((a,b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([date, count]) => {
            try {
                return { date: format(parseISO(date), 'dd MMM'), count };
            } catch (e) {
                return { date: date, count }; // Fallback
            }
        });

    const receivedTrend = Object.entries(receivedDateMap)
        .sort((a,b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([date, count]) => {
            try {
                return { date: format(parseISO(date), 'dd MMM'), count };
            } catch (e) {
                return { date: date, count }; // Fallback
            }
        });

    const topProducts = Object.values(productMap)
        .sort((a,b) => b.activeCount - a.activeCount)
        .slice(0, 20); 

    return {
        metrics: {
            totalOpen: activeRmas.length,
            pending: statusCounts.Pending,
            inTransit: statusCounts.InTransit,
            received: statusCounts.Received,
            issues: rmaLists.Attention.length, // use length of Attention RMA list
            flagged: rmaLists.Attention.filter(r => r.isFlagged).length,
            submitted: activeRmas.length, // Assuming all active are 'submitted'
            delivered: rmaLists.Received.length,
            courierCancelled: activeRmas.filter(r => r.isCourierCancelled).length,
            noTracking: activeRmas.filter(r => !r.trackingNumber).length,
            resolutionActioned: activeRmas.filter(r => r.resolutionActioned).length,
            noResolutionActioned: activeRmas.filter(r => !r.resolutionActioned).length,
            timelineData: activeTrend, // Map to timelineData
            // Additional fields from original ReturnGoMetrics
            totalReturns: activeRmas.length,
            statusBreakdown: statusCounts,
            resolutionTypes: resolutionCounts,
            returnReasons: reasonCounts,
            policyRules: policyCounts,
            dailyTrend: activeTrend,
            completedTrend,
            approvedTrend,
            receivedTrend,
            avgReturnValue: valueCount > 0 ? totalValue / valueCount : 0,
            sampleSize: valueCount,
            completedSampleSize: completedRmas.length,
            topProducts: topProducts,
            revenueRetained,
            revenueLost,
            averageTTR: ttrCount > 0 ? totalTTRDays / ttrCount : 0,
            agingReturnsCount,
            popReturnVolume,
            popRevenueRetained
        },
        rmaLists: {
            ...rmaLists,
            Retained: retainedRmas,
            Lost: lostRmas,
            Aging: agingRmas
        }
    };
};

/**
 * Fetch and process the entire Bounty Apparel ecosystem
 */
export const fetchBountyApparelData = async (onProgress: (msg: string) => void): Promise<BountyDashboardData> => {
    
    const byStore: Record<string, BountyMetricData> = {};
    const globalReasonCounts: Record<string, number> = {};
    
    const masterStoreActiveMap: Record<string, Record<string, number>> = {};
    const masterStoreCompletedMap: Record<string, Record<string, number>> = {};
    const masterStoreApprovedMap: Record<string, Record<string, number>> = {};
    const masterStoreReceivedMap: Record<string, Record<string, number>> = {};
    const globalActiveDateMap: Record<string, number> = {};
    const globalCompletedDateMap: Record<string, number> = {};
    const globalApprovedDateMap: Record<string, number> = {};
    const globalReceivedDateMap: Record<string, number> = {};
    
    const consolidatedStatus: any = { Pending: 0, ToShip: 0, InTransit: 0, Received: 0, Attention: 0, Done7d: 0 };
    const sevenDaysAgoDate = subDays(new Date(), 7);
    const sevenDaysAgoStr = format(sevenDaysAgoDate, "yyyy-MM-dd'T'00:00:00");
    const fourteenDaysAgoDate = subDays(new Date(), 14);
    const fourteenDaysAgoStr = format(fourteenDaysAgoDate, "yyyy-MM-dd'T'00:00:00");

    let globalRevenueRetained = 0;
    let globalRevenueLost = 0;
    let globalTotalTTRDays = 0;
    let globalTTRCount = 0;
    let globalAgingReturnsCount = 0;
    let globalPreviousRevenueRetained = 0;
    let globalPreviousCompletedCount = 0;
    
    const globalResolutionCounts: { [key: string]: number } = {};
    const globalPolicyCounts: { [key: string]: number } = {};
    const globalProductCounts: { [key: string]: { count: number, value: number, sku: string, activeRmas: any[], doneCount?: number } } = {};
    
    const globalRetainedRmas: ReturnGoRMA[] = [];
    const globalLostRmas: ReturnGoRMA[] = [];
    const globalPendingRmas: ReturnGoRMA[] = [];
    const globalToShipRmas: ReturnGoRMA[] = [];
    const globalInTransitRmas: ReturnGoRMA[] = [];
    const globalReceivedRmas: ReturnGoRMA[] = [];
    const globalAttentionRmas: ReturnGoRMA[] = [];
    const globalAgingRmas: ReturnGoRMA[] = [];
    const globalAllActiveRmas: ReturnGoRMA[] = [];
    const globalAllCompletedRmas: ReturnGoRMA[] = [];

    for (const store of BOUNTY_STORES) {
        onProgress(`Processing ${store.name}...`);
        await delay(500); // Add a small delay between stores
        
        const statuses = ["Pending", "Approved", "Received"];
        let activeRmasList: any[] = [];
        for (const status of statuses) {
            activeRmasList.push(...(await fetchRmaList(store.url, status, 100)));
        }
        const completedRmasList = await fetchRmaList(store.url, COMPLETED_STATUSES, 100, sevenDaysAgoStr);
        const previousCompletedRmasListRaw = await fetchRmaList(store.url, COMPLETED_STATUSES, 100, fourteenDaysAgoStr);
        const previousCompletedRmasList = previousCompletedRmasListRaw.filter(rma => {
            const updatedDate = parseISO(normalizeDate(rma.updatedAt || rma.rma_updated_at) || new Date().toISOString());
            return updatedDate < sevenDaysAgoDate;
        });

        const limitedList = activeRmasList.slice(0, 30);
        const activeRmas = await fetchDetailsForList(limitedList, store.url);
        // Hydrate completed RMAs for accurate date
        const completedRmas = await fetchDetailsForList(completedRmasList, store.url);
        const previousCompletedRmas = await fetchDetailsForList(previousCompletedRmasList, store.url);

        globalAllActiveRmas.push(...activeRmas);
        globalAllCompletedRmas.push(...completedRmas);

        const storeStatus: any = { Pending: 0, ToShip: 0, InTransit: 0, Received: 0, Attention: 0, Done7d: 0 };
        const storeActiveDateMap: Record<string, number> = {};
        const storeCompletedDateMap: Record<string, number> = {};
        const storeApprovedDateMap: Record<string, number> = {};
        const storeReceivedDateMap: Record<string, number> = {};
        const reasonCounts: Record<string, number> = {};
        const resolutionCounts: Record<string, number> = {};
        const policyCounts: Record<string, number> = {};
        const storeProductCounts: Record<string, { count: number; value: number; sku: string; activeRmas: any[]; doneCount?: number }> = {};
        
        let storeRevenueRetained = 0;
        let storeRevenueLost = 0;
        let storeTotalTTRDays = 0;
        let storeTTRCount = 0;
        let storeAgingReturnsCount = 0;
        let storePreviousRevenueRetained = 0;

        // RMA lists for this store
        const storeRmaLists: BountyMetricData = {
            activeReturns: 0, pending: 0, approved: 0, received: 0, breakdown: [], dailyTrend: [],
            Pending: 0, ToShip: 0, InTransit: 0, Received: 0, Attention: 0, Done7d: 0,
            revenueRetained: 0, revenueLost: 0, averageTTR: 0, agingReturnsCount: 0, popReturnVolume: 0, popRevenueRetained: 0,
            pendingRmas: [], toShipRmas: [], inTransitRmas: [], receivedRmas: [], attentionRmas: [], retainedRmas: [], lostRmas: [],
            allActiveRmas: activeRmas, allCompletedRmas: completedRmas
        };


        eachDayOfInterval({ start: sevenDaysAgoDate, end: new Date() }).forEach(d => {
             storeCompletedDateMap[format(d, 'yyyy-MM-dd')] = 0;
        });

        activeRmas.forEach(r => {
             const rawStatus = r.rmaSummary ? r.rmaSummary.status : r.status;
             let bucket = 'Other';
             if (rawStatus === 'Pending') {
                bucket = 'Pending';
                storeStatus.Pending++;
                storeRmaLists.pendingRmas?.push(r);
                globalPendingRmas.push(r);
             }
             else if (rawStatus === 'Received' || rawStatus === 'Validated') {
                bucket = 'Received';
                storeStatus.Received++;
                storeRmaLists.receivedRmas?.push(r);
                globalReceivedRmas.push(r);
             }
             else if (rawStatus === 'Approved') {
                 const hasTracking = r.shipments && r.shipments.length > 0 && r.shipments.some((s:any) => s.trackingNumber);
                 bucket = hasTracking ? 'InTransit' : 'ToShip';
                 if (hasTracking) {
                    storeStatus.InTransit++;
                    storeRmaLists.inTransitRmas?.push(r);
                    globalInTransitRmas.push(r);
                 } else {
                    storeStatus.ToShip++;
                    storeRmaLists.toShipRmas?.push(r);
                    globalToShipRmas.push(r);
                 }
             }
             
             consolidatedStatus[bucket]++;

             if (r.isFlagged || (r.transactions && r.transactions.some((t:any) => t.status === 'Failed'))) {
                 storeStatus.Attention++;
                 storeRmaLists.attentionRmas?.push(r);
                 globalAttentionRmas.push(r);
                 consolidatedStatus.Attention++;
             }

             if (r.items) {
                 r.items.forEach((item: any) => {
                     const reason = item.returnReason || "Other";
                     reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
                     globalReasonCounts[reason] = (globalReasonCounts[reason] || 0) + 1;
                     
                     const res = item.resolutionType || "Unknown";
                     resolutionCounts[res] = (resolutionCounts[res] || 0) + 1;
                     globalResolutionCounts[res] = (globalResolutionCounts[res] || 0) + 1;
                     
                     const policy = item.policyRuleName || "Default Policy";
                     policyCounts[policy] = (policyCounts[policy] || 0) + 1;
                     globalPolicyCounts[policy] = (globalPolicyCounts[policy] || 0) + 1;
                     
                     const pName = item.productName || "Unknown Item";
                     const itemSku = item.sku || "Unknown SKU";
                     const itemVal = item.paidPrice?.amount || 0;
                     
                     if (!storeProductCounts[pName]) {
                         storeProductCounts[pName] = { count: 0, value: 0, sku: itemSku, activeRmas: [] };
                     }
                     storeProductCounts[pName].count++;
                     storeProductCounts[pName].value += itemVal;
                     if (storeProductCounts[pName].activeRmas.length < 10) {
                         storeProductCounts[pName].activeRmas.push({
                             id: r.rmaId,
                             reason: item.returnReason || "Other",
                             resolution: item.resolutionType || "Unknown",
                             status: rawStatus
                         });
                     }

                     if (!globalProductCounts[pName]) {
                         globalProductCounts[pName] = { 
                             count: 0, 
                             value: 0, 
                             sku: itemSku,
                             activeRmas: [] 
                         };
                     }
                     globalProductCounts[pName].count++;
                     globalProductCounts[pName].value += itemVal;
                     
                     // Add to activeRmas drill-down
                     if (globalProductCounts[pName].activeRmas.length < 10) {
                         globalProductCounts[pName].activeRmas.push({
                             id: r.rmaId,
                             reason: item.returnReason || "Other",
                             resolution: item.resolutionType || "Unknown",
                             status: rawStatus
                         });
                     }
                 });
             }

             // Fix: Use r.createdAt if rma_created_at is not available
             const createdDate = normalizeDate(r.createdAt || r.rmaSummary?.events?.[0]?.eventDate || r.rma_created_at) || new Date().toISOString();
             if (createdDate) {
                 const dKey = createdDate.includes('T') ? createdDate.split('T')[0] : createdDate.substring(0, 10);
                 if (parseISO(dKey).toString() !== 'Invalid Date') {
                    storeActiveDateMap[dKey] = (storeActiveDateMap[dKey] || 0) + 1;
                    globalActiveDateMap[dKey] = (globalActiveDateMap[dKey] || 0) + 1;
                 }
                 
                 // Calculate Aging Returns
                 const parsedDate = parseISO(createdDate);
                 if (isValid(parsedDate) && differenceInDays(new Date(), parsedDate) > 14 && rawStatus === 'Pending') {
                     storeAgingReturnsCount++;
                     globalAgingReturnsCount++;
                     
                     if (!storeRmaLists.agingRmas) storeRmaLists.agingRmas = [];
                     storeRmaLists.agingRmas.push(r);
                     globalAgingRmas.push(r);
                 }
             }

             const approvedDate = getApprovedDate(r);
             if (approvedDate) {
                 try {
                     const aKey = approvedDate.includes('T') ? approvedDate.split('T')[0] : approvedDate.substring(0, 10);
                     if (parseISO(aKey).toString() !== 'Invalid Date') {
                         storeApprovedDateMap[aKey] = (storeApprovedDateMap[aKey] || 0) + 1;
                         globalApprovedDateMap[aKey] = (globalApprovedDateMap[aKey] || 0) + 1;
                     }
                 } catch (e) {}
             }
        });

        storeStatus.Done7d = completedRmas.length;
        consolidatedStatus.Done7d += completedRmas.length;
        
        completedRmas.forEach(r => {
             // 1. For Completed Trend (when it was finished)
             const dateStr = normalizeDate(r.lastUpdated || r.updatedAt || r.rma_updated_at) || new Date().toISOString();
             const dKey = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.substring(0, 10);
             storeCompletedDateMap[dKey] = (storeCompletedDateMap[dKey] || 0) + 1;
             globalCompletedDateMap[dKey] = (globalCompletedDateMap[dKey] || 0) + 1;

             const approvedDate = getApprovedDate(r);
             if (approvedDate) {
                 try {
                     const aKey = approvedDate.includes('T') ? approvedDate.split('T')[0] : approvedDate.substring(0, 10);
                     if (parseISO(aKey).toString() !== 'Invalid Date') {
                         storeApprovedDateMap[aKey] = (storeApprovedDateMap[aKey] || 0) + 1;
                         globalApprovedDateMap[aKey] = (globalApprovedDateMap[aKey] || 0) + 1;
                     }
                 } catch (e) {}
             }

             // 2. For Returns Requested Trend (when it was created)
             // Include completed RMAs in the creation trend
             const createdDate = normalizeDate(r.createdAt || r.rmaSummary?.events?.[0]?.eventDate || r.rma_created_at) || new Date().toISOString();
             if (createdDate) {
                 const cKey = createdDate.includes('T') ? createdDate.split('T')[0] : createdDate.substring(0, 10);
                 if (parseISO(cKey).toString() !== 'Invalid Date') {
                    storeActiveDateMap[cKey] = (storeActiveDateMap[cKey] || 0) + 1;
                    globalActiveDateMap[cKey] = (globalActiveDateMap[cKey] || 0) + 1;
                 }
                 
                 // Calculate TTR
                 const cDate = parseISO(createdDate);
                 const uDate = parseISO(dateStr);
                 if (isValid(cDate) && isValid(uDate)) {
                     const ttr = Math.max(0, differenceInDays(uDate, cDate));
                     storeTotalTTRDays += ttr;
                     storeTTRCount++;
                     globalTotalTTRDays += ttr;
                     globalTTRCount++;
                 }
             }
             
             // Calculate Revenue and Reasons
             if (r.items) {
                 let isRetained = false;
                 let isLost = false;
                 r.items.forEach((item: any) => {
                     const reason = item.returnReason || "Other";
                     reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
                     globalReasonCounts[reason] = (globalReasonCounts[reason] || 0) + 1;
                     
                     const res = item.resolutionType || "Unknown";
                     resolutionCounts[res] = (resolutionCounts[res] || 0) + 1;
                     globalResolutionCounts[res] = (globalResolutionCounts[res] || 0) + 1;
                     
                     const policy = item.policyRuleName || "Default Policy";
                     policyCounts[policy] = (policyCounts[policy] || 0) + 1;
                     globalPolicyCounts[policy] = (globalPolicyCounts[policy] || 0) + 1;

                     const pName = item.productName || "Unknown Item";
                     const itemSku = item.sku || "Unknown SKU";
                     
                     if (!storeProductCounts[pName]) {
                         storeProductCounts[pName] = { count: 0, value: 0, sku: itemSku, activeRmas: [] };
                     }
                     // For completed RMAs, we don't increment count (which is activeCount)
                     // But we might want a doneCount for storeProductCounts too
                     // For now, let's just keep it consistent with global
                     
                     if (!globalProductCounts[pName]) {
                         globalProductCounts[pName] = { 
                             count: 0, 
                             value: 0, 
                             sku: itemSku,
                             activeRmas: [],
                             doneCount: 0
                         };
                     }
                     globalProductCounts[pName].doneCount = (globalProductCounts[pName].doneCount || 0) + 1;

                     const itemVal = item.paidPrice?.amount || 0;
                     if (res.toLowerCase().includes('refund')) {
                         storeRevenueLost += itemVal;
                         globalRevenueLost += itemVal;
                         isLost = true;
                     } else if (res.toLowerCase().includes('exchange') || res.toLowerCase().includes('store credit') || res.toLowerCase().includes('gift card')) {
                         storeRevenueRetained += itemVal;
                         globalRevenueRetained += itemVal;
                         isRetained = true;
                     }
                 });
                 if (isRetained && !storeRmaLists.retainedRmas?.find(rma => rma.rmaId === r.rmaId)) {
                     storeRmaLists.retainedRmas?.push(r);
                     if (!globalRetainedRmas.find(rma => rma.rmaId === r.rmaId)) globalRetainedRmas.push(r);
                 }
                 if (isLost && !storeRmaLists.lostRmas?.find(rma => rma.rmaId === r.rmaId)) {
                     storeRmaLists.lostRmas?.push(r);
                     if (!globalLostRmas.find(rma => rma.rmaId === r.rmaId)) globalLostRmas.push(r);
                 }
             }
        });

        // Process Previous Completed RMAs for PoP
        globalPreviousCompletedCount += previousCompletedRmas.length;
        previousCompletedRmas.forEach(r => {
            if (r.items) {
                r.items.forEach((item: any) => {
                    const itemVal = item.paidPrice?.amount || 0;
                    const res = item.resolutionType || "Unknown";
                    if (res.toLowerCase().includes('exchange') || res.toLowerCase().includes('store credit') || res.toLowerCase().includes('gift card')) {
                        storePreviousRevenueRetained += itemVal;
                        globalPreviousRevenueRetained += itemVal;
                    }
                });
            }
        });

        // Calculate Store PoP Metrics
        const storePopReturnVolume = previousCompletedRmas.length > 0 
            ? ((completedRmas.length - previousCompletedRmas.length) / previousCompletedRmas.length) * 100 
            : 0;
            
        const storePopRevenueRetained = storePreviousRevenueRetained > 0 
            ? ((storeRevenueRetained - storePreviousRevenueRetained) / storePreviousRevenueRetained) * 100 
            : 0;

        masterStoreActiveMap[store.name] = storeActiveDateMap;
        masterStoreCompletedMap[store.name] = storeCompletedDateMap;
        masterStoreApprovedMap[store.name] = storeApprovedDateMap;
        masterStoreReceivedMap[store.name] = storeReceivedDateMap;

        byStore[store.name] = {
            activeReturns: activeRmas.length,
            pending: storeStatus.Pending,
            approved: storeStatus.ToShip + storeStatus.InTransit, 
            received: storeStatus.Received,
            breakdown: [], 
            dailyTrend: [], 
            ...storeStatus,
            returnReasons: reasonCounts,
            resolutionTypes: resolutionCounts,
            policyRules: policyCounts,
            topProducts: Object.entries(storeProductCounts)
                .sort((a,b) => b[1].count - a[1].count)
                .slice(0, 20)
                .map(([name, data]) => ({ 
                    name, 
                    sku: data.sku,
                    activeCount: data.count, 
                    doneCount: 0,
                    totalValue: data.value,
                    activeRmas: data.activeRmas
                })),
            revenueRetained: storeRevenueRetained,
            revenueLost: storeRevenueLost,
            averageTTR: storeTTRCount > 0 ? storeTotalTTRDays / storeTTRCount : 0,
            agingReturnsCount: storeAgingReturnsCount,
            popReturnVolume: storePopReturnVolume,
            popRevenueRetained: storePopRevenueRetained,
            ...storeRmaLists // Merge the RMA lists into the store's metric data
        } as any;
    }

    // Alignment logic 
    const allDateKeys = new Set([
        ...Object.keys(globalActiveDateMap),
        ...Object.keys(globalCompletedDateMap),
        ...Object.keys(globalApprovedDateMap),
        ...Object.keys(globalReceivedDateMap)
    ]);
    const sortedAllDates = Array.from(allDateKeys).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

    const alignedAggregatedActiveTrend = sortedAllDates.map(date => ({
        date: format(parseISO(date), 'dd MMM'),
        count: globalActiveDateMap[date] || 0
    }));

    const alignedStoreActiveTrends: Record<string, any[]> = {};
    BOUNTY_STORES.forEach(s => {
        alignedStoreActiveTrends[s.name] = sortedAllDates.map(date => ({
            date: format(parseISO(date), 'dd MMM'),
            count: masterStoreActiveMap[s.name][date] || 0
        }));
        byStore[s.name].dailyTrend = sortedAllDates.map(date => ({
            date: format(parseISO(date), 'dd MMM'),
            count: masterStoreActiveMap[s.name][date] || 0
        }));
    });

    const alignedAggregatedCompletedTrend = sortedAllDates.map(dateKey => ({
        date: format(parseISO(dateKey), 'dd MMM'),
        count: globalCompletedDateMap[dateKey] || 0
    }));

    const alignedStoreCompletedTrends: Record<string, any[]> = {};
    BOUNTY_STORES.forEach(s => {
        alignedStoreCompletedTrends[s.name] = sortedAllDates.map(dateKey => ({
            date: format(parseISO(dateKey), 'dd MMM'),
            count: masterStoreCompletedMap[s.name][dateKey] || 0
        }));
    });

    const alignedAggregatedApprovedTrend = sortedAllDates.map(dateKey => ({
        date: format(parseISO(dateKey), 'dd MMM'),
        count: globalApprovedDateMap[dateKey] || 0
    }));

    const alignedAggregatedReceivedTrend = sortedAllDates.map(dateKey => ({
        date: format(parseISO(dateKey), 'dd MMM'),
        count: globalReceivedDateMap[dateKey] || 0
    }));

    const alignedStoreApprovedTrends: Record<string, any[]> = {};
    BOUNTY_STORES.forEach(s => {
        alignedStoreApprovedTrends[s.name] = sortedAllDates.map(dateKey => ({
            date: format(parseISO(dateKey), 'dd MMM'),
            count: masterStoreApprovedMap[s.name][dateKey] || 0
        }));
    });

    const aggregated: any = {
        totalOpen: consolidatedStatus.Pending + consolidatedStatus.ToShip + consolidatedStatus.InTransit + consolidatedStatus.Received,
        statusBreakdown: consolidatedStatus,
        returnReasons: globalReasonCounts,
        resolutionTypes: globalResolutionCounts,
        policyRules: globalPolicyCounts,
        dailyTrend: alignedAggregatedActiveTrend,
        completedTrend: alignedAggregatedCompletedTrend,
        approvedTrend: alignedAggregatedApprovedTrend,
        receivedTrend: alignedAggregatedReceivedTrend,
        avgReturnValue: 0,
        sampleSize: 0,
        topProducts: Object.entries(globalProductCounts)
            .sort((a,b) => (b[1].count + (b[1].doneCount || 0)) - (a[1].count + (a[1].doneCount || 0)))
            .slice(0, 20)
            .map(([name, data]) => ({ 
                name, 
                sku: data.sku,
                activeCount: data.count, 
                doneCount: data.doneCount || 0,
                totalValue: data.value,
                activeRmas: data.activeRmas
            })),
        revenueRetained: globalRevenueRetained,
        revenueLost: globalRevenueLost,
        averageTTR: globalTTRCount > 0 ? globalTotalTTRDays / globalTTRCount : 0,
        agingReturnsCount: globalAgingReturnsCount,
        popReturnVolume: globalPreviousCompletedCount > 0 
            ? ((consolidatedStatus.Done7d - globalPreviousCompletedCount) / globalPreviousCompletedCount) * 100 
            : 0,
        popRevenueRetained: globalPreviousRevenueRetained > 0 
            ? ((globalRevenueRetained - globalPreviousRevenueRetained) / globalPreviousRevenueRetained) * 100 
            : 0,
        retainedRmas: globalRetainedRmas,
        lostRmas: globalLostRmas,
        pendingRmas: globalPendingRmas,
        toShipRmas: globalToShipRmas,
        inTransitRmas: globalInTransitRmas,
        receivedRmas: globalReceivedRmas,
        attentionRmas: globalAttentionRmas,
        agingRmas: globalAgingRmas,
        allActiveRmas: globalAllActiveRmas,
        allCompletedRmas: globalAllCompletedRmas
    };

    return { 
        aggregated, 
        byStore, 
        storeDailyTrends: alignedStoreActiveTrends, 
        storeCompletedTrends: alignedStoreCompletedTrends,
        storeApprovedTrends: alignedStoreApprovedTrends
    };
};