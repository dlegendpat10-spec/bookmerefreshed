import { Router } from 'express';
import { register, login, logout, getMe, forgotPassword, resetPassword, testEmailDelivery } from '../controllers/authController';

const router = Router();

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', getMe);
router.post('/auth/logout', logout);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password', resetPassword);
router.post('/auth/test-email', testEmailDelivery);

export default router;
