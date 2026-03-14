import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

// Lazy client creation to avoid module-level crashes
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

let schemaInitialized = false;

// Initialize schema (async-ish, Turso execute)
export const initSchema = async () => {
  if (schemaInitialized) return;
  
  try {
    console.log("Synchronizing database schema...");
    
    // Using a simple array of queries since Turso execute takes one at a time or use batch
    await db.batch([
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        namespace TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'idle',
        system_prompt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL, 
        content TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        text TEXT NOT NULL,
        vector TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS project_pages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        char_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        client_name TEXT,
        email TEXT,
        phone TEXT,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_embeddings_project ON embeddings(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pages_project ON project_pages(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_id)`
    ], "write");

    schemaInitialized = true;
    console.log("Database schema synchronized successfully!");
  } catch (error) {
    console.error("Turso schema init error:", error);
    // Don't throw, let the app try to continue
  }
};

export default db;

export interface Project {
  id: string;
  name: string;
  description: string | null;
  namespace: string;
  status: string;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  project_id: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
}
