

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  Undo2, RefreshCw, Loader2, AlertCircle, Activity, Package, Clock, Truck, 
  ShoppingBag, ChevronDown, TrendingUp, TrendingDown, Minus, DollarSign, Filter, Info, ChevronRight, 
  Layers, CheckCircle, PieChart as PieIcon, BarChart3, HelpCircle, Zap, AlertTriangle, Ship, Building2,
  X, Download
} from 'lucide-react';
import { Group, BountyMetricData, ProductStats, ReturnGoRMA, RmaShortInfo, FullReturnGoDashboardData } from '../types';
import { 
  fetchRmaList, fetchRmaDetail, aggregateDashboardMetrics, fetchBountyApparelData 
} from '../services/returnGoService';
import { GoogleGenAI, Type } from "@google/genai";
import Chart from 'chart.js/auto';
import { format, parseISO, isValid } from 'date-fns';
import { MetricDetailModal } from '../components/MetricDetailModal'; // Keep this for Freshdesk tickets
import { RmaDetailModal } from '../components/RmaDetailModal'; // New RMA detail modal
import { RmaFullDetailModal } from '../components/RmaFullDetailModal'; // New RMA full detail modal
import { ConsolidatedView, Rma } from '../components/ConsolidatedView';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type ReturnsPageProps = {
    selectedGroup: Group;
    appContext: 'levis' | 'bounty' | 'admin';
}

const BOUNTY_STORES = [
  "Diesel", "Hurley", "Jeep Apparel", "Reebok", "Superdry"
];

// Specific Brand Colors for Charts
const BRAND_COLORS: Record<string, string> = {
    "Diesel": "#ef4444",        // Red
    "Hurley": "#3b82f6",        // Blue
    "Jeep Apparel": "#10b981",  // Emerald
    "Reebok": "#f59e0b",        // Amber
    "Superdry": "#8b5cf6"       // Violet
};

export const ReturnsPage: React.FC<ReturnsPageProps> = ({ selectedGroup, appContext }) => {
    const [view, setView] = useState<'hub' | 'dashboard'>('hub');
    const [targetConfig, setTargetConfig] = useState<{ shopName: string; label: string, isBounty?: boolean } | null>(null);
    const [bountyBrandFilter, setBountyBrandFilter] = useState<string | null>(null);
    const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);

    useEffect(() => {
        if (appContext === 'levis') {
            setTargetConfig({ shopName: "levis-sa.myshopify.com", label: "Levi's® South Africa" });
            setView('dashboard');
        } else if (appContext === 'bounty') {
            setTargetConfig({ shopName: "diesel-south-africa.myshopify.com", label: "Bounty Apparel Consolidated", isBounty: true });
            setView('dashboard');
        } else {
            setView('hub');
            setTargetConfig(null);
        }
    }, [appContext]);

    // Consolidated data structure for ReturnGo and Bounty Apparel
    const [fullDashboardData, setFullDashboardData] = useState<FullReturnGoDashboardData | null>(null);
    const [bountyData, setBountyData] = useState<any>(null); // Raw bounty data, for per-store view
    
    // UI states
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [aiInsight, setAiInsight] = useState('');
    
    // Product Table State
    const [expandedProductSku, setExpandedProductSku] = useState<string | null>(null);

    // RMA Detail Modal State
    const [rmaDetailModalOpen, setRmaDetailModalOpen] = useState(false);
    const [rmaModalTitle, setRmaModalTitle] = useState('');
    const [rmaModalRmas, setRmaModalRmas] = useState<ReturnGoRMA[]>([]);
    
    // Full RMA Detail Modal State
    const [fullRmaDetailModalOpen, setFullRmaDetailModalOpen] = useState(false);
    const [selectedRmaId, setSelectedRmaId] = useState<string | null>(null);
    const [chartTimeframe, setChartTimeframe] = useState<'7d' | '30d' | 'all'>('7d');
    
    // Chart Refs
    const trendChartRef = useRef<HTMLCanvasElement>(null);
    const trendChartInstance = useRef<Chart | null>(null);
    const completedChartRef = useRef<HTMLCanvasElement>(null);
    const completedChartInstance = useRef<Chart | null>(null);
    const reasonChartRef = useRef<HTMLCanvasElement>(null);
    const reasonChartInstance = useRef<Chart | null>(null);
    const resolutionChartRef = useRef<HTMLCanvasElement>(null);
    const resolutionChartInstance = useRef<Chart | null>(null);
    const policyChartRef = useRef<HTMLCanvasElement>(null);
    const policyChartInstance = useRef<Chart | null>(null);

    // useEffect(() => {
    //     if (fullDashboardData && reasonChartRef.current) {
    //         if (reasonChartInstance.current) reasonChartInstance.current.destroy();
    //         
    //         const reasons = fullDashboardData.metrics.returnReasons;
    //         reasonChartInstance.current = new Chart(reasonChartRef.current, {
    //             type: 'bar',
    //             data: {
    //                 labels: Object.keys(reasons),
    //                 datasets: [{
    //                     label: 'Return Reasons',
    //                     data: Object.values(reasons),
    //                     backgroundColor: '#3b82f6'
    //                 }]
    //             },
    //             options: {
    //                 responsive: true,
    //                 maintainAspectRatio: false,
    //                 plugins: { legend: { display: false } }
    //             }
    //         });
    //     }
    // }, [fullDashboardData]);

     const generateAIInsight = async (metrics: any) => {
        try {
            const prompt = `
                Analyse these return metrics for the brand "${targetConfig?.label}":
                - Active Queue: ${metrics.totalOpen}
                - To Ship: ${metrics.statusBreakdown.ToShip}, In Transit: ${metrics.statusBreakdown.InTransit}
                - Top 3 Reasons: ${Object.entries(metrics.returnReasons || {}).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ')}
                - Resolution: ${Object.entries(metrics.resolutionTypes || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
                - Revenue Retained (Exchanges/Store Credit): ZAR ${metrics.revenueRetained || 0}
                - Revenue Lost (Refunds): ZAR ${metrics.revenueLost || 0}
                - Average Time to Resolution: ${metrics.averageTTR ? metrics.averageTTR.toFixed(1) : 0} days
                - Aging Returns (>14 days open): ${metrics.agingReturnsCount || 0}
                - Top Policy Rules Triggered: ${Object.entries(metrics.policyRules || {}).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ')}
                
                Provide a 3-4 sentence high-level executive insight in British English.
                Focus on:
                1. Operational health and any anomalies detected (e.g., high aging returns, slow TTR).
                2. Financial impact (revenue retention vs loss).
                3. Predictive insights or strategic recommendations to improve the return rate and revenue retention.
            `;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [{ parts: [{ text: prompt }] }]
            });
            setAiInsight(response.text || "Insight unavailable.");
        } catch (e) {
            console.error("Gemini failed", e);
            setAiInsight("Unable to generate automated insight at this time.");
        }
    };

    const loadDashboard = async (config: { shopName: string; label: string; isBounty?: boolean }) => {
        setTargetConfig(config);
        setView('dashboard');
        setLoading(true);
        setError(null);
        setAiInsight('');
        setBountyBrandFilter(null); 
        setFullDashboardData(null); // Clear previous data

        try {
            if (config.isBounty) {
                const fullBountyData = await fetchBountyApparelData(setProgress);
                setBountyData(fullBountyData); // Store raw bounty data
                setFullDashboardData({
                    metrics: fullBountyData.aggregated,
                    rmaLists: { // Map bounty-specific lists to FullReturnGoDashboardData structure
                        Pending: fullBountyData.aggregated.pendingRmas || [],
                        ToShip: fullBountyData.aggregated.toShipRmas || [],
                        InTransit: fullBountyData.aggregated.inTransitRmas || [],
                        Received: fullBountyData.aggregated.receivedRmas || [],
                        Attention: fullBountyData.aggregated.attentionRmas || [],
                    }
                });
                await generateAIInsight(fullBountyData.aggregated);
            } else {
                const data = await aggregateDashboardMetrics(config.shopName, setProgress);
                setFullDashboardData(data);
                await generateAIInsight(data.metrics);
            }
        } catch (e: any) {
            setError(e.message || "Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (targetConfig && !fullDashboardData && !loading) {
            loadDashboard(targetConfig);
        }
    }, [targetConfig]);

    // Current metrics being displayed (either aggregated or filtered bounty store)
    const displayMetrics = useMemo(() => {
        return fullDashboardData?.metrics;
    }, [fullDashboardData]);

    const displayRmaLists = useMemo(() => {
        return fullDashboardData?.rmaLists;
    }, [fullDashboardData]);

    const consolidatedRmas = useMemo(() => {
        if (!bountyData || !bountyData.byStore) return [];
        
        const allRmas: Rma[] = [];
        BOUNTY_STORES.forEach(store => {
            const storeData = bountyData.byStore[store];
            if (storeData && storeData.allActiveRmas) {
                storeData.allActiveRmas.forEach((rma: ReturnGoRMA) => {
                    allRmas.push({
                        id: rma.rmaId,
                        store: store,
                        status: rma.status,
                        order: rma.orderName || 'Unknown',
                        customerName: rma.customerName || 'Unknown',
                        trackingNumber: rma.trackingNumber || '',
                        requestedDate: rma.createdAt || 'Unknown',
                        updatedAt: rma.updatedAt || rma.rma_updated_at || rma.lastUpdated,
                        lastUpdated: rma.lastUpdated
                    });
                });
            }
            if (storeData && storeData.allCompletedRmas) {
                storeData.allCompletedRmas.forEach((rma: ReturnGoRMA) => {
                    allRmas.push({
                        id: rma.rmaId,
                        store: store,
                        status: rma.status,
                        order: rma.orderName || 'Unknown',
                        customerName: rma.customerName || 'Unknown',
                        trackingNumber: rma.trackingNumber || '',
                        requestedDate: rma.createdAt || 'Unknown',
                        updatedAt: rma.updatedAt || rma.rma_updated_at || rma.lastUpdated,
                        lastUpdated: rma.lastUpdated
                    });
                });
            }
        });
        return allRmas;
    }, [bountyData]);

    const dailyActivity = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let activity = consolidatedRmas.filter(rma => {
            const dateStr = rma.updatedAt || rma.lastUpdated || rma.requestedDate;
            if (!dateStr || dateStr === 'Unknown') return false;
            const rmaDate = new Date(dateStr);
            return rmaDate >= today;
        });

        // If a specific store is selected, filter by that store
        if (bountyBrandFilter) {
            activity = activity.filter(rma => rma.store === bountyBrandFilter);
        }
        
        // Sort by most recent first
        return activity.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.lastUpdated || a.requestedDate || 0).getTime();
            const dateB = new Date(b.updatedAt || b.lastUpdated || b.requestedDate || 0).getTime();
            return dateB - dateA;
        });
    }, [consolidatedRmas, bountyBrandFilter]);


    // Charts Logic
    useEffect(() => {
        if (displayMetrics && view === 'dashboard') {
            
            // 1. Returns Intelligence Combined Chart
            if (trendChartRef.current) {
                if (trendChartInstance.current) {
                    trendChartInstance.current.destroy();
                    trendChartInstance.current = null;
                }
                
                const ctx = trendChartRef.current.getContext('2d');
                if (ctx && displayMetrics.dailyTrend && displayMetrics.dailyTrend.length > 0) {
                    // Create unified date labels
                    const dateSet = new Set<string>();
                    displayMetrics.dailyTrend.forEach((d: any) => dateSet.add(d.date));
                    if (displayMetrics.completedTrend) {
                        displayMetrics.completedTrend.forEach((d: any) => dateSet.add(d.date));
                    }
                    if (displayMetrics.approvedTrend) {
                        displayMetrics.approvedTrend.forEach((d: any) => dateSet.add(d.date));
                    }
                    
                    // Convert to array and sort (assuming format 'dd MMM' and within the same year for simplicity, 
                    // or just use the order they appear if we assume they are mostly sequential)
                    // A better approach is to parse them, but since they are 'dd MMM', we can just use the order from dailyTrend then completedTrend
                    let labels = Array.from(dateSet);
                    // Simple sort by assuming they are within the last few months
                    labels.sort((a, b) => {
                        const dateA = new Date(`${a} 2024`).getTime(); // Year doesn't matter much if it's within the same year
                        const dateB = new Date(`${b} 2024`).getTime();
                        return dateA - dateB;
                    });

                    if (chartTimeframe === '7d') {
                        labels = labels.slice(-7);
                    } else if (chartTimeframe === '30d') {
                        labels = labels.slice(-30);
                    }

                    const getCountForDate = (trend: any[], date: string) => {
                        const found = trend?.find((d: any) => d.date === date);
                        return found ? found.count : 0;
                    };

                    let datasets = [
                        {
                            label: 'Returns Requested',
                            data: labels.map(date => getCountForDate(displayMetrics.dailyTrend, date)),
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#fff',
                            pointBorderWidth: 2,
                            pointBorderColor: '#2563eb'
                        },
                        {
                            label: 'Processed Resolutions',
                            data: labels.map(date => getCountForDate(displayMetrics.completedTrend, date)),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#fff',
                            pointBorderWidth: 2,
                            pointBorderColor: '#10b981'
                        },
                        {
                            label: 'Returns Approved',
                            data: labels.map(date => getCountForDate(displayMetrics.approvedTrend, date)),
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#fff',
                            pointBorderWidth: 2,
                            pointBorderColor: '#f59e0b'
                        }
                    ];

                    trendChartInstance.current = new Chart(ctx, {
                        type: 'line',
                        data: { labels, datasets },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { 
                                legend: { 
                                    display: true, 
                                    position: 'top',
                                    labels: { usePointStyle: true, boxWidth: 8, font: { size: 10, weight: 'bold' }, color: '#64748b' }
                                } 
                            },
                            scales: {
                                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, stepSize: 1 }, border: { display: false } },
                                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 }, border: { display: false } }
                            },
                            elements: { line: { tension: 0.4 } }
                        }
                    });
                }
            }
            
            // 2. Completed RMAs Chart (Removed as it's now combined)
            if (completedChartRef.current) {
                if (completedChartInstance.current) {
                    completedChartInstance.current.destroy();
                    completedChartInstance.current = null;
                }
            }
            
            // 3. Return Reasons Chart
            if (reasonChartRef.current) {
                if (reasonChartInstance.current) {
                    reasonChartInstance.current.destroy();
                    reasonChartInstance.current = null;
                }
                
                const ctx = reasonChartRef.current.getContext('2d');
                if (ctx && displayMetrics.returnReasons) {
                    const reasons = displayMetrics.returnReasons;
                    reasonChartInstance.current = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(reasons),
                            datasets: [{
                                label: 'Return Reasons',
                                data: Object.values(reasons),
                                backgroundColor: [
                                    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
                                ],
                                borderWidth: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { 
                                legend: { 
                                    position: 'right',
                                    labels: { usePointStyle: true, boxWidth: 8, font: { size: 10, weight: 'bold' }, color: '#64748b' }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context: any) {
                                            const label = context.label || '';
                                            const value = context.raw as number;
                                            const total = context.chart._metasets[context.datasetIndex].total;
                                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                            return `${label}: ${value} (${percentage}%)`;
                                        }
                                    }
                                }
                            },
                            cutout: '70%'
                        }
                    });
                }
            }

            // 4. Resolution Types Chart
            if (resolutionChartRef.current) {
                if (resolutionChartInstance.current) {
                    resolutionChartInstance.current.destroy();
                    resolutionChartInstance.current = null;
                }
                
                const ctx = resolutionChartRef.current.getContext('2d');
                if (ctx && displayMetrics.resolutionTypes) {
                    const resolutions = displayMetrics.resolutionTypes;
                    resolutionChartInstance.current = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(resolutions),
                            datasets: [{
                                label: 'Resolution Types',
                                data: Object.values(resolutions),
                                backgroundColor: [
                                    '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6', '#f97316'
                                ],
                                borderWidth: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { 
                                legend: { 
                                    position: 'right',
                                    labels: { usePointStyle: true, boxWidth: 8, font: { size: 10, weight: 'bold' }, color: '#64748b' }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context: any) {
                                            const label = context.label || '';
                                            const value = context.raw as number;
                                            const total = context.chart._metasets[context.datasetIndex].total;
                                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                            return `${label}: ${value} (${percentage}%)`;
                                        }
                                    }
                                }
                            },
                            cutout: '70%'
                        }
                    });
                }
            }

            // 5. Policy Rules Chart
            if (policyChartRef.current) {
                if (policyChartInstance.current) {
                    policyChartInstance.current.destroy();
                    policyChartInstance.current = null;
                }
                
                const ctx = policyChartRef.current.getContext('2d');
                if (ctx && displayMetrics.policyRules) {
                    const policies = displayMetrics.policyRules;
                    policyChartInstance.current = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: Object.keys(policies),
                            datasets: [{
                                label: 'Policy Rules Triggered',
                                data: Object.values(policies),
                                backgroundColor: '#6366f1',
                                borderRadius: 8,
                                barThickness: 24
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { 
                                legend: { display: false }
                            },
                            scales: {
                                x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } }, border: { display: false } },
                                y: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } }, border: { display: false } }
                            }
                        }
                    });
                }
            }
        }
    }, [displayMetrics, view, bountyBrandFilter, targetConfig, bountyData, chartTimeframe]);

    // Handle Bounty Filter Logic
    const handleBountyFilter = (brandName: string | null) => {
        setBountyBrandFilter(brandName);
        if (brandName && bountyData?.byStore[brandName]) {
             const storeMetrics = bountyData.byStore[brandName];
             setFullDashboardData({
                 metrics: { // Map bounty-specific metrics to FullReturnGoDashboardData metrics structure
                     totalOpen: storeMetrics.activeReturns,
                     pending: storeMetrics.Pending, 
                     inTransit: storeMetrics.InTransit, 
                     received: storeMetrics.Received,
                     issues: storeMetrics.Attention,
                     flagged: storeMetrics.attentionRmas?.filter((r:ReturnGoRMA) => r.isFlagged).length || 0,
                     submitted: storeMetrics.activeReturns,
                     delivered: storeMetrics.Received,
                     courierCancelled: storeMetrics.attentionRmas?.filter((r:ReturnGoRMA) => r.isCourierCancelled).length || 0,
                     noTracking: storeMetrics.toShipRmas?.length || 0, // Assuming 'ToShip' means no tracking yet
                     resolutionActioned: storeMetrics.pendingRmas?.filter((r:ReturnGoRMA) => r.resolutionActioned).length || 0,
                     noResolutionActioned: storeMetrics.pendingRmas?.filter((r:ReturnGoRMA) => !r.resolutionActioned).length || 0,
                     timelineData: storeMetrics.dailyTrend,
                     // Existing ReturnGoMetrics fields that need mapping
                     totalReturns: storeMetrics.activeReturns,
                     statusBreakdown: { 
                        Pending: storeMetrics.Pending, 
                        ToShip: storeMetrics.ToShip, 
                        InTransit: storeMetrics.InTransit, 
                        Received: storeMetrics.Received,
                        Attention: storeMetrics.Attention,
                        Done7d: storeMetrics.Done7d 
                    },
                    returnReasons: storeMetrics.returnReasons || {}, 
                    resolutionTypes: storeMetrics.resolutionTypes || {},
                    policyRules: storeMetrics.policyRules || {},
                    dailyTrend: storeMetrics.dailyTrend || [],
                    completedTrend: bountyData.storeCompletedTrends[brandName] || [], 
                    avgReturnValue: storeMetrics.revenueRetained / (storeMetrics.retainedRmas?.length || 1),
                    sampleSize: storeMetrics.activeReturns, 
                    completedSampleSize: storeMetrics.Done7d,
                    topProducts: storeMetrics.topProducts || [],
                    revenueRetained: storeMetrics.revenueRetained || 0,
                    revenueLost: storeMetrics.revenueLost || 0,
                    averageTTR: storeMetrics.averageTTR || 0,
                    agingReturnsCount: storeMetrics.agingReturnsCount || 0,
                    popRevenueRetained: 0,
                    popReturnVolume: 0
                 },
                 rmaLists: { // Map bounty-specific lists
                    Pending: storeMetrics.pendingRmas || [],
                    ToShip: storeMetrics.toShipRmas || [],
                    InTransit: storeMetrics.inTransitRmas || [],
                    Received: storeMetrics.receivedRmas || [],
                    Attention: storeMetrics.attentionRmas || [],
                    Retained: storeMetrics.retainedRmas || [],
                    Lost: storeMetrics.lostRmas || [],
                    Aging: storeMetrics.agingRmas || [],
                    allActiveRmas: storeMetrics.allActiveRmas || [],
                    allCompletedRmas: storeMetrics.allCompletedRmas || [],
                 }
             });
        } else if (bountyData) {
            setFullDashboardData({
                metrics: bountyData.aggregated,
                rmaLists: {
                    Pending: bountyData.aggregated.pendingRmas || [],
                    ToShip: bountyData.aggregated.toShipRmas || [],
                    InTransit: bountyData.aggregated.inTransitRmas || [],
                    Received: bountyData.aggregated.receivedRmas || [],
                    Attention: bountyData.aggregated.attentionRmas || [],
                    Retained: bountyData.aggregated.retainedRmas || [],
                    Lost: bountyData.aggregated.lostRmas || [],
                    Aging: bountyData.aggregated.agingRmas || [],
                    allActiveRmas: bountyData.aggregated.allActiveRmas || [],
                    allCompletedRmas: bountyData.aggregated.allCompletedRmas || [],
                }
            });
        }
        setBrandDropdownOpen(false);
    };

    const handleMetricClick = (title: string, rmaListKey: keyof FullReturnGoDashboardData['rmaLists']) => {
        if (!displayRmaLists || !targetConfig) return;
        
        const rmas = displayRmaLists[rmaListKey] || [];
        setRmaModalTitle(title);
        setRmaModalRmas(rmas);
        setRmaDetailModalOpen(true);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(val);
    };

    const render_kpi_card = (
        label: string,
        value: string | number,
        help_text: string = "",
        trend: number | null = null,
        card_accent: string = "#3a8dff",
        value_color: string = "#7bd6ff",
        rmaCount?: number,
        rmaListKey?: keyof FullReturnGoDashboardData['rmaLists']
    ) => {
        return (
            <div 
                className={`bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-[160px] w-full mb-6 relative overflow-hidden group ${rmaListKey ? 'cursor-pointer' : ''}`} 
                title={help_text}
                onClick={() => rmaListKey && handleMetricClick(label, rmaListKey)}
            >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500" style={{ backgroundColor: card_accent }}></div>
                
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</div>
                        <div className="text-4xl font-black tracking-tighter" style={{ color: value_color }}>{value}</div>
                        {rmaCount !== undefined && (
                            <div className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
                                {rmaCount} RMAs
                            </div>
                        )}
                    </div>
                    
                    {trend !== null && (
                        <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : trend < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                            {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                            {Math.abs(trend).toFixed(1)}%
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const render_metric_card = (
        column: any,
        label: string,
        count_key: string,
        filter_name: string,
        counts: Record<string, number>,
        help_text: string = "",
        card_accent: string = "#3a8dff",
        count_color: string = "#7bd6ff",
        rmaListKey?: keyof FullReturnGoDashboardData['rmaLists']
    ) => {
        const count = counts[count_key] || 0;
        
        let sparklineContent = null;
        
        if (rmaListKey && displayRmaLists && displayRmaLists[rmaListKey]) {
            const rmas = displayRmaLists[rmaListKey] || [];
            if (rmas.length > 0) {
                const ageGroups: Record<number, ReturnGoRMA[]> = {};
                let maxAge = 0;
                
                rmas.forEach(rma => {
                    const dateStr = rma.lastUpdated || rma.updatedAt || rma.rma_updated_at || rma.createdAt || rma.rma_created_at;
                    let age = 0;
                    if (dateStr) {
                        const parsed = parseISO(dateStr);
                        if (isValid(parsed)) {
                            age = Math.max(0, Math.floor((new Date().getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
                        }
                    }
                    if (age > 30) age = 30; // Cap at 30 days for visualization
                    if (age > maxAge) maxAge = age;
                    if (!ageGroups[age]) ageGroups[age] = [];
                    ageGroups[age].push(rma);
                });
                
                // Ensure at least 7 days are shown for visual balance
                const displayDays = Math.max(7, maxAge + 1);
                const histogramData = Array.from({ length: displayDays }, (_, i) => ({
                    day: i,
                    rmas: ageGroups[i] || []
                }));
                
                const maxCount = Math.max(...histogramData.map(d => d.rmas.length), 1);
                
                sparklineContent = (
                    <div className="flex flex-col items-end h-full justify-end w-1/2">
                        <div className="flex items-end h-16 gap-1 w-full justify-end">
                            {histogramData.map((data, i) => (
                                <div 
                                    key={i} 
                                    className="w-3 rounded-t-sm relative group/bar cursor-pointer transition-all hover:opacity-100" 
                                    style={{ 
                                        height: `${Math.max((data.rmas.length / maxCount) * 100, 5)}%`, 
                                        backgroundColor: data.rmas.length > 0 ? card_accent : '#f1f5f9',
                                        opacity: data.rmas.length > 0 ? 0.6 : 1
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (data.rmas.length > 0) {
                                            setRmaModalTitle(`${label} - ${data.day}${data.day === 30 ? '+' : ''} Days Old`);
                                            setRmaModalRmas(data.rmas);
                                            setRmaDetailModalOpen(true);
                                        }
                                    }}
                                >
                                    {data.rmas.length > 0 && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 pointer-events-none whitespace-nowrap z-20">
                                            {data.rmas.length} RMAs<br/>{data.day}{data.day === 30 ? '+' : ''} days
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between w-full text-[9px] text-slate-400 font-bold mt-1 px-1">
                            <span>0d</span>
                            <span>{displayDays - 1}{displayDays - 1 === 30 ? '+' : ''}d</span>
                        </div>
                        <div className="text-[8px] text-slate-400 uppercase tracking-widest text-right w-full mt-0.5">Days since update</div>
                    </div>
                );
            }
        }
        
        return (
            <div 
                className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between h-[180px] w-full mb-6 relative overflow-hidden group" 
                title={help_text}
                onClick={() => rmaListKey && handleMetricClick(label, rmaListKey)}
            >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500" style={{ backgroundColor: card_accent }}></div>
                
                <div className="flex justify-between items-start relative z-10 h-full">
                    <div className="flex flex-col justify-between h-full">
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</div>
                            <div className="text-5xl font-black tracking-tighter" style={{ color: count_color }}>{count}</div>
                        </div>
                    </div>
                    
                    {sparklineContent}
                </div>
                
                {rmaListKey && (
                    <div className="absolute bottom-4 right-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        View All <ChevronRight size={12} />
                    </div>
                )}
            </div>
        );
    };

    const counts = useMemo(() => {
        if (!displayMetrics) return {};
        return {
            "Total Open": displayMetrics.totalOpen || 0,
            "Pending": displayMetrics.statusBreakdown.Pending || 0,
            "In Transit": displayMetrics.statusBreakdown.InTransit || 0,
            "Received": displayMetrics.statusBreakdown.Received || 0,
        };
    }, [displayMetrics]);

    // Updated: Render Breakdown List inside card
    const renderInlineBreakdown = (metricKey: keyof BountyMetricData) => {
        if (!targetConfig?.isBounty || bountyBrandFilter) return null;
        
        return (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                {BOUNTY_STORES.map(store => {
                    const val = bountyData?.byStore[store]?.[metricKey] || 0;
                    return (
                        <div key={store} className="flex justify-between items-center text-[10px] text-slate-500">
                            <span className="font-medium truncate pr-2">{store}</span>
                            <span className={`font-black ${val > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{val}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const exportToCSV = () => {
        if (!displayMetrics || !displayMetrics.topProducts) return;
        
        const headers = ["Product Description", "SKU", "No. of Active RMAs", "No. of Done RMAs", "Total Value (ZAR)"];
        const rows = (displayMetrics.topProducts as ProductStats[]).map(p => [
            `"${p.name.replace(/"/g, '""')}"`,
            `"${p.sku || ''}"`,
            p.activeCount,
            p.doneCount,
            p.totalValue
        ]);
        
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `returns_product_matrix_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (view === 'hub') {
        return (
            <div className="p-10 md:p-14 max-w-[1600px] mx-auto w-full min-h-[80vh] flex flex-col justify-center animate-in fade-in duration-700">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-3">Returns Intelligence Hub</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Live ReturnGO E-Commerce Ecosystem Analysis</p>
                </div>
                
                <div className={`grid grid-cols-1 ${appContext === 'admin' ? 'md:grid-cols-2' : ''} gap-8 max-w-4xl mx-auto w-full`}>
                    {/* Levi's Block */}
                    {(appContext === 'admin' || appContext === 'levis') && (
                        <button 
                            onClick={() => {
                                setTargetConfig({ shopName: "levis-sa.myshopify.com", label: "Levi's® South Africa" });
                                setView('dashboard');
                            }}
                            className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all group text-left relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-10 -mt-10 group-hover:bg-red-100 transition-colors"></div>
                            <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-red-600/30">
                                <Undo2 size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2 group-hover:text-red-600 transition-colors">Levi's® SA</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Single Brand Matrix</p>
                            <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-red-600 transition-colors">
                                Enter Dashboard <ChevronRight size={14} />
                            </div>
                        </button>
                    )}

                    {/* Bounty Consolidated Block */}
                    {(appContext === 'admin' || appContext === 'bounty') && (
                        <button 
                            onClick={() => {
                                setTargetConfig({ shopName: "diesel-south-africa.myshopify.com", label: "Bounty Apparel Consolidated", isBounty: true });
                                setView('dashboard');
                            }}
                            className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all group text-left relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-colors"></div>
                            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-blue-600/50">
                                <Layers size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2 group-hover:text-blue-400 transition-colors">Bounty Apparel</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Multi-Store Ecosystem</p>
                            <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600 group-hover:text-blue-400 transition-colors">
                                Enter Consolidated View <ChevronRight size={14} />
                            </div>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col animate-in fade-in duration-500">
            {/* Improved Header */}
            <header className="bg-gradient-to-r from-slate-900 via-ecomplete-primary to-slate-900 border-b border-white/10 px-10 h-24 flex items-center justify-between sticky top-0 z-50 shadow-2xl">
                <div className="flex items-center gap-8">
                    {appContext === 'admin' && (
                        <button onClick={() => setView('hub')} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10">
                            <Undo2 size={20} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
                            {targetConfig?.label}
                            {targetConfig?.isBounty && (
                                <div className="relative">
                                    <button 
                                        onClick={() => setBrandDropdownOpen(!brandDropdownOpen)} 
                                        className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-3 hover:bg-white/20 transition-all shadow-lg ml-4 border border-white/10"
                                    >
                                        <Building2 size={14} />
                                        {bountyBrandFilter || "Consolidated View"} 
                                        <ChevronDown size={14} className={`transition-transform ${brandDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {brandDropdownOpen && (
                                        <>
                                        <div className="fixed inset-0 z-40" onClick={() => setBrandDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-4 mt-2 w-56 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-white">
                                            <button onClick={() => handleBountyFilter(null)} className={`w-full text-left p-3 rounded-xl text-xs font-black uppercase tracking-wider mb-1 ${!bountyBrandFilter ? 'bg-ecomplete-accent text-slate-900' : 'text-slate-300 hover:bg-slate-700'}`}>
                                                Consolidated View
                                            </button>
                                            <div className="h-px bg-slate-700 my-1"></div>
                                            {BOUNTY_STORES.map(store => (
                                                <button key={store} onClick={() => handleBountyFilter(store)} className={`w-full text-left p-3 rounded-xl text-xs font-bold uppercase tracking-wider mb-1 ${bountyBrandFilter === store ? 'bg-ecomplete-accent text-slate-900' : 'text-slate-300 hover:bg-slate-700'}`}>
                                                    {store}
                                                </button>
                                            ))}
                                        </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </h1>
                        <p className="text-[10px] font-black text-ecomplete-accent uppercase tracking-[0.3em] mt-1 opacity-80">{targetConfig?.shopName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => targetConfig && loadDashboard(targetConfig)} 
                        disabled={loading}
                        className="bg-ecomplete-accent text-slate-900 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-ecomplete-accent/20 flex items-center gap-3 hover:bg-yellow-400 transition-all"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Sync Data
                    </button>
                </div>
            </header>

            <main className="flex-1 p-10 max-w-[1600px] mx-auto w-full space-y-12">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40">
                        <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-blue-600 mb-8 shadow-inner relative">
                            <Loader2 size={48} className="animate-spin" />
                            <div className="absolute inset-0 border-4 border-blue-100 rounded-[2.5rem] animate-ping opacity-20"></div>
                        </div>
                        <div className="text-center space-y-4 max-w-md mx-auto">
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight animate-pulse">{progress}</h3>
                            <div className="flex flex-col gap-2">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                    Intelligence Stream Processing • {targetConfig?.label}
                                </p>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 rounded-full animate-progress-indeterminate"></div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium italic">
                                    Synchronising RMA lifecycle data, policy triggers, and financial impact metrics...
                                </p>
                            </div>
                        </div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-100 p-10 rounded-[3rem] text-center">
                        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                        <h3 className="text-xl font-black text-red-800 uppercase tracking-tight">Data Sync Failure</h3>
                        <p className="text-red-600 font-medium mt-2">{error}</p>
                    </div>
                ) : !displayMetrics && targetConfig ? (
                    <div className="flex justify-center py-20">
                        <button 
                            onClick={() => targetConfig && loadDashboard(targetConfig)}
                            className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl hover:bg-slate-700 transition-all"
                        >
                            Fetch RMA Details
                        </button>
                    </div>
                ) : displayMetrics && displayRmaLists && (
                    <div className="space-y-10">
                        {/* Aging Returns Alert */}
                        {(displayMetrics as any).agingReturnsCount > 0 && (
                            <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4">
                                <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-1" />
                                <div>
                                    <h3 className="font-black text-amber-800 uppercase tracking-widest text-sm mb-1">Action Required: Aging Returns</h3>
                                    <p className="text-amber-700 text-sm">There are <span className="font-bold">{(displayMetrics as any).agingReturnsCount}</span> open RMAs that have been pending for more than 14 days. Please review and process these requests to maintain customer satisfaction.</p>
                                </div>
                            </div>
                        )}

                        {/* Executive Insight Box */}
                        {aiInsight && (
                            <div className="bg-white border-l-[12px] border-ecomplete-accent rounded-[3rem] p-10 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-ecomplete-accent/5 rounded-bl-[100px] -mr-10 -mt-10"></div>
                                <div className="shrink-0 w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-ecomplete-accent shadow-xl">
                                    <Zap size={32} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] mb-3">AI Intelligence Insight</h3>
                                    <p className="text-xl font-bold text-slate-800 leading-relaxed italic">"{aiInsight}"</p>
                                </div>
                            </div>
                        )}

                        {/* Metric Cards */}
                        {targetConfig?.isBounty && !bountyBrandFilter ? (
                            <ConsolidatedView 
                                allRmas={consolidatedRmas} 
                                metrics={displayMetrics}
                                onSync={() => targetConfig && loadDashboard(targetConfig)} 
                            />
                        ) : (
                            <div className="space-y-10">
                                {/* Modern Store Ecosystem Overview */}
                                <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-200 overflow-hidden">
                                    <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Store Ecosystem Overview</h2>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Real-time Pipeline Analysis</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="px-4 py-2 bg-blue-50 rounded-xl text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                                Active Pipeline
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                                            {/* Total Open */}
                                            <div 
                                                onClick={() => handleMetricClick("Total Open", "Pending")}
                                                className="group cursor-pointer"
                                            >
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                    Total Open
                                                </div>
                                                <div className="flex items-end gap-3">
                                                    <span className="text-6xl font-black text-slate-800 tracking-tighter group-hover:text-blue-600 transition-colors">
                                                        {counts["Total Open"]}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">RMAs</span>
                                                </div>
                                                <div className="mt-6 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full w-full"></div>
                                                </div>
                                            </div>

                                            {/* Pending */}
                                            <div 
                                                onClick={() => handleMetricClick("Pending", "Pending")}
                                                className="group cursor-pointer"
                                            >
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                                    Pending
                                                </div>
                                                <div className="flex items-end gap-3">
                                                    <span className="text-6xl font-black text-slate-800 tracking-tighter group-hover:text-amber-600 transition-colors">
                                                        {counts["Pending"]}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                                        {counts["Total Open"] > 0 ? Math.round((counts["Pending"] / counts["Total Open"]) * 100) : 0}%
                                                    </span>
                                                </div>
                                                <div className="mt-6 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-amber-500 rounded-full transition-all duration-1000" 
                                                        style={{ width: `${counts["Total Open"] > 0 ? (counts["Pending"] / counts["Total Open"]) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* In Transit */}
                                            <div 
                                                onClick={() => handleMetricClick("In Transit", "InTransit")}
                                                className="group cursor-pointer"
                                            >
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                                                    In Transit
                                                </div>
                                                <div className="flex items-end gap-3">
                                                    <span className="text-6xl font-black text-slate-800 tracking-tighter group-hover:text-cyan-600 transition-colors">
                                                        {counts["In Transit"]}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                                        {counts["Total Open"] > 0 ? Math.round((counts["In Transit"] / counts["Total Open"]) * 100) : 0}%
                                                    </span>
                                                </div>
                                                <div className="mt-6 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-cyan-500 rounded-full transition-all duration-1000" 
                                                        style={{ width: `${counts["Total Open"] > 0 ? (counts["In Transit"] / counts["Total Open"]) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* Received */}
                                            <div 
                                                onClick={() => handleMetricClick("Received", "Received")}
                                                className="group cursor-pointer"
                                            >
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                    Received
                                                </div>
                                                <div className="flex items-end gap-3">
                                                    <span className="text-6xl font-black text-slate-800 tracking-tighter group-hover:text-emerald-600 transition-colors">
                                                        {counts["Received"]}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                                        {counts["Total Open"] > 0 ? Math.round((counts["Received"] / counts["Total Open"]) * 100) : 0}%
                                                    </span>
                                                </div>
                                                <div className="mt-6 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                                                        style={{ width: `${counts["Total Open"] > 0 ? (counts["Received"] / counts["Total Open"]) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {render_kpi_card("Revenue Retained", formatCurrency((displayMetrics as any).metrics?.revenueRetained || 0), "Value of exchanges and store credit", (displayMetrics as any).metrics?.popRevenueRetained, "#10b981", "#34d399", displayRmaLists?.Retained?.length || 0, "Retained")}
                                    {render_kpi_card("Revenue Lost", formatCurrency((displayMetrics as any).metrics?.revenueLost || 0), "Value of refunds", null, "#ef4444", "#f87171", displayRmaLists?.Lost?.length || 0, "Lost")}
                                    {render_kpi_card("Avg Time to Resolution", `${((displayMetrics as any).metrics?.averageTTR || 0).toFixed(1)} Days`, "Average days to complete an RMA", null, "#8b5cf6", "#a78bfa")}
                                    {render_kpi_card("Aging Returns", (displayMetrics as any).metrics?.agingReturnsCount || 0, "Pending RMAs older than 14 days", null, "#f59e0b", "#fbbf24", displayRmaLists?.Aging?.length || 0, "Aging")}
                                </div>

                                {/* Store RMA Data Table */}
                                <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-200 overflow-hidden">
                                    <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">RMA Transaction Ledger</h2>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Detailed store-level return listings</p>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                <tr>
                                                    <th className="p-6 pl-10">RMA ID</th>
                                                    <th className="p-6">Order</th>
                                                    <th className="p-6">Customer</th>
                                                    <th className="p-6">Status</th>
                                                    <th className="p-6">Requested Date</th>
                                                    <th className="p-6 text-right pr-10">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {[...(displayRmaLists?.allActiveRmas || []), ...(displayRmaLists?.allCompletedRmas || [])]
                                                    .sort((a, b) => {
                                                        const dateA = a.createdAt || a.rma_created_at || '';
                                                        const dateB = b.createdAt || b.rma_created_at || '';
                                                        return dateB.localeCompare(dateA);
                                                    })
                                                    .slice(0, 50) // Show top 50
                                                    .map((rma) => (
                                                        <tr key={rma.rmaId} className="hover:bg-slate-50 transition-colors group">
                                                            <td className="p-6 pl-10">
                                                                <span className="font-black text-blue-600">#{rma.rmaId}</span>
                                                            </td>
                                                            <td className="p-6 font-bold text-slate-700">{rma.orderName || 'Unknown'}</td>
                                                            <td className="p-6 text-slate-600">{rma.customerName || 'Unknown'}</td>
                                                            <td className="p-6">
                                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest
                                                                    ${rma.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 
                                                                      rma.status === 'Done' ? 'bg-emerald-100 text-emerald-700' : 
                                                                      'bg-blue-100 text-blue-700'}`}>
                                                                    {rma.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-6 text-slate-400 font-bold text-xs">
                                                                {rma.createdAt ? format(parseISO(rma.createdAt), 'dd MMM yyyy') : 'Unknown'}
                                                            </td>
                                                            <td className="p-6 text-right pr-10">
                                                                <button 
                                                                    onClick={() => {
                                                                        setSelectedRmaId(rma.rmaId);
                                                                        setFullRmaDetailModalOpen(true);
                                                                    }}
                                                                    className="p-2 bg-slate-100 rounded-lg text-slate-400 hover:bg-blue-600 hover:text-white transition-all"
                                                                >
                                                                    <ChevronRight size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* GRAPHS SECTION */}
                        {!(targetConfig?.isBounty && !bountyBrandFilter) && (
                            <div className="space-y-8">
                                {/* Daily Activity Log */}
                                <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                                                <Activity size={20} />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Today's Activity Log</h2>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Real-time RMA updates</p>
                                            </div>
                                        </div>
                                        <div className="px-4 py-2 bg-indigo-50 rounded-xl text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                            {dailyActivity.length} Activities Today
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                                        {dailyActivity.length > 0 ? (
                                            dailyActivity.map((activity, idx) => (
                                                <div key={`${activity.id}-${idx}`} className="flex-shrink-0 w-64 bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-2">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-xs font-black text-slate-700">{activity.store}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                                                            activity.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                            activity.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                                                            activity.status === 'Received' ? 'bg-emerald-100 text-emerald-700' :
                                                            activity.status === 'In Transit' ? 'bg-purple-100 text-purple-700' :
                                                            'bg-slate-200 text-slate-700'
                                                        }`}>
                                                            {activity.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-bold text-slate-800">{activity.order}</div>
                                                    <div className="text-xs text-slate-500">{activity.customerName}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium mt-auto pt-2 border-t border-slate-200">
                                                        {format(new Date(activity.updatedAt || activity.lastUpdated || activity.requestedDate || new Date()), 'HH:mm a')}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="w-full text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                                No activity recorded for today yet.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Returns Intelligence Combined Chart */}
                                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-lg">
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                                            <TrendingUp size={18} className="text-blue-600" />
                                            Returns Intelligence
                                        </h3>
                                    </div>
                                    <div className="h-[300px] w-full relative">
                                        <canvas ref={trendChartRef}></canvas>
                                        {(!displayMetrics.dailyTrend || displayMetrics.dailyTrend.length === 0) && (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                No Data Available
                                            </div>
                                        )}
                                    </div>
                                    {/* Filter Bar */}
                                    <div className="mt-6 flex justify-center gap-2">
                                        <button 
                                            onClick={() => setChartTimeframe('7d')}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${chartTimeframe === '7d' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            7 Days
                                        </button>
                                        <button 
                                            onClick={() => setChartTimeframe('30d')}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${chartTimeframe === '30d' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            30 Days
                                        </button>
                                        <button 
                                            onClick={() => setChartTimeframe('all')}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${chartTimeframe === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            All Time
                                        </button>
                                    </div>
                                </div>

                                {/* Return Reasons and Resolutions - Side by Side */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                                    {/* Return Reasons */}
                                    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-lg">
                                        <div className="flex justify-between items-center mb-8">
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                                                <PieIcon size={18} className="text-blue-600" />
                                                Return Reason Distribution
                                            </h3>
                                        </div>
                                        <div className="h-[300px] w-full relative">
                                            <canvas ref={reasonChartRef}></canvas>
                                            {(!displayMetrics.returnReasons || Object.keys(displayMetrics.returnReasons).length === 0) && (
                                                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                    No Data Available
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Resolution Types */}
                                    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-lg">
                                        <div className="flex justify-between items-center mb-8">
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                                                <PieIcon size={18} className="text-purple-600" />
                                                Processed Resolutions Distribution
                                            </h3>
                                        </div>
                                        <div className="h-[300px] w-full relative">
                                            <canvas ref={resolutionChartRef}></canvas>
                                            {(!displayMetrics.resolutionTypes || Object.keys(displayMetrics.resolutionTypes).length === 0) && (
                                                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                    No Data Available
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Policy Rules */}
                                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-lg">
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                                            <Layers size={18} className="text-amber-600" />
                                            Requested Policy Rules Distribution
                                        </h3>
                                    </div>
                                    <div className="h-[300px] w-full relative">
                                        <canvas ref={policyChartRef}></canvas>
                                        {(!displayMetrics.policyRules || Object.keys(displayMetrics.policyRules).length === 0) && (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                No Data Available
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Product Intelligence Matrix Table */}
                        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                        <ShoppingBag size={20} className="text-purple-600" />
                                        Product Intelligence Matrix
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Top 20 Returned SKUs & Drill Down Analysis</p>
                                </div>
                                <button 
                                    onClick={exportToCSV}
                                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                                >
                                    <Download size={14} />
                                    Export CSV
                                </button>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="p-6 pl-10 w-1/2">Product Description (SKU)</th>
                                            <th className="p-6 text-center">No. of Active RMAs</th>
                                            <th className="p-6 text-center">% of Active RMAs</th>
                                            <th className="p-6 text-right pr-10">Total Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {displayMetrics.topProducts && displayMetrics.topProducts.length > 0 ? (displayMetrics.topProducts as ProductStats[]).map((p, idx) => {
                                            const totalActive = displayMetrics.totalOpen || 1; 
                                            const prevalence = Math.round(((p.activeCount || 0) / totalActive) * 100);
                                                
                                            const isExpanded = expandedProductSku === (p.sku || p.name);

                                            return (
                                                <React.Fragment key={idx}>
                                                    <tr className={`hover:bg-slate-50 transition-colors cursor-pointer group ${isExpanded ? 'bg-purple-50 hover:bg-purple-50' : ''}`} 
                                                        onClick={() => setExpandedProductSku(isExpanded ? null : (p.sku || p.name))}>
                                                        <td className="p-6 pl-10 font-bold text-slate-700 flex items-center gap-3">
                                                            <div className={`p-1 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-90 bg-purple-200 text-purple-700' : 'bg-slate-200 text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-600'}`}>
                                                                <ChevronRight size={14} />
                                                            </div>
                                                            <div>
                                                                <div className="line-clamp-1">{p.name}</div>
                                                                {p.sku && <div className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-wider">SKU: {p.sku}</div>}
                                                            </div>
                                                        </td>
                                                        <td className="p-6 text-center">
                                                            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-black text-xs">{p.activeCount}</span>
                                                        </td>
                                                        <td className="p-6 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="font-bold text-slate-600">{prevalence}%</span>
                                                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${prevalence}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-6 text-right pr-10 font-black text-slate-800">
                                                            {formatCurrency(p.totalValue)}
                                                        </td>
                                                    </tr>
                                                    
                                                    {isExpanded && (
                                                        <tr className="bg-slate-50/50 animate-in fade-in slide-in-from-top-2">
                                                            <td colSpan={4} className="p-0">
                                                                <div className="p-6 pl-16 pr-10 border-b border-slate-100 shadow-inner">
                                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                        <Layers size={12}/> Active RMA Breakdown
                                                                    </h4>
                                                                    {p.activeRmas && p.activeRmas.length > 0 ? (
                                                                        <div className="space-y-2">
                                                                            {p.activeRmas.map((rma, rIdx) => (
                                                                                <div 
                                                                                    key={rIdx} 
                                                                                    onClick={() => {
                                                                                        setSelectedRmaId(rma.id);
                                                                                        setFullRmaDetailModalOpen(true);
                                                                                    }}
                                                                                    className="flex items-center gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-purple-300 hover:shadow-md transition-all"
                                                                                >
                                                                                    <span className="font-black text-blue-600 shrink-0 min-w-[80px]">#{rma.id}</span>
                                                                                    <div className="h-4 w-px bg-slate-200"></div>
                                                                                    <span className="font-bold text-slate-700 shrink-0 min-w-[150px]">{rma.reason}</span>
                                                                                    <div className="h-4 w-px bg-slate-200"></div>
                                                                                    <span className="text-slate-500 italic flex-1">{rma.resolution}</span>
                                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${rma.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{rma.status}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-center text-slate-400 italic py-4 text-xs font-bold">No active RMA details available for drill-down.</div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan={4} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No product data available</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="h-20"></div>
                    </div>
                )}
            </main>
            
            {/* MetricDetailModal is no longer used for RMAs but kept for Freshdesk */}
            {/* <MetricDetailModal 
                isOpen={metricModalOpen} 
                onClose={() => setMetricModalOpen(false)} 
                title={metricModalTitle} 
                tickets={metricModalTickets} 
                onTicketClick={() => {}} 
            /> */}

            {/* New RMA Detail Modal */}
            {targetConfig && (
                <>
                    <RmaDetailModal
                        isOpen={rmaDetailModalOpen}
                        onClose={() => setRmaDetailModalOpen(false)}
                        title={rmaModalTitle}
                        rmas={rmaModalRmas}
                        shopName={targetConfig.shopName}
                        onRmaClick={(rmaId) => {
                            setSelectedRmaId(rmaId);
                            setFullRmaDetailModalOpen(true);
                        }}
                    />
                    <RmaFullDetailModal
                        isOpen={fullRmaDetailModalOpen}
                        onClose={() => setFullRmaDetailModalOpen(false)}
                        rmaId={selectedRmaId || ''}
                        shopName={targetConfig.shopName}
                    />
                </>
            )}
        </div>
    );
};