import { NextRequest, NextResponse } from 'next/server';
import projectService from '@/lib/project-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const leads = projectService.listLeads();
    return NextResponse.json(leads);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
