import { NextRequest, NextResponse } from 'next/server';
import projectService from '@/lib/project-service';
import { jobManager } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: any) {
  const metaId = `API_${Date.now()}`;
  try {
    // Next.js 15+ Compatibility Check
    const context = props || {};
    const awaitedParams = context.params instanceof Promise ? await context.params : context.params;
    const id = awaitedParams?.id;

    console.log(`[${metaId}] GET Project Request. ID: ${id || 'undefined'}`);

    if (!id) {
      return NextResponse.json({ error: 'Missing ID parameter' }, { status: 400 });
    }

    // Step 1: Project Basic Info
    console.log(`[${metaId}] Fetching project...`);
    const project = await projectService.getProject(id);
    
    if (!project) {
      console.log(`[${metaId}] Project NOT FOUND in database for ID: ${id}`);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Step 2-4: Data parts with individual safety
    console.log(`[${metaId}] Fetching sources, pages, stats...`);
    const [sources, pages, stats] = await Promise.all([
      projectService.getSources(id).catch(e => { console.error("sources fail", e); return []; }),
      projectService.getPages(id).catch(e => { console.error("pages fail", e); return []; }),
      projectService.getStats(id).catch(e => { console.error("stats fail", e); return { vectors: 0, sources: 0 }; })
    ]);

    // Step 5: Jobs
    let activeJobId = null;
    try {
      const activeJob = jobManager.getJobByProject(id);
      activeJobId = activeJob?.id || null;
    } catch(e) {}

    console.log(`[${metaId}] Success. Found project: ${project.name}`);
    return NextResponse.json({ 
      project, 
      sources, 
      pages, 
      stats,
      activeJobId
    });

  } catch (error: any) {
    console.error(`[${metaId}] FATAL API ERROR:`, error);
    return NextResponse.json({ 
      error: 'CRITICAL_ERROR', 
      details: error.message,
      code: error.code || 'UNKNOWN'
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
