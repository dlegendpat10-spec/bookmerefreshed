import { Router } from 'express';
import { login, logout } from '../controllers/authController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', requireAdmin, logout);

export default router;
