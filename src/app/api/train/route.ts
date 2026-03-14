import { NextRequest, NextResponse } from 'next/server';
import { jobManager } from '@/lib/jobs';
import projectService from '@/lib/project-service';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// GET: Stream status of a specific job
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'JobId is required' }, { status: 400 });
  }

  // --- PROXY to VPS if configured ---
  if (BACKEND_URL && BACKEND_URL.startsWith('http')) {
    try {
      const remoteUrl = `${BACKEND_URL}/status/${jobId}`;
      const res = await fetch(remoteUrl);
      return new Response(res.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (err: any) {
      console.error("[PROXY] SSE Failed:", err.message);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const interval = setInterval(() => {
        const job = jobManager.getJob(jobId);
        if (job) {
          sendUpdate(job);
          if (job.status === 'success' || job.status === 'error') {
            clearInterval(interval);
            controller.close();
          }
        } else {
          sendUpdate({ status: 'idle', message: 'No active job found.' });
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      req.signal.addEventListener('abort', () => clearInterval(interval));
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// POST: Start a new background training job for a project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, sourceId, url, manualKnowledge } = body;
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    // --- PROXY to VPS if configured ---
    if (BACKEND_URL && BACKEND_URL.startsWith('http')) {
      const remoteUrl = `${BACKEND_URL.replace(/\/$/, '')}/train`;
      console.log(`[PROXY] Forwarding training to VPS: ${remoteUrl}`);
      
      try {
        const res = await fetch(remoteUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          // Add a reasonable timeout for the proxy connection
          signal: AbortSignal.timeout(5000) 
        });
        
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      } catch (proxyErr: any) {
        console.error(`[PROXY FATAL] Failed to reach VPS at ${remoteUrl}:`, proxyErr.message);
        return NextResponse.json({ 
          error: 'VPS_REACH_FAILED', 
          details: proxyErr.message,
          target: remoteUrl 
        }, { status: 502 });
      }
    }

    const project = await projectService.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const jobId = await jobManager.createJob(projectId, sourceId, url, manualKnowledge);
    return NextResponse.json({ jobId, message: 'Training started' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
