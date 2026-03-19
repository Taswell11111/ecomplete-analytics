import axios from 'axios';

const BOUNTY_BRANDS = [
  {
    name: 'Diesel',
    username: process.env.PARCELNINJA_DIESEL_USERNAME || 'ENgsxyMbeqVGvGzTCpVdkZmsjz/VCDeF+NWHlRk3Hk0=',
    password: process.env.PARCELNINJA_DIESEL_PASSWORD || 'EuoTNvCvp5imhOR2TZDe/fnKDxfoPK+EORSqfGvafZk=',
    store_id: process.env.PARCELNINJA_DIESEL_STORE_ID || '7b0fb2ac-51bd-47ea-847e-cfb1584b4aa2'
  },
  {
    name: 'Hurley',
    username: process.env.PARCELNINJA_HURLEY_USERNAME || 'CtAAy94MhKTJClgAwEfQL9LfkM14CegkeUbpBfhwt68=',
    password: process.env.PARCELNINJA_HURLEY_PASSWORD || 'AmlbcKtg1WQsLuivLpjyOTVizNrijZiXY6vVJoT5a1U=',
    store_id: process.env.PARCELNINJA_HURLEY_STORE_ID || 'a504304c-ad27-4b9b-8625-92a314498e64'
  },
  {
    name: 'Jeep Apparel',
    username: process.env.PARCELNINJA_JEEP_USERNAME || '+w3K5hLq56MQ4ijqFH78lV0xQCTTzP9mNAqToCUL9Cw=',
    password: process.env.PARCELNINJA_JEEP_PASSWORD || 'l2+ozGqsA6PX7MSHrl4OMwZRTieKzUpJVWv/WYye8iA=',
    store_id: process.env.PARCELNINJA_JEEP_STORE_ID || '80f123d6-f9de-45b9-938c-61c0a358f205'
  },
  {
    name: 'Superdry',
    username: process.env.PARCELNINJA_SUPERDRY_USERNAME || 'zcUrzwFh2QwtH1yEJixFXtUA4XGQyx2wbNVLpYTzZ8M=',
    password: process.env.PARCELNINJA_SUPERDRY_PASSWORD || '92Av8tHsbq2XLEZZeRwYNsPFSkca+dD1cwRQs79rooM=',
    store_id: process.env.PARCELNINJA_SUPERDRY_STORE_ID || 'b112948b-0390-4833-8f41-47f997c5382c'
  },
  {
    name: 'Reebok',
    username: process.env.PARCELNINJA_REEBOK_USERNAME || '9oZ10dMWlyQpEmS0Kw6xhIcKYXw8lB2az3Q0Zb+KBAw=',
    password: process.env.PARCELNINJA_REEBOK_PASSWORD || 'Cq/Zn86P7FT3EN0C5qzOewAQssyvrDSbkzmQBSAOrMY=',
    store_id: process.env.PARCELNINJA_REEBOK_STORE_ID || '963f57af-6f46-4d6d-b07c-dc4aa684cdfa'
  }
];

const LEVIS = [
  {
    name: "Levi's",
    username: process.env.PARCELNINJA_LEVIS_USERNAME || '4lQbm0CgLBZQkzIiPnwWnjCQqgEdXsP6mVQ6q7nX24Y=',
    password: process.env.PARCELNINJA_LEVIS_PASSWORD || '70JK3u4z/IxrGdpdSUE4csPfzlg/wgGTcuAgUgbd+j4=',
    store_id: process.env.PARCELNINJA_LEVIS_STORE_ID || 'ea344f50-5af3-4de1-814c-0c45171a2353'
  }
];

export const STORES = [...BOUNTY_BRANDS, ...LEVIS];

const BASE_URL = 'https://storeapi.parcelninja.com/api/v1';

// In-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Inventory cache
const inventoryCache = new Map<string, string>();

const createClient = (store: any) => {
  console.log(`Creating Parcelninja client for store: ${store.name}, store_id: ${store.store_id}`);
  const client = axios.create({
    baseURL: BASE_URL,
    auth: {
      username: store.username,
      password: store.password
    },
    headers: {
      'X-Store-Id': store.store_id,
      'Accept': 'application/json'
    },
    timeout: 60000
  });


  // Retry interceptor
  client.interceptors.response.use(undefined, async (err) => {
    const config = err.config;
    if (!config || !config.retry) {
      config.retry = 0;
    }
    if (config.retry >= 3) {
      return Promise.reject(err);
    }
    const isRateLimit = err.response && (err.response.status === 429 || err.response.status === 503);
    const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
    
    if (isRateLimit || isTimeout) {
      config.retry += 1;
      // Use a longer backoff for rate limits: 5s, 10s, 20s
      const delay = Math.pow(2, config.retry - 1) * 5000; 
      const reason = isTimeout ? 'timeout' : 'rate limited (429/503)';
      console.warn(`Parcelninja API ${reason}. Retrying in ${delay}ms... (Attempt ${config.retry}/3)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return client(config);
    }
    return Promise.reject(err);
  });

  return client;
};

const getInventoryName = async (client: any, sku: string): Promise<string> => {
  if (!sku || sku === 'N/A') return 'Unknown Item';
  if (inventoryCache.has(sku)) return inventoryCache.get(sku)!;

  try {
    const res = await client.get(`/inventory/${sku}`);
    const items = res.data?.items || [];
    if (items.length > 0 && items[0].name) {
      inventoryCache.set(sku, items[0].name);
      return items[0].name;
    }
  } catch (e) {
    // Ignore errors for inventory lookup
  }
  return sku;
};

export const fetchOutbounds = async (store: any, startDate: string, endDate: string) => {
  const client = createClient(store);
  let allRecords: any[] = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore && page <= 40) {
      const res = await client.get('/outbounds', {
        params: {
          pageSize: 50,
          page,
          startDate,
          endDate,
          orderBy: 'createDate',
          orderDirection: 'desc'
        }
      });

      const outbounds = res.data?.outbounds || [];
      if (outbounds.length === 0) break;

      for (const summary of outbounds) {
        // Use summary directly to avoid rate limits
        allRecords.push({
          ...summary,
          _store: store.name,
          _type: 'outbound'
        });
      }

      if (outbounds.length < 50) {
        hasMore = false;
      } else {
        page++;
        // Delay between pages to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    return { data: allRecords, error: null };
  } catch (e: any) {
    if (e.response?.status === 401) {
      console.warn(`Authentication failed for store ${store.name} (ParcelNinja 401). Please check credentials.`);
    } else {
      console.error(`Failed to fetch outbounds for store ${store.name}:`, e.message);
    }
    return { data: [], error: e.message || 'Unknown error' };
  }
};

export const fetchInbounds = async (store: any, startDate: string, endDate: string) => {
  const client = createClient(store);
  let allRecords: any[] = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore && page <= 40) {
      const res = await client.get('/inbounds', {
        params: {
          pageSize: 50,
          page,
          startDate,
          endDate,
          col: 4,
          colOrder: 'desc'
        }
      });

      const inbounds = res.data?.inbounds || [];
      if (inbounds.length === 0) break;

      for (const summary of inbounds) {
        // Use summary directly to avoid rate limits
        allRecords.push({
          ...summary,
          _store: store.name,
          _type: 'inbound'
        });
      }

      if (inbounds.length < 50) {
        hasMore = false;
      } else {
        page++;
        // Delay between pages to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    return { data: allRecords, error: null };
  } catch (e: any) {
    if (e.response?.status === 401) {
      console.warn(`Authentication failed for store ${store.name} (ParcelNinja 401). Please check credentials.`);
    } else {
      console.error(`Failed to fetch inbounds for store ${store.name}:`, e.message);
    }
    return { data: [], error: e.message || 'Unknown error' };
  }
};

export const getShipments = async (type: 'outbound' | 'inbound', days: number, storeName?: string) => {
  const cacheKey = `${type}_${days}_${storeName || 'all'}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Adjust to GMT+2 (South Africa Time)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt2Now = new Date(utc + (3600000 * 2));
  
  const endDateObj = new Date(gmt2Now);
  const startDateObj = new Date(gmt2Now);
  
  if (days > 0) {
    startDateObj.setDate(startDateObj.getDate() - days);
  }

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  const startDate = formatDate(startDateObj);
  const endDate = formatDate(endDateObj);

  const fetchFn = type === 'outbound' ? fetchOutbounds : fetchInbounds;

  const mergedData: any[] = [];
  const errors: Record<string, string | null> = {};

  const storesToFetch = storeName ? STORES.filter(s => s.name === storeName) : STORES;

  // Parallelise with staggering to avoid blocking the event loop and prevent rate limiting
  const results = await Promise.allSettled(
    storesToFetch.map(async (store, i) => {
      try {
        // Stagger requests by 500ms each
        await new Promise(resolve => setTimeout(resolve, i * 500));
        console.log(`[Parcelninja] Fetching ${type} for ${store.name} (${startDate} to ${endDate})...`);
        const result = await fetchFn(store, startDate, endDate);
        if (result.error) {
          console.error(`[Parcelninja] Error for ${store.name}: ${result.error}`);
        } else {
          console.log(`[Parcelninja] Found ${result.data.length} ${type} for ${store.name}`);
        }
        return { storeName: store.name, data: result.data, error: result.error };
      } catch (e: any) {
        let message = e.message;
        if (e.response && e.response.data && e.response.data.message) {
          message = e.response.data.message;
        } else if (e.response && e.response.status === 429) {
          message = 'Rate exceeded';
        }
        console.error(`[Parcelninja] Exception for ${store.name}: ${message}`);
        return { storeName: store.name, data: [], error: message || 'Unknown error' };
      }
    })
  );

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { storeName, data, error } = result.value;
      mergedData.push(...data);
      errors[storeName] = error;
    } else {
      // This case should be handled by the try/catch inside map, but just in case
      console.error('Unexpected promise rejection in getShipments:', result.reason);
    }
  });

  const responseData = { data: mergedData, errors };
  cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

  return responseData;
};

export const testParcelninjaConnection = async (appContext: 'levis' | 'bounty' | 'admin' = 'admin') => {
  const results: Record<string, { success: boolean, message?: string, lastOutbound?: any }> = {};
  const storesToTest = appContext === 'levis' ? LEVIS : (appContext === 'bounty' ? BOUNTY_BRANDS : STORES);
  console.log(`Testing Parcelninja connection. AppContext: ${appContext}, Number of stores: ${storesToTest.length}, Stores: ${storesToTest.map(s => s.name).join(', ')}`);
  
  // Parallelise with staggering
  const connectionResults = await Promise.allSettled(
    storesToTest.map(async (store, i) => {
      try {
        await new Promise(resolve => setTimeout(resolve, i * 500));
        const client = createClient(store);
        
        // Fetch the most recent outbound to verify connection and see real data
        console.log(`[Parcelninja Test] Fetching last outbound for ${store.name}...`);
        const res = await client.get('/outbounds', { 
          params: { 
            pageSize: 1, 
            page: 1,
            orderBy: 'createDate',
            orderDirection: 'desc'
          } 
        });
        
        const lastOutbound = res.data?.outbounds?.[0] || null;
        if (lastOutbound) {
          console.log(`[Parcelninja Test] Found last outbound for ${store.name}: ${lastOutbound.outboundNo} created at ${lastOutbound.createDate}`);
        } else {
          console.log(`[Parcelninja Test] No outbounds found for ${store.name} (Store ID: ${store.store_id})`);
        }

        const maskedUser = store.username.substring(0, 4) + '...' + store.username.substring(store.username.length - 4);
        const storeInfo = `Store ID: ${store.store_id} | User: ${maskedUser}`;

        return { 
          storeName: store.name, 
          success: true, 
          lastOutbound,
          message: `Connected successfully. ${storeInfo}`
        };
      } catch (e: any) {
        let message = e.message;
        if (e.response) {
          const status = e.response.status;
          const data = e.response.data;
          if (status === 401) {
            message = 'Authentication failed. Please check your Parcelninja username and password.';
          } else if (status === 403) {
            message = `Access denied (403). The credentials may not have permission for store ID: ${store.store_id}`;
          } else if (status === 404) {
            message = 'API endpoint not found (404). Please check the BASE_URL.';
          } else if (status === 429) {
            message = 'Rate exceeded (429). Please try again later.';
          } else if (data) {
            message = typeof data === 'object' ? JSON.stringify(data) : data;
          }
        }
        console.error(`[Parcelninja Test] Connection failed for ${store.name}: ${message}`);
        const maskedUser = store.username.substring(0, 4) + '...' + store.username.substring(store.username.length - 4);
        const storeInfo = `Store ID: ${store.store_id} | User: ${maskedUser}`;
        return { 
          storeName: store.name, 
          success: false, 
          message: `${message} (${storeInfo})` 
        };
      }
    })
  );

  let overallSuccess = true;
  connectionResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { storeName, success, message, lastOutbound } = result.value;
      results[storeName] = { success, message, lastOutbound };
      if (!success) overallSuccess = false;
    } else {
      overallSuccess = false;
    }
  });

  return { 
    success: overallSuccess, 
    message: overallSuccess ? 'All stores connected' : 'Some stores failed to connect',
    details: results
  };
};
