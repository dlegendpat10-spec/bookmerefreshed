import { Router } from 'express';
import {
  getBusinessHours,
  updateBusinessHours,
  getBlockedDates,
  addBlockedDate,
  removeBlockedDate,
} from '../controllers/availabilityController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Public availability routes
router.get('/business/hours', getBusinessHours);
router.get('/business/blocked-dates', getBlockedDates);

// Admin availability management routes
router.patch('/admin/business/hours/:dow', requireAdmin, updateBusinessHours);
router.post('/admin/business/blocked-dates', requireAdmin, addBlockedDate);
router.delete('/admin/business/blocked-dates/:id', requireAdmin, removeBlockedDate);

export default router;
