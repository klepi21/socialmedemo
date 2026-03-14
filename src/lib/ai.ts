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
  if (process.env.NODE_ENV === 'production') {
     // Optional: Fallback or shorter logic for cloud if needed
  }

  if (!embeddingPipeline) {
    const { pipeline } = await import('@xenova/transformers');
    // Set cache directory to /tmp for Vercel
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  // Timeout for production to prevent Vercel 10s kill
  const embeddingPromise = embeddingPipeline(text, { pooling: 'mean', normalize: true });
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 4000));

  const output = await Promise.race([embeddingPromise, timeoutPromise]) as any;
  return Array.from(output.data) as number[];
}
