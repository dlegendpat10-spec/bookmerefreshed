import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bookme';
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

export async function safeQuery(
  text: string,
  params: any[] = []
): Promise<QueryResult<any>> {
  return await pool.query(text, params);
}
