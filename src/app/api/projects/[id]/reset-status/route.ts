import { NextRequest, NextResponse } from 'next/server';
import projectService from '@/lib/project-service';
import { jobManager } from '@/lib/jobs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // 1. Update DB to idle
    projectService.updateProjectStatus(id, 'idle');
    
    // 2. Clear job manager tracking for this project
    jobManager.resetProject(id);
    
    return NextResponse.json({ message: 'Project status reset to idle' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
