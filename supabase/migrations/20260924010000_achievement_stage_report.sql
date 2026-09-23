-- Arthur: NarIyirm
-- 中文：按共享冰箱时区生成最近 30 天的阶段报告；次数、批次与有价格的金额分别统计，避免混合口径。
-- EN: Build a 30-day shared-fridge report in its time zone, keeping event counts, completed batches, and priced value separate.
create function public.get_fridge_stage_report(p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  fridge_id uuid;
  fridge_time_zone text;
  local_today date;
  first_date date;
  period_start timestamptz;
  period_end timestamptz := now();
  overview jsonb;
  trend jsonb;
  reasons jsonb;
  categories jsonb;
  upcoming jsonb;
  upcoming_count integer;
begin
  fridge_id := public.bootstrap_device(p_device_id);
  select f.time_zone into fridge_time_zone from public.fridges f where f.fridge_uid = fridge_id;
  local_today := (period_end at time zone fridge_time_zone)::date;
  first_date := local_today - 29;
  period_start := first_date::timestamp at time zone fridge_time_zone;

  select jsonb_build_object(
    'completedBatchCount', count(distinct e.batch_uid) filter (where e.event_type = 'consume' and b.lifecycle_state = 'consumed'),
    'discardedBatchCount', count(distinct e.batch_uid) filter (where e.event_type = 'discard'),
    'discardedValue', coalesce(sum(abs(e.value_change)) filter (where e.event_type = 'discard' and e.purchase_price_snapshot is not null and e.currency_snapshot = 'AUD'), 0),
    'pricedDiscardCount', count(*) filter (where e.event_type = 'discard' and e.purchase_price_snapshot is not null and e.currency_snapshot = 'AUD'),
    'discardRecordCount', count(*) filter (where e.event_type = 'discard'),
    'priceCoverageRate', count(*) filter (where e.event_type = 'discard' and e.purchase_price_snapshot is not null and e.currency_snapshot = 'AUD')::numeric
      / nullif(count(*) filter (where e.event_type = 'discard'), 0)
  ) into overview
  from public.inventory_events e
  left join public.inventory_batches b on b.batch_uid = e.batch_uid and b.fridge_uid = e.fridge_uid
  where e.fridge_uid = fridge_id and e.event_type in ('consume', 'discard')
    and e.occurred_at >= period_start and e.occurred_at < period_end;

  -- Arthur: NarIyirm
  -- 中文：从起始日期每七天分桶，末桶只到今天；前端可直接显示真实起止日期，不误称为完整自然周。
  -- EN: Bucket from the first day in seven-day spans, ending the last bucket today so labels never imply a full calendar week.
  select coalesce(jsonb_agg(jsonb_build_object(
    'startDate', to_char(bucket_start, 'YYYY-MM-DD'),
    'endDate', to_char(least(bucket_start + 6, local_today), 'YYYY-MM-DD'),
    'usedRecords', (
      select count(*) from public.inventory_events e where e.fridge_uid = fridge_id and e.event_type = 'consume'
        and e.occurred_at >= (bucket_start::timestamp at time zone fridge_time_zone)
        and e.occurred_at < least(((bucket_start + 7)::timestamp at time zone fridge_time_zone), period_end)
    ),
    'discardedRecords', (
      select count(*) from public.inventory_events e where e.fridge_uid = fridge_id and e.event_type = 'discard'
        and e.occurred_at >= (bucket_start::timestamp at time zone fridge_time_zone)
        and e.occurred_at < least(((bucket_start + 7)::timestamp at time zone fridge_time_zone), period_end)
    )
  ) order by bucket_start), '[]'::jsonb) into trend
  from (select first_date + (series.bucket_index * 7) as bucket_start from generate_series(0, 4) as series(bucket_index)) buckets
  where bucket_start <= local_today;

  select coalesce(jsonb_agg(jsonb_build_object('code', ranked.reason_code, 'count', ranked.record_count)
    order by ranked.record_count desc, ranked.reason_code), '[]'::jsonb) into reasons
  from (
    select coalesce(nullif(e.reason_code, ''), 'unknown') as reason_code, count(*)::integer as record_count
    from public.inventory_events e
    where e.fridge_uid = fridge_id and e.event_type = 'discard'
      and e.occurred_at >= period_start and e.occurred_at < period_end
    group by 1 order by record_count desc, reason_code limit 5
  ) ranked;

  select coalesce(jsonb_agg(jsonb_build_object(
    'categoryUid', ranked.category_uid, 'systemCode', ranked.system_code,
    'name', ranked.category_name, 'count', ranked.record_count
  ) order by ranked.record_count desc, ranked.category_name), '[]'::jsonb) into categories
  from (
    select c.category_uid, c.system_code, coalesce(c.name, 'Other') as category_name,
      count(*)::integer as record_count
    from public.inventory_events e
    join public.inventory_batches b on b.batch_uid = e.batch_uid and b.fridge_uid = e.fridge_uid
    left join public.food_categories c on c.category_uid = b.category_uid and c.fridge_uid = e.fridge_uid
    where e.fridge_uid = fridge_id and e.event_type = 'discard'
      and e.occurred_at >= period_start and e.occurred_at < period_end
    group by c.category_uid, c.system_code, c.name
    order by record_count desc, category_name limit 5
  ) ranked;

  select count(*)::integer into upcoming_count from public.inventory_batches b
  where b.fridge_uid = fridge_id and b.lifecycle_state = 'active'
    and coalesce(b.use_by_at, b.best_before_at, b.estimated_quality_until, b.expires_at)
      >= period_end
    and coalesce(b.use_by_at, b.best_before_at, b.estimated_quality_until, b.expires_at)
      < period_end + interval '7 days';

  select coalesce(jsonb_agg(jsonb_build_object(
    'batchUid', items.batch_uid, 'name', items.name,
    'dateType', items.date_type, 'deadlineAt', items.deadline_at
  ) order by items.deadline_at, items.name), '[]'::jsonb) into upcoming
  from (
    select b.batch_uid, b.name,
      case when b.use_by_at is not null then 'use_by'
        when b.best_before_at is not null then 'best_before'
        when b.estimated_quality_until is not null then 'estimated_quality'
        else 'legacy_expiry' end as date_type,
      coalesce(b.use_by_at, b.best_before_at, b.estimated_quality_until, b.expires_at) as deadline_at
    from public.inventory_batches b
    where b.fridge_uid = fridge_id and b.lifecycle_state = 'active'
      and coalesce(b.use_by_at, b.best_before_at, b.estimated_quality_until, b.expires_at)
        >= period_end
      and coalesce(b.use_by_at, b.best_before_at, b.estimated_quality_until, b.expires_at)
        < period_end + interval '7 days'
    order by deadline_at, b.name limit 50
  ) items;

  return jsonb_build_object(
    'periodStart', period_start, 'periodEnd', period_end,
    'timeZone', fridge_time_zone, 'currency', 'AUD',
    'overview', overview, 'trend', trend,
    'reasons', reasons, 'categories', categories,
    'upcomingCount', upcoming_count, 'upcoming', upcoming
  );
end; $$;

revoke execute on function public.get_fridge_stage_report(text) from public, anon, authenticated;
grant execute on function public.get_fridge_stage_report(text) to service_role;
comment on function public.get_fridge_stage_report(text) is 'Returns one authenticated shared-fridge 30-day impact report and upcoming dated inventory.';
notify pgrst, 'reload schema';
