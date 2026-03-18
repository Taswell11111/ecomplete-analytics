
import { Group } from './types';

// Configuration
export const FRESHDESK_DOMAIN = 'ecomplete.freshdesk.com';
export const FALLBACK_API_KEY = '';
export const DEFAULT_PROXY_URL = 'https://corsproxy.io/?';

// ReturnGo Configuration
export const RETURNGO_LEVIS_API_KEY = process.env.RETURNGO_LEVIS_API_KEY || "WsIPXwH9w45gaaGrl5BfZ9EeF52MlUqp79G0fIEU";
export const RETURNGO_BOUNTY_API_KEY = process.env.RETURNGO_BOUNTY_API_KEY || "G0dxSEprxa5iOAIsK5X6g7fCDdPl09q2882osmWD";
export const RETURNGO_STORE_URL = process.env.RETURNGO_LEVIS_STORE_URL || "levis-sa.myshopify.com";

// Bounty Individual Store URLs and API Keys
export const BOUNTY_DIESEL_URL = process.env.RETURNGO_DIESEL_STORE_URL || "diesel-dev-south-africa.myshopify.com";
export const BOUNTY_DIESEL_KEY = process.env.RETURNGO_DIESEL_API_KEY || RETURNGO_BOUNTY_API_KEY;

export const BOUNTY_HURLEY_URL = process.env.RETURNGO_HURLEY_STORE_URL || "hurley-dev-south-africa.myshopify.com";
export const BOUNTY_HURLEY_KEY = process.env.RETURNGO_HURLEY_API_KEY || RETURNGO_BOUNTY_API_KEY;

export const BOUNTY_JEEP_URL = process.env.RETURNGO_JEEP_STORE_URL || "jeep-apparel-dev-south-africa.myshopify.com";
export const BOUNTY_JEEP_KEY = process.env.RETURNGO_JEEP_API_KEY || RETURNGO_BOUNTY_API_KEY;

export const BOUNTY_REEBOK_URL = process.env.RETURNGO_REEBOK_STORE_URL || "reebok-dev-south-africa.myshopify.com";
export const BOUNTY_REEBOK_KEY = process.env.RETURNGO_REEBOK_API_KEY || RETURNGO_BOUNTY_API_KEY;

export const BOUNTY_SUPERDRY_URL = process.env.RETURNGO_SUPERDRY_STORE_URL || "superdry-dev-south-africa.myshopify.com";
export const BOUNTY_SUPERDRY_KEY = process.env.RETURNGO_SUPERDRY_API_KEY || RETURNGO_BOUNTY_API_KEY;

export const BOUNTY_STORES_CONFIG = [
  { name: 'Diesel', url: BOUNTY_DIESEL_URL, apiKey: BOUNTY_DIESEL_KEY },
  { name: 'Hurley', url: BOUNTY_HURLEY_URL, apiKey: BOUNTY_HURLEY_KEY },
  { name: 'Jeep', url: BOUNTY_JEEP_URL, apiKey: BOUNTY_JEEP_KEY },
  { name: 'Reebok', url: BOUNTY_REEBOK_URL, apiKey: BOUNTY_REEBOK_KEY },
  { name: 'Superdry', url: BOUNTY_SUPERDRY_URL, apiKey: BOUNTY_SUPERDRY_KEY }
];

export const BOUNTY_STORE_URLS = BOUNTY_STORES_CONFIG.map(s => s.url);

// Freshdesk Configuration
export const FRESHDESK_API_KEY = process.env.FRESHDESK_API_KEY || "";

// Group IDs for consolidation
export const BOUNTY_APPAREL_GROUP_IDS = [
  24000009010, // Diesel
  24000009052, // Hurley
  24000009038, // Jeep
  24000009035, // Reebok
  24000009051  // Superdry
];

export const REAL_GROUP_IDS = [
  24000008969, // Levi's
  24000005392, // PnP
  ...BOUNTY_APPAREL_GROUP_IDS
];

export const CONSOLIDATED_GROUP_ID = 999999999;
export const MASTER_GROUP_ID = 888888888;

export const ECOMPLETE_GROUPS: Group[] = [
  { id: MASTER_GROUP_ID, name: "MASTER Executive Report" },
  { id: 24000008969, name: "Levi's South Africa Online" },
  { id: 24000005392, name: "Pick n Pay Clothing Online" },
  { id: CONSOLIDATED_GROUP_ID, name: "Bounty Apparel_Consolidated" },
  { id: 24000009010, name: "Diesel Online South Africa" },
  { id: 24000009052, name: "Hurley Online South Africa" },
  { id: 24000009038, name: "Jeep Apparel Online South Africa" },
  { id: 24000009035, name: "Reebok Online South Africa" },
  { id: 24000009051, name: "Superdry Online South Africa" }
];

export const TICKET_STATUS_MAP: { [key: number]: string } = {
  2: "Open",
  3: "Pending",
  4: "Resolved",
  5: "Closed",
  6: "Waiting on Customer",
  7: "Waiting on Third Party",
  8: "Pending_2",
  9: "Reopened",
  12: "Waiting on Collection",
  13: "Waiting on Delivery",
  14: "Waiting on Feedback",
  15: "Waiting on Refund",
  17: "Waiting on Warehouse",
  18: "Custom Status 18", 
};

// Status IDs considered "Active" (not closed or resolved)
// Valid values based on error feedback
export const ACTIVE_TICKET_STATUSES = [2, 3, 6, 7, 8, 9, 12, 13, 14, 15, 17, 18];

export const TICKET_TYPES = [
  "Account related", "Assembly", "Cancel Order", "Damaged/Defective item",
  "Delivery query", "Duplicate ticket", "Exchange request", "General Assistance",
  "Invoice request", "Marketing/Promotions/Sponsorships", "Other", "Payment query",
  "Refunds", "Repairs", "Return", "Service Task", "Spam", "Stock/Product Query",
  "Store-Related", "Test", "There's an issue with my order", "Update Order/Details",
  "Website Issue", "Where is my order", "Voucher/Discount Code"
];

export const CATEGORIES = [
  "Shipments", "Returns", "Refunds", "Exchanges", "Incorrect items",
  "Damages/defects", "Discount/Voucher", "Stock/product", "Spam", "Other"
] as const;

export const WITTY_ONE_LINERS = [
  "I'm not arguing, I'm just explaining why I'm right.",
  "I put the 'pro' in procrastinate.",
  "Loading... please hold your breath.",
  "Why do Java developers wear glasses? Because they don't C#.",
  "I told my computer I needed a break, and now it won't stop sending me Kit-Kats.",
  "404: Motivation not found.",
  "Artificial Intelligence is no match for natural stupidity.",
  "I plan to live forever. So far, so good."
];

export const CATEGORY_COLORS = [
  '#4CAF50', // Green
  '#FFC107', // Amber
  '#2196F3', // Blue
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#00BCD4', // Cyan
  '#E91E63', // Pink
  '#3F51B5', // Indigo
  '#009688', // Teal
  '#CDDC39', // Lime
  '#FF5722', // Deep Orange
  '#607D8B', // Blue Grey
  '#8BC34A', // Light Green
  '#FFEB3B', // Yellow
  '#03A9F4', // Light Blue
  '#FFC107', // Amber (again, to ensure enough colours)
  '#795548', // Brown
  '#673AB7', // Deep Purple
  '#8BC34A', // Light Green (again)
  '#FF5722', // Deep Orange (again)
];
