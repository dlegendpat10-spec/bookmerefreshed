import { Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';

export async function createBusiness(req: AuthenticatedRequest, res: Response) {
  const { name, category, template, country, address, description, phone } = req.body || {};
  const userId = req.user?.id;

  if (!userId) {
    return sendError(res, 'Unauthorized - Invalid session', 401);
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return sendError(res, 'Business name is required and must be a valid string', 400);
  }

  let client;
  try {
    client = await pool.connect();
  } catch (connErr: any) {
    console.error('Database connection error in createBusiness:', connErr);
    return sendError(res, 'Database connection error. Please check server database credentials.', 500);
  }

  try {
    await client.query('BEGIN');

    const businessId = crypto.randomUUID();
    const cleanName = name.trim();
    let baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = 'business-' + Math.floor(Math.random() * 1000);

    const slug = baseSlug + '-' + Math.floor(Math.random() * 1000);
    const initials = cleanName.split(' ').map((w: string) => w[0]).join('').substring(0, 4).toUpperCase() || 'BM';

    // 1. Create Business
    const businessResult = await client.query(
      `INSERT INTO businesses (
        id, name, short_name, slug, tagline, description, initials,
        accent_color, currency, currency_symbol, locale, timezone, time_format,
        phone, email, address, booking_lead_time_hours, slot_interval_minutes, max_booking_days_ahead
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, 'NGN', '₦', 'en-NG', 'Africa/Lagos', '12h',
        $9, $10, $11, 1, 30, 60
      ) RETURNING *`,
      [
        businessId,
        cleanName,
        cleanName.substring(0, 20),
        slug,
        category || 'Professional Services',
        description || '',
        initials,
        '#10B981',
        phone || '',
        req.user?.email || '',
        address || (country ? `${country}` : 'Lagos, Nigeria'),
      ]
    );

    const newBusiness = businessResult.rows[0];

    // 2. Link business to admin profile (upsert so orphaned in-memory user gets persisted)
    await client.query(
      `INSERT INTO admin_profiles (id, business_id, full_name, email, role)
       VALUES ($1, $2, $3, $4, 'BUSINESS_ADMIN')
       ON CONFLICT (id) DO UPDATE SET business_id = $2`,
      [
        userId,
        businessId,
        req.user?.email?.split('@')[0] || 'Business Admin',
        req.user?.email || 'admin@bookme.app'
      ]
    );

    // 3. Initialize default business hours (Monday-Friday 9-5, Sat 10-2, Sun Closed)
    const hours = [
      { dow: 0, name: 'Sunday', open: '09:00', close: '13:00', isOpen: false },
      { dow: 1, name: 'Monday', open: '09:00', close: '17:00', isOpen: true },
      { dow: 2, name: 'Tuesday', open: '09:00', close: '17:00', isOpen: true },
      { dow: 3, name: 'Wednesday', open: '09:00', close: '17:00', isOpen: true },
      { dow: 4, name: 'Thursday', open: '09:00', close: '17:00', isOpen: true },
      { dow: 5, name: 'Friday', open: '09:00', close: '17:00', isOpen: true },
      { dow: 6, name: 'Saturday', open: '10:00', close: '14:00', isOpen: true },
    ];

    for (const h of hours) {
      await client.query(
        `INSERT INTO business_hours (business_id, day_of_week, day_name, opening_time, closing_time, is_open)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (business_id, day_of_week) DO UPDATE SET
           opening_time = EXCLUDED.opening_time,
           closing_time = EXCLUDED.closing_time,
           is_open = EXCLUDED.is_open`,
        [businessId, h.dow, h.name, h.open, h.close, h.isOpen]
      );
    }

    await client.query('COMMIT');

    return sendSuccess(res, {
      ...newBusiness,
      template: template || 'Custom',
    }, 201);
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('Rollback error:', rbErr);
      }
    }
    console.error('Create business error:', error);
    return sendError(res, error?.message || 'Error while creating business', 500);
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function getMyBusiness(req: AuthenticatedRequest, res: Response) {
  const businessId = req.business?.id;

  if (!businessId) {
    return sendSuccess(res, null);
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM businesses WHERE id = $1`,
      [businessId]
    );

    if (rows.length === 0) {
      return sendSuccess(res, null);
    }

    return sendSuccess(res, rows[0]);
  } catch (error: any) {
    console.error('Get my business error:', error);
    return sendError(res, 'Internal Server Error', 500);
  }
}
