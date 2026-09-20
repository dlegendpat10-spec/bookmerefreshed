import { Router } from 'express';
import {
  getPaystackConfig,
  initializePayment,
  verifyPayment,
  handleWebhook,
} from '../controllers/paymentController';

export const paymentRouter = Router();

paymentRouter.get('/config', getPaystackConfig);
paymentRouter.post('/initialize', initializePayment);
paymentRouter.get('/verify/:reference', verifyPayment);
paymentRouter.post('/webhook', handleWebhook);
