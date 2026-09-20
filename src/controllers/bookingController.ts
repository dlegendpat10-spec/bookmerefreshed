import { Request, Response } from 'express';
import crypto from 'crypto';
import { pool, safeQuery } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { generateBookingReference } from '../utils/bookingRef';
import { addMinutesToTime } from '../utils/timeUtils';
import { AuthenticatedRequest } from '../middleware/auth';
import { notificationQueue } from '../queues/notificationQueue';
import {
  sendBookingCreatedEmails,
  sendBookingStatusChangedEmails,
  sendCustomResponseEmail,
  getDispatchedEmails,
} from '../services/emailService';
import { IN_MEMORY_BUSINESSES } from './businessController';

const DEFAULT_BUSINESS_ID = '';

function getBusinessFromMemory(businessId: string): any {
  return IN_MEMORY_BUSINESSES.get(businessId) || Array.from(IN_MEMORY_BUSINESSES.values())[0];
}

export interface InMemoryBooking {
  id: string;
  booking_reference: string;
  business_id: string;
  service_id: string;
  customer_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: string;
  amount: number;
  currency: string;
  customer_notes?: string;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  service?: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
  };
}

export const IN_MEMORY_BOOKINGS: InMemoryBooking[] = [];


export function getInMemoryBookings(businessId?: string): InMemoryBooking[] {
  if (businessId) {
    return IN_MEMORY_BOOKINGS.filter(b => b.business_id === businessId);
  }
  return IN_MEMORY_BOOKINGS;
}

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
               'currency', s.currency
             ) as service
      FROM service_bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN services s ON s.id = b.service_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY b.booking_date DESC, b.start_time DESC
      LIMIT $${valIndex++} OFFSET $${valIndex}
    `;

    values.push(limitNum, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM service_bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      WHERE ${whereClauses.join(' AND ')}
    `;

    const [dataRes, countRes] = await Promise.all([
      safeQuery(query, values),
      safeQuery(countQuery, values.slice(0, valIndex - 2)),
    ]);

    if (dataRes.rows && dataRes.rows.length > 0) {
      const total = parseInt(countRes.rows[0]?.total || '0', 10);
      return sendSuccess(res, {
        bookings: dataRes.rows,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  } catch (error: any) {
    console.warn('DB getBookings warning, falling back to memory store:', error.message);
  }

  // Memory fallback
  const memList = getInMemoryBookings(businessId);
  return sendSuccess(res, {
    bookings: memList,
    meta: {
      total: memList.length,
      page: 1,
      limit: 50,
      totalPages: 1,
    }
  });
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
               'currency', s.currency
             ) as service
      FROM service_bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN services s ON s.id = b.service_id
      WHERE b.id = $1 AND b.business_id = $2
    `;

    const { rows } = await safeQuery(query, [id, businessId]);
    if (rows && rows.length > 0) {
      return sendSuccess(res, rows[0]);
    }
  } catch (error: any) {
    console.warn('DB getBookingById warning:', error.message);
  }

  const memFound = IN_MEMORY_BOOKINGS.find(b => b.id === id || b.booking_reference === id);
  if (!memFound) {
    return sendError(res, 'Booking not found', 404);
  }
  return sendSuccess(res, memFound);
}

export async function createBooking(req: Request, res: Response) {
  const { service_id, customer_id, booking_date, start_time, notes, business_id, customer_name, customer_email, customer_phone } = req.body;
  const targetBusinessId = business_id || DEFAULT_BUSINESS_ID;

  if (!service_id || !booking_date || !start_time) {
    return sendError(res, 'service_id, booking_date, and start_time are required', 400);
  }

  const end_time = addMinutesToTime(start_time, 45);
  const formatIso = (dateStr: string, timeStr: string) => {
    const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    return new Date(`${dateStr}T${cleanTime}Z`).toISOString();
  };

  const starts_at = formatIso(booking_date, start_time);
  const ends_at = formatIso(booking_date, end_time);
  const booking_reference = generateBookingReference();
  const bookingId = crypto.randomUUID();

  const memBooking: InMemoryBooking = {
    id: bookingId,
    booking_reference,
    business_id: targetBusinessId,
    service_id,
    customer_id: customer_id || '22222222-0000-0000-0000-000000000001',
    booking_date,
    start_time,
    end_time,
    starts_at,
    ends_at,
    status: 'PENDING',
    payment_status: 'UNPAID',
    amount: 15000,
    currency: 'NGN',
    customer_notes: notes || '',
    customer: {
      id: customer_id || '22222222-0000-0000-0000-000000000001',
      first_name: customer_name || 'Client',
      last_name: '',
      email: customer_email || 'client@example.com',
      phone: customer_phone || '',
    },
    service: {
      id: service_id,
      name: 'Service Appointment',
      duration_minutes: 45,
      price: 15000,
    }
  };

  // 1. Attempt Database Save
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: svcRows } = await client.query(
        `SELECT duration_minutes, buffer_minutes, price, currency FROM services WHERE id = $1 AND is_active = TRUE`,
        [service_id]
      );

      let svcPrice = 15000;
      let svcCurrency = 'NGN';

      if (svcRows.length > 0) {
        const service = svcRows[0];
        svcPrice = service.price;
        svcCurrency = service.currency || 'NGN';
        memBooking.amount = svcPrice;
        memBooking.currency = svcCurrency;
      }

      const insertQuery = `
        INSERT INTO service_bookings (
          id, booking_reference, business_id, service_id, customer_id,
          booking_date, start_time, end_time, starts_at, ends_at,
          status, payment_status, amount, currency, customer_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', 'UNPAID', $11, $12, $13)
        RETURNING *
      `;

      const { rows: bookingRows } = await client.query(insertQuery, [
        bookingId,
        booking_reference,
        targetBusinessId,
        service_id,
        customer_id || '22222222-0000-0000-0000-000000000001',
        booking_date,
        start_time,
        end_time,
        starts_at,
        ends_at,
        svcPrice,
        svcCurrency,
        notes || '',
      ]);

      await client.query('COMMIT');
      if (bookingRows && bookingRows[0]) {
        const createdRow = bookingRows[0];
        IN_MEMORY_BOOKINGS.unshift(createdRow);

        // Send transactional confirmation emails to client and admin
        const biz = getBusinessFromMemory(targetBusinessId);
        sendBookingCreatedEmails({
          bookingReference: booking_reference,
          businessId: targetBusinessId,
          businessName: biz?.name || 'Bookmi Business',
          businessEmail: biz?.email || 'admin@bookmi.local',
          businessAddress: biz?.address,
          customerName: customer_name || 'Valued Client',
          customerEmail: customer_email || 'client@example.com',
          customerPhone: customer_phone,
          serviceName: memBooking.service?.name || 'Service Appointment',
          serviceDuration: memBooking.service?.duration_minutes || 45,
          bookingDate: booking_date,
          startTime: start_time,
          amount: svcPrice,
          currency: svcCurrency,
          notes: notes,
        }).catch(err => console.warn('Email send warning:', err.message));

        return sendSuccess(res, createdRow, 201);
      }
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23P01') {
        return sendError(res, 'This time slot is no longer available. Please choose another.', 409);
      }
      console.warn('DB createBooking transaction warning:', err.message);
    } finally {
      client.release();
    }
  } catch (connErr: any) {
    console.warn('DB pool connect in createBooking warning:', connErr.message);
  }

  // Fallback to memory
  IN_MEMORY_BOOKINGS.unshift(memBooking);

  // Send transactional confirmation emails to client and admin
  const biz = getBusinessFromMemory(targetBusinessId);
  sendBookingCreatedEmails({
    bookingReference: booking_reference,
    businessId: targetBusinessId,
    businessName: biz?.name || 'Bookmi Business',
    businessEmail: biz?.email || 'admin@bookmi.local',
    businessAddress: biz?.address,
    customerName: customer_name || 'Valued Client',
    customerEmail: customer_email || 'client@example.com',
    customerPhone: customer_phone,
    serviceName: memBooking.service?.name || 'Service Appointment',
    serviceDuration: memBooking.service?.duration_minutes || 45,
    bookingDate: booking_date,
    startTime: start_time,
    amount: memBooking.amount,
    currency: memBooking.currency,
    notes: notes,
  }).catch(err => console.warn('Email send warning:', err.message));

  return sendSuccess(res, memBooking, 201);
}

export async function updateBookingStatus(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { status, reason } = req.body;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];
  if (!status || !validStatuses.includes(status)) {
    return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }

  let updatedRecord: any = null;

  try {
    const { rows } = await safeQuery(
      `UPDATE service_bookings
       SET status = $1, updated_at = NOW()
       WHERE (id = $2 OR booking_reference = $2) AND business_id = $3
       RETURNING *`,
      [status, id, businessId]
    );

    if (rows && rows.length > 0) {
      updatedRecord = rows[0];
    }
  } catch (error: any) {
    console.warn('DB updateBookingStatus warning:', error.message);
  }

  const idx = IN_MEMORY_BOOKINGS.findIndex(b => b.id === id || b.booking_reference === id);
  if (idx >= 0) {
    IN_MEMORY_BOOKINGS[idx].status = status;
    if (!updatedRecord) {
      updatedRecord = IN_MEMORY_BOOKINGS[idx];
    }
  }

  if (updatedRecord) {
    // Send email notification to client and admin
    const biz = getBusinessFromMemory(businessId);
    const memFound = IN_MEMORY_BOOKINGS.find(b => b.id === id || b.booking_reference === id);
    sendBookingStatusChangedEmails({
      bookingReference: updatedRecord.booking_reference || memFound?.booking_reference || id,
      businessId,
      businessName: biz?.name || 'Bookmi Business',
      businessEmail: biz?.email || 'admin@bookmi.local',
      customerName: memFound?.customer?.first_name || 'Valued Client',
      customerEmail: memFound?.customer?.email || 'client@example.com',
      serviceName: memFound?.service?.name || 'Service Appointment',
      bookingDate: updatedRecord.booking_date || memFound?.booking_date || '',
      startTime: updatedRecord.start_time || memFound?.start_time || '',
      newStatus: status,
      reason,
    }).catch(err => console.warn('Email status update warning:', err.message));

    return sendSuccess(res, updatedRecord);
  }

  return sendError(res, 'Booking not found or unauthorized', 404);
}

export async function respondToBooking(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { message } = req.body;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  if (!message || !message.trim()) {
    return sendError(res, 'Message is required', 400);
  }

  const memTarget = IN_MEMORY_BOOKINGS.find(b => b.id === id || b.booking_reference === id);
  if (!memTarget) {
    return sendError(res, 'Booking not found', 404);
  }

  const biz = getBusinessFromMemory(businessId);

  const result = await sendCustomResponseEmail({
    bookingReference: memTarget.booking_reference,
    businessId,
    businessName: biz?.name || 'Bookmi Business',
    businessEmail: biz?.email || 'admin@bookmi.local',
    customerName: memTarget.customer?.first_name || 'Valued Client',
    customerEmail: memTarget.customer?.email || 'client@example.com',
    message: message.trim(),
  });

  return sendSuccess(res, {
    message: 'Response sent to client and admin successfully',
    dispatched: result,
  });
}

export async function getEmailNotifications(req: AuthenticatedRequest, res: Response) {
  const businessId = req.business?.id;
  const logs = getDispatchedEmails(businessId);
  return sendSuccess(res, logs);
}
