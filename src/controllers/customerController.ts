import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';

const DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

export async function getCustomers(req: AuthenticatedRequest, res: Response) {
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM customers WHERE business_id = $1 ORDER BY created_at DESC`,
      [businessId]
    );
    return sendSuccess(res, rows);
  } catch (error: any) {
    console.error('getCustomers error:', error);
    return sendError(res, 'Failed to fetch customers', 500);
  }
}

export async function getCustomerById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM customers WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
    if (rows.length === 0) {
      return sendError(res, 'Customer not found', 404);
    }
    return sendSuccess(res, rows[0]);
  } catch (error: any) {
    console.error('getCustomerById error:', error);
    return sendError(res, 'Failed to fetch customer', 500);
  }
}

export async function createCustomer(req: Request, res: Response) {
  const { first_name, last_name, email, phone, notes, business_id } = req.body;
  const targetBusinessId = business_id || DEFAULT_BUSINESS_ID;

  if (!first_name || !last_name || !email || !phone) {
    return sendError(res, 'first_name, last_name, email, and phone are required', 400);
  }

  try {
    // Idempotent upsert by (business_id, email)
    const { rows } = await pool.query(
      `INSERT INTO customers (business_id, first_name, last_name, email, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (business_id, email)
       DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name  = EXCLUDED.last_name,
         phone      = EXCLUDED.phone,
         updated_at = NOW()
       RETURNING *`,
      [targetBusinessId, first_name.trim(), last_name.trim(), email.toLowerCase().trim(), phone.trim(), notes || '']
    );

    return sendSuccess(res, rows[0], 201);
  } catch (error: any) {
    console.error('createCustomer error:', error);
    return sendError(res, 'Failed to create customer', 500);
  }
}

export async function updateCustomer(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;
  const { first_name, last_name, email, phone, notes } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE customers
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $6 AND business_id = $7
       RETURNING *`,
      [first_name, last_name, email, phone, notes, id, businessId]
    );

    if (rows.length === 0) {
      return sendError(res, 'Customer not found or unauthorized', 404);
    }

    return sendSuccess(res, rows[0]);
  } catch (error: any) {
    console.error('updateCustomer error:', error);
    return sendError(res, 'Failed to update customer', 500);
  }
}

export async function deleteCustomer(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  try {
    const { rows } = await pool.query(
      `DELETE FROM customers WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, businessId]
    );

    if (rows.length === 0) {
      return sendError(res, 'Customer not found or unauthorized', 404);
    }

    return sendSuccess(res, null);
  } catch (error: any) {
    console.error('deleteCustomer error:', error);
    return sendError(res, 'Failed to delete customer', 500);
  }
}

export async function getCustomerBookings(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  try {
    const { rows } = await pool.query(
      `SELECT b.*,
              json_build_object(
                'id', s.id,
                'name', s.name,
                'duration_minutes', s.duration_minutes,
                'price', s.price,
                'icon', s.icon
              ) as service
       FROM service_bookings b
       JOIN services s ON s.id = b.service_id
       WHERE b.customer_id = $1 AND b.business_id = $2
       ORDER BY b.booking_date DESC, b.start_time DESC`,
      [id, businessId]
    );

    return sendSuccess(res, rows);
  } catch (error: any) {
    console.error('getCustomerBookings error:', error);
    return sendError(res, 'Failed to fetch customer bookings', 500);
  }
}
