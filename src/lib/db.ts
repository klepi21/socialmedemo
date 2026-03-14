import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'socialme.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    namespace TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'idle', -- 'idle', 'training', 'ready', 'error'
    system_prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Migration attempt is safer
  BEGIN;
  SELECT count(*) FROM pragma_table_info('projects') WHERE name='system_prompt';
  -- Note: better-sqlite3 doesn't support conditional execution in a single exec block like this easily, 
  -- so I will do it the simple way but adding a separate statement that handles error gracefully.
  COMMIT;

  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'url', 'file', 'text'
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'crawling', 'embedding', 'completed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    text TEXT NOT NULL,
    vector TEXT NOT NULL, -- Store as JSON stringified array
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(source_id) REFERENCES sources(id)
  );

  CREATE TABLE IF NOT EXISTS project_pages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    char_count INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(source_id) REFERENCES sources(id)
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    client_name TEXT,
    email TEXT,
    phone TEXT,
    data TEXT, -- JSON string of the analysis result
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  CREATE INDEX IF NOT EXISTS idx_embeddings_project ON embeddings(project_id);
  CREATE INDEX IF NOT EXISTS idx_pages_project ON project_pages(project_id);
  CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_id);
`);

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
