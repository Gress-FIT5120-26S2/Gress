-- Arthur: NarIyirm
-- 中文：为勺勺建立只存审核知识的混合检索底座；用户库存和会话数据不进入全局 RAG 表。
-- EN: Establish Spoonie's reviewed-knowledge hybrid retrieval foundation; user inventory and conversations never enter the global RAG tables.

create extension if not exists vector with schema extensions;

create table public.assistant_knowledge_sources (
  source_uid uuid primary key default extensions.gen_random_uuid(),
  title text not null,
  publisher text not null,
  source_url text not null,
  jurisdiction text not null default 'AU',
  content_type text not null,
  published_at timestamptz,
  reviewed_at timestamptz,
  trust_level text not null default 'standard',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_knowledge_sources_title_not_blank check (char_length(btrim(title)) > 0),
  constraint assistant_knowledge_sources_publisher_not_blank check (char_length(btrim(publisher)) > 0),
  constraint assistant_knowledge_sources_url_https check (source_url ~ '^https://'),
  constraint assistant_knowledge_sources_jurisdiction_valid check (jurisdiction ~ '^[A-Z]{2}$'),
  constraint assistant_knowledge_sources_content_type_valid check (content_type in ('food_safety', 'food_storage', 'kitchmemo_help')),
  constraint assistant_knowledge_sources_trust_valid check (trust_level in ('standard', 'authoritative')),
  constraint assistant_knowledge_sources_review_state check (not is_enabled or reviewed_at is not null),
  constraint assistant_knowledge_sources_url_unique unique (source_url)
);

create table public.assistant_knowledge_documents (
  document_uid uuid primary key default extensions.gen_random_uuid(),
  source_uid uuid not null references public.assistant_knowledge_sources(source_uid) on update cascade on delete restrict,
  title text not null,
  language text not null,
  document_version text not null,
  content_hash text not null,
  raw_content text not null,
  embedding_model text not null default 'text-embedding-3-small',
  embedding_dimension integer not null default 1536,
  is_enabled boolean not null default false,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_knowledge_documents_title_not_blank check (char_length(btrim(title)) > 0),
  constraint assistant_knowledge_documents_language_valid check (language in ('zh', 'en')),
  constraint assistant_knowledge_documents_version_not_blank check (char_length(btrim(document_version)) > 0),
  constraint assistant_knowledge_documents_hash_valid check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint assistant_knowledge_documents_content_not_blank check (char_length(btrim(raw_content)) > 0),
  constraint assistant_knowledge_documents_embedding_contract check (
    embedding_model = 'text-embedding-3-small' and embedding_dimension = 1536
  ),
  constraint assistant_knowledge_documents_source_version_unique unique (source_uid, document_version),
  constraint assistant_knowledge_documents_hash_unique unique (content_hash)
);

create table public.assistant_knowledge_chunks (
  chunk_uid uuid primary key default extensions.gen_random_uuid(),
  document_uid uuid not null references public.assistant_knowledge_documents(document_uid) on update cascade on delete cascade,
  chunk_index integer not null,
  content text not null,
  topic text not null,
  food_names text[] not null default '{}',
  language text not null,
  risk_level text not null default 'general',
  embedding extensions.vector(1536),
  fts tsvector generated always as (to_tsvector('simple', content)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_knowledge_chunks_index_non_negative check (chunk_index >= 0),
  constraint assistant_knowledge_chunks_content_not_blank check (char_length(btrim(content)) > 0),
  constraint assistant_knowledge_chunks_topic_not_blank check (char_length(btrim(topic)) > 0),
  constraint assistant_knowledge_chunks_language_valid check (language in ('zh', 'en')),
  constraint assistant_knowledge_chunks_risk_valid check (risk_level in ('general', 'safety_sensitive')),
  constraint assistant_knowledge_chunks_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint assistant_knowledge_chunks_document_index_unique unique (document_uid, chunk_index)
);

create index assistant_knowledge_sources_filter_idx
  on public.assistant_knowledge_sources (jurisdiction, content_type, trust_level)
  where is_enabled;

create index assistant_knowledge_documents_filter_idx
  on public.assistant_knowledge_documents (language, source_uid)
  where is_enabled;

create index assistant_knowledge_chunks_fts_idx
  on public.assistant_knowledge_chunks using gin (fts);

create index assistant_knowledge_chunks_food_names_idx
  on public.assistant_knowledge_chunks using gin (food_names);

create index assistant_knowledge_chunks_embedding_hnsw_idx
  on public.assistant_knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create trigger assistant_knowledge_sources_set_updated_at
before update on public.assistant_knowledge_sources
for each row execute function public.set_updated_at();

create trigger assistant_knowledge_documents_set_updated_at
before update on public.assistant_knowledge_documents
for each row execute function public.set_updated_at();

create trigger assistant_knowledge_chunks_set_updated_at
before update on public.assistant_knowledge_chunks
for each row execute function public.set_updated_at();

-- Arthur: NarIyirm
-- 中文：关键词与语义候选分别排序后用 RRF 合并；安全查询只允许已启用、已审核的权威澳洲来源进入结果。
-- EN: Rank keyword and semantic candidates separately and merge them with RRF; safety queries admit only enabled, reviewed authoritative Australian sources.
create function public.search_assistant_knowledge(
  p_query_text text,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 6,
  p_language text default 'en',
  p_jurisdiction text default 'AU',
  p_safety_only boolean default false,
  p_full_text_weight double precision default 1,
  p_semantic_weight double precision default 1,
  p_rrf_k integer default 50
)
returns table (
  chunk_uid uuid,
  document_uid uuid,
  content text,
  topic text,
  food_names text[],
  language text,
  risk_level text,
  source_title text,
  publisher text,
  source_url text,
  trust_level text,
  rrf_score double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_match_count integer;
begin
  if p_query_text is null or char_length(btrim(p_query_text)) = 0 then
    raise exception 'assistant_search_query_required';
  end if;
  if p_query_embedding is null then
    raise exception 'assistant_search_embedding_required';
  end if;
  if p_language not in ('zh', 'en') then
    raise exception 'assistant_search_language_invalid';
  end if;
  if p_jurisdiction !~ '^[A-Z]{2}$' then
    raise exception 'assistant_search_jurisdiction_invalid';
  end if;
  if p_rrf_k < 1 or p_full_text_weight < 0 or p_semantic_weight < 0 then
    raise exception 'assistant_search_ranking_invalid';
  end if;

  safe_match_count := least(greatest(coalesce(p_match_count, 6), 1), 20);

  return query
  with eligible as (
    select
      chunk.chunk_uid,
      chunk.document_uid,
      chunk.content,
      chunk.topic,
      chunk.food_names,
      chunk.language,
      chunk.risk_level,
      chunk.embedding,
      chunk.fts,
      source.title as source_title,
      source.publisher,
      source.source_url,
      source.trust_level
    from public.assistant_knowledge_chunks as chunk
    join public.assistant_knowledge_documents as document
      on document.document_uid = chunk.document_uid
     and document.is_enabled
    join public.assistant_knowledge_sources as source
      on source.source_uid = document.source_uid
     and source.is_enabled
    where chunk.language = p_language
      and source.jurisdiction = p_jurisdiction
      and (
        not p_safety_only
        or (
          chunk.risk_level = 'safety_sensitive'
          and source.trust_level = 'authoritative'
          and source.reviewed_at is not null
        )
      )
  ),
  full_text as (
    select
      candidate.chunk_uid,
      row_number() over (
        order by ts_rank_cd(candidate.fts, websearch_to_tsquery('simple', p_query_text)) desc
      ) as rank_index
    from eligible as candidate
    where candidate.fts @@ websearch_to_tsquery('simple', p_query_text)
    order by rank_index
    limit safe_match_count * 2
  ),
  semantic as (
    select
      candidate.chunk_uid,
      row_number() over (order by candidate.embedding <=> p_query_embedding) as rank_index
    from eligible as candidate
    where candidate.embedding is not null
    order by rank_index
    limit safe_match_count * 2
  ),
  fused as (
    select
      coalesce(full_text.chunk_uid, semantic.chunk_uid) as chunk_uid,
      coalesce(1.0 / (p_rrf_k + full_text.rank_index), 0.0) * p_full_text_weight
        + coalesce(1.0 / (p_rrf_k + semantic.rank_index), 0.0) * p_semantic_weight as score
    from full_text
    full outer join semantic on semantic.chunk_uid = full_text.chunk_uid
  )
  select
    candidate.chunk_uid,
    candidate.document_uid,
    candidate.content,
    candidate.topic,
    candidate.food_names,
    candidate.language,
    candidate.risk_level,
    candidate.source_title,
    candidate.publisher,
    candidate.source_url,
    candidate.trust_level,
    fused.score
  from fused
  join eligible as candidate on candidate.chunk_uid = fused.chunk_uid
  order by fused.score desc, candidate.chunk_uid
  limit safe_match_count;
end;
$$;

alter table public.assistant_knowledge_sources enable row level security;
alter table public.assistant_knowledge_documents enable row level security;
alter table public.assistant_knowledge_chunks enable row level security;

revoke all on table public.assistant_knowledge_sources from public, anon, authenticated;
revoke all on table public.assistant_knowledge_documents from public, anon, authenticated;
revoke all on table public.assistant_knowledge_chunks from public, anon, authenticated;

grant select, insert, update, delete on table public.assistant_knowledge_sources to service_role;
grant select, insert, update, delete on table public.assistant_knowledge_documents to service_role;
grant select, insert, update, delete on table public.assistant_knowledge_chunks to service_role;

revoke execute on function public.search_assistant_knowledge(text, extensions.vector, integer, text, text, boolean, double precision, double precision, integer) from public, anon, authenticated;
grant execute on function public.search_assistant_knowledge(text, extensions.vector, integer, text, text, boolean, double precision, double precision, integer) to service_role;

comment on table public.assistant_knowledge_sources is
  'Reviewed global sources for Spoonie RAG; no user inventory, credentials, or conversation content belongs here.';
comment on table public.assistant_knowledge_chunks is
  'Bilingual hybrid-search chunks embedded with text-embedding-3-small at 1536 dimensions.';
comment on function public.search_assistant_knowledge(text, extensions.vector, integer, text, text, boolean, double precision, double precision, integer) is
  'Service-role-only RRF hybrid search with language, jurisdiction, trust, and safety filters.';
