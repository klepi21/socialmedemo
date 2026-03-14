import OpenAI from 'openai';
import Firecrawl from '@mendable/firecrawl-js';


export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Local Embedding Singleton with dynamic loading
let embeddingPipeline: any = null;

export async function getLocalEmbedding(text: string) {
  try {
    if (!embeddingPipeline) {
      const { pipeline } = await import('@xenova/transformers');
      embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    // Timeout for local embedding to prevent Vercel 10s kill
    const embeddingPromise = embeddingPipeline(text, { pooling: 'mean', normalize: true });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 4000));

    const output = await Promise.race([embeddingPromise, timeoutPromise]) as any;
    console.log(`[AI] Local embedding success (${text.length} chars)`);
    return Array.from(output.data) as number[];
  } catch (err: any) {
    if (process.env.OPENAI_API_KEY) {
      console.warn(`[AI] Local embedding failed (${err.message}). Falling back to OpenAI...`);
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    }
    console.error(`[AI] All embedding methods failed.`);
    throw err;
  }
}
