

export type Group = {
  id: number;
  name: string;
}

export type Requester = {
  id: number;
  name: string;
  email: string;
}

export type Ticket = {
  id: number;
  subject: string;
  description: string;
  description_text: string;
  status: number;
  priority: number;
  created_at: string;
  updated_at: string;
  group_id: number;
  requester_id: number;
  responder_id: number | null;
  type: string | null;
  custom_fields: { [key: string]: any };
}

export type Conversation = {
  id: number;
  body: string;
  body_text: string;
  created_at: string;
  user_id: number;
  incoming: boolean;
  private: boolean;
}

export type Urgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export const CATEGORIES = [
  "Shipments", "Returns", "Refunds", "Exchanges", "Incorrect items",
  "Damages/defects", "Discount/Voucher", "Stock/product", "Spam", "Other"
] as const;

export type Category = typeof CATEGORIES[number];

export type TicketAnalysis = {
  urgency: Urgency;
  category: Category;
}

export type TicketActivity = {
  ticket: Ticket;
  conversations: Conversation[];
  aiSummary: string;
  timeSpent: number;
  analysis: TicketAnalysis;
  requesterName: string | null;
  lastResponseDate: string | null;
  statusSince: string;
  statusName: string;
  periodInStatus: string;
  sentimentScore: number;
  riskScore: number;
  brandName?: string;
}

export type GeminiSummaryResponse = {
  summary: string;
  timeSpentMinutes: number;
  urgency: string;
  category: string;
  sentimentScore: number;
  riskScore: number;
}

export type ConnectionMode = 'direct' | 'proxy';
export type ApiKeyStatus = 'idle' | 'testing' | 'valid' | 'invalid';
export type TestConnectionStatus = 'idle' | 'testing' | 'success' | 'failed';

export type TicketScope = '25' | '50' | '75' | 'all' | 'custom';

export type SortConfig = {
  key: keyof TicketActivity | string;
  direction: 'ascending' | 'descending';
}

export type FreshdeskSearchResponse = {
  results: Ticket[];
  total: number;
}

export type DashboardMetrics = {
  activeTickets: number;
  createdToday: number;
  createdTrend24h: number;
  createdTrend7d: number;
  reopenedToday: number;
  reopenedTrend24h: number;
  reopenedTrend7d: number;
  workedToday: number;
  workedTrend24h: number;
  workedTrend7d: number;
  closedToday: number;
  closedTrend24h: number;
  closedTrend7d: number;
  ticketsByHour: number[]; 
  workedTicketsByHour: number[];
  closedTicketsByHour: number[];
  // Historical 24h (Yesterday) comparison data
  ticketsByHour24hAgo: number[];
  workedTicketsByHour24hAgo: number[];
  closedTicketsByHour24hAgo: number[];
  // Historical 7-day comparison data
  ticketsByHour7dAgo: number[];
  workedTicketsByHour7dAgo: number[];
  closedTicketsByHour7dAgo: number[];
  createdFrequency: string; 
  responseFrequency: string;
  averageTickets7Days: number; // New field for average
  // Pulse Metrics
  respondedCount?: number;
  unrespondedCount?: number;
  avgAgeDays?: number;
  requesterLastCount?: number;
  agentLastCount?: number;
}

export type SavedReport = {
  id: string;
  timestamp: string;
  group: Group;
  metrics: DashboardMetrics;
  activities: TicketActivity[];
  executiveSummary: string;
}

// --- ReturnGo Specific Types ---

export type ReturnGoRMA = {
  rmaId: string;
  status: string;
  createdAt: string;
  rma_created_at?: string; // Added for `services/returnGoService.ts`
  updatedAt?: string;
  rma_updated_at?: string;
  lastUpdated?: string;
  shipments?: Array<{
    trackingNumber?: string;
    shipmentId?: string;
    carrier?: string; // Added carrier for better info
  }>;
  comments?: Array<{
    htmlText: string;
    datetime: string;
    author?: string; // Added author to distinguish customer/agent comments
  }>;
  transactions?: Array<{
    type: string; // e.g., 'Refund Paid', 'Store Credit'
    status: string; // e.g., 'Success', 'Failed'
    createdAt?: string; // Timestamp of the transaction
  }>;
  exchangeOrders?: Array<{
    orderName: string;
    createdAt?: string; // Timestamp of the exchange order creation
  }>;
  // Enriched fields
  trackingNumber?: string; // Consolidated tracking number
  trackingStatus?: string;
  resolutionActioned?: boolean;
  resolutionActionedDate?: string | null; // Date when resolution was actioned
  daysSinceResolutionActioned?: number | null; // Days since resolution was actioned
  isFlagged?: boolean;
  isCourierCancelled?: boolean;
  failures?: string[];
  items?: Array<{
      productName: string;
      sku: string;
      returnReason: string;
      resolutionType: string;
      paidPrice: { amount: number };
  }>;
  rmaSummary?: any; // For flexible structure
  // New fields for detailed view
  orderName?: string;
  customerName?: string;
  resolutionTypeOverall?: string;
};

export type RmaShortInfo = {
    id: string;
    reason: string;
    resolution: string;
    status: string;
};

export type ProductStats = {
    name: string;
    sku: string;
    activeCount: number;
    doneCount: number; // Count in Done RMAs
    totalValue: number;
    activeRmas: RmaShortInfo[]; // Drill down list
};

export type ReturnGoMetrics = {
  totalOpen: number;
  pending: number;
  inTransit: number;
  received: number;
  issues: number;
  flagged: number;
  submitted: number;
  delivered: number;
  courierCancelled: number;
  noTracking: number;
  resolutionActioned: number;
  noResolutionActioned: number;
  timelineData: { date: string; count: number }[]; // Added timeline data
  // New properties to store lists of RMAs for drill-down and charts
  totalReturns: number; // Added
  statusBreakdown: { [key: string]: number }; // Added
  resolutionTypes: { [key: string]: number }; // Added
  returnReasons: { [key: string]: number }; // Added
  policyRules: { [key: string]: number }; // Added
  dailyTrend: { date: string; count: number }[]; // Added for charts
  completedTrend: { date: string; count: number }[]; // Added for charts
  approvedTrend: { date: string; count: number }[]; // Added for charts
  receivedTrend: { date: string; count: number }[]; // Added for charts
  avgReturnValue: number; // Added
  sampleSize: number; // Added
  completedSampleSize: number; // Added
  topProducts: ProductStats[]; // Added for product matrix
  
  // Advanced Analytics & Financial KPIs
  revenueRetained: number; // Value of Exchanges / Store Credit
  revenueLost: number; // Value of Refunds
  averageTTR: number; // Average Time to Resolution in days
  agingReturnsCount: number; // RMAs open for > 14 days
  
  // Period-over-Period (PoP) Comparisons
  popReturnVolume: number; // % change in return volume vs previous period
  popRevenueRetained: number; // % change in revenue retained vs previous period
};

// Interface for the full ReturnGo dashboard data including RMA lists
export interface FullReturnGoDashboardData {
  metrics: ReturnGoMetrics;
  rmaLists: {
    Pending: ReturnGoRMA[];
    ToShip: ReturnGoRMA[];
    InTransit: ReturnGoRMA[];
    Received: ReturnGoRMA[];
    Attention: ReturnGoRMA[]; // Also include Attention list for possible future use
    Retained?: ReturnGoRMA[];
    Lost?: ReturnGoRMA[];
    Aging?: ReturnGoRMA[];
    allActiveRmas?: ReturnGoRMA[];
    allCompletedRmas?: ReturnGoRMA[];
  };
}

// --- Bounty Apparel Specific Types ---

export type BountyMetricData = {
  activeReturns: number;
  pending: number;
  approved: number;
  received: number;
  breakdown: { status: string; count: number; percentage: number }[];
  dailyTrend: { date: string; count: number }[];
  // Extended fields for dashboard
  Pending: number;
  ToShip: number;
  InTransit: number;
  Received: number;
  Attention: number;
  Done7d: number;
  // Advanced Analytics & Financial KPIs
  revenueRetained: number;
  revenueLost: number;
  averageTTR: number;
  agingReturnsCount: number;
  popReturnVolume: number;
  popRevenueRetained: number;
  // Add RMA lists for Bounty as well
  pendingRmas?: ReturnGoRMA[];
  toShipRmas?: ReturnGoRMA[];
  inTransitRmas?: ReturnGoRMA[];
  receivedRmas?: ReturnGoRMA[];
  attentionRmas?: ReturnGoRMA[];
  retainedRmas?: ReturnGoRMA[];
  lostRmas?: ReturnGoRMA[];
  agingRmas?: ReturnGoRMA[];
  allActiveRmas?: ReturnGoRMA[];
  allCompletedRmas?: ReturnGoRMA[];
};

export type BountyDashboardData = {
  aggregated: any;
  byStore: Record<string, BountyMetricData>;
  storeDailyTrends: Record<string, { date: string; count: number }[]>;
  storeCompletedTrends: Record<string, { date: string; count: number }[]>;
  storeApprovedTrends: Record<string, { date: string; count: number }[]>;
};