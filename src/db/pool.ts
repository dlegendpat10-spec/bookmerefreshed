import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bookme';
  // Unwrap bracket-encoded passwords e.g. :[password]@
  return raw.replace(/:\[([^\]]+)\]@/, ':$1@');
}

const connectionString = getConnectionString();
const isPgBouncer = connectionString.includes('pgbouncer=true') || connectionString.includes(':6543/');
const isRemoteDb = connectionString.includes('supabase.com') || connectionString.includes('render.com') || process.env.NODE_ENV === 'production';

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is not set — falling back to localhost. This will fail in production!');
}

export const pool = new Pool({
  connectionString,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
  max: isPgBouncer ? 5 : 10,           // PgBouncer already pools; keep client count low
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  // Disable statement caching when running through PgBouncer (transaction mode)
  ...(isPgBouncer && { statement_timeout: 30000 }),
});

pool.on('error', (err) => {
  console.warn('PostgreSQL pool connection warning:', err.message);
});

export async function safeQuery(
  text: string,
  params: any[] = []
): Promise<QueryResult<any>> {
  return await pool.query(text, params);
}

export async function initDbSchema() {
  try {
    // 1. Make business_id nullable for new user profiles before they create a business
    await pool.query(`ALTER TABLE admin_profiles ALTER COLUMN business_id DROP NOT NULL;`);
  } catch (e: any) {
    // Ignore if already nullable
  }

  try {
    // 2. Add password_hash column if missing
    await pool.query(`ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`);
  } catch (e: any) {
    // Ignore if already exists
  }

  console.log('✅ PostgreSQL Schema Auto-Migration verified.');
}
