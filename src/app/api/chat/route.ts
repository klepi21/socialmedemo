import { NextRequest } from 'next/server';
import { groq } from '@/lib/ai';
import { getContext } from '@/lib/rag';
import projectService from '@/lib/project-service';

export const dynamic = 'force-dynamic';

const FALLBACK_PROMPT = `
Είσαι ένας Sales Consultant.
ΚΑΝΟΝΕΣ ΣΥΜΠΕΡΙΦΟΡΑΣ:
1. ΜΟΝΟ 1 ΠΡΟΤΑΣΗ ανά απάντηση.
2. ΜΗΝ χαιρετάς και μην λες "Γεια σας", "Ευχαριστώ", "Ωραία".
3. Κάθε φορά που μαθαίνεις πληροφορία, βάλε το tag: [LEAD_UPDATE: {"key": "value"}] στο ΤΕΛΟΣ.
   KEYS: client_name, company, website, service_type, problem, budget, timeline, email, phone.
4. ΑΠΑΓΟΡΕΥΕΤΑΙ η χρήση του [LEAD_COMPLETE] αν δεν γνωρίζεις ήδη το EMAIL ΚΑΙ ΤΟ ΤΗΛΕΦΩΝΟ (phone) του χρήστη.
5. Το EMAIL και το PHONE είναι τα τελευταία στοιχεία. Μόλις τα έχεις, στείλε [LEAD_UPDATE: {"email": "...", "phone": "..."}] [LEAD_COMPLETE].

{context}
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
    if (projectId && !project) {
        console.warn(`[CHAT] Project ${projectId} requested but not found in DB.`);
    }

    // RAG context enhancement: user message + potential service intent
    let context = '';
    try {
      if (projectId) {
          console.log(`[CHAT] Fetching RAG context for ${projectId}...`);
          const intentQuery = `${lastMessage} digital marketing development agency services`;
          context = await getContext(intentQuery, projectId);
          if (context && context.length > 3000) {
              context = context.slice(0, 3000);
          }
          console.log(`[CHAT] RAG context fetched: ${context.length} chars`);
      }
    } catch (ragErr: any) {
      console.error(`[CHAT] RAG FAILED (continuing without context):`, ragErr.message);
      context = ''; 
    }
    
    // 2. Build identity header
    const identityHeader = `
PROJECT KNOWLEDGE BASE:
Business: ${project?.name || 'SocialMe AI'}
About: ${project?.description || 'General Services'}
`;

    // 3. Prepare System Prompt
    let basePrompt = project?.system_prompt || FALLBACK_PROMPT;
    
    // Ensure {context} exists in the prompt if we have data
    if (!basePrompt.includes('{context}')) {
      basePrompt += '\n\nΣχετικές πληροφορίες από τη βάση γνώσης:\n{context}';
    }

    let fullSystemPrompt = identityHeader + '\n' + basePrompt.replaceAll('{context}', context || 'Δεν βρέθηκαν συγκεκριμένες πληροφορίες για αυτό το ερώτημα.');

    console.log(`--- RAG CONTEXT FOR: "${lastMessage}" ---\n${context || 'EMPTY'}\n----------------`);

    // 4. Critical Data Reinforcement
    if (context && context.includes('CONTACT DATA:')) {
      fullSystemPrompt += '\n\n**ΠΡΟΣΟΧΗ**: Στα παραπάνω δεδομένα υπάρχει η ενότητα "CONTACT DATA". Χρησιμοποίησε την ΑΚΡΙΒΗ διεύθυνση, πόλη, τηλέφωνα, email και τυχόν booking link που αναγράφονται εκεί αν ο χρήστης ρωτήσει. ΑΠΑΓΟΡΕΥΕΤΑΙ να λες ότι "δεν υπάρχει διεύθυνση" ή "δεν ξέρεις τα στοιχεία" όταν εμφανίζονται στο CONTEXT.';
    }

    // 5. Hallucination Guard
    if (!context || context.length === 0) {
      fullSystemPrompt += '\n\n**ΚΑΝΟΝΑΣ**: Εάν ο χρήστης ρωτάει για τηλέφωνα, διεύθυνση ή τιμές και δεν τις βλέπεις παραπάνω, πες ευγενικά ότι δεν είναι διαθέσιμες αυτή τη στιγμή. ΜΗΝ τις βγάλεις από το μυαλό σου.';
    }

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
      ? `\n\nΣΗΜΑΝΤΙΚΟ - ΓΝΩΡΙΖΟΥΜΕ ΗΔΗ ΓΙΑ ΤΟΝ ΠΕΛΑΤΗ:\n${JSON.stringify(memory, null, 2)}\nΑΠΑΓΟΡΕΥΕΤΑΙ ΑΥΣΤΗΡΑ να ξαναρωτήσεις πληροφορίες που υπάρχουν παραπάνω. Προχώρα αμέσως στην επόμενη ερώτηση.`
      : '';

    fullSystemPrompt += memoryContext;

    const behavioralRules = `
\nΕΝΤΟΛΕΣ ΣΥΜΠΕΡΙΦΟΡΑΣ (ΚΡΙΣΙΜΟ):
1. ΜΗΝ ΧΑΙΡΕΤΑΣ. Μην λες "Γεια σας", "Ευχαριστώ", "Πολύ ωραία", "Πάμε παρακάτω". Μόνο την ερώτηση.
2. ΑΠΑΝΤΗΣΗ ΜΕ ΜΕΓΙΣΤΟ 1 ΠΡΟΤΑΣΗ. Να είσαι ο πιο σύντομος consultant στον κόσμο.
3. ΣΕ ΚΑΘΕ ΑΠΑΝΤΗΣΗ ΠΟΥ ΜΑΘΑΙΝΕΙΣ ΚΑΤΙ, ΒΑΛΕ ΤΟ ΤΑΓ [LEAD_UPDATE: {"key": "value"}]. 
4. ΜΟΛΙΣ ΕΧΕΙΣ client_name, email ΚΑΙ service_type, ΒΑΛΕ [LEAD_COMPLETE] ΚΑΙ ΣΤΑΜΑΤΑ.
`;

    fullSystemPrompt += behavioralRules;

    // 7. Call Groq with safety history trim (increased to 20 for better context)
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
    console.log(`[CHAT] Groq stream established.`);

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

    function stripControlTags(chunkText: string): string {
      let result = stripThinkingBlocks(chunkText);
      result = result.replace(/\[LEAD_UPDATE:[\s\S]*?\]/g, '');
      result = result.replace('[LEAD_COMPLETE]', '');
      return result;
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const visible = stripControlTags(content);
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
    const errorLog = `
--- CHAT API ERROR [${new Date().toISOString()}] ---
Message: ${error.message}
Stack: ${error.stack}
----------------------
`;
    console.error(errorLog);
    return new Response(JSON.stringify({ 
      error: 'Chat failed', 
      details: error.message
    }), {
      status: error.status || 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
