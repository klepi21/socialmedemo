import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly from the current directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const rawUrl = process.env.TURSO_DATABASE_URL || '';
const url = rawUrl.trim().replace(/[\r\n]/g, '');
const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim().replace(/[\r\n]/g, '');

if (!url) {
  console.error("[DB] CRITICAL: TURSO_DATABASE_URL is missing in .env!");
}
if (!authToken && !url.startsWith('file:')) {
  console.error("[DB] CRITICAL: TURSO_AUTH_TOKEN is missing in .env!");
}

let _db: any = null;

export function getDb() {
  if (!_db) {
    console.log(`[DB] Connecting to Turso: ${url.slice(0, 20)}...`);
    _db = createClient({
      url: url || 'file:socialme.db',
      authToken: authToken,
    });
  }
  return _db;
}

const db = {
  execute: async (args: any) => getDb().execute(args),
  batch: async (args: any, mode?: any) => getDb().batch(args, mode),
};

export default db;
