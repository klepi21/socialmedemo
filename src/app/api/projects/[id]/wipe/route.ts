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
    
    // 2. Wipe the knowledge data from DB
    await projectService.resetKnowledge(id);
    
    return NextResponse.json({ message: 'Project knowledge wiped and training stopped' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
