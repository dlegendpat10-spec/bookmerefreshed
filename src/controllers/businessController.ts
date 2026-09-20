import { Response } from 'express';
import crypto from 'crypto';
import { pool, safeQuery } from '../db/pool';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';

export interface InMemoryBusiness {
  id: string;
  name: string;
  short_name?: string;
  slug: string;
  tagline?: string;
  description?: string;
  initials?: string;
  accent_color?: string;
  currency: string;
  currency_symbol: string;
  locale: string;
  timezone: string;
  time_format: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  hero_image_url?: string;
  pictures?: string[];
  booking_lead_time_hours?: number;
  slot_interval_minutes?: number;
  max_booking_days_ahead?: number;
  created_at?: string;
  updated_at?: string;
}

export const IN_MEMORY_BUSINESSES = new Map<string, InMemoryBusiness>([
  ['biz-001', {
    id: 'biz-001',
    name: 'Apex Strategy & Advisory',
    slug: 'apex-strategy',
    tagline: 'Consulting & Legal',
    description: 'Premier executive advisory, corporate legal counsel, and strategic growth consulting for high-growth ventures.',
    logo_url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=200&h=200&q=80',
    hero_image_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&h=450&q=80',
    pictures: [
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80'
    ],
    accent_color: '#2563EB',
    currency: 'NGN',
    currency_symbol: '₦',
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    time_format: '12h',
    phone: '+234 802 111 2233',
    email: 'contact@apexstrategy.ng',
    address: 'Plot 12, Adeola Odeku St, Victoria Island, Lagos'
  }],
  ['biz-002', {
    id: 'biz-002',
    name: 'Serenity Wellness & Spa Sanctuary',
    slug: 'serenity-wellness',
    tagline: 'Wellness & Spa',
    description: 'Luxury organic wellness sanctuary providing holistic bodywork, hydrotherapy, and signature therapeutic facials.',
    logo_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=200&h=200&q=80',
    hero_image_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&h=450&q=80',
    pictures: [
      'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80'
    ],
    accent_color: '#059669',
    currency: 'NGN',
    currency_symbol: '₦',
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    time_format: '12h',
    phone: '+234 803 222 3344',
    email: 'hello@serenityspa.ng',
    address: '24 Bourdillon Road, Ikoyi, Lagos'
  }],
  ['biz-003', {
    id: 'biz-003',
    name: 'Pulse High-Performance Athletic Lab',
    slug: 'pulse-performance',
    tagline: 'Fitness & Health',
    description: 'State-of-the-art conditioning, metabolic testing, and biomechanical injury rehabilitation for athletes and executives.',
    logo_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=200&h=200&q=80',
    hero_image_url: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1200&h=450&q=80',
    pictures: [
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80'
    ],
    accent_color: '#DC2626',
    currency: 'NGN',
    currency_symbol: '₦',
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    time_format: '12h',
    phone: '+234 805 333 4455',
    email: 'train@pulsefitness.ng',
    address: '8 Admiralty Way, Lekki Phase 1, Lagos'
  }],
  ['biz-004', {
    id: 'biz-004',
    name: 'Lumina Creative Studio & Visual Lab',
    slug: 'lumina-studio',
    tagline: 'Creative & Media',
    description: 'Boutique visual production house specializing in executive portraiture, brand design sprints, and commercial product videography.',
    logo_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=200&h=200&q=80',
    hero_image_url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&h=450&q=80',
    pictures: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'
    ],
    accent_color: '#7C3AED',
    currency: 'NGN',
    currency_symbol: '₦',
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    time_format: '12h',
    phone: '+234 807 444 5566',
    email: 'bookings@luminastudio.ng',
    address: '15 Commercial Avenue, Yaba, Lagos'
  }],
  ['biz-005', {
    id: 'biz-005',
    name: 'Quantum Cloud & Cyber Systems',
    slug: 'quantum-cloud',
    tagline: 'Technology & Software',
    description: 'Enterprise architecture consultants delivering secure multi-cloud migrations, penetration testing, and generative AI implementations.',
    logo_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=200&h=200&q=80',
    hero_image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&h=450&q=80',
    pictures: [
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80'
    ],
    accent_color: '#0891B2',
    currency: 'NGN',
    currency_symbol: '₦',
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    time_format: '12h',
    phone: '+234 809 555 6677',
    email: 'solutions@quantumsys.ng',
    address: '5th Floor, Heritage Tower, Marina, Lagos'
  }],
  ['biz-006', {
    id: 'biz-006',
    name: 'BrightSmiles Aesthetic Dental Clinic',
    slug: 'bright-smiles',
    tagline: 'Healthcare & Dental',
    description: 'Advanced dental spa specializing in precision cosmetic dentistry, pain-free ultrasonic cleanings, and clear aligner orthodontics.',
    logo_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=200&h=200&q=80',
    hero_image_url: 'https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&w=1200&h=450&q=80',
    pictures: [
      'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80'
    ],
    accent_color: '#0D9488',
    currency: 'NGN',
    currency_symbol: '₦',
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    time_format: '12h',
    phone: '+234 808 666 7788',
    email: 'care@brightsmiles.ng',
    address: '18 Isaac John Street, Ikeja GRA, Lagos'
  }]
]);

function sanitizeSlug(rawSlug: string): string {
  return rawSlug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export async function createBusiness(req: AuthenticatedRequest, res: Response) {
  const { name, slug: customSlug, category, template, country, address, description, phone } = req.body || {};
  const userId = req.user?.id;

  if (!userId) {
    return sendError(res, 'Unauthorized - Invalid session', 401);
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return sendError(res, 'Business name is required and must be a valid string', 400);
  }

  const cleanName = name.trim();
  const businessId = crypto.randomUUID();

  // Resolve slug
  let candidateSlug = customSlug ? sanitizeSlug(customSlug) : '';
  if (!candidateSlug) {
    candidateSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  if (!candidateSlug) {
    candidateSlug = 'business-' + Math.floor(1000 + Math.random() * 9000);
  }

  const initials = cleanName.split(' ').map((w: string) => w[0]).join('').substring(0, 4).toUpperCase() || 'BM';

  const newBusinessObj: InMemoryBusiness = {
    id: businessId,
    name: cleanName,
    short_name: cleanName.substring(0, 20),
    slug: candidateSlug,
    tagline: category || 'Professional Services',
    description: description || '',
    initials,
    accent_color: '#10B981',
    currency: 'NGN',
    currency_symbol: '₦',
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    time_format: '12h',
    phone: phone || '',
    email: req.user?.email || '',
    address: address || (country ? `${country}` : 'Lagos, Nigeria'),
    booking_lead_time_hours: 1,
    slot_interval_minutes: 30,
    max_booking_days_ahead: 60,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Attempt Database Save
  let dbSaved = false;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if slug taken, append random suffix if conflict
      const slugCheck = await client.query('SELECT id FROM businesses WHERE slug = $1', [candidateSlug]);
      if (slugCheck.rows.length > 0) {
        candidateSlug = `${candidateSlug}-${Math.floor(100 + Math.random() * 900)}`;
        newBusinessObj.slug = candidateSlug;
      }

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
          candidateSlug,
          category || 'Professional Services',
          description || '',
          initials,
          '#10B981',
          phone || '',
          req.user?.email || '',
          address || (country ? `${country}` : 'Lagos, Nigeria'),
        ]
      );

      // Link business to admin profile
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

      // Default operating hours
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
      dbSaved = true;
      if (businessResult.rows[0]) {
        Object.assign(newBusinessObj, businessResult.rows[0]);
      }
    } catch (txErr: any) {
      await client.query('ROLLBACK');
      console.warn('DB createBusiness transaction failed, using in-memory store:', txErr.message);
    } finally {
      client.release();
    }
  } catch (connErr: any) {
    console.warn('DB connect failed in createBusiness, saving to resilient memory store:', connErr.message);
  }

  // Always register in resilient memory store
  IN_MEMORY_BUSINESSES.set(businessId, newBusinessObj);

  return sendSuccess(res, {
    ...newBusinessObj,
    template: template || 'Custom',
  }, 201);
}

export async function getMyBusiness(req: AuthenticatedRequest, res: Response) {
  const businessId = req.business?.id;

  if (!businessId) {
    // Check if there is an in-memory business for this user or return first available
    const first = Array.from(IN_MEMORY_BUSINESSES.values())[0] || null;
    return sendSuccess(res, first);
  }

  try {
    const { rows } = await safeQuery(
      `SELECT * FROM businesses WHERE id = $1`,
      [businessId]
    );

    if (rows && rows.length > 0) {
      return sendSuccess(res, rows[0]);
    }
  } catch (error: any) {
    console.warn('DB getMyBusiness query error, using memory fallback:', error.message);
  }

  const memBiz = IN_MEMORY_BUSINESSES.get(businessId) || Array.from(IN_MEMORY_BUSINESSES.values())[0] || null;
  return sendSuccess(res, memBiz);
}

export async function updateMyBusiness(req: AuthenticatedRequest, res: Response) {
  const businessId = req.business?.id;
  const { name, slug, category, phone, email, address, description, accentColor, logoUrl, logo_url, heroImageUrl, hero_image_url, pictures } = req.body || {};
  const resolvedLogo = logoUrl || logo_url;
  const resolvedHero = heroImageUrl || hero_image_url;

  const cleanSlug = slug ? sanitizeSlug(slug) : undefined;
  if (cleanSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
    return sendError(res, 'Slug must contain only lowercase letters, numbers, and single hyphens', 400);
  }

  let updatedRecord: any = null;

  // 1. Update in database if connected
  if (businessId) {
    try {
      if (cleanSlug) {
        const slugCheck = await safeQuery(
          `SELECT id FROM businesses WHERE slug = $1 AND id != $2`,
          [cleanSlug, businessId]
        );
        if (slugCheck.rows && slugCheck.rows.length > 0) {
          return sendError(res, 'This URL slug is already in use by another business. Please choose another one.', 409);
        }
      }

      const { rows } = await safeQuery(
        `UPDATE businesses
         SET name = COALESCE($1, name),
             slug = COALESCE($2, slug),
             tagline = COALESCE($3, tagline),
             phone = COALESCE($4, phone),
             email = COALESCE($5, email),
             address = COALESCE($6, address),
             description = COALESCE($7, description),
             accent_color = COALESCE($8, accent_color),
             logo_url = COALESCE($9, logo_url),
             hero_image_url = COALESCE($10, hero_image_url),
             pictures = COALESCE($11, pictures),
             updated_at = NOW()
         WHERE id = $12
         RETURNING *`,
        [
          name ? name.trim() : null,
          cleanSlug || null,
          category || null,
          phone || null,
          email || null,
          address || null,
          description || null,
          accentColor || null,
          resolvedLogo || null,
          resolvedHero || null,
          pictures || null,
          businessId
        ]
      );

      if (rows && rows.length > 0) {
        updatedRecord = rows[0];
      }
    } catch (dbErr: any) {
      console.warn('DB updateMyBusiness error, updating memory store:', dbErr.message);
    }
  }

  // 2. Update memory store
  const targetId = businessId || (IN_MEMORY_BUSINESSES.keys().next().value || crypto.randomUUID());
  const existing = IN_MEMORY_BUSINESSES.get(targetId) || {
    id: targetId,
    name: name || 'Business',
    slug: cleanSlug || 'my-business',
    currency: 'NGN',
    currency_symbol: '₦',
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    time_format: '12h',
  };

  const merged: InMemoryBusiness = {
    ...existing,
    ...(name && { name: name.trim() }),
    ...(cleanSlug && { slug: cleanSlug }),
    ...(category && { tagline: category }),
    ...(phone && { phone }),
    ...(email && { email }),
    ...(address && { address }),
    ...(description !== undefined && { description }),
    ...(accentColor && { accent_color: accentColor }),
    ...(resolvedLogo && { logo_url: resolvedLogo }),
    ...(resolvedHero && { hero_image_url: resolvedHero }),
    ...(pictures !== undefined && { pictures }),
    updated_at: new Date().toISOString(),
  };

  IN_MEMORY_BUSINESSES.set(targetId, merged);

  return sendSuccess(res, updatedRecord || merged);
}

export function findBusinessBySlug(slug: string): InMemoryBusiness | undefined {
  const clean = sanitizeSlug(slug);
  for (const biz of IN_MEMORY_BUSINESSES.values()) {
    if (biz.slug === clean) return biz;
  }
  return undefined;
}
