import { Request, Response } from 'express';
import crypto from 'crypto';
import { safeQuery } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';
import { findBusinessBySlug, IN_MEMORY_BUSINESSES } from './businessController';

const DEFAULT_BUSINESS_ID = '';

export interface InMemoryService {
  id: string;
  business_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  buffer_minutes: number;
  price: number;
  currency?: string;
  is_active: boolean;
  icon: string;
  category: string;
}

const IN_MEMORY_SERVICES: InMemoryService[] = [];


export async function getServices(req: Request, res: Response) {
  const includeInactive = req.query.includeInactive === 'true';
  const slug = req.query.slug as string | undefined;
  let businessId = req.query.businessId as string | undefined;

  // Resolve businessId from slug if passed
  if (!businessId && slug) {
    try {
      const bizRes = await safeQuery(`SELECT id FROM businesses WHERE slug = $1`, [slug.trim().toLowerCase()]);
      if (bizRes.rows && bizRes.rows.length > 0) {
        businessId = bizRes.rows[0].id;
      }
    } catch (e: any) {
      console.warn('DB slug lookup warning:', e.message);
    }

    if (!businessId) {
      const memBiz = findBusinessBySlug(slug);
      if (memBiz) {
        businessId = memBiz.id;
      }
    }
  }

  try {
    if (businessId) {
      // 1. Business-isolated query: Only services offered by this specific business
      const query = includeInactive
        ? `SELECT s.*, b.name AS business_name, b.slug AS business_slug, b.address AS business_address
           FROM services s
           LEFT JOIN businesses b ON s.business_id = b.id
           WHERE s.business_id = $1
           ORDER BY s.created_at DESC`
        : `SELECT s.*, b.name AS business_name, b.slug AS business_slug, b.address AS business_address
           FROM services s
           LEFT JOIN businesses b ON s.business_id = b.id
           WHERE s.business_id = $1 AND s.is_active = TRUE
           ORDER BY s.price ASC, s.name ASC`;

      const { rows } = await safeQuery(query, [businessId]);
      if (rows) {
        return sendSuccess(res, rows);
      }
    } else {
      // 2. Platform-wide query: All active services available on the platform
      const query = includeInactive
        ? `SELECT s.*, b.name AS business_name, b.slug AS business_slug, b.address AS business_address
           FROM services s
           LEFT JOIN businesses b ON s.business_id = b.id
           ORDER BY s.created_at DESC`
        : `SELECT s.*, b.name AS business_name, b.slug AS business_slug, b.address AS business_address
           FROM services s
           LEFT JOIN businesses b ON s.business_id = b.id
           WHERE s.is_active = TRUE
           ORDER BY s.created_at DESC`;

      const { rows } = await safeQuery(query);
      if (rows) {
        return sendSuccess(res, rows);
      }
    }
  } catch (error: any) {
    console.warn('DB getServices warning, using memory store fallback:', error.message);
  }

  // Memory fallback
  const filtered = businessId
    ? IN_MEMORY_SERVICES.filter(s => s.business_id === businessId && (includeInactive || s.is_active))
    : IN_MEMORY_SERVICES.filter(s => includeInactive || s.is_active);

  const mapped = filtered.map(s => {
    const biz = IN_MEMORY_BUSINESSES.get(s.business_id);
    return {
      ...s,
      business_name: biz?.name || 'Verified Provider',
      business_slug: biz?.slug || 'provider',
      business_address: biz?.address || 'Lagos, Nigeria',
    };
  });

  return sendSuccess(res, mapped);
}

export async function getServiceById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const { rows } = await safeQuery(`SELECT * FROM services WHERE id = $1`, [id]);
    if (rows && rows.length > 0) {
      return sendSuccess(res, rows[0]);
    }
  } catch (error: any) {
    console.warn('DB getServiceById warning, using memory fallback:', error.message);
  }

  const memService = IN_MEMORY_SERVICES.find(s => s.id === id);
  if (!memService) {
    return sendError(res, 'Service not found', 404);
  }
  return sendSuccess(res, memService);
}

export async function createService(req: AuthenticatedRequest, res: Response) {
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;
  const { name, description, duration_minutes, buffer_minutes, price, icon, category, is_active } = req.body;

  if (!name || !duration_minutes) {
    return sendError(res, 'Name and duration_minutes are required', 400);
  }

  const newService: InMemoryService = {
    id: crypto.randomUUID(),
    business_id: businessId,
    name: name.trim(),
    description: description || '',
    duration_minutes: Number(duration_minutes),
    buffer_minutes: Number(buffer_minutes) || 0,
    price: Number(price) || 0,
    currency: 'NGN',
    icon: icon || '🎯',
    category: category || 'General',
    is_active: is_active ?? true,
  };

  try {
    const { rows } = await safeQuery(
      `INSERT INTO services
         (id, business_id, name, description, duration_minutes, buffer_minutes, price, icon, category, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        newService.id,
        businessId,
        newService.name,
        newService.description,
        newService.duration_minutes,
        newService.buffer_minutes,
        newService.price,
        newService.icon,
        newService.category,
        newService.is_active,
      ]
    );

    if (rows && rows[0]) {
      IN_MEMORY_SERVICES.unshift(rows[0]);
      return sendSuccess(res, rows[0], 201);
    }
  } catch (error: any) {
    console.warn('DB createService warning, saving to memory store:', error.message);
  }

  IN_MEMORY_SERVICES.unshift(newService);
  return sendSuccess(res, newService, 201);
}

export async function updateService(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;
  const { name, description, duration_minutes, buffer_minutes, price, icon, category, is_active } = req.body;

  try {
    const { rows } = await safeQuery(
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

    if (rows && rows.length > 0) {
      return sendSuccess(res, rows[0]);
    }
  } catch (error: any) {
    console.warn('DB updateService warning, updating memory store:', error.message);
  }

  const idx = IN_MEMORY_SERVICES.findIndex(s => s.id === id);
  if (idx >= 0) {
    IN_MEMORY_SERVICES[idx] = {
      ...IN_MEMORY_SERVICES[idx],
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(duration_minutes && { duration_minutes: Number(duration_minutes) }),
      ...(buffer_minutes !== undefined && { buffer_minutes: Number(buffer_minutes) }),
      ...(price !== undefined && { price: Number(price) }),
      ...(icon && { icon }),
      ...(category && { category }),
      ...(is_active !== undefined && { is_active }),
    };
    return sendSuccess(res, IN_MEMORY_SERVICES[idx]);
  }

  return sendError(res, 'Service not found', 404);
}

export async function deleteService(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const businessId = req.business?.id || DEFAULT_BUSINESS_ID;

  try {
    const { rows } = await safeQuery(
      `UPDATE services SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, businessId]
    );

    if (rows && rows.length > 0) {
      return sendSuccess(res, null);
    }
  } catch (error: any) {
    console.warn('DB deleteService warning:', error.message);
  }

  const idx = IN_MEMORY_SERVICES.findIndex(s => s.id === id);
  if (idx >= 0) {
    IN_MEMORY_SERVICES[idx].is_active = false;
    return sendSuccess(res, null);
  }

  return sendError(res, 'Service not found or unauthorized', 404);
}
