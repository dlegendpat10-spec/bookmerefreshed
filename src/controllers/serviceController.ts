import { Request, Response } from 'express';
import crypto from 'crypto';
import { safeQuery } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';
import { findBusinessBySlug, IN_MEMORY_BUSINESSES } from './businessController';

const DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000003'; // Default to Luxe Grooming

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

const IN_MEMORY_SERVICES: InMemoryService[] = [
  {
    id: '11111111-0000-0000-0000-000000000011',
    business_id: '00000000-0000-0000-0000-000000000003',
    name: 'Executive Haircut & Beard Sculpting',
    description: 'Precision haircut tailored to head shape with hot towel treatment, straight-razor detailing, and beard nourishment.',
    duration_minutes: 45,
    buffer_minutes: 10,
    price: 15000,
    currency: 'NGN',
    is_active: true,
    icon: '✂️',
    category: 'Grooming',
  },
  {
    id: '11111111-0000-0000-0000-000000000012',
    business_id: '00000000-0000-0000-0000-000000000003',
    name: 'Royal Spa Treatment',
    description: 'Complete deep cleansing facial, exfoliating scrub, scalp massage, and therapeutic grooming ritual.',
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 25000,
    currency: 'NGN',
    is_active: true,
    icon: '👑',
    category: 'Spa',
  },
  {
    id: '11111111-0000-0000-0000-000000000013',
    business_id: '00000000-0000-0000-0000-000000000003',
    name: 'Classic Beard Trim & Oil Treatment',
    description: 'Beard line-up with electric shaver and premium essential oils conditioning.',
    duration_minutes: 30,
    buffer_minutes: 5,
    price: 8000,
    currency: 'NGN',
    is_active: true,
    icon: '💈',
    category: 'Beard',
  },
  {
    id: '11111111-0000-0000-0000-000000000001',
    business_id: '00000000-0000-0000-0000-000000000001',
    name: 'Discovery Call',
    description: 'A free 30-minute introductory session to understand your educational needs and goals.',
    duration_minutes: 30,
    buffer_minutes: 0,
    price: 0,
    currency: 'NGN',
    is_active: true,
    icon: '🎯',
    category: 'Consultation',
  },
];

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

  const resolvedBusinessId = businessId || DEFAULT_BUSINESS_ID;

  try {
    const query = includeInactive
      ? `SELECT * FROM services WHERE business_id = $1 ORDER BY created_at DESC`
      : `SELECT * FROM services WHERE business_id = $1 AND is_active = TRUE ORDER BY price ASC, name ASC`;

    const { rows } = await safeQuery(query, [resolvedBusinessId]);
    if (rows && rows.length > 0) {
      return sendSuccess(res, rows);
    }
  } catch (error: any) {
    console.warn('DB getServices warning, using memory store fallback:', error.message);
  }

  // Memory fallback
  const filtered = IN_MEMORY_SERVICES.filter(s =>
    s.business_id === resolvedBusinessId && (includeInactive || s.is_active)
  );

  return sendSuccess(res, filtered);
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
