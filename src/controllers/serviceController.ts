import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';

const DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

export async function getServices(req: Request, res: Response) {
  const includeInactive = req.query.includeInactive === 'true';
  const businessId = req.query.businessId as string || DEFAULT_BUSINESS_ID;

  try {
    const query = includeInactive
      ? `SELECT * FROM services WHERE business_id = $1 ORDER BY created_at DESC`
      : `SELECT * FROM services WHERE business_id = $1 AND is_active = TRUE ORDER BY price ASC, name ASC`;

    const { rows } = await pool.query(query, [businessId]);
    return sendSuccess(res, rows);
  } catch (error: any) {
    console.error('getServices error:', error);
    return sendError(res, 'Failed to retrieve services', 500);
  }
}

export async function getServiceById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(`SELECT * FROM services WHERE id = $1`, [id]);
    if (rows.length === 0) {
      return sendError(res, 'Service not found', 404);
    }
    return sendSuccess(res, rows[0]);
  } catch (error: any) {
    console.error('getServiceById error:', error);
    return sendError(res, 'Failed to retrieve service', 500);
  }
}

export async function createService(req: AuthenticatedRequest, res: Response) {
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;
  const { name, description, duration_minutes, buffer_minutes, price, icon, category, is_active } = req.body;

  if (!name || !duration_minutes) {
    return sendError(res, 'Name and duration_minutes are required', 400);
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO services
         (business_id, name, description, duration_minutes, buffer_minutes, price, icon, category, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        businessId,
        name,
        description || '',
        duration_minutes,
        buffer_minutes || 0,
        price || 0.00,
        icon || '🎯',
        category || 'general',
        is_active ?? true,
      ]
    );

    return sendSuccess(res, rows[0], 201);
  } catch (error: any) {
    console.error('createService error:', error);
    return sendError(res, 'Failed to create service', 500);
  }
}

export async function updateService(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;
  const { name, description, duration_minutes, buffer_minutes, price, icon, category, is_active } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE services
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           duration_minutes = COALESCE($3, duration_minutes),
           buffer_minutes = COALESCE($4, buffer_minutes),
           price = COALESCE($5, price),
           icon = COALESCE($6, icon),
           category = COALESCE($7, category),
           is_active = COALESCE($8, is_active),
           updated_at = NOW()
       WHERE id = $9 AND business_id = $10
       RETURNING *`,
      [name, description, duration_minutes, buffer_minutes, price, icon, category, is_active, id, businessId]
    );

    if (rows.length === 0) {
      return sendError(res, 'Service not found or unauthorized', 404);
    }

    return sendSuccess(res, rows[0]);
  } catch (error: any) {
    console.error('updateService error:', error);
    return sendError(res, 'Failed to update service', 500);
  }
}

export async function deleteService(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  try {
    // Soft delete by setting is_active = FALSE
    const { rows } = await pool.query(
      `UPDATE services SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, businessId]
    );

    if (rows.length === 0) {
      return sendError(res, 'Service not found or unauthorized', 404);
    }

    return sendSuccess(res, null);
  } catch (error: any) {
    console.error('deleteService error:', error);
    return sendError(res, 'Failed to delete service', 500);
  }
}
