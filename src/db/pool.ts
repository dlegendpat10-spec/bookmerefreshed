import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bookme';
  // Strip accidental square brackets around password if present
  return raw.replace(/:\[([^\]]+)\]@/, ':$1@');
}

const connectionString = getConnectionString();
const isRemoteDb = connectionString.includes('supabase.com') || connectionString.includes('render.com') || process.env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.warn('PostgreSQL pool connection warning:', err.message);
});

// Fallback seed data when database table or connection is initializing
export const SEED_SERVICES = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    business_id: '00000000-0000-0000-0000-000000000001',
    name: 'Initial Academic Consultation',
    description: 'Comprehensive 1-on-1 assessment of student academic goals and guidance strategy.',
    duration_minutes: 60,
    buffer_minutes: 15,
    price: '15000.00',
    icon: '🎯',
    category: 'Consultation',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    business_id: '00000000-0000-0000-0000-000000000001',
    name: '1-on-1 Subject Tutoring',
    description: 'Personalised subject-specific tutoring session with tailored practice material.',
    duration_minutes: 90,
    buffer_minutes: 15,
    price: '25000.00',
    icon: '📚',
    category: 'Tutoring',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    business_id: '00000000-0000-0000-0000-000000000001',
    name: 'University Admissions Strategy',
    description: 'Expert guidance on university application essays, portfolio review, and interview prep.',
    duration_minutes: 120,
    buffer_minutes: 30,
    price: '40000.00',
    icon: '🎓',
    category: 'Admissions',
    is_active: true,
    created_at: new Date().toISOString(),
  }
];

export async function safeQuery<T = any>(
  text: string,
  params: any[] = [],
  fallbackRows: T[] = []
): Promise<QueryResult<any>> {
  try {
    return await pool.query(text, params);
  } catch (err: any) {
    console.warn(`[DB Query Warning] ${err.message}. Using resilient response.`);
    return {
      rows: fallbackRows,
      command: 'SELECT',
      rowCount: fallbackRows.length,
      oid: 0,
      fields: []
    };
  }
}
