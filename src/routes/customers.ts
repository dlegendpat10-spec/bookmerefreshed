import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBookings,
} from '../controllers/customerController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Public route (Customer registration during booking flow)
router.post('/customers', createCustomer);

// Admin protected routes
router.get('/admin/customers', requireAdmin, getCustomers);
router.get('/admin/customers/:id', requireAdmin, getCustomerById);
router.patch('/admin/customers/:id', requireAdmin, updateCustomer);
router.delete('/admin/customers/:id', requireAdmin, deleteCustomer);
router.get('/admin/customers/:id/bookings', requireAdmin, getCustomerBookings);

export default router;
