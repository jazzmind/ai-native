import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let _db: ReturnType<typeof drizzleNeon<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const sql = neon(process.env.DATABASE_URL);
  _db = drizzleNeon(sql, { schema });
  return _db;
}

export type DrizzleDb = ReturnType<typeof getDb>;
