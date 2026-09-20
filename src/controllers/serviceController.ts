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

const IN_MEMORY_SERVICES: InMemoryService[] = [
  // ── Apex Strategy & Advisory (biz-001) ──
  {
    id: 'svc-001',
    business_id: 'biz-001',
    name: 'Executive 1-on-1 Business Strategy Session',
    category: 'Consulting & Strategy',
    description: 'Deep-dive session to evaluate revenue models, capital allocation, and market expansion tactics for C-suite leaders.',
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 45000,
    currency: 'NGN',
    is_active: true,
    icon: 'Briefcase'
  },
  {
    id: 'svc-002',
    business_id: 'biz-001',
    name: 'Commercial Contract & Legal Risk Review',
    category: 'Legal & Compliance',
    description: 'In-depth legal audit of vendor, partnership, and employment agreements with actionable risk mitigation suggestions.',
    duration_minutes: 90,
    buffer_minutes: 15,
    price: 75000,
    currency: 'NGN',
    is_active: true,
    icon: 'FileText'
  },
  {
    id: 'svc-003',
    business_id: 'biz-001',
    name: 'Startup Pitch Deck & Fundraising Masterclass',
    category: 'Consulting & Strategy',
    description: 'Comprehensive narrative polishing, financial model stress-testing, and Q&A roleplay before meeting Tier-1 VC investors.',
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 50000,
    currency: 'NGN',
    is_active: true,
    icon: 'TrendingUp'
  },
  {
    id: 'svc-004',
    business_id: 'biz-001',
    name: 'Commercial Due Diligence & M&A Consultation',
    category: 'Legal & Compliance',
    description: 'Rigorous analysis of target balance sheets, asset ownership, pending liabilities, and regulatory compliance.',
    duration_minutes: 120,
    buffer_minutes: 30,
    price: 120000,
    currency: 'NGN',
    is_active: true,
    icon: 'ShieldCheck'
  },

  // ── Serenity Wellness & Spa Sanctuary (biz-002) ──
  {
    id: 'svc-005',
    business_id: 'biz-002',
    name: 'Deep Tissue & Volcanic Hot Stone Massage',
    category: 'Wellness & Spa',
    description: 'Targeted muscle recovery therapy utilizing heated basalt volcanic stones and organic essential oils to eliminate chronic tension.',
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 28000,
    currency: 'NGN',
    is_active: true,
    icon: 'Sparkles'
  },
  {
    id: 'svc-006',
    business_id: 'biz-002',
    name: 'Organic Botanical Glow & Hydration Facial',
    category: 'Wellness & Spa',
    description: 'Gentle exfoliating fruit-enzyme peel followed by pure botanical serums and lymphatic facial sculpting for an instant radiance.',
    duration_minutes: 45,
    buffer_minutes: 10,
    price: 22000,
    currency: 'NGN',
    is_active: true,
    icon: 'Smile'
  },
  {
    id: 'svc-007',
    business_id: 'biz-002',
    name: 'Holistic Aromatherapy & Full-Body Detox Soak',
    category: 'Wellness & Spa',
    description: 'Immersion in mineral-rich Dead Sea salts infused with eucalyptus and lavender, paired with gentle acupressure bodywork.',
    duration_minutes: 90,
    buffer_minutes: 15,
    price: 40000,
    currency: 'NGN',
    is_active: true,
    icon: 'Feather'
  },
  {
    id: 'svc-008',
    business_id: 'biz-002',
    name: 'Traditional Thai Herbal Compress Therapy',
    category: 'Wellness & Spa',
    description: 'Ancient healing ritual using warm steamed herbal poultices packed with lemongrass, turmeric, and ginger to boost circulation.',
    duration_minutes: 75,
    buffer_minutes: 15,
    price: 32000,
    currency: 'NGN',
    is_active: true,
    icon: 'Heart'
  },

  // ── Pulse High-Performance Athletic Lab (biz-003) ──
  {
    id: 'svc-009',
    business_id: 'biz-003',
    name: 'Personalized Athletic Strength & Conditioning',
    category: 'Fitness & Training',
    description: '1-on-1 progressive resistance training, core stabilization, and neuromuscular speed development tailored to your performance goals.',
    duration_minutes: 60,
    buffer_minutes: 10,
    price: 18000,
    currency: 'NGN',
    is_active: true,
    icon: 'Activity'
  },
  {
    id: 'svc-010',
    business_id: 'biz-003',
    name: 'Metabolic Rate & VO2 Max Bio-Assessment',
    category: 'Fitness & Training',
    description: 'Lab-grade cardiopulmonary metabolic cart testing to calculate exact caloric expenditure zones and aerobic endurance capacity.',
    duration_minutes: 45,
    buffer_minutes: 15,
    price: 25000,
    currency: 'NGN',
    is_active: true,
    icon: 'Zap'
  },
  {
    id: 'svc-011',
    business_id: 'biz-003',
    name: 'Sports Injury Rehabilitation & Mobility Therapy',
    category: 'Fitness & Training',
    description: 'Targeted physical therapy addressing joint impingement, soft-tissue strains, and gait imbalances for safe return to competition.',
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 30000,
    currency: 'NGN',
    is_active: true,
    icon: 'Award'
  },

  // ── Lumina Creative Studio & Visual Lab (biz-004) ──
  {
    id: 'svc-012',
    business_id: 'biz-004',
    name: 'Executive Portrait & Studio Headshot Session',
    category: 'Creative & Design',
    description: 'Professional multi-light studio photography session for LinkedIn profiles, corporate directories, and conference keynotes.',
    duration_minutes: 45,
    buffer_minutes: 15,
    price: 35000,
    currency: 'NGN',
    is_active: true,
    icon: 'Camera'
  },
  {
    id: 'svc-013',
    business_id: 'biz-004',
    name: 'Brand Identity & Visual Sprint Workshop',
    category: 'Creative & Design',
    description: 'Intensive collaborative design sprint delivering brand guidelines, typographic hierarchy, color systems, and logo assets.',
    duration_minutes: 90,
    buffer_minutes: 20,
    price: 65000,
    currency: 'NGN',
    is_active: true,
    icon: 'Layers'
  },
  {
    id: 'svc-014',
    business_id: 'biz-004',
    name: 'Commercial Product & Lifestyle Videography',
    category: 'Creative & Design',
    description: 'High-definition 4K commercial capture with cinematic lighting and custom sound design for e-commerce and social ad campaigns.',
    duration_minutes: 120,
    buffer_minutes: 30,
    price: 95000,
    currency: 'NGN',
    is_active: true,
    icon: 'Video'
  },

  // ── Quantum Cloud & Cyber Systems (biz-005) ──
  {
    id: 'svc-015',
    business_id: 'biz-005',
    name: 'Cloud Architecture & Infrastructure Audit',
    category: 'Tech & Development',
    description: 'Comprehensive evaluation of AWS/GCP/Azure cost efficiency, auto-scaling resilience, and microservice topology.',
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 55000,
    currency: 'NGN',
    is_active: true,
    icon: 'Cloud'
  },
  {
    id: 'svc-016',
    business_id: 'biz-005',
    name: 'Enterprise Cybersecurity Vulnerability Assessment',
    category: 'Tech & Development',
    description: 'Simulated penetration testing, API endpoint fuzzing, and compliance verification under ISO 27001 / NDPR standards.',
    duration_minutes: 90,
    buffer_minutes: 20,
    price: 85000,
    currency: 'NGN',
    is_active: true,
    icon: 'Lock'
  },
  {
    id: 'svc-017',
    business_id: 'biz-005',
    name: 'Generative AI & LLM Solution Blueprinting',
    category: 'Tech & Development',
    description: 'Architecture review for deploying enterprise RAG pipelines, fine-tuning local models, and evaluating latency vs accuracy trade-offs.',
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 65000,
    currency: 'NGN',
    is_active: true,
    icon: 'Cpu'
  },

  // ── BrightSmiles Aesthetic Dental Clinic (biz-006) ──
  {
    id: 'svc-018',
    business_id: 'biz-006',
    name: 'Professional Laser Teeth Whitening & Enamel Care',
    category: 'Healthcare & Dental',
    description: 'Non-invasive LED laser whitening treatment lightening smile shade up to 8 levels without tooth sensitivity.',
    duration_minutes: 45,
    buffer_minutes: 15,
    price: 38000,
    currency: 'NGN',
    is_active: true,
    icon: 'Sun'
  },
  {
    id: 'svc-019',
    business_id: 'biz-006',
    name: 'Comprehensive Dental Checkup & Ultrasonic Scaling',
    category: 'Healthcare & Dental',
    description: 'Preventive oral health screening, digital intraoral photography, ultrasonic plaque removal, and fluoride polish.',
    duration_minutes: 60,
    buffer_minutes: 15,
    price: 22000,
    currency: 'NGN',
    is_active: true,
    icon: 'CheckCircle'
  },
  {
    id: 'svc-020',
    business_id: 'biz-006',
    name: 'Orthodontic & Clear Aligner Digital Smile Assessment',
    category: 'Healthcare & Dental',
    description: '3D digital optical scan of dentition, bite alignment analysis, and virtual simulation of custom clear aligner results.',
    duration_minutes: 30,
    buffer_minutes: 10,
    price: 15000,
    currency: 'NGN',
    is_active: true,
    icon: 'Smile'
  }
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
