import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/ai';
import { getContext } from '@/lib/rag';
import projectService from '@/lib/project-service';

export async function POST(req: NextRequest) {
  try {
    const { messages, projectId } = await req.json();

    // 1. Identify the project theme to fetch relevant "brain" context
    const userMessages = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' ');
    // Default to a generic context search if no project ID is provided in lead analysis
    const agencyContext = await getContext(userMessages, projectId || ''); 

    const analysisPrompt = `
Analyze the following conversation between a Sales Consultant and a potential client.
Generate a professional business proposal structure.

REQUIRED INFO (Search deep in conversation):
- Phone number: (mandatory)
- Email: (mandatory)

LANGUAGE RULES:
1. ALWAYS return all project fields (project_title, client_goals, scope, timeline, budget_estimation, tasks) in EXCELLENT GREEK (Ελληνικά), even if the user or consultant spoke in Greeklish or English. This is for a professional PDF.
2. 'client_name' should use the user's name as provided (Greek or Latin).

PRICING RULE:
Follow the FINAL agreement (e.g., 400€ Starter Audit).

AGENCY CONTEXT:
${agencyContext}

CONVERSATION:
${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

OUTPUT FORMAT (JSON):
{
  "client_name": "Full Name",
  "project_title": "Τίτλος Έργου στα Ελληνικά",
  "client_goals": ["Στόχος 1 στα Ελληνικά", "Στόχος 2", "Στόχος 3"],
  "scope": "Περιγραφή στα Ελληνικά",
  "timeline": "Χρονοδιάγραμμα στα Ελληνικά",
  "budget_estimation": "Τιμή (π.χ. 400€)",
  "email": "customer@email.com",
  "phone": "69xxxxxxxx",
  "contact_info": "Email: ..., Phone: ...",
  "key_tasks": [
    {"category": "Κατηγορία", "task": "Εργασία στα Ελληνικά"}
  ],
  "internal_tasks": [
    {"role": "Developer", "task": "Task description in Greek"},
    {"role": "Marketing", "task": "Task description in Greek"}
  ],
  "suggested_team_roles": ["Role 1", "Role 2"],
  "confidence_score": 0.0-1.0
}

Return ONLY the JSON.
`;

    const response = await groq.chat.completions.create({
      model: 'qwen/qwen3-32b',
      messages: [{ role: 'system', content: analysisPrompt }],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // Save to Database
    if (result.client_name) {
      await projectService.saveLead(
        projectId || null,
        result.client_name,
        result.email || '',
        result.phone || '',
        result
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Lead analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
