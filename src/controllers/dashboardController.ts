import { Response } from 'express';
import { pool } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';

const DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

export async function getDashboardStats(req: AuthenticatedRequest, res: Response) {
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  try {
    const todayQuery = `
      SELECT COUNT(*) as count FROM service_bookings
      WHERE business_id = $1 AND booking_date = CURRENT_DATE AND status <> 'CANCELLED'
    `;
    const customerQuery = `
      SELECT COUNT(*) as count FROM customers WHERE business_id = $1
    `;
    const pendingQuery = `
      SELECT COUNT(*) as count FROM service_bookings WHERE business_id = $1 AND status = 'PENDING'
    `;
    const revenueQuery = `
      SELECT COALESCE(SUM(amount), 0) as total FROM service_bookings
      WHERE business_id = $1 AND status <> 'CANCELLED'
        AND booking_date >= date_trunc('month', CURRENT_DATE)
        AND booking_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    `;
    const totalBookingsQuery = `
      SELECT COUNT(*) as count FROM service_bookings WHERE business_id = $1
    `;

    const [todayRes, custRes, pendRes, revRes, totRes] = await Promise.all([
      pool.query(todayQuery, [businessId]),
      pool.query(customerQuery, [businessId]),
      pool.query(pendingQuery, [businessId]),
      pool.query(revenueQuery, [businessId]),
      pool.query(totalBookingsQuery, [businessId]),
    ]);

    return sendSuccess(res, {
      todayCount: parseInt(todayRes.rows[0].count, 10),
      totalCustomers: parseInt(custRes.rows[0].count, 10),
      pendingCount: parseInt(pendRes.rows[0].count, 10),
      monthRevenue: parseFloat(revRes.rows[0].total),
      totalBookings: parseInt(totRes.rows[0].count, 10),
    });
  } catch (error: any) {
    console.error('getDashboardStats error:', error);
    return sendError(res, 'Failed to fetch dashboard statistics', 500);
  }
}
