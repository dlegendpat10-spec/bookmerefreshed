import { Router } from 'express';
import {
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  respondToBooking,
  getEmailNotifications,
} from '../controllers/bookingController';
import { requireAdmin } from '../middleware/auth';
import { bookingRateLimiter } from '../middleware/rateLimit';
import { checkIdempotency } from '../middleware/idempotency';

const router = Router();

// Public booking creation route (Step 4 of wizard)
router.post('/bookings', bookingRateLimiter, checkIdempotency, createBooking);

// Admin protected booking management routes
router.get('/admin/bookings', requireAdmin, getBookings);
router.get('/admin/bookings/:id', requireAdmin, getBookingById);
router.patch('/admin/bookings/:id/status', requireAdmin, updateBookingStatus);
router.post('/admin/bookings/:id/respond', requireAdmin, respondToBooking);
router.get('/admin/notifications', requireAdmin, getEmailNotifications);

export default router;
