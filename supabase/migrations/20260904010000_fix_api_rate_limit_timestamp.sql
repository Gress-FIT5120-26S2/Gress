begin;

-- Arthur: NarIyirm
-- 中文：上一版变量名与 PostgreSQL CURRENT_TIME 保留表达式冲突；改用明确的 timestamptz 变量后保留同一原子桶契约。
-- EN: The previous variable name collided with PostgreSQL's CURRENT_TIME expression; an explicit timestamptz variable preserves the same atomic-bucket contract.
create or replace function public.claim_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer,
  limit_value integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  observed_at timestamptz := clock_timestamp();
  current_count integer;
  current_window_started_at timestamptz;
begin
  if p_scope is null or char_length(p_scope) not between 1 and 80 then
    raise exception 'invalid_rate_limit_scope';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_rate_limit_key';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid_rate_limit_limit';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid_rate_limit_window';
  end if;

  insert into public.api_rate_limit_buckets as bucket (
    scope,
    key_hash,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_scope, p_key_hash, observed_at, 1, observed_at)
  on conflict (scope, key_hash) do update
  set
    window_started_at = case
      when bucket.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= observed_at
        then observed_at
      else bucket.window_started_at
    end,
    request_count = case
      when bucket.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= observed_at
        then 1
      else bucket.request_count + 1
    end,
    updated_at = observed_at
  returning request_count, window_started_at
  into current_count, current_window_started_at;

  return query
  select
    current_count <= p_limit,
    greatest(p_limit - current_count, 0),
    case
      when current_count <= p_limit then 0
      else greatest(
        ceil(
          extract(epoch from (
            current_window_started_at
            + pg_catalog.make_interval(secs => p_window_seconds)
            - observed_at
          ))
        )::integer,
        1
      )
    end,
    p_limit;
end;
$$;

revoke execute on function public.claim_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_api_rate_limit(text, text, integer, integer)
  to service_role;

commit;
