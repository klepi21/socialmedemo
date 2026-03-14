import { NextRequest, NextResponse } from 'next/server';
import projectService from '@/lib/project-service';
import { jobManager } from '@/lib/jobs';

export async function POST(req: NextRequest, context: any) {
  try {
    const params = await context.params;
    const id = params?.id;
    
    if (!id) return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 });

    // 1. Stop any active training for this project
    jobManager.stopJob(id);

    // --- PROXY to VPS stop if configured ---
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (BACKEND_URL && BACKEND_URL.startsWith('http')) {
      try {
        await fetch(`${BACKEND_URL}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: id })
        });
        console.log(`[PROXY] Remote stop sent to ${BACKEND_URL}`);
      } catch (err: any) {
        console.warn("[PROXY] Remote stop failed:", err.message);
      }
    }
    
    // 2. Wipe the knowledge data from DB
    await projectService.resetKnowledge(id);
    
    return NextResponse.json({ message: 'Project knowledge wiped and training stopped' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
