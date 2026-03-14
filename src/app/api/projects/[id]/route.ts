import { NextRequest, NextResponse } from 'next/server';
import projectService from '@/lib/project-service';
import { jobManager } from '@/lib/jobs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await projectService.getProject(id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const sources = await projectService.getSources(id);
    const pages = await projectService.getPages(id);
    const stats = await projectService.getStats(id);
    
    // Check for active training jobs to resume UI state
    const activeJob = jobManager.getJobByProject(id);

    return NextResponse.json({ 
      project, 
      sources, 
      pages, 
      stats,
      activeJobId: activeJob?.id || null 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
