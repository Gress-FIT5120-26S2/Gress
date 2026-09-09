-- Arthur: NarIyirm
-- 中文：为助手提供个人与共享冰箱的匿名聚合历史；事件操作者只用于筛选，真实设备 ID 永远不出现在结果中。
-- EN: Provide anonymised personal and shared-fridge history aggregates; actor IDs are filter-only and never appear in results.

create function public.get_assistant_consumption_history(
  p_device_id text,
  p_scope text,
  p_from timestamptz,
  p_to timestamptz,
  p_item_name text default null
)
returns table (
  scope text,
  item_name text,
  normalized_item_name text,
  unit text,
  stocked_quantity numeric,
  consumed_quantity numeric,
  discarded_quantity numeric,
  adjustment_quantity numeric,
  stock_event_count bigint,
  consume_event_count bigint,
  discard_event_count bigint,
  first_event_at timestamptz,
  last_event_at timestamptz,
  median_restock_interval_days numeric,
  evidence_sufficient boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  normalized_filter text;
begin
  if p_device_id is null or char_length(btrim(p_device_id)) < 3 then
    raise exception 'invalid_device';
  end if;
  if p_scope not in ('personal', 'shared') then
    raise exception 'invalid_history_scope';
  end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'invalid_history_window';
  end if;
  if p_to - p_from > interval '366 days' then
    raise exception 'history_window_too_large';
  end if;

  select member.fridge_uid
  into current_fridge_uid
  from public.fridge_members as member
  join public.fridges as fridge
    on fridge.fridge_uid = member.fridge_uid
   and fridge.status = 'active'
  where member.device_id = btrim(p_device_id);

  if current_fridge_uid is null then
    raise exception 'no_fridge';
  end if;

  normalized_filter := nullif(lower(btrim(p_item_name)), '');

  return query
  with scoped_events as (
    select
      event.event_uid,
      event.event_type,
      event.quantity_change,
      event.occurred_at,
      batch.name,
      batch.normalized_name,
      batch.unit
    from public.inventory_events as event
    join public.inventory_batches as batch
      on batch.batch_uid = event.batch_uid
     and batch.fridge_uid = event.fridge_uid
    where event.fridge_uid = current_fridge_uid
      and event.occurred_at >= p_from
      and event.occurred_at < p_to
      and (p_scope = 'shared' or event.actor_device_id = btrim(p_device_id))
      and (normalized_filter is null or batch.normalized_name = normalized_filter)
  ),
  stock_timeline as (
    select
      event.normalized_name,
      event.unit,
      event.occurred_at,
      lag(event.occurred_at) over (
        partition by event.normalized_name, event.unit
        order by event.occurred_at
      ) as previous_stocked_at
    from scoped_events as event
    where event.event_type = 'stock'
  ),
  restock_intervals as (
    select
      timeline.normalized_name,
      timeline.unit,
      percentile_cont(0.5) within group (
        order by extract(epoch from (timeline.occurred_at - timeline.previous_stocked_at)) / 86400.0
      )::numeric as median_days
    from stock_timeline as timeline
    where timeline.previous_stocked_at is not null
    group by timeline.normalized_name, timeline.unit
  ),
  totals as (
    select
      event.normalized_name,
      event.unit,
      max(event.name) as display_name,
      coalesce(sum(event.quantity_change) filter (where event.event_type = 'stock'), 0) as stocked,
      coalesce(-sum(event.quantity_change) filter (where event.event_type = 'consume'), 0) as consumed,
      coalesce(-sum(event.quantity_change) filter (where event.event_type = 'discard'), 0) as discarded,
      coalesce(sum(event.quantity_change) filter (where event.event_type = 'adjust'), 0) as adjusted,
      count(*) filter (where event.event_type = 'stock') as stock_count,
      count(*) filter (where event.event_type = 'consume') as consume_count,
      count(*) filter (where event.event_type = 'discard') as discard_count,
      min(event.occurred_at) as first_at,
      max(event.occurred_at) as last_at
    from scoped_events as event
    group by event.normalized_name, event.unit
  )
  select
    p_scope,
    totals.display_name,
    totals.normalized_name,
    totals.unit,
    totals.stocked,
    totals.consumed,
    totals.discarded,
    totals.adjusted,
    totals.stock_count,
    totals.consume_count,
    totals.discard_count,
    totals.first_at,
    totals.last_at,
    intervals.median_days,
    (
      totals.stock_count >= 3
      and totals.first_at <= p_to - interval '14 days'
    ) as evidence_sufficient
  from totals
  left join restock_intervals as intervals
    on intervals.normalized_name = totals.normalized_name
   and intervals.unit = totals.unit
  order by totals.normalized_name, totals.unit;
end;
$$;

revoke execute on function public.get_assistant_consumption_history(text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.get_assistant_consumption_history(text, text, timestamptz, timestamptz, text) to service_role;

comment on function public.get_assistant_consumption_history(text, text, timestamptz, timestamptz, text) is
  'Returns current-fridge history aggregates for assistant tools without exposing device IDs; personal scope filters by the authenticated device actor.';
