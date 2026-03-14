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
  createJob(projectId: string, sourceId?: string, url?: string, manualKnowledge?: string): string {
    // If there is already an active job for this project, return IT instead of creating new
    if (activeProjectJobs.has(projectId)) {
      const existingId = activeProjectJobs.get(projectId)!;
      const existingJob = jobs.get(existingId);
      if (existingJob && (existingJob.status === 'scraping' || existingJob.status === 'vectorizing')) {
        return existingId;
      }
    }

    const id = Buffer.from(projectId + Date.now()).toString('base64').slice(0, 10);
    const newJob: TrainingJob = { id, url: url || 'manual', status: 'idle', message: 'Starting...', progress: 0, current: 0, total: 0, chunks: 0, startTime: Date.now() };
    jobs.set(id, newJob);
    activeProjectJobs.set(projectId, id);

    let finalSourceId = sourceId;
    if (!finalSourceId) {
       const source = url 
         ? db.prepare('SELECT id FROM sources WHERE project_id = ? AND content = ?').get(projectId, url) as any
         : db.prepare('SELECT id FROM sources WHERE project_id = ? AND type = "text"').get(projectId) as any;
       finalSourceId = source?.id;
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

  // Force reset a project's job status
  resetProject(projectId: string) {
    activeProjectJobs.delete(projectId);
    // We don't necessarily delete the job from 'jobs' map so logs remain,
    // but the project is no longer considered "actively training".
  },

  async runJob(id: string, projectId: string, sourceId: string, url?: string, manualKnowledge?: string) {
    const job = jobs.get(id);
    if (!job) return;

    try {
      // 1. Initial State & Cleanup
      db.prepare("UPDATE projects SET status = 'training' WHERE id = ?").run(projectId);
      db.prepare("DELETE FROM embeddings WHERE source_id = ?").run(sourceId);
      db.prepare("DELETE FROM project_pages WHERE source_id = ?").run(sourceId);

      const insertEmbedding = db.prepare('INSERT INTO embeddings (id, project_id, source_id, text, vector) VALUES (?, ?, ?, ?, ?)');
      const insertPage = db.prepare('INSERT INTO project_pages (id, project_id, source_id, url, title, char_count) VALUES (?, ?, ?, ?, ?, ?)');

      const processPage = async (page: { url: string, content: string, title: string }) => {
        try {
          // Verify source still exists (protection against 'Wipe Knowledge' while running)
          const sourceExists = db.prepare('SELECT 1 FROM sources WHERE id = ?').get(sourceId);
          if (!sourceExists) {
            console.log(`Job ${id}: Source ${sourceId} was deleted. Stopping.`);
            throw new Error('STOP_JOB');
          }

          // Insert page metadata
          insertPage.run(uuidv4(), projectId, sourceId, page.url, page.title, page.content.length);

          // Vectorize & Insert Chunks
          const chunks = chunkText(page.content, 900);
          for (const chunk of chunks) {
            const embedding = await getLocalEmbedding(chunk);
            insertEmbedding.run(uuidv4(), projectId, sourceId, chunk, JSON.stringify(embedding));
            job.chunks++;
          }
          
          job.current++;
          // Simulated progress for responsiveness
          job.progress = Math.min(99, 10 + Math.floor((job.current / (job.total || 50)) * 80));
        } catch (err: any) {
          if (err.message === 'STOP_JOB') throw err;
          console.error(`Job ${id}: Failed to process page ${page.url}:`, err.message);
        }
      };

      // 2. Execution Logic
      if (url) {
        job.status = 'scraping';
        job.message = 'Deep Crawling & Learning...';
        const crawler = new CustomCrawler(2000); // Allow many pages
        
        await crawler.crawl(
          url, 
          (msg, current) => {
            job.message = msg;
            // job.current is updated in processPage now
          },
          async (page) => {
            // This happens IN PARALLEL with the crawl
            await processPage(page);
          }
        );
      }

      if (manualKnowledge) {
        job.status = 'vectorizing';
        job.message = 'Processing Manual Entry...';
        await processPage({ url: 'manual', title: 'Manual Entry', content: manualKnowledge });
      }

      // 3. Finalization
      db.prepare("UPDATE sources SET status = 'completed' WHERE id = ?").run(sourceId);
      db.prepare("UPDATE projects SET status = 'ready' WHERE id = ?").run(projectId);
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
      db.prepare("UPDATE projects SET status = 'error' WHERE id = ?").run(projectId);
      activeProjectJobs.delete(projectId);
    }
  }
};
