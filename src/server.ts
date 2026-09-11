import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import businessRoutes from './routes/business';
import serviceRoutes from './routes/services';
import customerRoutes from './routes/customers';
import bookingRoutes from './routes/bookings';
import slotRoutes from './routes/slots';
import availabilityRoutes from './routes/availability';
import dashboardRoutes from './routes/dashboard';
import { sendSuccess, sendError } from './utils/response';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Dynamic CORS configuration allowing localhost & Vercel production domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://bookme-indol-six.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive CORS for public REST API
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome & API info endpoint (Handles GET /)
app.get('/', (req: Request, res: Response) => {
  sendSuccess(res, {
    message: 'Bookme REST API Server',
    status: 'online',
    version: '1.0.0',
    healthCheck: '/health',
    apiBaseUrl: '/api/v1',
  });
});

// Liveness & Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API v1 Base Route Info
app.get('/api/v1', (req: Request, res: Response) => {
  sendSuccess(res, {
    message: 'Bookme API v1 Endpoints',
    status: 'online',
    endpoints: [
      'GET /health',
      'POST /api/v1/auth/register',
      'POST /api/v1/auth/login',
      'GET /api/v1/auth/me',
      'POST /api/v1/businesses',
      'GET /api/v1/services?slug=luxe-grooming',
      'GET /api/v1/slots?serviceId=...&date=YYYY-MM-DD',
      'POST /api/v1/bookings',
      'GET /api/v1/dashboard/stats',
    ],
  });
});

// API v1 Routes
const API_PREFIX = '/api/v1';

app.use(API_PREFIX, authRoutes);
app.use(API_PREFIX, businessRoutes);
app.use(API_PREFIX, serviceRoutes);
app.use(API_PREFIX, customerRoutes);
app.use(API_PREFIX, bookingRoutes);
app.use(API_PREFIX, slotRoutes);
app.use(API_PREFIX, availabilityRoutes);
app.use(API_PREFIX, dashboardRoutes);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  sendError(res, `Route not found: ${req.method} ${req.path}`, 404);
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  sendError(res, 'Internal Server Error', 500);
});

app.listen(PORT, () => {
  console.log(`🚀 Bookme REST API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Base URL: http://localhost:${PORT}${API_PREFIX}`);
});

export default app;
