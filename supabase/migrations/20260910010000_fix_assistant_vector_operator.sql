-- Arthur: NarIyirm
-- 中文：保持安全函数的空 search_path，同时显式解析 pgvector 余弦运算符，避免 RAG 语义检索在运行时失败。
-- EN: Keep the security-definer function's empty search_path while explicitly resolving pgvector's cosine operator so RAG semantic search works at runtime.

create or replace function public.search_assistant_knowledge(
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
      row_number() over (
        order by candidate.embedding OPERATOR(extensions.<=>) p_query_embedding
      ) as rank_index
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

