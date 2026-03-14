import { NextRequest, NextResponse } from 'next/server';
import { jobManager } from '@/lib/jobs';
import projectService from '@/lib/project-service';

export const dynamic = 'force-dynamic';

// GET: Stream status of a specific job
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'JobId is required' }, { status: 400 });
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
    const { projectId, sourceId, url, manualKnowledge } = await req.json();
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const project = projectService.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const jobId = jobManager.createJob(projectId, sourceId, url, manualKnowledge);
    return NextResponse.json({ jobId, message: 'Training started' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
