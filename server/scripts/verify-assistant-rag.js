import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const environmentName = process.env.NODE_ENV === 'production' ? 'production' : 'development';
dotenv.config({ path: `.env.${environmentName}`, quiet: true });

const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const embeddingDimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536);

function requireValue(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing ${name}`);
  }
  return value.trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function embed(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireValue(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: embeddingModel,
      dimensions: embeddingDimensions,
      encoding_format: 'float',
      input: text,
    }),
  });
  if (!response.ok) throw new Error(`Embedding request failed with HTTP ${response.status}`);
  const payload = await response.json();
  assert(payload.data?.[0]?.embedding?.length === embeddingDimensions, 'Embedding dimension mismatch');
  return payload.data[0].embedding;
}

async function countRows(supabase, table, configure = (query) => query) {
  const result = await configure(supabase.from(table).select('*', { count: 'exact', head: true }));
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function search(supabase, queryText, language, safetyOnly) {
  const queryEmbedding = await embed(queryText);
  const { data, error } = await supabase.rpc('search_assistant_knowledge', {
    p_query_text: queryText,
    p_query_embedding: queryEmbedding,
    p_match_count: 4,
    p_language: language,
    p_jurisdiction: 'AU',
    p_safety_only: safetyOnly,
  });
  if (error) throw error;
  return data ?? [];
}

async function main() {
  assert(embeddingModel === 'text-embedding-3-small', 'Unexpected embedding model');
  assert(embeddingDimensions === 1536, 'Unexpected embedding dimensions');
  const supabase = createClient(
    requireValue(process.env.SUPABASE_URL, 'SUPABASE_URL'),
    requireValue(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const publicClient = createClient(
    requireValue(process.env.SUPABASE_URL, 'SUPABASE_URL'),
    requireValue(process.env.SUPABASE_PUBLISHABLE_KEY, 'SUPABASE_PUBLISHABLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const [sourceCount, documentCount, chunkCount, enabledSourceCount, enabledDocumentCount] = await Promise.all([
    countRows(supabase, 'assistant_knowledge_sources'),
    countRows(supabase, 'assistant_knowledge_documents'),
    countRows(supabase, 'assistant_knowledge_chunks'),
    countRows(supabase, 'assistant_knowledge_sources', (query) => query.eq('is_enabled', true)),
    countRows(supabase, 'assistant_knowledge_documents', (query) => query.eq('is_enabled', true)),
  ]);
  assert(sourceCount === 4 && enabledSourceCount === 4, 'Expected four enabled knowledge sources');
  assert(documentCount === 8 && enabledDocumentCount === 8, 'Expected eight enabled bilingual documents');
  assert(chunkCount === 16, 'Expected sixteen knowledge chunks');

  const [englishSafety, chineseSafety, englishQuality] = await Promise.all([
    search(supabase, 'Can I eat food after its use-by date?', 'en', true),
    search(supabase, '超过 use-by 日期以后还可以吃吗？', 'zh', true),
    search(supabase, 'What does a best-before quality date mean?', 'en', false),
  ]);
  assert(englishSafety.length > 0, 'English safety retrieval returned no results');
  assert(chineseSafety.length > 0, 'Chinese safety retrieval returned no results');
  assert(englishQuality.length > 0, 'English quality retrieval returned no results');

  // Arthur: NarIyirm
  // 中文：安全模式必须同时满足语言、风险等级、权威来源和可引用 URL，防止普通建议混入高风险回答。
  // EN: Safety mode must satisfy language, risk, authority, and citable-URL gates so general guidance cannot leak into high-risk answers.
  for (const [language, results] of [['en', englishSafety], ['zh', chineseSafety]]) {
    for (const result of results) {
      assert(result.language === language, `Safety retrieval leaked a ${result.language} chunk into ${language}`);
      assert(result.risk_level === 'safety_sensitive', 'Safety retrieval returned a general chunk');
      assert(result.trust_level === 'authoritative', 'Safety retrieval returned a non-authoritative source');
      assert(result.source_url?.startsWith('https://'), 'Safety retrieval returned an invalid citation URL');
    }
  }
  assert(englishQuality.some((result) => result.topic === 'best_before'), 'Quality retrieval missed best-before guidance');

  const [publicTableResult, publicRpcResult] = await Promise.all([
    publicClient.from('assistant_knowledge_sources').select('source_uid').limit(1),
    publicClient.rpc('search_assistant_knowledge', {
      p_query_text: 'milk safety',
      p_query_embedding: Array(embeddingDimensions).fill(0),
    }),
  ]);
  assert(publicTableResult.error?.code === '42501', 'Public client unexpectedly read knowledge sources');
  assert(publicRpcResult.error?.code === '42501', 'Public client unexpectedly executed RAG search');

  console.log(JSON.stringify({
    counts: { sources: sourceCount, documents: documentCount, chunks: chunkCount },
    retrieval: {
      englishSafety: englishSafety.map((result) => result.topic),
      chineseSafety: chineseSafety.map((result) => result.topic),
      englishQuality: englishQuality.map((result) => result.topic),
    },
    publicAccessBlocked: true,
    valid: true,
  }));
}

await main();
