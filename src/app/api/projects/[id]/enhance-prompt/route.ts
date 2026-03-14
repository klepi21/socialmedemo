import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/ai';
import projectService from '@/lib/project-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { currentPrompt } = await req.json();

    const enhancementPrompt = `
      You are an expert AI Prompt Engineer.
      Your task is to take the following "System Prompt" for an AI Agent and ENHANCE it to be more professional, structured, and effective.
      
      CRITICAL RULES:
      1. PRESERVE ALL NAMES AND TITLES exactly as written. Do not change "Ηλέκτρα Αυγουστή" to anything else.
      2. ROLE CONSISTENCY: Keep the exact role described (Secretary, Support, etc). Do NOT assume "Sales Consultant".
      3. PROFESSIONAL GREEK: Use professional Greek (Ελληνικά).
      4. FORBIDDEN: NEVER write the word {context} or \`{context}\` or reference it. The knowledge base is injected automatically by the system.
      5. Keep the prompt SHORT (max 400 words). Organize into: Ρόλος, Στόχοι, Κανόνες, Τόνος.
      
      CURRENT PROMPT:
      ${currentPrompt}
      
      Return ONLY the enhanced prompt text in Greek. Nothing else.
    `;

    const response = await groq.chat.completions.create({
      model: 'qwen/qwen3-32b',
      messages: [{ role: 'system', content: enhancementPrompt }],
      temperature: 0.7,
    });

    // Post-process: strip any {context} references the AI might have added
    let enhancedPrompt = response.choices[0].message.content?.trim() || '';
    enhancedPrompt = enhancedPrompt.replaceAll('{context}', '').replaceAll('`{context}`', '');

    return NextResponse.json({ enhancedPrompt });
  } catch (error: any) {
    console.error('Prompt enhancement error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
