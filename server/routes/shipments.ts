import { Router } from 'express';
import { getShipments, testParcelninjaConnection } from '../parcelninja';

const router = Router();

router.get('/parcelninja/test-connection', async (req, res) => {
  try {
    const appContext = (req.query.appContext as 'levis' | 'bounty' | 'admin') || 'admin';
    const result = await testParcelninjaConnection(appContext);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/shipments', async (req, res) => {
  try {
    const type = req.query.type as 'outbound' | 'inbound';
    const days = parseInt(req.query.days as string) || 30;

    if (type !== 'outbound' && type !== 'inbound') {
      return res.status(400).json({ error: 'Invalid type parameter. Must be outbound or inbound.' });
    }

    const data = await getShipments(type, days, req.query.storeName as string, req.query.appContext as 'levis' | 'bounty' | 'admin');
    res.json(data);
  } catch (error: any) {
    console.error('Error in /api/shipments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
