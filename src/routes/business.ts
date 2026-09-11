import { Router } from 'express';
import { createBusiness, getMyBusiness } from '../controllers/businessController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/businesses', requireAdmin, createBusiness);
router.get('/businesses/me', requireAdmin, getMyBusiness);

export default router;
