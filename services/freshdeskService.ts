
import { Ticket, Conversation, ConnectionMode, FreshdeskSearchResponse, Requester, DashboardMetrics } from '../types';
import { FRESHDESK_DOMAIN, DEFAULT_PROXY_URL, ACTIVE_TICKET_STATUSES, CONSOLIDATED_GROUP_ID, BOUNTY_APPAREL_GROUP_IDS, MASTER_GROUP_ID, REAL_GROUP_IDS } from '../constants';
import { format } from 'date-fns';

type ApiConfig = {
  connectionMode: ConnectionMode;
}

// --- Rate Limiter & Queue System ---
const MAX_CONCURRENT_REQUESTS = 2; 
const MIN_REQUEST_SPACING_MS = 350; 
const SAFETY_BUFFER_MS = 500;

class RateLimiter {
  queue: Array<() => Promise<void>> = [];
  activeRequests = 0;
  lastRequestTime = 0;
  globalRetryAfter = 0; 
  rateLimitRemaining = 1000; 

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const work = async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };
      this.queue.push(work);
      this.processQueue();
    });
  }

  async processQueue() {
    const now = Date.now();
    if (now < this.globalRetryAfter) {
      const waitTime = this.globalRetryAfter - now;
      setTimeout(() => this.processQueue(), waitTime + 100);
      return;
    }
    if (this.activeRequests >= MAX_CONCURRENT_REQUESTS) return;
    if (this.queue.length === 0) return;

    let dynamicSpacing = MIN_REQUEST_SPACING_MS;
    if (this.rateLimitRemaining < 50) dynamicSpacing = 1000; 
    if (this.rateLimitRemaining < 10) dynamicSpacing = 3000;

    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < dynamicSpacing) {
      setTimeout(() => this.processQueue(), dynamicSpacing - timeSinceLast);
      return;
    }

    const nextTask = this.queue.shift();
    if (nextTask) {
      this.activeRequests++;
      this.lastRequestTime = Date.now();
      nextTask();
    }
  }

  updateFromHeaders(headers: Headers) {
    const remaining = headers.get('X-RateLimit-Remaining');
    if (remaining) this.rateLimitRemaining = parseInt(remaining, 10);
    const retryAfter = headers.get('Retry-After');
    if (retryAfter) this.setGlobalBackoff(parseInt(retryAfter, 10));
  }

  setGlobalBackoff(seconds: number) {
    this.globalRetryAfter = Date.now() + (seconds * 1000) + SAFETY_BUFFER_MS;
  }
}

const limiter = new RateLimiter();

const getFreshdeskBackendUrl = (path: string) => {
  return `/api/freshdesk${path}`;
};

const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};

const handleApiError = async (response: Response) => {
  const errorBodyText = await response.text();
  let errorDetails = `Status ${response.status}: ${response.statusText}`;
  try {
    const errorBody = JSON.parse(errorBodyText);
    if (errorBody.description) errorDetails += ` - ${errorBody.description}`;
    if (errorBody.errors) errorDetails += ` (${JSON.stringify(errorBody.errors)})`;
  } catch (e) {
    // If it's HTML (likely a proxy error), provide a cleaner message
    if (errorBodyText.trim().startsWith('<!doctype') || errorBodyText.trim().startsWith('<html')) {
        errorDetails += " (The server returned an HTML error page, likely due to a timeout or proxy issue)";
    }
  }
  return new Error(errorDetails);
};

const safeJson = async (response: Response) => {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('Failed to parse JSON response:', text.substring(0, 100));
        throw new Error('The server returned an invalid response. This often happens during high load or timeouts.');
    }
};

const fetchWithRetry = async (url: string, options: RequestInit, retries = 2): Promise<Response> => {
  return limiter.schedule(async () => {
    try {
      const response = await fetch(url, options);
      limiter.updateFromHeaders(response.headers);
      if (response.status === 429 && retries > 0) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return fetchWithRetry(url, options, retries - 1);
      }
      return response;
    } catch (error: any) {
      if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000));
          return fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  });
};

export const testConnection = async (config: ApiConfig): Promise<{ success: boolean; message: string }> => {
  const url = getFreshdeskBackendUrl('/test-connection');
  try {
    const headers = getHeaders();
    const response = await fetchWithRetry(url, { headers, method: 'POST', body: JSON.stringify({ connectionMode: config.connectionMode }) }, 0); 
    if (!response.ok) {
      const error = await handleApiError(response);
      return { success: false, message: error.message };
    }
    const data = await safeJson(response);
    return { success: true, message: data.message };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const getTickets = async (query: string, config: ApiConfig, page: number = 1): Promise<FreshdeskSearchResponse> => {
  const url = getFreshdeskBackendUrl(`/tickets?query=${encodeURIComponent(query)}&page=${page}&connectionMode=${config.connectionMode}`);
  const headers = getHeaders();
  const response = await fetchWithRetry(url, { headers });
  if (!response.ok) throw await handleApiError(response);
  const data = await safeJson(response);
  return data as FreshdeskSearchResponse;
};

export const getConversations = async (ticketId: number, config: ApiConfig): Promise<Conversation[]> => {
  const url = getFreshdeskBackendUrl(`/tickets/${ticketId}/conversations?connectionMode=${config.connectionMode}`);
  const headers = getHeaders();
  const response = await fetchWithRetry(url, { headers });
  if (!response.ok) throw await handleApiError(response);
  return await safeJson(response);
};

export const getRequesters = async (requesterIds: number[], config: ApiConfig): Promise<Requester[]> => {
  const headers = getHeaders();
  const uniqueIds = [...new Set(requesterIds)];
  
  const results: (Requester | null)[] = [];
  for (let i = 0; i < uniqueIds.length; i++) {
    const id = uniqueIds[i];
    const url = getFreshdeskBackendUrl(`/contacts/${id}?connectionMode=${config.connectionMode}`);
    try {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 100)); // Stagger requests
      const response = await fetchWithRetry(url, { headers });
      if (!response.ok) {
        results.push(null);
      } else {
        results.push(await safeJson(response));
      }
    } catch (e) {
      results.push(null);
    }
  }

  return results.filter((r): r is Requester => r !== null);
};

export const updateTicket = async (ticketId: number, data: Partial<Ticket>, config: ApiConfig): Promise<Ticket> => {
  const url = getFreshdeskBackendUrl(`/tickets/${ticketId}?connectionMode=${config.connectionMode}`);
  const headers = getHeaders();
  
  const payload: any = {};
  
  if (data.custom_fields) payload.custom_fields = data.custom_fields;
  if (data.status) payload.status = data.status;
  if (data.priority) payload.priority = data.priority;
  if (data.type) payload.type = data.type;

  const response = await fetchWithRetry(url, { 
    method: 'PUT',
    headers, 
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) throw await handleApiError(response);
  return await safeJson(response);
};

export const sendTicketReply = async (ticketId: number, data: { body: string, from_email?: string }, config: ApiConfig): Promise<Conversation> => {
    const url = getFreshdeskBackendUrl(`/tickets/${ticketId}/reply?connectionMode=${config.connectionMode}`);
    const headers = getHeaders();
    
    // Construct basic payload
    const payload: any = { body: data.body };
    if (data.from_email) payload.from_email = data.from_email;

    const response = await fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw await handleApiError(response);
    return await safeJson(response);
};

export const getDashboardMetrics = async (groupId: number, config: ApiConfig): Promise<DashboardMetrics> => {
    const url = getFreshdeskBackendUrl(`/dashboard-metrics?groupId=${groupId}&connectionMode=${config.connectionMode}`);
    const headers = getHeaders();
    const response = await fetchWithRetry(url, { headers });
    if (!response.ok) throw await handleApiError(response);
    return await safeJson(response);
};


