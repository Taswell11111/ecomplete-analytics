import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from "vite";
import { FreshdeskSearchResponse, Ticket } from './types.js';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import cors from "cors";
import helmet from "helmet";
import nodemailer from 'nodemailer';
import { FRESHDESK_DOMAIN, DEFAULT_PROXY_URL, ACTIVE_TICKET_STATUSES, CONSOLIDATED_GROUP_ID, BOUNTY_APPAREL_GROUP_IDS, MASTER_GROUP_ID, REAL_GROUP_IDS, RETURNGO_LEVIS_STORE_URL, BOUNTY_STORE_URLS, BOUNTY_STORES_CONFIG, FRESHDESK_API_KEY, RETURNGO_LEVIS_API_KEY, RETURNGO_BOUNTY_API_KEY } from './constants.js';
import { format } from 'date-fns';
import axios from 'axios';

// Helper to call Freshdesk API from backend with retry logic
async function callFreshdeskApi(path: string, apiKey: string, connectionMode: string, method: string = 'GET', body?: any, retries = 3): Promise<any> {
  const url = `https://${FRESHDESK_DOMAIN}${path}`;

  const headers: Record<string, string> = {
    'Authorization': `Basic ${Buffer.from(`${apiKey}:x`).toString('base64')}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios({
      url,
      method,
      headers,
      data: body,
      validateStatus: () => true // Handle all statuses
    });
    
    if (response.status === 429 && retries > 0) {
      const retryAfter = parseInt(response.headers['retry-after'] || '2');
      console.log(`Rate limited (429). Retrying after ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return callFreshdeskApi(path, apiKey, connectionMode, method, body, retries - 1);
    }

    if (response.status >= 400) {
      const errorBody = typeof response.data === 'object' ? JSON.stringify(response.data) : response.data;
      console.warn(`Freshdesk API Error: ${response.status} - ${errorBody}`);
      // Return a more descriptive error that includes the status code from Freshdesk
      throw new Error(`Freshdesk API returned ${response.status} (${response.statusText}). Details: ${errorBody}`);
    }
    return response.data;
  } catch (error: any) {
    if (retries > 0 && !error.message?.includes('429')) {
      console.log(`Request failed, retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return callFreshdeskApi(path, apiKey, connectionMode, method, body, retries - 1);
    }
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(cors());
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "'unsafe-eval'", 
          "blob:", 
          "data:",
          "*.gstatic.com",
          "*.googleapis.com",
          "*.googletagmanager.com",
          "*.google.com",
          "*.google-analytics.com",
          "cdn.jsdelivr.net",
          "cdnjs.cloudflare.com"
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "*.googleapis.com", "*.gstatic.com", "cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "blob:", "*.gstatic.com", "*.googleapis.com", "*.google.com", "*.google-analytics.com", "picsum.photos", "*.picsum.photos"],
        connectSrc: ["'self'", "*.googleapis.com", "*.gstatic.com", "*.google.com", "*.google-analytics.com", "*.googletagmanager.com", "api.freshdesk.com", "api.returngo.ai"],
        fontSrc: ["'self'", "data:", "*.gstatic.com", "*.googleapis.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "data:", "blob:"],
        frameSrc: ["'self'", "https://aistudio.google.com", "https://*.run.app"],
        frameAncestors: ["'self'", "https://aistudio.google.com", "https://*.run.app"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(express.json()); // Enable JSON body parsing

  // Initialize Google Cloud Storage
  let storage: Storage;

  const firebaseServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (firebaseServiceAccountKey) {
    if (firebaseServiceAccountKey.trim().startsWith('{')) {
      try {
        const serviceAccount = JSON.parse(firebaseServiceAccountKey);
        storage = new Storage({
          projectId: serviceAccount.project_id,
          credentials: {
            client_email: serviceAccount.client_email,
            private_key: serviceAccount.private_key,
          },
        });
        // console.log('Google Cloud Storage initialised with service account key.');
      } catch (error) {
        console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON. Falling back to Application Default Credentials.');
        storage = new Storage();
      }
    } else {
      console.warn('FIREBASE_SERVICE_ACCOUNT_KEY is not a valid JSON string (it might be just the private key). Falling back to Application Default Credentials.');
      storage = new Storage();
    }
  } else {
    // console.log('Initialising Google Cloud Storage with Application Default Credentials.');
    storage = new Storage();
  }

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Import and use shipments router
  try {
    const shipmentsRouter = await import('./server/routes/shipments.js');
    app.use('/api', shipmentsRouter.default);
  } catch (err) {
    console.error('Failed to load shipments router:', err);
  }

  // Multer setup for file uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // Firebase Storage API Routes (Now using @google-cloud/storage)
  app.post('/api/storage/upload-report', (req, res, next) => {
      upload.single('report')(req, res, (err) => {
          if (err instanceof multer.MulterError) {
              console.error('Multer Error:', err);
              return res.status(400).json({ success: false, message: `Upload failed: ${err.message}` });
          } else if (err) {
              console.error('Unknown Upload Error:', err);
              return res.status(500).json({ success: false, message: `Upload failed: ${err.message}` });
          }
          next();
      });
  }, async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    try {
      // Use GCS_BUCKET_NAME from environment or fallback to project ID
      const bucketName = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_PROJECT || 'executive-reporting-dashboard-reports';
      const bucket = storage.bucket(bucketName);
      
      // Check if bucket exists, if not try to create it (if permissions allow)
      try {
          const [exists] = await bucket.exists();
          if (!exists) {
              const region = process.env.GOOGLE_CLOUD_REGION || 'europe-west2';
              console.log(`Bucket ${bucketName} does not exist. Attempting to create in ${region}...`);
              await bucket.create({ location: region.toUpperCase() }); 
              console.log(`Bucket ${bucketName} created successfully in ${region}.`);
          }
      } catch (checkErr: any) {
          console.warn(`Failed to check/create bucket: ${checkErr.message}. Proceeding to upload attempt anyway.`);
      }

      const fileName = `reports/${Date.now()}_${req.file.originalname}`;
      const file = bucket.file(fileName);

      await file.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
      });

      // Generate a signed URL for the file
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
      });

      res.json({ success: true, url, fileName });
    } catch (error: any) {
      console.error('Storage Upload Error:', error);
      // Ensure we return JSON, not HTML (which Express might do by default for 500s if not handled)
      res.status(500).json({ success: false, message: `Upload failed: ${error.message}` });
    }
  });

  app.get('/api/storage/download-report/:fileName', async (req, res) => {
    const { fileName } = req.params;

    try {
      const bucketName = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_PROJECT || 'executive-reporting-dashboard-reports';
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(`reports/${fileName}`);

      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ success: false, message: 'File not found.' });
      }

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
      });

      res.json({ success: true, url });
    } catch (error: any) {
      console.error('Storage Download Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Helper to call ReturnGo API from backend
  async function callReturnGoApi(path: string, apiKey: string, shopName: string, method: string = 'GET', body?: any, retries = 2): Promise<any> {
    const url = `https://api.returngo.ai${path}`;

    const headers: Record<string, string> = {
      "Accept": "application/json",
      "X-API-KEY": apiKey,
      "x-shop-name": shopName,
      "User-Agent": "ExecutiveReportingDashboard/1.0"
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    // console.log(`[ReturnGo] Calling ${method} ${url} for shop ${shopName}`);

    try {
      const response = await axios({
        url,
        method,
        headers,
        data: body,
        validateStatus: () => true
      });
      
      if (response.status >= 400) {
        const errorBody = typeof response.data === 'object' ? JSON.stringify(response.data) : response.data;
        console.error(`[ReturnGo] API Error: ${response.status} - ${errorBody} for ${url} (shop: ${shopName}). API Key: ${apiKey.substring(0, 5)}...`);
        
        // If it's a 403, it might be due to the API key or the shop name mismatch
        if (response.status === 403) {
          console.error(`[ReturnGo] 403 Forbidden for ${shopName}. Please verify that the API key is authorized for this specific shop. Headers sent: ${JSON.stringify({ ...headers, "X-API-KEY": "MASKED" })}`);
        }
        
        // If it's a 500 or 429, try to retry if we have retries left
        if ((response.status >= 500 || response.status === 429) && retries > 0) {
          console.log(`Retrying ReturnGo API call for ${url} due to ${response.status}... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // Increased delay
          return callReturnGoApi(path, apiKey, shopName, method, body, retries - 1);
        }
        
        let errorMessage = `ReturnGo API Error: ${response.status} - ${response.statusText} (Shop: ${shopName})`;
        try {
            const parsedError = typeof response.data === 'object' ? response.data : JSON.parse(response.data);
            if (parsedError.message) errorMessage += ` (${parsedError.message})`;
            else if (parsedError.error) errorMessage += ` (${parsedError.error})`;
        } catch (e) {
            if (errorBody && errorBody.length < 100) errorMessage += ` (${errorBody})`;
        }
        
        throw new Error(errorMessage);
      }
      return response.data;
    } catch (error: any) {
      console.error(`[ReturnGo] API Request Failed for ${url} (shop: ${shopName}): ${error.message}`);
      if (retries > 0 && !error.message?.includes('ReturnGo API Error: 4')) {
        console.log(`Retrying ReturnGo API call due to network error... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return callReturnGoApi(path, apiKey, shopName, method, body, retries - 1);
      }
      throw error;
    }
  }

  // Email API Route
  app.post('/api/email/send-brief', async (req, res) => {
    const { html_content } = req.body;
    const SENDER_PASS = process.env.EMAIL_PASS || "evpd vqfd vwku krkn";
    const RECIPIENT = "taswell@ecomplete.co.za";
    const SENDER_EMAIL = "taswell@ecomplete.co.za";

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: SENDER_EMAIL,
            pass: SENDER_PASS
        }
    });

    const mailOptions = {
        from: SENDER_EMAIL,
        to: RECIPIENT,
        subject: `CS Morning Brief – ${format(new Date(), 'dd MMM yyyy')}`,
        html: html_content
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("✅ SUCCESS: HTML Brief sent to Slack/Email.");
        res.json({ success: true, message: "Email sent successfully." });
    } catch (error: any) {
        console.error(`SMTP Error: ${error}`);
        res.status(500).json({ success: false, message: error.message });
    }
  });
  // ReturnGo API Proxy Routes
  app.post('/api/returngo/test-connection', async (req, res) => {
    const shopName = (req.body.shopName as string || "").trim();
    
    let apiKey = "";
    const bountyStore = BOUNTY_STORES_CONFIG.find(s => s.url === shopName);
    if (bountyStore) {
      apiKey = bountyStore.apiKey;
    } else if (shopName === RETURNGO_LEVIS_STORE_URL || shopName === "levis-sa.myshopify.com") {
      apiKey = RETURNGO_LEVIS_API_KEY;
    }

    if (!apiKey) {
      console.error(`ReturnGo API Key not configured for store: ${shopName}`);
      return res.status(400).json({ success: false, message: `ReturnGo API Key not configured for store: ${shopName}` });
    }

    try {
      const data = await callReturnGoApi('/rmas?pagesize=1&status=Pending', apiKey, shopName as string);
      res.json({ success: true, message: `Connected to ${shopName}` });
    } catch (error: any) {
      console.error(`ReturnGo connection failed for ${shopName}: ${error.message}`);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/returngo/test-rmas', async (req, res) => {
    const appContext = (req.query.appContext as string || "levis");
    const results: Record<string, any> = {};
    
    try {
      const storesToTest = appContext === 'bounty' ? BOUNTY_STORES_CONFIG : [{ name: 'LevisOnline', apiKey: RETURNGO_LEVIS_API_KEY, url: 'levis-sa.myshopify.com' }];

      // Test stores
      for (const store of storesToTest) {
        try {
          console.log(`[ReturnGo Test] Fetching last RMA for ${store.name} (${store.url})...`);
          const data = await callReturnGoApi('/rmas?pagesize=1&sort_by=-rma_created_at', store.apiKey, store.url);
          const lastRma = data.rmas?.[0] || null;
          
          if (lastRma) {
            const updatedAt = new Date(lastRma.rma_updated_at);
            const daysSinceUpdate = !isNaN(updatedAt.getTime()) ? Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)) : -1;
            
            results[store.name] = {
              success: true,
              rmaId: lastRma.rma_id,
              orderName: lastRma.order_name,
              createdAt: lastRma.rma_created_at,
              updatedAt: lastRma.rma_updated_at,
              daysSinceUpdate
            };
            console.log(`[ReturnGo Test] Found last RMA for ${store.name}: ${lastRma.rma_id}`);
          } else {
            results[store.name] = { success: true, rmaId: null, message: 'No RMAs found' };
            console.log(`[ReturnGo Test] No RMAs found for ${store.name}`);
          }
        } catch (err: any) {
          console.error(`[ReturnGo Test] Failed for ${store.name}: ${err.message}`);
          results[store.name] = { success: false, error: err.message };
        }
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/returngo/rmas', async (req, res) => {
    const shopName = (req.query.shopName as string || "").trim();
    const { status, pagesize, updatedAfter, breakdown } = req.query;
    
    let apiKey = "";
    const bountyStore = BOUNTY_STORES_CONFIG.find(s => s.url === shopName);
    if (bountyStore) {
      apiKey = bountyStore.apiKey;
    } else if (shopName === RETURNGO_LEVIS_STORE_URL) {
      apiKey = RETURNGO_LEVIS_API_KEY;
    }

    if (!apiKey) {
      return res.status(400).json({ success: false, message: `ReturnGo API Key not configured for store: ${shopName}` });
    }

    try {
      let path = `/rmas?pagesize=${pagesize}&status=${status}&sort_by=-rma_created_at`;
      if (updatedAfter) {
        path += `&rma_updated_at=gte:${updatedAfter}`;
      }
      if (breakdown) {
        path += `&breakdown=${breakdown}`;
      }
      const data = await callReturnGoApi(path, apiKey, shopName as string);
      res.json(data);
    } catch (error: any) {
      console.error(`[ReturnGo] API Request Failed: ${error.message}`);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/returngo/rma/:rmaId', async (req, res) => {
    const { rmaId } = req.params;
    const shopName = (req.query.shopName as string || "").trim();
    
    let apiKey = "";
    const bountyStore = BOUNTY_STORES_CONFIG.find(s => s.url === shopName);
    if (bountyStore) {
      apiKey = bountyStore.apiKey;
    } else if (shopName === RETURNGO_LEVIS_STORE_URL) {
      apiKey = RETURNGO_LEVIS_API_KEY;
    }

    if (!apiKey) {
      return res.status(400).json({ success: false, message: `ReturnGo API Key not configured for store: ${shopName}` });
    }

    try {
      const data = await callReturnGoApi(`/rma/${rmaId}`, apiKey, shopName as string);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Freshdesk API Proxy Routes
  app.post('/api/freshdesk/test-connection', async (req, res) => {
    const { connectionMode } = req.body;
    const apiKey = process.env.FRESHDESK_API_KEY || FRESHDESK_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Freshdesk API Key not configured on backend.' });
    }

    try {
      const data: { contact?: { name: string } } = await callFreshdeskApi('/api/v2/agents/me', apiKey, connectionMode);
      res.json({ success: true, message: `Connected as ${data.contact?.name || 'Authorised User'}` });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/freshdesk/tickets', async (req, res) => {
    const { query, page, connectionMode } = req.query;
    const apiKey = process.env.FRESHDESK_API_KEY || FRESHDESK_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Freshdesk API Key not configured on backend.' });
    }

    try {
      const queryString = typeof query === 'string' ? query : '';
      const finalQuery = queryString.startsWith('"') && queryString.endsWith('"') ? queryString : `"${queryString}"`;
      const encodedQuery = encodeURIComponent(finalQuery);
      const data: FreshdeskSearchResponse = await callFreshdeskApi(`/api/v2/search/tickets?query=${encodedQuery}&page=${page}`, apiKey, connectionMode as string);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/freshdesk/tickets/:ticketId/conversations', async (req, res) => {
    const { ticketId } = req.params;
    const { connectionMode } = req.query;
    const apiKey = process.env.FRESHDESK_API_KEY || FRESHDESK_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Freshdesk API Key not configured on backend.' });
    }

    try {
      const data: any[] = await callFreshdeskApi(`/api/v2/tickets/${ticketId}/conversations`, apiKey, connectionMode as string);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/freshdesk/contacts/:id', async (req, res) => {
    const { id } = req.params;
    const { connectionMode } = req.query;
    const apiKey = process.env.FRESHDESK_API_KEY || FRESHDESK_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Freshdesk API Key not configured on backend.' });
    }

    try {
      const data: any = await callFreshdeskApi(`/api/v2/contacts/${id}`, apiKey, connectionMode as string);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/freshdesk/tickets/:ticketId', async (req, res) => {
    const { ticketId } = req.params;
    const { connectionMode } = req.query;
    const apiKey = process.env.FRESHDESK_API_KEY || FRESHDESK_API_KEY;
    const payload = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Freshdesk API Key not configured on backend.' });
    }

    try {
      const data: Ticket = await callFreshdeskApi(`/api/v2/tickets/${ticketId}`, apiKey, connectionMode as string, 'PUT', payload);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/freshdesk/tickets/:ticketId/reply', async (req, res) => {
    const { ticketId } = req.params;
    const { connectionMode } = req.query;
    const apiKey = process.env.FRESHDESK_API_KEY || FRESHDESK_API_KEY;
    const payload = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Freshdesk API Key not configured on backend.' });
    }

    try {
      const data: any = await callFreshdeskApi(`/api/v2/tickets/${ticketId}/reply`, apiKey, connectionMode as string, 'POST', payload);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/freshdesk/dashboard-metrics', async (req, res) => {
    const { groupId, connectionMode } = req.query;
    const apiKey = process.env.FRESHDESK_API_KEY || FRESHDESK_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Freshdesk API Key not configured on backend.' });
    }

    try {
      if (!groupId) {
        return res.status(400).json({ success: false, message: 'Group ID is required.' });
      }

      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
      
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = format(sevenDaysAgo, 'yyyy-MM-dd');
      
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      const sixDaysAgoStr = format(sixDaysAgo, 'yyyy-MM-dd');

      let groupQuery = `group_id:${groupId}`;
      if (parseInt(groupId as string) === CONSOLIDATED_GROUP_ID) {
          groupQuery = `(${BOUNTY_APPAREL_GROUP_IDS.map(id => `group_id:${id}`).join(' OR ')})`;
      } else if (parseInt(groupId as string) === MASTER_GROUP_ID) {
          groupQuery = `(${REAL_GROUP_IDS.map(id => `group_id:${id}`).join(' OR ')})`;
      }

      const activeStatusString = ACTIVE_TICKET_STATUSES.map(s => `status:${s}`).join(' OR ');
      
      const activeQuery = `${groupQuery} AND (${activeStatusString})`;
      const createdTodayQuery = `${groupQuery} AND created_at:'${todayStr}'`;
      const createdYesterdayQuery = `${groupQuery} AND created_at:'${yesterdayStr}'`;
      const created7DaysQuery = `${groupQuery} AND created_at:'${sevenDaysAgoStr}'`;
      const createdLast7DaysQuery = `${groupQuery} AND created_at:>'${sevenDaysAgoStr}'`;
      
      const reopenedTodayQuery = `${groupQuery} AND status:9 AND updated_at:'${todayStr}'`;
      const reopenedYesterdayQuery = `${groupQuery} AND status:9 AND updated_at:'${yesterdayStr}'`;
      const reopened7DaysQuery = `${groupQuery} AND status:9 AND updated_at:'${sevenDaysAgoStr}'`;
      const closedTodayQuery = `${groupQuery} AND (status:4 OR status:5) AND updated_at:'${todayStr}'`;
      const closedYesterdayQuery = `${groupQuery} AND (status:4 OR status:5) AND updated_at:'${yesterdayStr}'`;
      const closed7DaysQuery = `${groupQuery} AND (status:4 OR status:5) AND updated_at:'${sevenDaysAgoStr}'`;
      const workedTodayQuery = `${groupQuery} AND updated_at:'${todayStr}'`;
      const workedYesterdayQuery = `${groupQuery} AND updated_at:'${yesterdayStr}'`;
      const worked7DaysQuery = `${groupQuery} AND updated_at:'${sevenDaysAgoStr}'`;

      const queries = [
          activeQuery, createdTodayQuery, createdYesterdayQuery, created7DaysQuery,
          reopenedTodayQuery, reopenedYesterdayQuery, reopened7DaysQuery,
          workedTodayQuery, workedYesterdayQuery, worked7DaysQuery,
          closedTodayQuery, closedYesterdayQuery, closed7DaysQuery, createdLast7DaysQuery
      ];

      // Execute queries in parallel with a small stagger to avoid hitting rate limits too hard
      const results = await Promise.all(queries.map(async (query, index) => {
        try {
          // Add a small delay based on index to stagger the start times
          if (index > 0) await new Promise(resolve => setTimeout(resolve, index * 100));
          
          return await callFreshdeskApi(
            `/api/v2/search/tickets?query=${encodeURIComponent(`"${query}"`)}&page=1`, 
            apiKey, 
            connectionMode as string
          );
        } catch (queryError: any) {
          console.error(`Error executing query ${index} (${query}):`, queryError.message);
          return { results: [], total: 0 };
        }
      }));

      const totals = results.map(r => r.total || r.results.length);

      let createdFrequency = "N/A";
      if (results[1].results && results[1].results.length > 1) {
          const times = results[1].results.map((t: Ticket) => new Date(t.created_at).getTime()).sort((a: number, b: number) => a - b);
          const avgDiffMins = Math.round((times[times.length-1] - times[0]) / (times.length-1) / 60000);
          createdFrequency = `${avgDiffMins} mins`;
      }

      let responseFrequency = "N/A";
      if (results[1].results && results[1].results.length > 0) {
           let totalMs = 0;
           let respondedCount = 0;
           results[1].results.forEach((t: Ticket) => {
              const diff = new Date(t.updated_at).getTime() - new Date(t.created_at).getTime();
              if (diff > 0) {
                  totalMs += diff;
                  respondedCount++;
              }
           });
           if (respondedCount > 0) {
               responseFrequency = `${(totalMs / respondedCount / 3600000).toFixed(1)} hrs`;
           }
      }
      
      const averageTickets7Days = Math.round(totals[13] / 7);

      const bucketByHour = (tickets: Ticket[], dateField: 'created_at' | 'updated_at') => {
          const buckets = new Array(24).fill(0);
          if (tickets) {
              tickets.forEach(t => buckets[new Date(t[dateField]).getHours()]++);
          }
          return buckets;
      };

      const ticketsByHour = bucketByHour(results[1].results, 'created_at');
      const workedTicketsByHour = bucketByHour(results[7].results, 'updated_at');
      const closedTicketsByHour = bucketByHour(results[10].results, 'updated_at');

      const ticketsByHour24hAgo = bucketByHour(results[2].results, 'created_at');
      const workedTicketsByHour24hAgo = bucketByHour(results[8].results, 'updated_at');
      const closedTicketsByHour24hAgo = bucketByHour(results[11].results, 'updated_at');

      const ticketsByHour7dAgo = bucketByHour(results[3].results, 'created_at');
      const workedTicketsByHour7dAgo = bucketByHour(results[9].results, 'updated_at');
      const closedTicketsByHour7dAgo = bucketByHour(results[12].results, 'updated_at');

      res.json({
          activeTickets: totals[0],
          createdToday: totals[1],
          createdTrend24h: totals[1] - totals[2],
          createdTrend7d: totals[1] - totals[3],
          reopenedToday: totals[4],
          reopenedTrend24h: totals[4] - totals[5],
          reopenedTrend7d: totals[4] - totals[6],
          workedToday: totals[7],
          workedTrend24h: totals[7] - totals[8],
          workedTrend7d: totals[7] - totals[9],
          closedToday: totals[10],
          closedTrend24h: totals[10] - totals[11],
          closedTrend7d: totals[10] - totals[12],
          ticketsByHour, workedTicketsByHour, closedTicketsByHour,
          ticketsByHour24hAgo, workedTicketsByHour24hAgo, closedTicketsByHour24hAgo,
          ticketsByHour7dAgo, workedTicketsByHour7dAgo, closedTicketsByHour7dAgo,
          createdFrequency, responseFrequency,
          averageTickets7Days
      });

    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from the 'dist/client' directory
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(path.resolve(__dirname, 'client')));
    app.use((req, res) => {
      res.sendFile(path.resolve(__dirname, 'client', 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
