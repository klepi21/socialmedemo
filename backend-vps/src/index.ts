import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { jobManager } from './jobs';
import db from './db';

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'SocialMe-Backend-VPS' });
});

// Start Training
app.post('/train', async (req, res) => {
  const { projectId, sourceId, url, manualKnowledge } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  try {
    const jobId = await jobManager.createJob(projectId, sourceId, url, manualKnowledge);
    res.json({ jobId, message: 'Job started' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stream Job Status (SSE)
app.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(() => {
    const job = jobManager.getJob(jobId);
    if (job) {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
      if (job.status === 'success' || job.status === 'error') {
        clearInterval(interval);
        res.end();
      }
    } else {
      res.write(`data: ${JSON.stringify({ status: 'idle', message: 'Not found' })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// Stop Job
app.post('/stop', (req, res) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  jobManager.stopJob(projectId);
  res.json({ message: 'Job stopping' });
});

app.listen(PORT, () => {
  console.log(`🚀 SocialMe Backend Running on port ${PORT}`);
});
