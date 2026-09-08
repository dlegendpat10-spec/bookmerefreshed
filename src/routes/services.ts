import { Router } from 'express';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} from '../controllers/serviceController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Public routes (for booking wizard)
router.get('/services', getServices);
router.get('/services/:id', getServiceById);

// Admin protected routes
router.post('/admin/services', requireAdmin, createService);
router.patch('/admin/services/:id', requireAdmin, updateService);
router.delete('/admin/services/:id', requireAdmin, deleteService);

export default router;
