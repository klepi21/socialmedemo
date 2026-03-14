import { v4 as uuidv4 } from 'uuid';
import db, { Project, Source } from './db';

const projectService = {
  // Create a new project
  async createProject(name: string, description?: string): Promise<Project> {
    const id = uuidv4();
    const namespace = `ns_${id.replace(/-/g, '')}`;
    const defaultPrompt = `Είσαι ένας φιλικός AI βοηθός για το project "${name}". Στόχος σου είναι να βοηθάς τους χρήστες με βάση τις πληροφορίες που έχεις εκπαιδευτεί.`;
    
    const stmt = db.prepare(`
      INSERT INTO projects (id, name, description, namespace, system_prompt)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, name, description || null, namespace, defaultPrompt);
    return this.getProject(id) as Project;
  },

  // Update project prompt
  async updateProjectPrompt(id: string, prompt: string): Promise<void> {
    const stmt = db.prepare('UPDATE projects SET system_prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(prompt, id);
  },

  // Get project by ID
  getProject(id: string): Project | null {
    const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(id) as Project | null;
  },

  // List all projects
  listProjects(): Project[] {
    const stmt = db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    return stmt.all() as Project[];
  },

  // Add a source to a project
  async addSource(projectId: string, type: 'url' | 'file' | 'text', content: string): Promise<Source> {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO sources (id, project_id, type, content)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, projectId, type, content);
    return this.getSource(id) as Source;
  },

  // Get sources for a project
  getSources(projectId: string): Source[] {
    const stmt = db.prepare('SELECT * FROM sources WHERE project_id = ?');
    return stmt.all(projectId) as Source[];
  },

  // Get single source
  getSource(id: string): Source | null {
    const stmt = db.prepare('SELECT * FROM sources WHERE id = ?');
    return stmt.get(id) as Source | null;
  },

  // Update project status
  updateProjectStatus(id: string, status: string) {
    const stmt = db.prepare('UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, id);
  },

  // Get project stats
  getStats(projectId: string) {
    const vectors = db.prepare('SELECT COUNT(*) as count FROM embeddings WHERE project_id = ?').get(projectId) as any;
    const sources = db.prepare('SELECT COUNT(*) as count FROM sources WHERE project_id = ?').get(projectId) as any;
    return {
      vectors: vectors?.count || 0,
      sources: sources?.count || 0,
    };
  },

  // Get individual pages learned by the project
  getPages(projectId: string): any[] {
    const stmt = db.prepare('SELECT * FROM project_pages WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId);
  },

  async resetKnowledge(projectId: string): Promise<void> {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM embeddings WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM project_pages WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM sources WHERE project_id = ?').run(projectId);
      db.prepare('UPDATE projects SET status = \'idle\' WHERE id = ?').run(projectId);
    });
    transaction();
  },

  // Save a new lead
  saveLead(projectId: string | null, clientName: string, email: string, phone: string, data: any) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO leads (id, project_id, client_name, email, phone, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, projectId, clientName, email, phone, JSON.stringify(data));
    return id;
  },

  // List all leads for a dashboard
  listLeads(projectId?: string) {
    let sql = 'SELECT * FROM leads';
    let params: any[] = [];
    
    if (projectId) {
      sql += ' WHERE project_id = ?';
      params.push(projectId);
    }
    
    sql += ' ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    return stmt.all(...params).map((lead: any) => ({
      ...lead,
      data: JSON.parse(lead.data)
    }));
  }
};

export default projectService;
