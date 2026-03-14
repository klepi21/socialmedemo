import OpenAI from 'openai';
import Firecrawl from '@mendable/firecrawl-js';
import { pipeline } from '@xenova/transformers';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Local Embedding Singleton
let embeddingPipeline: any = null;

export async function getLocalEmbedding(text: string) {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  
  const output = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data) as number[];
}
