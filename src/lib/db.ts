import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:socialme.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize schema (async-ish, Turso execute)
// We use a self-invoked function for the schema init but individual calls elsewhere
export const initSchema = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        namespace TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'idle',
        system_prompt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL, 
        content TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        text TEXT NOT NULL,
        vector TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS project_pages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        char_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        client_name TEXT,
        email TEXT,
        phone TEXT,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_embeddings_project ON embeddings(project_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_pages_project ON project_pages(project_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_id)`);
    
    console.log("Database schema synchronized with Turso!");
  } catch (error) {
    console.error("Turso schema init error:", error);
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
