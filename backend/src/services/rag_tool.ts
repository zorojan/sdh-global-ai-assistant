import axios from 'axios';
import { supabase, supabaseAvailable } from '../database/supabase';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const resp = await axios.post(
    'https://api.openai.com/v1/embeddings',
    { model: OPENAI_EMBEDDING_MODEL, input: text },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
  );

  return resp.data?.data?.[0]?.embedding || [];
}

export type KnowledgeRow = {
  id?: string;
  title?: string;
  content?: string;
  language?: string;
  company_id?: string;
  similarity?: number;
  [k: string]: any;
};

/**
 * Search knowledge base for a query. Prefers Supabase RPC (match_knowledge_base).
 * Falls back to an empty array if Supabase is not configured.
 */
export async function searchFsmRag(query: string, k = 3, companyId?: string, language?: string): Promise<KnowledgeRow[]> {
  if (!query || query.trim() === '') return [];

  // Prefer Supabase vector search if available in this project
  if (supabaseAvailable && supabase) {
    try {
      const queryEmbedding = await generateEmbedding(query);

      const { data: searchResults, error } = await supabase.rpc('match_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.0,
        match_count: k
      });

      if (error) {
        console.error('RAG: Supabase RPC error:', error);
        return [];
      }

      let results: KnowledgeRow[] = searchResults || [];

      if (companyId) {
        results = results.filter(r => r.company_id === companyId);
      }
      if (language) {
        results = results.filter(r => r.language === language);
      }

      return results;
    } catch (err: any) {
      console.error('RAG: Error during Supabase search:', err?.message || err);
      return [];
    }
  }

  // If Supabase is not available, provide a clear message and empty result.
  // Optionally: add a Chroma/Local vector store implementation here.
  console.warn('RAG: Supabase not available - no vector search performed.');
  return [];
}

/**
 * Format an array of knowledge rows into a textual context for LLM prompts.
 */
export function formatContext(rows: KnowledgeRow[]): string {
  if (!rows || rows.length === 0) return '';

  return rows.map((r, idx) => {
    const src = (r.source || r.id || r.title || 'unknown').toString();
    const title = r.title ? `${r.title}\n` : '';
    const content = r.content || r.text || '';
    const sim = r.similarity ? ` (sim=${Number(r.similarity).toFixed(3)})` : '';
    return `${idx + 1}. Source: ${src}${sim}\n${title}${content}\n---\n`;
  }).join('\n');
}

export default { generateEmbedding, searchFsmRag, formatContext };
