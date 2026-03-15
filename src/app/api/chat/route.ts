import { NextRequest } from 'next/server';
import { groq } from '@/lib/ai';
import { getContext } from '@/lib/rag';
import projectService from '@/lib/project-service';

export const dynamic = 'force-dynamic';

const FALLBACK_PROMPT = `
Είσαι ο Sales Consultant της εταιρείας SocialMe.
Στόχος σου: Να συλλέξεις στοιχεία για ΠΡΟΤΑΣΗ σε 3-4 μηνύματα.

ΚΑΝΟΝΕΣ:
1. ΜΟΝΟ 1 ΠΡΟΤΑΣΗ + 1 ΞΕΚΑΘΑΡΗ ΕΡΩΤΗΣΗ στο τέλος.
2. ΜΗΝ χαιρετάς μετά το πρώτο μήνυμα.
3. Μην προσπαθείς να δώσεις λεπτομέρειες για τις υπηρεσίες ακόμα, απλά ρώτα τι χρειάζεται ο πελάτης.
4. Μόλις έχεις Όνομα, Ανάγκη και ένα στοιχείο επικοινωνίας (Email/Phone), κλείσε αμέσως.
`;

export async function POST(req: NextRequest) {
  let projectId: string | undefined = undefined;
  let lastMessage = '';

  try {
    const body = await req.json();
    projectId = body.projectId;
    const messages = body.messages || [];
    lastMessage = body.lastMessage || '';

    // 1. Get Project Data
    const project = projectId ? await projectService.getProject(projectId) : null;
    
    // 2. Build identity header
    const identityHeader = `
BUSINESS IDENTITY:
Name: ${project?.name || 'SocialMe Digital Agency'}
Consultant Role: Senior Sales Professional
`;

    // 3. Prepare System Prompt - WE REMOVE RAG CONTEXT FROM CHAT TO AVOID CONFUSION
    let fullSystemPrompt = identityHeader + '\n' + FALLBACK_PROMPT;

    // 6. Build Memory from leadState or previous tags
    const incomingLeadState = body.leadState || {};
    const memory: Record<string, any> = { ...incomingLeadState };
    
    // Fallback: also check tags in messages if leadState is empty
    if (Object.keys(memory).length === 0) {
      messages.forEach((m: any) => {
        if (m.role === 'assistant') {
          const matches = m.content.matchAll(/\[LEAD_UPDATE:\s*(\{[\s\S]*?\})\]/g);
          for (const match of matches) {
            try {
              const data = JSON.parse(match[1]);
              Object.assign(memory, data);
            } catch (e) {}
          }
        }
      });
    }

    const memoryContext = Object.keys(memory).filter(k => memory[k]).length > 0 
      ? `\n\nΣΗΜΑΝΤΙΚΟ - ΓΝΩΡΙΖΟΥΜΕ ΗΔΗ ΓΙΑ ΤΟΝ ΠΕΛΑΤΗ:\n${JSON.stringify(memory, null, 2)}\nΠροχώρα αμέσως στην επόμενη ερώτηση.`
      : '';

    fullSystemPrompt += memoryContext;

    const behavioralRules = `
\nΕΝΤΟΛΕΣ ΣΥΜΠΕΡΙΦΟΡΑΣ (ΚΑΘΑΡΟ LEAD CAPTURE):
1. ΠΟΤΕ ΜΗΝ ΛΕΣ: "Βάσει της ιστοσελίδας μας" ή "Είμαι ο Ευπαθές Βοηθός".
2. ΟΝΟΜΑ: Είσαι ο Σύμβουλος Πωλήσεων του SocialMe.
3. ΚΑΘΕ ΑΠΑΝΤΗΣΗ ΠΡΕΠΕΙ ΝΑ ΤΕΛΕΙΩΝΕΙ ΜΕ ΕΡΩΤΗΣΗ.
4. ΔΙΑΔΙΚΑΣΙΑ 3 ΒΗΜΑΤΩΝ: 
   - Ρώτα τι ανάγκη έχει (π.χ. Marketing, Web).
   - Ρώτα το όνομα.
   - Ρώτα email ή τηλέφωνο.
5. ΜΟΛΙΣ ΕΧΕΙΣ αυτά τα 3, πες "Τέλεια, η πρόταση ετοιμάζεται!" και βάλε [LEAD_COMPLETE].
`;

    fullSystemPrompt += behavioralRules;

    // 7. Call Groq with safety history trim
    const sanitizedMessages = messages
      .slice(-20) 
      .map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'user' || m.role === 'system' ? m.role : 'user',
        content: (m.content || '').slice(0, 1000),
      }));

    console.log(`[CHAT] Calling Groq with ${sanitizedMessages.length} messages...`);
    const response = await groq.chat.completions.create({
      model: 'qwen/qwen3-32b',
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...sanitizedMessages
      ],
      stream: true,
      temperature: 0.1,
    });

    const encoder = new TextEncoder();
    let insideThink = false;

    function stripThinkingBlocks(chunkText: string): string {
      let result = '';
      let i = 0;
      while (i < chunkText.length) {
        if (!insideThink && chunkText.slice(i, i + 7) === '<think>') {
          insideThink = true;
          i += 7;
          continue;
        }
        if (insideThink && chunkText.slice(i, i + 8) === '</think>') {
          insideThink = false;
          i += 8;
          continue;
        }
        if (insideThink) { i += 1; continue; }
        result += chunkText[i];
        i += 1;
      }
      return result;
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const visible = stripThinkingBlocks(content);
              if (visible) {
                controller.enqueue(encoder.encode(visible));
              }
            }
          }
        } catch (e) {
          console.error('Stream error:', e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error: any) {
    console.error('[CHAT API ERROR]', error);
    return new Response(JSON.stringify({ 
      error: 'Chat failed', 
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
