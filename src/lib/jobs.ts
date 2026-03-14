import { CustomCrawler } from './crawler';
import { getLocalEmbedding } from './ai';
import db from './db';
import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'idle' | 'scraping' | 'vectorizing' | 'success' | 'error';

export interface TrainingJob {
  id: string;
  url: string;
  status: JobStatus;
  message: string;
  progress: number;
  current: number;
  total: number;
  chunks: number;
  totalDiscovered: number;
  startTime: number;
}

// Persistence across HMR in development
const globalForJobs = global as any;

if (!globalForJobs.jobs) {
  globalForJobs.jobs = new Map<string, TrainingJob>();
}
if (!globalForJobs.activeProjectJobs) {
  globalForJobs.activeProjectJobs = new Map<string, string>();
}

const jobs: Map<string, TrainingJob> = globalForJobs.jobs;
const activeProjectJobs: Map<string, string> = globalForJobs.activeProjectJobs;
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
    // If there is already an active job for this project, return IT instead of creating new
    if (activeProjectJobs.has(projectId)) {
      const existingId = activeProjectJobs.get(projectId)!;
      const existingJob = jobs.get(existingId);
      if (existingJob && (existingJob.status === 'scraping' || existingJob.status === 'vectorizing')) {
        return existingId;
      }
    }

    const id = Buffer.from(projectId + Date.now()).toString('base64').slice(0, 10);
    const newJob: TrainingJob = { id, url: url || 'manual', status: 'idle', message: 'Starting...', progress: 0, current: 0, total: 0, chunks: 0, totalDiscovered: 0, startTime: Date.now() };
    jobs.set(id, newJob);
    activeProjectJobs.set(projectId, id);
    
    const controller = new AbortController();
    abortControllers.set(id, controller);

    let finalSourceId = sourceId;
    if (!finalSourceId) {
       const rs = url 
         ? await db.execute({ sql: 'SELECT id FROM sources WHERE project_id = ? AND content = ?', args: [projectId, url] })
         : await db.execute({ sql: 'SELECT id FROM sources WHERE project_id = ? AND type = "text"', args: [projectId] });
       finalSourceId = rs.rows[0]?.id as string;
    }
    if (!finalSourceId) throw new Error('Source not found.');

    this.runJob(id, projectId, finalSourceId, url, manualKnowledge);
    return id;
  },

  getJob(id: string) { return jobs.get(id); },

  // Get job by project ID (for UI reconnection)
  getJobByProject(projectId: string) {
    const id = activeProjectJobs.get(projectId);
    const job = id ? jobs.get(id) : null;
    return job;
  },

  // Stop and cleanup a project's job
  stopJob(projectId: string) {
    const jobId = activeProjectJobs.get(projectId);
    if (jobId) {
      const controller = abortControllers.get(jobId);
      if (controller) {
        controller.abort();
        abortControllers.delete(jobId);
      }
      activeProjectJobs.delete(projectId);
      const job = jobs.get(jobId);
      if (job) {
         job.status = 'idle';
         job.message = 'Stopped by user.';
      }
    }
  },

  resetProject(projectId: string) {
    this.stopJob(projectId);
  },

  async runJob(id: string, projectId: string, sourceId: string, url?: string, manualKnowledge?: string) {
    const job = jobs.get(id);
    if (!job) return;

    try {
      // 1. Initial State & Cleanup
      await db.batch([
        { sql: "UPDATE projects SET status = 'training' WHERE id = ?", args: [projectId] },
        { sql: "DELETE FROM embeddings WHERE source_id = ?", args: [sourceId] },
        { sql: "DELETE FROM project_pages WHERE source_id = ?", args: [sourceId] }
      ]);

      const processPage = async (page: { url: string, content: string, title: string }) => {
        try {
          // Verify source still exists
          const rsSource = await db.execute({ sql: 'SELECT 1 FROM sources WHERE id = ?', args: [sourceId] });
          if (rsSource.rows.length === 0) {
            console.log(`Job ${id}: Source ${sourceId} was deleted. Stopping.`);
            throw new Error('STOP_JOB');
          }

          // Insert page metadata
          await db.execute({
            sql: 'INSERT INTO project_pages (id, project_id, source_id, url, title, char_count) VALUES (?, ?, ?, ?, ?, ?)',
            args: [uuidv4(), projectId, sourceId, page.url, page.title, page.content.length]
          });

          // Vectorize & Insert Chunks
          const chunks = chunkText(page.content, 900);
          for (const chunk of chunks) {
            const embedding = await getLocalEmbedding(chunk);
            await db.execute({
              sql: 'INSERT INTO embeddings (id, project_id, source_id, text, vector) VALUES (?, ?, ?, ?, ?)',
              args: [uuidv4(), projectId, sourceId, chunk, JSON.stringify(embedding)]
            });
            job.chunks++;
          }
          
          job.current++;
          job.progress = Math.min(99, 2 + Math.floor((job.current / 20) * 97)); // Assuming max 20 pages for progress
        } catch (err: any) {
          if (err.message === 'STOP_JOB') throw err;
          console.error(`Job ${id}: Failed to process page ${page.url}:`, err.message);
        }
      };

      // 2. Execution Logic
      if (url) {
        job.status = 'scraping';
        const controller = abortControllers.get(id);
        const crawler = new CustomCrawler(20); // Max 20 pages
        
        await crawler.crawl(
          url, 
          (msg: string, current: number, discovered: number) => {
            job.message = msg;
            job.totalDiscovered = discovered;
          },
          async (page: any) => {
            if (controller?.signal.aborted) throw new Error('STOP_JOB');
            await processPage(page);
          },
          controller?.signal
        );
      }

      if (manualKnowledge) {
        job.status = 'vectorizing';
        job.message = 'Processing Manual Entry...';
        await processPage({ url: 'manual', title: 'Manual Entry', content: manualKnowledge });
      }

      // 3. Finalization
      await db.batch([
        { sql: "UPDATE sources SET status = 'completed' WHERE id = ?", args: [sourceId] },
        { sql: "UPDATE projects SET status = 'ready' WHERE id = ?", args: [projectId] }
      ]);
      job.status = 'success';
      job.message = `Sync Complete! Learned ${job.current} pages.`;
      activeProjectJobs.delete(projectId);
    } catch (error: any) {
      if (error.message === 'STOP_JOB') {
        activeProjectJobs.delete(projectId);
        return;
      }
      console.error('JobManager Error:', error);
      job.status = 'error';
      job.message = error.message;
      await db.execute({ sql: "UPDATE projects SET status = 'error' WHERE id = ?", args: [projectId] });
      activeProjectJobs.delete(projectId);
    }
  }
};
