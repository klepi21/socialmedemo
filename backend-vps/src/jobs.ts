import { CustomCrawler } from './crawler';
import { getLocalEmbedding } from './ai';
import db from './db';
import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'idle' | 'scraping' | 'vectorizing' | 'success' | 'error';

export interface TrainingJob {
  id: string;
  projectId: string;
  url: string;
  status: JobStatus;
  message: string;
  progress: number;
  current: number;
  totalDiscovered: number;
  startTime: number;
}

const jobs = new Map<string, TrainingJob>();
const activeProjectJobs = new Map<string, string>();
const abortControllers = new Map<string, AbortController>();

function chunkText(text: string, size: number = 800): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]*\s*|\n/g) || [text];
  
  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > size && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += sentence;
  }
  if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
  return chunks;
}

export const jobManager = {
  async createJob(projectId: string, sourceId?: string, url?: string, manualKnowledge?: string): Promise<string> {
    if (activeProjectJobs.has(projectId)) {
      const existingId = activeProjectJobs.get(projectId)!;
      const existingJob = jobs.get(existingId);
      if (existingJob && (existingJob.status === 'scraping' || existingJob.status === 'vectorizing')) {
        return existingId;
      }
    }

    const id = uuidv4().slice(0, 8);
    console.log(`[JOBS] Creating new job ${id} for project ${projectId}`);
    
    const newJob: TrainingJob = { 
        id, 
        projectId,
        url: url || 'manual', 
        status: 'idle', 
        message: 'Starting...', 
        progress: 0, 
        current: 0, 
        totalDiscovered: 0, 
        startTime: Date.now() 
    };
    
    jobs.set(id, newJob);
    activeProjectJobs.set(projectId, id);
    
    const controller = new AbortController();
    abortControllers.set(id, controller);

    // Run async
    this.runJob(id, projectId, sourceId, url, manualKnowledge);
    
    return id;
  },

  getJob(id: string) { return jobs.get(id); },
  
  getJobByProject(projectId: string) {
    const id = activeProjectJobs.get(projectId);
    return id ? jobs.get(id) : null;
  },

  stopJob(projectId: string) {
    const jobId = activeProjectJobs.get(projectId);
    if (jobId) {
      const controller = abortControllers.get(jobId);
      if (controller) controller.abort();
      activeProjectJobs.delete(projectId);
      const job = jobs.get(jobId);
      if (job) {
          job.status = 'idle';
          job.message = 'Stopped by user.';
      }
    }
  },

  async runJob(id: string, projectId: string, sourceId?: string, url?: string, manualKnowledge?: string) {
    const job = jobs.get(id);
    if (!job) return;

    console.log(`[JOBS] Starting execution for job ${id} (Project: ${projectId}, URL: ${url || 'manual'})`);

    try {
      await db.execute({ sql: "UPDATE projects SET status = 'training' WHERE id = ?", args: [projectId] });
      
      const processPage = async (page: { url: string, content: string, title: string }) => {
        console.log(`[JOBS] Processing page: ${page.url} (${page.content.length} chars)`);
        // Insert page metadata
        const pageId = uuidv4();
        await db.execute({
          sql: 'INSERT INTO project_pages (id, project_id, source_id, url, title, char_count) VALUES (?, ?, ?, ?, ?, ?)',
          args: [pageId, projectId, sourceId || 'manual', page.url, page.title, page.content.length]
        });

        // Vectorize
        const chunks = chunkText(page.content, 900);
        for (const chunk of chunks) {
          const embedding = await getLocalEmbedding(chunk);
          await db.execute({
            sql: 'INSERT INTO embeddings (id, project_id, source_id, text, vector) VALUES (?, ?, ?, ?, ?)',
            args: [uuidv4(), projectId, sourceId || 'manual', chunk, JSON.stringify(embedding)]
          });
        }
        
        job.current++;
        job.progress = Math.min(99, Math.floor((job.current / 20) * 100));
      };

      if (url) {
        job.status = 'scraping';
        const controller = abortControllers.get(id);
        const crawler = new CustomCrawler(50); // Increased limit for VPS
        
        await crawler.crawl(
          url, 
          (msg, current, discovered) => {
            job.message = msg;
            job.totalDiscovered = discovered;
          },
          async (page) => {
            if (controller?.signal.aborted) throw new Error('ABORTED');
            await processPage(page);
          },
          controller?.signal
        );
      }

      if (manualKnowledge) {
        job.status = 'vectorizing';
        await processPage({ url: 'manual', title: 'Manual Entry', content: manualKnowledge });
      }

      await db.execute({ sql: "UPDATE projects SET status = 'ready' WHERE id = ?", args: [projectId] });
      job.status = 'success';
      job.message = `Sync Complete! Learned ${job.current} pages.`;
      
    } catch (error: any) {
      if (error.message === 'ABORTED') {
          console.log(`[JOBS] Job ${id} was aborted.`);
          return;
      }
      console.error(`[JOBS] FATAL ERROR in job ${id}:`, error.message);
      if (error.message.includes('migration')) {
        console.error("[JOBS] HINT: This is likely a Database Connection issue. Check your TURSO_AUTH_TOKEN and URL.");
      }
      
      job.status = 'error';
      job.message = error.message;
      try {
        await db.execute({ sql: "UPDATE projects SET status = 'error' WHERE id = ?", args: [projectId] });
      } catch (dbErr: any) {
        console.error("[JOBS] Could not update project status in DB:", dbErr.message);
      }
    }
  }
};
