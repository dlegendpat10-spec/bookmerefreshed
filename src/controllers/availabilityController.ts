import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';

const DEFAULT_BUSINESS_ID = '';

export async function getBusinessHours(req: Request, res: Response) {
  const businessId = (req.query.businessId as string) || DEFAULT_BUSINESS_ID;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM business_hours WHERE business_id = $1 ORDER BY day_of_week ASC`,
      [businessId]
    );

    return sendSuccess(res, rows);
  } catch (error: any) {
    console.error('getBusinessHours error:', error);
    return sendError(res, 'Failed to fetch business hours', 500);
  }
}

export async function updateBusinessHours(req: AuthenticatedRequest, res: Response) {
  const { dow } = req.params;
  const { opening_time, closing_time, is_open } = req.body;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;
  const dayOfWeek = parseInt(dow, 10);

  if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return sendError(res, 'Day of week (dow) must be between 0 (Sunday) and 6 (Saturday)', 400);
  }

  try {
    const { rows } = await pool.query(
      `UPDATE business_hours
       SET opening_time = COALESCE($1, opening_time),
           closing_time = COALESCE($2, closing_time),
           is_open = COALESCE($3, is_open)
       WHERE business_id = $4 AND day_of_week = $5
       RETURNING *`,
      [opening_time, closing_time, is_open, businessId, dayOfWeek]
    );

    if (rows.length === 0) {
      return sendError(res, 'Business hours row not found', 404);
    }

    return sendSuccess(res, rows[0]);
  } catch (error: any) {
    console.error('updateBusinessHours error:', error);
    return sendError(res, 'Failed to update business hours', 500);
  }
}

export async function getBlockedDates(req: Request, res: Response) {
  const businessId = (req.query.businessId as string) || DEFAULT_BUSINESS_ID;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM blocked_dates WHERE business_id = $1 ORDER BY blocked_date ASC`,
      [businessId]
    );

    return sendSuccess(res, rows);
  } catch (error: any) {
    console.error('getBlockedDates error:', error);
    return sendError(res, 'Failed to fetch blocked dates', 500);
  }
}

export async function addBlockedDate(req: AuthenticatedRequest, res: Response) {
  const { blocked_date, reason } = req.body;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  if (!blocked_date) {
    return sendError(res, 'blocked_date (YYYY-MM-DD) is required', 400);
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO blocked_dates (business_id, blocked_date, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [businessId, blocked_date, reason || '']
    );

    return sendSuccess(res, rows[0], 201);
  } catch (error: any) {
    console.error('addBlockedDate error:', error);
    return sendError(res, 'Failed to add blocked date', 500);
  }
}

export async function removeBlockedDate(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  try {
    const { rows } = await pool.query(
      `DELETE FROM blocked_dates WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, businessId]
    );

    if (rows.length === 0) {
      return sendError(res, 'Blocked date record not found or unauthorized', 404);
    }

    return sendSuccess(res, null);
  } catch (error: any) {
    console.error('removeBlockedDate error:', error);
    return sendError(res, 'Failed to remove blocked date', 500);
  }
}
