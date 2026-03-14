import { NextRequest, NextResponse } from 'next/server';
import projectService from '@/lib/project-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: any) {
  const metaId = `API_${Date.now()}`;
  try {
    // Next.js 15/16 Compatibility: Ensure params are correctly awaited if needed
    let p = params;
    if (p instanceof Promise) p = await p;
    const id = p?.id;

    if (!id) return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 });

    console.log(`[${metaId}] Loading project: ${id}`);
    
    // Core data only - avoid complex stats if failing
    const project = await projectService.getProject(id);
    if (!project) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    // Optional data blocks with safe catch
    const sources = await projectService.getSources(id).catch(() => []);
    const pages = await projectService.getPages(id).catch(() => []);
    const stats = await projectService.getStats(id).catch(() => ({ vectors: 0, sources: 0 }));

    return NextResponse.json({ 
       project, 
       sources, 
       pages, 
       stats,
       activeJobId: null // Temporarily disabled job status to isolate crash
    });

  } catch (error: any) {
    console.error(`[${metaId}] API CRASH:`, error);
    return new Response(JSON.stringify({ 
      error: 'SERVER_CRASH', 
      details: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
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
