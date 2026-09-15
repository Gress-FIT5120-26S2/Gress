-- Arthur: NarIyirm
-- 中文：扩展成就 dashboard 返回徽章四态与带分母的进度字段；权威判断仍在数据库，Express 只透传。
-- EN: Extend the achievement dashboard with badge status and progress denominators; authority stays in the database while Express only forwards the payload.

create or replace function public.get_achievement_dashboard(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  fridge_time_zone text;
  member_count_value integer;
  stock_count_value integer;
  rescued_batch_count_value integer;
  completed_rescued_batch_count_value integer;
  discard_reason_count_value integer;
  active_week_count_value integer;
  total_xp_value integer;
  current_level public.achievement_levels;
  previous_level_number smallint;
  next_level public.achievement_levels;
  level_progress numeric;
  metrics_json jsonb;
  achievements_json jsonb;
  recent_xp_json jsonb;
begin
  current_fridge_uid := public.bootstrap_device(p_device_id);
  select fridge.time_zone into fridge_time_zone
  from public.fridges as fridge where fridge.fridge_uid = current_fridge_uid;

  select count(*)::integer into member_count_value
  from public.fridge_members as member where member.fridge_uid = current_fridge_uid;

  select count(*)::integer into stock_count_value
  from public.inventory_events as event
  where event.fridge_uid = current_fridge_uid and event.event_type = 'stock';

  select count(distinct event.batch_uid)::integer into rescued_batch_count_value
  from public.inventory_events as event
  where event.fridge_uid = current_fridge_uid
    and event.event_type = 'consume'
    and event.was_in_warning_window
    and event.deadline_snapshot is not null
    and event.occurred_at <= event.deadline_snapshot
    and event.date_type_snapshot in ('use_by', 'best_before', 'estimated_quality');

  select count(distinct event.batch_uid)::integer into completed_rescued_batch_count_value
  from public.inventory_events as event
  join public.inventory_batches as batch
    on batch.batch_uid = event.batch_uid and batch.fridge_uid = event.fridge_uid
  where event.fridge_uid = current_fridge_uid
    and event.event_type = 'consume'
    and event.was_in_warning_window
    and event.deadline_snapshot is not null
    and event.occurred_at <= event.deadline_snapshot
    and event.date_type_snapshot in ('use_by', 'best_before', 'estimated_quality')
    and batch.lifecycle_state = 'consumed';

  select count(*)::integer into discard_reason_count_value
  from public.inventory_events as event
  where event.fridge_uid = current_fridge_uid
    and event.event_type = 'discard'
    and event.reason_code is not null;

  select count(distinct date_trunc('week', event.occurred_at at time zone fridge_time_zone))::integer
  into active_week_count_value
  from public.inventory_events as event
  where event.fridge_uid = current_fridge_uid and event.event_type in ('consume', 'discard');

  insert into public.fridge_xp_events (fridge_uid, source_key, reason_code, points, metadata)
  select current_fridge_uid, 'first_inventory', 'first_inventory', 10, '{"ruleVersion":1}'::jsonb
  where stock_count_value > 0
  on conflict do nothing;

  -- Arthur: NarIyirm
  -- 中文：浪费改善使用“丢弃结算批次 / 全部结算批次”的跨单位口径；当前周和此前连续四个完整周均至少结算五批才奖励。
  -- EN: Waste improvement uses discarded settled batches over all settled batches; the current week and each of the four preceding complete weeks need at least five settlements.
  with weekly as (
    select
      date_trunc('week', event.occurred_at at time zone fridge_time_zone)::date as week_start,
      count(distinct event.batch_uid)::integer as settled_batch_count,
      count(distinct event.batch_uid) filter (where event.event_type = 'discard')::integer as discarded_batch_count
    from public.inventory_events as event
    where event.fridge_uid = current_fridge_uid and event.event_type in ('consume', 'discard')
    group by 1
  )
  insert into public.fridge_xp_events (fridge_uid, source_key, reason_code, points, occurred_at, metadata)
  select current_fridge_uid,
    'waste_improvement_week:' || current_week.week_start::text,
    'waste_improvement_week', 40,
    ((current_week.week_start + 7)::timestamp at time zone fridge_time_zone),
    jsonb_build_object(
      'weekStart', current_week.week_start,
      'currentWasteRate', current_week.discarded_batch_count::numeric / current_week.settled_batch_count,
      'baselineWasteRate', history.baseline_waste_rate,
      'ruleVersion', 1
    )
  from weekly as current_week
  cross join lateral (
    select
      count(*)::integer as qualifying_week_count,
      sum(previous_week.discarded_batch_count)::numeric / nullif(sum(previous_week.settled_batch_count), 0) as baseline_waste_rate
    from weekly as previous_week
    where previous_week.week_start >= current_week.week_start - 28
      and previous_week.week_start < current_week.week_start
      and previous_week.settled_batch_count >= 5
  ) as history
  where current_week.settled_batch_count >= 5
    and current_week.week_start + 7 <= (now() at time zone fridge_time_zone)::date
    and history.qualifying_week_count = 4
    and current_week.discarded_batch_count::numeric / current_week.settled_batch_count <= history.baseline_waste_rate - 0.10
  on conflict do nothing;

  insert into public.fridge_xp_events (fridge_uid, source_event_uid, reason_code, points, occurred_at, metadata)
  select current_fridge_uid, completed.event_uid, 'batch_consumed', 8, completed.occurred_at,
    jsonb_build_object('batchUid', completed.batch_uid, 'ruleVersion', 1)
  from (
    select distinct on (event.batch_uid) event.event_uid, event.batch_uid, event.occurred_at
    from public.inventory_events as event
    join public.inventory_batches as batch on batch.batch_uid = event.batch_uid and batch.fridge_uid = event.fridge_uid
    where event.fridge_uid = current_fridge_uid
      and event.event_type = 'consume'
      and batch.lifecycle_state = 'consumed'
    order by event.batch_uid, event.occurred_at desc, event.event_uid desc
  ) as completed
  on conflict do nothing;

  insert into public.fridge_xp_events (fridge_uid, source_event_uid, reason_code, points, occurred_at, metadata)
  select current_fridge_uid, rescued.event_uid, 'warning_window_rescue', 12, rescued.occurred_at,
    jsonb_build_object('batchUid', rescued.batch_uid, 'ruleVersion', 1)
  from (
    select distinct on (event.batch_uid) event.event_uid, event.batch_uid, event.occurred_at
    from public.inventory_events as event
    join public.inventory_batches as batch on batch.batch_uid = event.batch_uid and batch.fridge_uid = event.fridge_uid
    where event.fridge_uid = current_fridge_uid
      and event.event_type = 'consume'
      and event.was_in_warning_window
      and event.deadline_snapshot is not null
      and event.occurred_at <= event.deadline_snapshot
      and event.date_type_snapshot in ('use_by', 'best_before', 'estimated_quality')
      and batch.lifecycle_state = 'consumed'
    order by event.batch_uid, event.occurred_at desc, event.event_uid desc
  ) as rescued
  on conflict do nothing;

  insert into public.fridge_xp_events (fridge_uid, source_key, reason_code, points, metadata)
  select current_fridge_uid, 'shared_kitchen', 'shared_kitchen', 20, '{"ruleVersion":1}'::jsonb
  where member_count_value >= 2
  on conflict do nothing;

  insert into public.fridge_xp_events (fridge_uid, source_key, reason_code, points, occurred_at, metadata)
  select current_fridge_uid,
    'zero_waste_week:' || week.week_start::text,
    'zero_waste_week', 30,
    ((week.week_start + 7)::timestamp at time zone fridge_time_zone),
    jsonb_build_object('weekStart', week.week_start, 'settledBatchCount', week.settled_batch_count, 'ruleVersion', 1)
  from (
    select
      date_trunc('week', event.occurred_at at time zone fridge_time_zone)::date as week_start,
      count(distinct event.batch_uid)::integer as settled_batch_count,
      count(*) filter (where event.event_type = 'discard')::integer as discard_count
    from public.inventory_events as event
    where event.fridge_uid = current_fridge_uid and event.event_type in ('consume', 'discard')
    group by 1
  ) as week
  where week.settled_batch_count >= 3
    and week.discard_count = 0
    and week.week_start + 7 <= (now() at time zone fridge_time_zone)::date
  on conflict do nothing;

  insert into public.fridge_achievements (fridge_uid, achievement_uid, metric_value)
  select current_fridge_uid, achievement.achievement_uid, metric.metric_value
  from public.achievements as achievement
  cross join lateral (
    select case achievement.code
      when 'first_item' then stock_count_value::numeric
      when 'first_rescue' then rescued_batch_count_value::numeric
      when 'waste_watcher' then discard_reason_count_value::numeric
      when 'zero_waste_week' then (select count(*) from public.fridge_xp_events as xp where xp.fridge_uid = current_fridge_uid and xp.reason_code = 'zero_waste_week')::numeric
      when 'rescue_ten' then completed_rescued_batch_count_value::numeric
      when 'fridge_regular' then active_week_count_value::numeric
      when 'shared_kitchen' then member_count_value::numeric
      else null
    end as metric_value
  ) as metric
  where achievement.is_enabled
    and achievement.code <> 'climate_summit'
    and metric.metric_value is not null
    and metric.metric_value >= achievement.threshold
  on conflict (fridge_uid, achievement_uid) do update
    set metric_value = greatest(coalesce(public.fridge_achievements.metric_value, excluded.metric_value), excluded.metric_value);

  insert into public.fridge_xp_events (fridge_uid, source_key, reason_code, points, occurred_at, metadata)
  select current_fridge_uid, 'achievement:' || achievement.code, 'achievement_unlocked', achievement.xp_reward,
    unlocked.unlocked_at, jsonb_build_object('achievementCode', achievement.code, 'ruleVersion', achievement.rule_version)
  from public.fridge_achievements as unlocked
  join public.achievements as achievement on achievement.achievement_uid = unlocked.achievement_uid
  where unlocked.fridge_uid = current_fridge_uid and achievement.xp_reward > 0
  on conflict do nothing;

  select coalesce(sum(xp.points), 0)::integer into total_xp_value
  from public.fridge_xp_events as xp where xp.fridge_uid = current_fridge_uid;

  update public.fridges as fridge
  set achievement_peak_xp = greatest(fridge.achievement_peak_xp, total_xp_value)
  where fridge.fridge_uid = current_fridge_uid
  returning achievement_peak_xp into total_xp_value;

  if total_xp_value >= 1600 then
    insert into public.fridge_achievements (fridge_uid, achievement_uid, metric_value)
    select current_fridge_uid, achievement.achievement_uid, total_xp_value
    from public.achievements as achievement
    where achievement.code = 'climate_summit' and achievement.is_enabled
    on conflict (fridge_uid, achievement_uid) do update
      set metric_value = greatest(coalesce(public.fridge_achievements.metric_value, excluded.metric_value), excluded.metric_value);

    insert into public.fridge_xp_events (fridge_uid, source_key, reason_code, points, metadata)
    select current_fridge_uid, 'achievement:climate_summit', 'achievement_unlocked', achievement.xp_reward,
      jsonb_build_object('achievementCode', achievement.code, 'ruleVersion', achievement.rule_version)
    from public.achievements as achievement
    where achievement.code = 'climate_summit' and achievement.xp_reward > 0
    on conflict do nothing;

    select coalesce(sum(xp.points), 0)::integer into total_xp_value
    from public.fridge_xp_events as xp where xp.fridge_uid = current_fridge_uid;

    update public.fridges as fridge
    set achievement_peak_xp = greatest(fridge.achievement_peak_xp, total_xp_value)
    where fridge.fridge_uid = current_fridge_uid
    returning achievement_peak_xp into total_xp_value;
  end if;

  select level_definition.* into current_level
  from public.achievement_levels as level_definition
  where level_definition.is_enabled and level_definition.minimum_xp <= total_xp_value
  order by level_definition.minimum_xp desc limit 1;

  select level_definition.* into next_level
  from public.achievement_levels as level_definition
  where level_definition.is_enabled and level_definition.minimum_xp > current_level.minimum_xp
  order by level_definition.minimum_xp asc limit 1;

  previous_level_number := case when current_level.level > 1 then current_level.level - 1 else null end;
  level_progress := case
    when next_level.level is null then 1
    else greatest(0, least(1, (total_xp_value - current_level.minimum_xp)::numeric / nullif(next_level.minimum_xp - current_level.minimum_xp, 0)))
  end;

  select jsonb_build_object(
    'consumedBatchCount', count(distinct event.batch_uid) filter (where event.event_type = 'consume'),
    'rescuedBatchCount', rescued_batch_count_value,
    'discardedBatchCount', count(distinct event.batch_uid) filter (where event.event_type = 'discard'),
    'consumedValue', coalesce(sum(abs(event.value_change)) filter (where event.event_type = 'consume' and event.purchase_price_snapshot is not null and event.currency_snapshot = 'AUD'), 0),
    'rescuedValue', coalesce(sum(abs(event.value_change)) filter (
      where event.event_type = 'consume'
        and event.was_in_warning_window
        and event.deadline_snapshot is not null
        and event.occurred_at <= event.deadline_snapshot
        and event.date_type_snapshot in ('use_by', 'best_before', 'estimated_quality')
        and event.purchase_price_snapshot is not null
        and event.currency_snapshot = 'AUD'
    ), 0),
    'discardedValue', coalesce(sum(abs(event.value_change)) filter (where event.event_type = 'discard' and event.purchase_price_snapshot is not null and event.currency_snapshot = 'AUD'), 0),
    'currency', 'AUD',
    'priceCoverageRate', case when count(*) = 0 then null else count(*) filter (where event.purchase_price_snapshot is not null and event.currency_snapshot = 'AUD')::numeric / count(*) end,
    'memberCount', member_count_value
  ) into metrics_json
  from public.inventory_events as event
  where event.fridge_uid = current_fridge_uid and event.event_type in ('consume', 'discard');

  -- Arthur: NarIyirm
  -- 中文：徽章状态与进度分母由数据库按实时指标权威计算；客户端只渲染，不自行判定 locked/in_progress/unlocked。
  -- EN: Badge status and progress denominators are authoritative database aggregates; clients only render and never decide locked/in_progress/unlocked.
  select coalesce(jsonb_agg(payload.item order by payload.sort_order), '[]'::jsonb) into achievements_json
  from (
    select
      achievement.sort_order,
      jsonb_build_object(
        'code', achievement.code,
        'titleKey', achievement.title_key,
        'descriptionKey', achievement.description_key,
        'xpReward', achievement.xp_reward,
        'badgeAssetKey', achievement.badge_asset_key,
        'ruleVersion', achievement.rule_version,
        'unlocked', unlocked.achievement_uid is not null,
        'unlockedAt', unlocked.unlocked_at,
        'metricValue', progress.progress_current,
        'status', progress.status,
        'progressCurrent', progress.progress_current,
        'progressTarget', progress.progress_target,
        'progressLabelKey', progress.progress_label_key
      ) as item
    from public.achievements as achievement
    left join public.fridge_achievements as unlocked
      on unlocked.achievement_uid = achievement.achievement_uid and unlocked.fridge_uid = current_fridge_uid
    cross join lateral (
      select
        case achievement.code
          when 'first_item' then least(stock_count_value, achievement.threshold)::numeric
          when 'first_rescue' then least(rescued_batch_count_value, achievement.threshold)::numeric
          when 'waste_watcher' then least(discard_reason_count_value, achievement.threshold)::numeric
          when 'zero_waste_week' then least((
            select count(*)::numeric from public.fridge_xp_events as xp
            where xp.fridge_uid = current_fridge_uid and xp.reason_code = 'zero_waste_week'
          ), achievement.threshold)
          when 'rescue_ten' then least(completed_rescued_batch_count_value, achievement.threshold)::numeric
          when 'fridge_regular' then least(active_week_count_value, achievement.threshold)::numeric
          when 'shared_kitchen' then least(member_count_value, achievement.threshold)::numeric
          when 'climate_summit' then least(total_xp_value, achievement.threshold)::numeric
          else 0::numeric
        end as progress_current,
        achievement.threshold as progress_target,
        case achievement.code
          when 'climate_summit' then 'achievements.progress.xpOfTarget'
          when 'shared_kitchen' then 'achievements.progress.membersOfTarget'
          else 'achievements.progress.currentOfTarget'
        end as progress_label_key,
        case
          when unlocked.achievement_uid is not null then 'unlocked'
          when case achievement.code
            when 'first_item' then stock_count_value
            when 'first_rescue' then rescued_batch_count_value
            when 'waste_watcher' then discard_reason_count_value
            when 'zero_waste_week' then (
              select count(*)::integer from public.fridge_xp_events as xp
              where xp.fridge_uid = current_fridge_uid and xp.reason_code = 'zero_waste_week'
            )
            when 'rescue_ten' then completed_rescued_batch_count_value
            when 'fridge_regular' then active_week_count_value
            when 'shared_kitchen' then member_count_value
            when 'climate_summit' then total_xp_value
            else 0
          end > 0 then 'in_progress'
          else 'locked'
        end as status
    ) as progress
    where achievement.is_enabled
  ) as payload;

  select coalesce(jsonb_agg(recent.item order by recent.occurred_at desc), '[]'::jsonb) into recent_xp_json
  from (
    select jsonb_build_object(
      'id', xp.xp_event_uid,
      'reasonCode', xp.reason_code,
      'points', xp.points,
      'occurredAt', xp.occurred_at,
      'metadata', xp.metadata
    ) as item, xp.occurred_at
    from public.fridge_xp_events as xp
    where xp.fridge_uid = current_fridge_uid
    order by xp.occurred_at desc
    limit 10
  ) as recent;

  return jsonb_build_object(
    'level', jsonb_build_object(
      'current', current_level.level,
      'code', current_level.code,
      'titleKey', current_level.title_key,
      'totalXp', total_xp_value,
      'currentLevelMinimumXp', current_level.minimum_xp,
      'nextLevelMinimumXp', next_level.minimum_xp,
      'progress', level_progress,
      'isMaxLevel', next_level.level is null,
      'mountainKey', current_level.mountain_key,
      'themeKey', current_level.theme_key
    ),
    'journey', jsonb_build_object('previousLevel', previous_level_number, 'currentLevel', current_level.level, 'nextLevel', next_level.level),
    'metrics', metrics_json,
    'achievements', achievements_json,
    'recentXpEvents', recent_xp_json,
    'updatedAt', now()
  );
end;
$$;


revoke execute on function public.get_achievement_dashboard(text) from public, anon, authenticated;
grant execute on function public.get_achievement_dashboard(text) to service_role;

comment on function public.get_achievement_dashboard(text) is 'Reconciles XP/unlocks and returns badge status, progress denominators, level, metrics, and recent XP for one shared fridge.';

-- Arthur: NarIyirm
-- 中文：迁移后强制刷新 PostgREST schema cache，避免已存在的函数/列仍报 schema cache 找不到。
-- EN: Force a PostgREST schema-cache reload after migration so existing functions/columns are not reported missing.
notify pgrst, 'reload schema';
