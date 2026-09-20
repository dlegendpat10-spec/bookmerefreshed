import { Router } from 'express';
import { createBusiness, getMyBusiness, updateMyBusiness } from '../controllers/businessController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/businesses', requireAdmin, createBusiness);
router.get('/businesses/me', requireAdmin, getMyBusiness);
router.put('/businesses/me', requireAdmin, updateMyBusiness);
router.patch('/businesses/me', requireAdmin, updateMyBusiness);

export default router;
