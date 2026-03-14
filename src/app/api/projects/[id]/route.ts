import { NextRequest, NextResponse } from 'next/server';
import projectService from '@/lib/project-service';
import { jobManager } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const metaId = `DEBUG_${Date.now()}`;
  try {
    const { id } = await params;
    console.log(`[${metaId}] Request for info on project: ${id}`);

    // Step 1: Check Project
    const project = await projectService.getProject(id).catch(e => {
       console.error(`[${metaId}] projectService.getProject FAILED:`, e);
       throw new Error(`DB_PROJECT_FETCH_FAIL: ${e.message}`);
    });
    
    if (!project) {
      console.log(`[${metaId}] Project not found: ${id}`);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Step 2-4: Sequential fetch to isolate errors
    console.log(`[${metaId}] Fetching sources...`);
    const sources = await projectService.getSources(id).catch(e => []);
    
    console.log(`[${metaId}] Fetching pages...`);
    const pages = await projectService.getPages(id).catch(e => []);
    
    console.log(`[${metaId}] Fetching stats...`);
    const stats = await projectService.getStats(id).catch(e => ({ vectors: 0, sources: 0 }));

    // Step 5: Jobs
    console.log(`[${metaId}] Checking active jobs...`);
    let activeJobId = null;
    try {
      const activeJob = jobManager.getJobByProject(id);
      activeJobId = activeJob?.id || null;
    } catch(e) {
      console.warn(`[${metaId}] jobManager.getJobByProject failed (non-critical):`, e);
    }

    console.log(`[${metaId}] All steps completed. Returning data.`);
    return NextResponse.json({ 
      project, 
      sources, 
      pages, 
      stats,
      activeJobId
    });
  } catch (error: any) {
    console.error(`[${metaId}] UNHANDLED ERROR IN API ROUTE:`, error);
    return NextResponse.json({ 
      error: 'CRITICAL_API_FAILURE', 
      details: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { type, content } = await req.json();
    if (!type || !content) return NextResponse.json({ error: 'Type and content are required' }, { status: 400 });

    const source = await projectService.addSource(id, type, content);
    return NextResponse.json(source);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { system_prompt } = await req.json();
    if (system_prompt === undefined) return NextResponse.json({ error: 'System prompt is required' }, { status: 400 });

    await projectService.updateProjectPrompt(id, system_prompt);
    return NextResponse.json({ message: 'System prompt updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await projectService.resetKnowledge(id);
    return NextResponse.json({ message: 'Project knowledge wiped successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
