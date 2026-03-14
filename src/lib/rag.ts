import { getLocalEmbedding } from './ai';
import db from './db';

function cosineSimilarity(A: number[], B: number[]) {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    mA += A[i] * A[i];
    mB += B[i] * B[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

export async function getContext(query: string, projectId: string) {
  if (!projectId) return '';

  const queryEmbedding = await getLocalEmbedding(query);

  const rs = await db.execute({
    sql: 'SELECT text, vector FROM embeddings WHERE project_id = ?',
    args: [projectId]
  });
  const rows = rs.rows as unknown as { text: string; vector: string }[];

  const bookingKeywords = ['ραντεβου', 'κλεισω', 'πως', 'που', 'βρισκεται', 'τηλεφωνο', 'επικοινωνια', 'email', 'book', 'appointment', 'address', 'location', 'θελω', 'μπορω'];
  const isBookingQuery = bookingKeywords.some(k => query.toLowerCase().includes(k));

  const scored = rows
    .map(row => {
      let score = cosineSimilarity(queryEmbedding, JSON.parse(row.vector));
      
      // Boost "OFFICIAL DATA" or chunks containing contact keywords if it's a booking/location query
      if (isBookingQuery && (row.text.includes('[OFFICIAL DATA]') || /τηλ|email|διευθυνση|address|book/i.test(row.text))) {
        score += 0.25; // Significant boost
      }
      
      return { text: row.text, score };
    })
    .filter(match => match.score > 0.18)
    .sort((a, b) => b.score - a.score);

  // Deduplication
  const seenTexts = new Set<string>();
  const uniqueMatches = [];
  for (const match of scored) {
    if (!seenTexts.has(match.text) && uniqueMatches.length < 12) {
      seenTexts.add(match.text);
      uniqueMatches.push(match.text);
    }
  }

  return uniqueMatches.join('\n---\n');
}
