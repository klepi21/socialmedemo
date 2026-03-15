import { NextRequest } from 'next/server';
import { groq } from '@/lib/ai';
import { getContext } from '@/lib/rag';
import projectService from '@/lib/project-service';

export const dynamic = 'force-dynamic';

const FALLBACK_PROMPT = `
Είσαι ο Sales Consultant της εταιρείας SocialMe.
Στόχος σου: Να βοηθήσεις τον πελάτη και να συλλέξεις στοιχεία για μια επαγγελματική ΠΡΟΤΑΣΗ.

ΚΑΝΟΝΕΣ:
1. ΜΟΝΟ ΜΙΑ ΕΡΩΤΗΣΗ ανά μήνυμα. ΠΟΤΕ μην ρωτάς δύο πράγματα μαζί.
2. Ξεκίνα με την ανάγκη του πελάτη και προχώρα σταδιακά.
3. Κάθε απάντηση πρέπει να περιλαμβάνει μια σύντομη επιβεβαίωση και μία ΞΕΚΑΘΑΡΗ ερώτηση στο τέλος.
4. Μην χαιρετάς μετά το πρώτο μήνυμα.
5. Στο τέλος πρέπει να έχεις: Όνομα, Υπηρεσία, Budget και ένα στοιχείο επικοινωνίας.
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

    // 3. Prepare System Prompt
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
      ? `\n\nΣΗΜΑΝΤΙΚΟ - ΓΝΩΡΙΖΟΥΜΕ ΗΔΗ ΓΙΑ ΤΟΝ ΠΕΛΑΤΗ:\n${JSON.stringify(memory, null, 2)}\nΜΗΝ ξαναρωτήσεις αυτά που ήδη ξέρεις.`
      : '';

    fullSystemPrompt += memoryContext;

    const behavioralRules = `
\nΕΝΤΟΛΕΣ ΣΥΜΠΕΡΙΦΟΡΑΣ:
1. ΑΠΑΓΟΡΕΥΕΤΑΙ η ομαδική αποστολή ερωτήσεων. Μόνο ΜΙΑ ερώτηση ανά φορά. 
2. ΣΕΙΡΑ ΕΡΩΤΗΣΕΩΝ:
   - Βήμα 1: Τι ακριβώς χρειάζεται (π.χ. eshop, καμπάνια).
   - Βήμα 2: Ποιο είναι το διαθέσιμο budget ή το μέγεθος του έργου.
   - Βήμα 3: Ποιο είναι το όνομά του.
   - Βήμα 4: Email ή τηλέφωνο για την αποστολή της πρότασης.
3. ΜΟΛΙΣ ΕΧΕΙΣ αυτά τα 4, πες "Τέλεια, η πρόταση ετοιμάζεται!" και πρόσθεσε το [LEAD_COMPLETE].
4. Χρησιμοποίησε τα [LEAD_UPDATE: {"key": "value"}] για να ενημερώνεις το σύστημα.
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
