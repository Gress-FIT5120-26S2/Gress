begin;

-- Arthur: NarIyirm
-- 中文：固定窗口计数保存在数据库中，使无状态 Vercel 实例共享同一限流结果；只保存服务端哈希后的调用方标识。
-- EN: Fixed-window counters live in PostgreSQL so stateless Vercel instances share one decision; only server-hashed caller identifiers are stored.
create table public.api_rate_limit_buckets (
  scope text not null check (char_length(scope) between 1 and 80),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (scope, key_hash)
);

create index api_rate_limit_buckets_updated_at_idx
  on public.api_rate_limit_buckets (updated_at);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on table public.api_rate_limit_buckets from public, anon, authenticated;
grant all on table public.api_rate_limit_buckets to service_role;

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
  current_time timestamptz := clock_timestamp();
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

  -- Arthur: NarIyirm
  -- 中文：单条 UPSERT 在行锁内完成窗口重置或递增，避免多个 Function 实例并发时共同越过上限。
  -- EN: One UPSERT resets or increments under the row lock so concurrent Function instances cannot all pass the same limit.
  insert into public.api_rate_limit_buckets as bucket (
    scope,
    key_hash,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_scope, p_key_hash, current_time, 1, current_time)
  on conflict (scope, key_hash) do update
  set
    window_started_at = case
      when bucket.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= current_time
        then current_time
      else bucket.window_started_at
    end,
    request_count = case
      when bucket.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= current_time
        then 1
      else bucket.request_count + 1
    end,
    updated_at = current_time
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
            - current_time
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

-- Arthur: NarIyirm
-- 中文：补货函数只解析已写明 public schema 的业务表，并锁定空 search_path，消除调用会话对名称解析的影响。
-- EN: The restock function references explicitly qualified public tables and now pins an empty search_path so caller sessions cannot affect name resolution.
alter function public.get_restock_suggestions(uuid) set search_path = '';
revoke execute on function public.get_restock_suggestions(uuid) from public, anon, authenticated;
grant execute on function public.get_restock_suggestions(uuid) to service_role;

-- Arthur: NarIyirm
-- 中文：官方 RLS 自动启用示例由数据库事件触发器调用；仅在签名仍是安全的 event_trigger 时撤销客户端角色权限，不删除函数或其触发器依赖。
-- EN: The documented RLS auto-enable helper is invoked by a database event trigger; revoke client-role access only when its signature remains the expected SECURITY DEFINER event trigger, without deleting the function or dependency.
do $$
declare
  function_oid oid := pg_catalog.to_regprocedure('public.rls_auto_enable()');
  function_is_security_definer boolean;
  function_return_type regtype;
  enabled_event_trigger_count integer;
begin
  if function_oid is null then
    raise notice 'public.rls_auto_enable() is absent; no EXECUTE grant needs removal';
    return;
  end if;

  select procedure.prosecdef, procedure.prorettype::regtype
  into function_is_security_definer, function_return_type
  from pg_catalog.pg_proc as procedure
  where procedure.oid = function_oid;

  if not function_is_security_definer or function_return_type <> 'event_trigger'::regtype then
    raise exception 'Unexpected public.rls_auto_enable() definition; refusing automatic privilege changes';
  end if;

  select pg_catalog.count(*)::integer
  into enabled_event_trigger_count
  from pg_catalog.pg_event_trigger as event_trigger
  where event_trigger.evtfoid = function_oid
    and event_trigger.evtenabled <> 'D';

  raise notice 'public.rls_auto_enable() has % enabled event-trigger caller(s); preserving those dependencies',
    enabled_event_trigger_count;

  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
end;
$$;

-- Arthur: NarIyirm
-- 中文：后续由 postgres 在 public schema 创建的函数不再短暂继承 PUBLIC 执行权限；需要 Data API 调用的 RPC 必须显式授权。
-- EN: Future functions created by postgres in public no longer inherit temporary PUBLIC execution; Data API RPCs must be granted explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

commit;
