import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const environmentName = process.env.NODE_ENV === 'production' ? 'production' : 'development';
dotenv.config({ path: `.env.${environmentName}`, quiet: true });

const manifestPath = resolve(
  process.cwd(),
  process.argv.find((argument) => argument.endsWith('.json'))
    ?? 'data/assistant-knowledge/au-core-v1.json',
);
const dryRun = process.argv.includes('--dry-run');
const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const embeddingDimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536);

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid or missing ${fieldName}`);
  }
  return value.trim();
}

function validateManifest(manifest) {
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    throw new Error('The knowledge manifest must contain at least one source');
  }
  if (embeddingModel !== 'text-embedding-3-small' || embeddingDimensions !== 1536) {
    throw new Error('The deployed vector schema requires text-embedding-3-small at 1536 dimensions');
  }

  const sourceUrls = new Set();
  for (const source of manifest.sources) {
    const sourceUrl = requireText(source.sourceUrl, 'source.sourceUrl');
    if (!sourceUrl.startsWith('https://') || sourceUrls.has(sourceUrl)) {
      throw new Error(`Source URL must be unique HTTPS: ${sourceUrl}`);
    }
    sourceUrls.add(sourceUrl);
    requireText(source.title, 'source.title');
    requireText(source.publisher, 'source.publisher');
    if (source.trustLevel !== 'authoritative' || source.jurisdiction !== 'AU') {
      throw new Error(`Core safety source must be authoritative and Australian: ${sourceUrl}`);
    }
    if (!source.reviewedAt || Number.isNaN(Date.parse(source.reviewedAt))) {
      throw new Error(`Enabled source requires a valid reviewedAt: ${sourceUrl}`);
    }
    if (!Array.isArray(source.documents) || source.documents.length !== 2) {
      throw new Error(`Each core source requires aligned zh/en documents: ${sourceUrl}`);
    }

    const languages = new Set(source.documents.map((document) => document.language));
    if (!languages.has('zh') || !languages.has('en')) {
      throw new Error(`Source is missing a zh/en document pair: ${sourceUrl}`);
    }
    for (const document of source.documents) {
      requireText(document.title, 'document.title');
      requireText(document.version, 'document.version');
      if (!Array.isArray(document.chunks) || document.chunks.length === 0) {
        throw new Error(`Document has no chunks: ${document.title}`);
      }
      for (const chunk of document.chunks) {
        requireText(chunk.content, 'chunk.content');
        requireText(chunk.topic, 'chunk.topic');
        if (!['general', 'safety_sensitive'].includes(chunk.riskLevel)) {
          throw new Error(`Invalid chunk risk level in ${document.title}`);
        }
      }
    }
  }
}

async function createEmbeddings(contents) {
  const apiKey = requireText(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY');
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: embeddingModel,
      dimensions: embeddingDimensions,
      encoding_format: 'float',
      input: contents,
    }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI embeddings failed (${response.status}): ${message.slice(0, 500)}`);
  }
  const payload = await response.json();
  const embeddings = payload.data?.sort((left, right) => left.index - right.index);
  if (!Array.isArray(embeddings) || embeddings.length !== contents.length) {
    throw new Error('OpenAI returned an unexpected embedding count');
  }
  for (const item of embeddings) {
    if (!Array.isArray(item.embedding) || item.embedding.length !== embeddingDimensions) {
      throw new Error('OpenAI returned an embedding with an unexpected dimension');
    }
  }
  return embeddings.map((item) => item.embedding);
}

async function requireResult(operation, label) {
  const result = await operation;
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

async function ingestDocument(supabase, sourceUid, document, embeddings) {
  const rawContent = document.chunks.map((chunk) => chunk.content.trim()).join('\n\n');
  const contentHash = createHash('sha256').update(rawContent, 'utf8').digest('hex');

  // Arthur: NarIyirm
  // 中文：先禁用文档再替换分块，避免网络或写入失败时检索到半更新内容。
  // EN: Disable the document before replacing chunks so a network or write failure cannot expose a partially updated document.
  const row = await requireResult(
    supabase
      .from('assistant_knowledge_documents')
      .upsert({
        source_uid: sourceUid,
        title: document.title.trim(),
        language: document.language,
        document_version: document.version.trim(),
        content_hash: contentHash,
        raw_content: rawContent,
        embedding_model: embeddingModel,
        embedding_dimension: embeddingDimensions,
        is_enabled: false,
        ingested_at: new Date().toISOString(),
      }, { onConflict: 'source_uid,document_version' })
      .select('document_uid')
      .single(),
    `Upsert document ${document.title}`,
  );

  await requireResult(
    supabase.from('assistant_knowledge_chunks').delete().eq('document_uid', row.document_uid),
    `Clear chunks for ${document.title}`,
  );
  await requireResult(
    supabase.from('assistant_knowledge_chunks').insert(
      document.chunks.map((chunk, index) => ({
        document_uid: row.document_uid,
        chunk_index: index,
        content: chunk.content.trim(),
        topic: chunk.topic.trim(),
        food_names: chunk.foodNames ?? [],
        language: document.language,
        risk_level: chunk.riskLevel,
        embedding: embeddings[index],
        metadata: { sourceSection: chunk.sourceSection ?? null },
      })),
    ),
    `Insert chunks for ${document.title}`,
  );
  await requireResult(
    supabase.from('assistant_knowledge_documents').update({ is_enabled: true }).eq('document_uid', row.document_uid),
    `Enable document ${document.title}`,
  );
  return document.chunks.length;
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  validateManifest(manifest);
  const documentCount = manifest.sources.reduce((count, source) => count + source.documents.length, 0);
  const chunkCount = manifest.sources.reduce(
    (count, source) => count + source.documents.reduce((inner, document) => inner + document.chunks.length, 0),
    0,
  );

  if (dryRun) {
    console.log(JSON.stringify({ valid: true, sources: manifest.sources.length, documents: documentCount, chunks: chunkCount }));
    return;
  }

  const supabaseUrl = requireText(process.env.SUPABASE_URL, 'SUPABASE_URL');
  const supabaseSecret = requireText(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    'SUPABASE_SECRET_KEY',
  );
  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const allChunks = manifest.sources.flatMap((source) => (
    source.documents.flatMap((document) => document.chunks)
  ));

  // Arthur: NarIyirm
  // 中文：先用一次批量请求生成全部向量，只有 OpenAI 完整成功后才开始数据库写入，避免额度或网络错误留下半成品。
  // EN: Generate every vector in one batch before database writes begin, preventing quota or network failures from leaving partial ingestion state.
  const allEmbeddings = await createEmbeddings(allChunks.map((chunk) => chunk.content.trim()));
  let embeddingOffset = 0;
  let insertedChunks = 0;

  for (const source of manifest.sources) {
    const sourceRow = await requireResult(
      supabase
        .from('assistant_knowledge_sources')
        .upsert({
          title: source.title.trim(),
          publisher: source.publisher.trim(),
          source_url: source.sourceUrl.trim(),
          jurisdiction: source.jurisdiction,
          content_type: source.contentType,
          published_at: source.publishedAt ?? null,
          reviewed_at: source.reviewedAt,
          trust_level: source.trustLevel,
        }, { onConflict: 'source_url' })
        .select('source_uid')
        .single(),
      `Upsert source ${source.title}`,
    );

    for (const document of source.documents) {
      const documentEmbeddings = allEmbeddings.slice(
        embeddingOffset,
        embeddingOffset + document.chunks.length,
      );
      embeddingOffset += document.chunks.length;
      insertedChunks += await ingestDocument(
        supabase,
        sourceRow.source_uid,
        document,
        documentEmbeddings,
      );
    }
    await requireResult(
      supabase.from('assistant_knowledge_sources').update({ is_enabled: true }).eq('source_uid', sourceRow.source_uid),
      `Enable source ${source.title}`,
    );
  }

  console.log(JSON.stringify({ sources: manifest.sources.length, documents: documentCount, chunks: insertedChunks }));
}

await main();
