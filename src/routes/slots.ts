import { Router } from 'express';
import { getAvailableSlots } from '../controllers/slotController';

const router = Router();

// Public time slot calculation endpoint
router.get('/slots', getAvailableSlots);

export default router;
