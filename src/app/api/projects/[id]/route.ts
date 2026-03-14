import { NextRequest, NextResponse } from 'next/server';
import projectService from '@/lib/project-service';
import { jobManager } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const metaId = `API_GET_${Date.now()}`;
  try {
    const { id } = await params;
    console.log(`[${metaId}] Fetching project details for ID: ${id}`);
    const project = await projectService.getProject(id);
    if (!project) {
      console.log(`[${metaId}] Project not found for ID: ${id}`);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log(`[${metaId}] Found project, fetching related data...`);
    const [sources, pages, stats] = await Promise.all([
      projectService.getSources(id),
      projectService.getPages(id),
      projectService.getStats(id)
    ]);
    
    console.log(`[${metaId}] Success. Sources: ${sources.length}, Pages: ${pages.length}`);
    const activeJob = jobManager.getJobByProject(id);

    return NextResponse.json({ 
      project, 
      sources, 
      pages, 
      stats,
      activeJobId: activeJob?.id || null 
    });
  } catch (error: any) {
    console.error(`[${metaId}] CRASH:`, error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
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
