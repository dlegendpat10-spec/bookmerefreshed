import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { generateBookingReference } from '../utils/bookingRef';
import { addMinutesToTime } from '../utils/timeUtils';
import { AuthenticatedRequest } from '../middleware/auth';
import { notificationQueue } from '../queues/notificationQueue';

const DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

export async function getBookings(req: AuthenticatedRequest, res: Response) {
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;
  const { status, date, customerId, q, page = '1', limit = '50' } = req.query;

  try {
    let whereClauses = ['b.business_id = $1'];
    let values: any[] = [businessId];
    let valIndex = 2;

    if (status) {
      whereClauses.push(`b.status = $${valIndex++}`);
      values.push(status);
    }
    if (date) {
      whereClauses.push(`b.booking_date = $${valIndex++}`);
      values.push(date);
    }
    if (customerId) {
      whereClauses.push(`b.customer_id = $${valIndex++}`);
      values.push(customerId);
    }
    if (q) {
      whereClauses.push(`(
        c.first_name ILIKE $${valIndex} OR
        c.last_name ILIKE $${valIndex} OR
        c.email ILIKE $${valIndex} OR
        b.booking_reference ILIKE $${valIndex}
      )`);
      values.push(`%${q}%`);
      valIndex++;
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const offset = (pageNum - 1) * limitNum;

    const query = `
      SELECT b.*,
             json_build_object(
               'id', c.id,
               'first_name', c.first_name,
               'last_name', c.last_name,
               'email', c.email,
               'phone', c.phone
             ) as customer,
             json_build_object(
               'id', s.id,
               'name', s.name,
               'duration_minutes', s.duration_minutes,
               'price', s.price,
               'icon', s.icon
             ) as service
      FROM service_bookings b
      JOIN customers c ON c.id = b.customer_id
      JOIN services s ON s.id = b.service_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY b.booking_date DESC, b.start_time DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const { rows } = await pool.query(query, values);
    return sendSuccess(res, rows);
  } catch (error: any) {
    console.error('getBookings error:', error);
    return sendError(res, 'Failed to fetch bookings', 500);
  }
}

export async function getBookingById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  try {
    const query = `
      SELECT b.*,
             json_build_object(
               'id', c.id,
               'first_name', c.first_name,
               'last_name', c.last_name,
               'email', c.email,
               'phone', c.phone
             ) as customer,
             json_build_object(
               'id', s.id,
               'name', s.name,
               'duration_minutes', s.duration_minutes,
               'price', s.price,
               'icon', s.icon
             ) as service
      FROM service_bookings b
      JOIN customers c ON c.id = b.customer_id
      JOIN services s ON s.id = b.service_id
      WHERE b.id = $1 AND b.business_id = $2
    `;

    const { rows } = await pool.query(query, [id, businessId]);
    if (rows.length === 0) {
      return sendError(res, 'Booking not found', 404);
    }

    return sendSuccess(res, rows[0]);
  } catch (error: any) {
    console.error('getBookingById error:', error);
    return sendError(res, 'Failed to fetch booking', 500);
  }
}

export async function createBooking(req: Request, res: Response) {
  const { service_id, customer_id, booking_date, start_time, notes, business_id } = req.body;
  const targetBusinessId = business_id || DEFAULT_BUSINESS_ID;

  if (!service_id || !customer_id || !booking_date || !start_time) {
    return sendError(res, 'service_id, customer_id, booking_date, and start_time are required', 400);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch service details
    const { rows: svcRows } = await client.query(
      `SELECT duration_minutes, buffer_minutes, price, currency FROM services WHERE id = $1 AND business_id = $2 AND is_active = TRUE`,
      [service_id, targetBusinessId]
    );

    if (svcRows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 'Service not found or inactive', 404);
    }

    const service = svcRows[0];
    const totalMinutes = service.duration_minutes + (service.buffer_minutes || 0);
    const end_time = addMinutesToTime(start_time, totalMinutes);

    // Helper to safely convert booking_date and start/end time into ISO string
    const formatIso = (dateStr: string, timeStr: string) => {
      const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
      return new Date(`${dateStr}T${cleanTime}Z`).toISOString();
    };

    const starts_at = formatIso(booking_date, start_time);
    const ends_at = formatIso(booking_date, end_time);

    const booking_reference = generateBookingReference();

    // 2. Insert booking — GIST constraint automatically fires on conflict
    const insertQuery = `
      INSERT INTO service_bookings (
        booking_reference, business_id, service_id, customer_id,
        booking_date, start_time, end_time, starts_at, ends_at,
        status, payment_status, amount, currency, customer_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', 'UNPAID', $10, $11, $12)
      RETURNING *
    `;

    const { rows: bookingRows } = await client.query(insertQuery, [
      booking_reference,
      targetBusinessId,
      service_id,
      customer_id,
      booking_date,
      start_time,
      end_time,
      starts_at,
      ends_at,
      service.price,
      service.currency || 'NGN',
      notes || '',
    ]);

    await client.query('COMMIT');

    const createdBooking = bookingRows[0];

    // Async notification queue (non-blocking)
    setImmediate(() => {
      notificationQueue.add('booking_created', { bookingId: createdBooking.id }).catch(console.error);
    });

    return sendSuccess(res, createdBooking, 201);
  } catch (error: any) {
    await client.query('ROLLBACK');

    // PostgreSQL GIST Exclusion Constraint Violation Code: 23P01
    if (error.code === '23P01') {
      return sendError(res, 'This time slot is no longer available. Please choose another.', 409);
    }

    console.error('createBooking error:', error);
    return sendError(res, 'Internal Server Error', 500);
  } finally {
    client.release();
  }
}

export async function updateBookingStatus(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { status } = req.body;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];
  if (!status || !validStatuses.includes(status)) {
    return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }

  try {
    const { rows } = await pool.query(
      `UPDATE service_bookings
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND business_id = $3
       RETURNING *`,
      [status, id, businessId]
    );

    if (rows.length === 0) {
      return sendError(res, 'Booking not found or unauthorized', 404);
    }

    const updatedBooking = rows[0];

    if (status === 'CANCELLED') {
      setImmediate(() => {
        notificationQueue.add('booking_cancelled', { bookingId: updatedBooking.id }).catch(console.error);
      });
    }

    return sendSuccess(res, updatedBooking);
  } catch (error: any) {
    console.error('updateBookingStatus error:', error);
    return sendError(res, 'Failed to update booking status', 500);
  }
}
