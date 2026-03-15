import { v4 as uuidv4 } from 'uuid';
import db, { Project, Source, initSchema } from './db';

const projectService = {
  // Create a new project
  async createProject(name: string, description?: string): Promise<Project> {
    
    const id = uuidv4();
    const namespace = `ns_${id.replace(/-/g, '')}`;
    const defaultPrompt = `Είσαι ένας φιλικός AI βοηθός για το project "${name}". Στόχος σου είναι να βοηθάς τους χρήστες με βάση τις πληροφορίες που έχεις εκπαιδευτεί.`;
    
    await db.execute({
      sql: `INSERT INTO projects (id, name, description, namespace, system_prompt) VALUES (?, ?, ?, ?, ?)`,
      args: [id, name, description || null, namespace, defaultPrompt]
    });
    
    return (await this.getProject(id)) as Project;
  },

  // Update project prompt
  async updateProjectPrompt(id: string, prompt: string): Promise<void> {
    
    await db.execute({
      sql: 'UPDATE projects SET system_prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [prompt, id]
    });
  },

  // Get project by ID
  async getProject(id: string): Promise<Project | null> {
    
    console.log(`[DB] Querying project with ID: ${id}`);
    try {
      const rs = await db.execute({
        sql: 'SELECT * FROM projects WHERE id = ?',
        args: [id]
      });
      const project = (rs.rows[0] as unknown as Project) || null;
      console.log(`[DB] Result for ${id}: ${project ? 'found' : 'not found'}`);
      return project;
    } catch (err: any) {
      console.error(`[DB ERROR] getProject failed:`, err);
      throw err;
    }
  },

  // List all projects
  async listProjects(): Promise<Project[]> {
    
    const rs = await db.execute('SELECT * FROM projects ORDER BY created_at DESC');
    return rs.rows as unknown as Project[];
  },

  // Add a source to a project
  async addSource(projectId: string, type: 'url' | 'file' | 'text', content: string): Promise<Source> {
    
    const id = uuidv4();
    await db.execute({
      sql: `INSERT INTO sources (id, project_id, type, content) VALUES (?, ?, ?, ?)`,
      args: [id, projectId, type, content]
    });
    return (await this.getSource(id)) as Source;
  },

  // Get sources for a project
  async getSources(projectId: string): Promise<Source[]> {
    
    const rs = await db.execute({
      sql: 'SELECT * FROM sources WHERE project_id = ?',
      args: [projectId]
    });
    return rs.rows as unknown as Source[];
  },

  // Get single source
  async getSource(id: string): Promise<Source | null> {
    
    const rs = await db.execute({
      sql: 'SELECT * FROM sources WHERE id = ?',
      args: [id]
    });
    return (rs.rows[0] as unknown as Source) || null;
  },

  // Update project status
  async updateProjectStatus(id: string, status: string) {
    
    await db.execute({
      sql: 'UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [status, id]
    });
  },

  // Get project stats
  async getStats(projectId: string) {
    
    const rsVectors = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM embeddings WHERE project_id = ?',
      args: [projectId]
    });
    const rsSources = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM sources WHERE project_id = ?',
      args: [projectId]
    });
    return {
      vectors: Number(rsVectors.rows[0]?.count) || 0,
      sources: Number(rsSources.rows[0]?.count) || 0,
    };
  },

  // Get individual pages learned by the project
  async getPages(projectId: string): Promise<any[]> {
    
    const rs = await db.execute({
      sql: 'SELECT * FROM project_pages WHERE project_id = ? ORDER BY created_at DESC',
      args: [projectId]
    });
    return Array.from(rs.rows);
  },

  async deleteProject(id: string): Promise<void> {
    await this.resetKnowledge(id);
    await db.execute({
      sql: 'DELETE FROM projects WHERE id = ?',
      args: [id]
    });
  },

  async resetKnowledge(projectId: string): Promise<void> {
    
    await db.batch([
      { sql: 'DELETE FROM embeddings WHERE project_id = ?', args: [projectId] },
      { sql: 'DELETE FROM project_pages WHERE project_id = ?', args: [projectId] },
      { sql: 'DELETE FROM sources WHERE project_id = ?', args: [projectId] },
      { sql: 'UPDATE projects SET status = \'idle\' WHERE id = ?', args: [projectId] }
    ]);
  },

  // Save a new lead
  async saveLead(projectId: string | null, clientName: string, email: string, phone: string, data: any) {
    
    const id = uuidv4();
    const cleanProjectId = (projectId === 'undefined' || !projectId) ? null : projectId;
    
    console.log(`[DB] Saving lead ${id} for project ${cleanProjectId}`);
    await db.execute({
      sql: `INSERT INTO leads (id, project_id, client_name, email, phone, data) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, cleanProjectId, clientName, email, phone, JSON.stringify(data)]
    });
    return id;
  },

  // List all leads for a dashboard
  async listLeads(projectId?: string) {
    let sql = 'SELECT * FROM leads';
    let args: any[] = [];
    
    if (projectId) {
      sql += ' WHERE project_id = ?';
      args.push(projectId);
    }
    
    sql += ' ORDER BY created_at DESC';
    const rs = await db.execute({ sql, args });
    return rs.rows.map((lead: any) => ({
      ...lead,
      data: lead.data ? JSON.parse(lead.data as string) : {}
    }));
  }
};

export default projectService;
