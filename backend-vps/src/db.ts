import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let _db: any = null;

export function getDb() {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:socialme.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}

const db = {
  execute: async (args: any) => getDb().execute(args),
  batch: async (args: any, mode?: any) => getDb().batch(args, mode),
};

export default db;
