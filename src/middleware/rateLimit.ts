import rateLimit from 'express-rate-limit';

export const bookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 booking attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: 'Too many booking attempts. Please try again later.',
  },
});
