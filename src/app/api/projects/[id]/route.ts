import { NextRequest, NextResponse } from 'next/server';
import projectService from '@/lib/project-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: any) {
  const metaId = `API_${Date.now()}`;
  try {
    const params = await context.params;
    const id = params?.id;

    if (!id) {
      console.error(`[${metaId}] No ID in params!`, params);
      return NextResponse.json({ error: 'ID_MISSING' }, { status: 400 });
    }

    console.log(`[${metaId}] Loading project: ${id}`);
    
    // Core data only
    const project = await projectService.getProject(id);
    if (!project) {
      console.warn(`[${metaId}] Project ${id} not found in DB`);
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

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

export async function POST(req: NextRequest, context: any) {
  try {
    const params = await context.params;
    const id = params?.id;
    const { type, content } = await req.json();
    if (!type || !content) return NextResponse.json({ error: 'Type and content are required' }, { status: 400 });

    const source = await projectService.addSource(id, type, content);
    return NextResponse.json(source);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const params = await context.params;
    const id = params?.id;
    const { system_prompt } = await req.json();
    if (system_prompt === undefined) return NextResponse.json({ error: 'System prompt is required' }, { status: 400 });

    await projectService.updateProjectPrompt(id, system_prompt);
    return NextResponse.json({ message: 'System prompt updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function DELETE(req: NextRequest, context: any) {
  try {
    const params = await context.params;
    const id = params?.id;
    await projectService.resetKnowledge(id);
    return NextResponse.json({ message: 'Project knowledge wiped successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
