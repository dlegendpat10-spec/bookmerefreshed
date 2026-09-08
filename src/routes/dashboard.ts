import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/admin/dashboard/stats', requireAdmin, getDashboardStats);

export default router;
