-- Arthur: NarIyirm
-- 中文：落地每日/每周挑战定义、冰箱级分配、进度对账与每周一次更换；权威完成与 XP 只在数据库结算，客户端只渲染。
-- EN: Land daily/weekly quest definitions, fridge-level assignments, progress reconciliation, and one weekly reroll; completion and XP stay authoritative in the database while clients only render.

create table public.quest_definitions (
  quest_uid uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  period_type text not null,
  category text not null,
  title_key text not null,
  description_key text not null,
  reward_xp integer not null default 0,
  default_target integer not null default 1,
  target_formula text not null default 'fixed_one',
  min_target integer not null default 1,
  max_target integer not null default 1,
  eligibility_key text not null,
  rule_version integer not null default 1,
  sort_order integer not null default 0,
  is_enabled boolean not null default false,
  is_reminder_only boolean not null default false,
  constraint quest_definitions_code_format check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint quest_definitions_period_type_valid check (period_type in ('daily', 'weekly')),
  constraint quest_definitions_category_valid check (category in ('outcome', 'organisation', 'shopping')),
  constraint quest_definitions_reward_non_negative check (reward_xp >= 0),
  constraint quest_definitions_targets_positive check (
    default_target > 0 and min_target > 0 and max_target >= min_target
  ),
  constraint quest_definitions_rule_version_positive check (rule_version > 0)
);

create table public.fridge_quest_assignments (
  assignment_uid uuid primary key default extensions.gen_random_uuid(),
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  quest_uid uuid not null references public.quest_definitions(quest_uid) on update cascade on delete restrict,
  quest_code text not null,
  period_type text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  time_zone text not null,
  target integer not null,
  progress numeric not null default 0,
  reward_xp integer not null,
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'assigned',
  completed_at timestamptz,
  rule_version integer not null,
  source_key text not null,
  reroll_of_assignment_uid uuid references public.fridge_quest_assignments(assignment_uid) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fridge_quest_assignments_period_type_valid check (period_type in ('daily', 'weekly')),
  constraint fridge_quest_assignments_status_valid check (status in ('assigned', 'completed', 'expired', 'rerolled')),
  constraint fridge_quest_assignments_target_positive check (target > 0),
  constraint fridge_quest_assignments_progress_non_negative check (progress >= 0),
  constraint fridge_quest_assignments_reward_non_negative check (reward_xp >= 0),
  constraint fridge_quest_assignments_period_order check (period_end > period_start),
  constraint fridge_quest_assignments_eligibility_object check (jsonb_typeof(eligibility_snapshot) = 'object'),
  constraint fridge_quest_assignments_source_key_not_blank check (char_length(btrim(source_key)) > 0),
  constraint fridge_quest_assignments_rule_version_positive check (rule_version > 0)
);

-- Arthur: NarIyirm
-- 中文：每个冰箱在同一周期只保留一条有效主挑战（assigned/completed）；rerolled/expired 可并存审计。
-- EN: Each fridge keeps one active primary quest per period (assigned/completed); rerolled/expired rows remain for audit.
create unique index fridge_quest_assignments_active_period_unique
  on public.fridge_quest_assignments (fridge_uid, period_type, period_start)
  where status in ('assigned', 'completed');

create unique index fridge_quest_assignments_source_key_unique
  on public.fridge_quest_assignments (fridge_uid, source_key);

create index fridge_quest_assignments_fridge_period_idx
  on public.fridge_quest_assignments (fridge_uid, period_type, period_start desc);

create index fridge_quest_assignments_status_idx
  on public.fridge_quest_assignments (fridge_uid, status, period_end);

alter table public.quest_definitions enable row level security;
alter table public.fridge_quest_assignments enable row level security;
revoke all on table public.quest_definitions, public.fridge_quest_assignments from public, anon, authenticated;
grant select, insert, update, delete on table public.quest_definitions, public.fridge_quest_assignments to service_role;

insert into public.quest_definitions (
  code, period_type, category, title_key, description_key, reward_xp,
  default_target, target_formula, min_target, max_target, eligibility_key,
  rule_version, sort_order, is_enabled, is_reminder_only
)
values
  ('use_it_today', 'daily', 'outcome', 'quests.useItToday.title', 'quests.useItToday.description', 5, 1, 'fixed_one', 1, 1, 'safe_active_batch', 1, 10, true, false),
  ('rescue_one', 'daily', 'outcome', 'quests.rescueOne.title', 'quests.rescueOne.description', 10, 1, 'fixed_one', 1, 1, 'warning_window_batch', 1, 20, true, false),
  ('finish_one_in_time', 'daily', 'outcome', 'quests.finishOneInTime.title', 'quests.finishOneInTime.description', 5, 1, 'fixed_one', 1, 1, 'safe_active_batch', 1, 30, true, false),
  ('update_after_use', 'daily', 'organisation', 'quests.updateAfterUse.title', 'quests.updateAfterUse.description', 5, 1, 'fixed_one', 1, 1, 'known_quantity_batch', 1, 40, true, false),
  ('quick_fridge_check', 'daily', 'organisation', 'quests.quickFridgeCheck.title', 'quests.quickFridgeCheck.description', 5, 3, 'fixed_one', 3, 3, 'review_batches_3', 1, 50, false, false),
  ('plan_before_shopping', 'daily', 'shopping', 'quests.planBeforeShopping.title', 'quests.planBeforeShopping.description', 5, 1, 'fixed_one', 1, 1, 'shopping_future', 1, 60, false, false),
  ('skip_a_double_buy', 'daily', 'shopping', 'quests.skipADoubleBuy.title', 'quests.skipADoubleBuy.description', 10, 1, 'fixed_one', 1, 1, 'duplicate_warning_future', 1, 70, false, false),
  ('rescue_the_week', 'weekly', 'outcome', 'quests.rescueTheWeek.title', 'quests.rescueTheWeek.description', 20, 2, 'weekly_rescue', 1, 3, 'warning_window_batches_2', 1, 110, true, false),
  ('use_four_in_time', 'weekly', 'outcome', 'quests.useFourInTime.title', 'quests.useFourInTime.description', 20, 4, 'weekly_use_in_time', 2, 5, 'safe_active_batches_4', 1, 120, true, false),
  ('three_day_rhythm', 'weekly', 'organisation', 'quests.threeDayRhythm.title', 'quests.threeDayRhythm.description', 20, 3, 'weekly_habit_days', 2, 4, 'recent_active_day', 1, 130, true, false),
  ('fridge_reset', 'weekly', 'organisation', 'quests.fridgeReset.title', 'quests.fridgeReset.description', 0, 8, 'weekly_review', 2, 8, 'review_batches_8', 1, 140, false, true),
  ('shop_from_what_you_have', 'weekly', 'shopping', 'quests.shopFromWhatYouHave.title', 'quests.shopFromWhatYouHave.description', 20, 2, 'fixed_one', 2, 2, 'shopping_future', 1, 150, false, false),
  ('duplicate_defender', 'weekly', 'shopping', 'quests.duplicateDefender.title', 'quests.duplicateDefender.description', 20, 2, 'duplicate_avoidance', 1, 2, 'duplicate_warning_future', 1, 160, false, false),
  ('strong_utilisation_week', 'weekly', 'outcome', 'quests.strongUtilisationWeek.title', 'quests.strongUtilisationWeek.description', 30, 1, 'fixed_one', 1, 1, 'price_coverage_80', 1, 170, true, false),
  ('know_the_outcome', 'weekly', 'organisation', 'quests.knowTheOutcome.title', 'quests.knowTheOutcome.description', 0, 6, 'fixed_one', 6, 6, 'resolvable_batches_6', 1, 180, true, true)
on conflict (code) do update set
  period_type = excluded.period_type,
  category = excluded.category,
  title_key = excluded.title_key,
  description_key = excluded.description_key,
  reward_xp = excluded.reward_xp,
  default_target = excluded.default_target,
  target_formula = excluded.target_formula,
  min_target = excluded.min_target,
  max_target = excluded.max_target,
  eligibility_key = excluded.eligibility_key,
  rule_version = excluded.rule_version,
  sort_order = excluded.sort_order,
  is_enabled = excluded.is_enabled,
  is_reminder_only = excluded.is_reminder_only;

create or replace function public.quest_period_bounds(p_time_zone text, p_period_type text)
returns table(period_start timestamptz, period_end timestamptz, local_date date)
language plpgsql
stable
set search_path = ''
as $$
declare
  local_now timestamp;
  week_start date;
begin
  local_now := timezone(p_time_zone, now());
  local_date := local_now::date;
  if p_period_type = 'daily' then
    period_start := (local_date::timestamp at time zone p_time_zone);
    period_end := ((local_date + 1)::timestamp at time zone p_time_zone);
  elsif p_period_type = 'weekly' then
    week_start := date_trunc('week', local_now)::date;
    period_start := (week_start::timestamp at time zone p_time_zone);
    period_end := ((week_start + 7)::timestamp at time zone p_time_zone);
  else
    raise exception 'unsupported quest period type: %', p_period_type;
  end if;
  return next;
end;
$$;

create or replace function public.quest_eligibility_snapshot(p_fridge_uid uuid, p_time_zone text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  active_safe integer;
  warning_batches integer;
  known_quantity integer;
  price_coverage numeric;
  active_days_28 integer;
begin
  select count(*)::integer into active_safe
  from public.inventory_batches as batch
  where batch.fridge_uid = p_fridge_uid
    and batch.lifecycle_state = 'active'
    and (batch.use_by_at is null or batch.use_by_at > now());

  select count(*)::integer into warning_batches
  from public.inventory_batches as batch
  where batch.fridge_uid = p_fridge_uid
    and batch.lifecycle_state = 'active'
    and batch.initial_quantity is not null
    and batch.initial_quantity > 0
    and coalesce(batch.use_by_at, batch.best_before_at, batch.estimated_quality_until, batch.expires_at) is not null
    and coalesce(batch.use_by_at, batch.best_before_at, batch.estimated_quality_until, batch.expires_at) > now()
    and coalesce(batch.use_by_at, batch.best_before_at, batch.estimated_quality_until, batch.expires_at)
      <= now() + make_interval(days => greatest(coalesce(batch.expiry_warning_days, 3), 0));

  select count(*)::integer into known_quantity
  from public.inventory_batches as batch
  where batch.fridge_uid = p_fridge_uid
    and batch.lifecycle_state = 'active'
    and batch.initial_quantity is not null
    and batch.initial_quantity > 0;

  select case
    when count(*) filter (where batch.lifecycle_state in ('consumed', 'discarded')) = 0 then null
    else count(*) filter (
      where batch.lifecycle_state in ('consumed', 'discarded')
        and batch.price_status in ('recorded', 'free')
    )::numeric / nullif(count(*) filter (where batch.lifecycle_state in ('consumed', 'discarded')), 0)
  end into price_coverage
  from public.inventory_batches as batch
  where batch.fridge_uid = p_fridge_uid;

  select count(distinct date_trunc('day', event.occurred_at at time zone p_time_zone)::date)::integer
  into active_days_28
  from public.inventory_events as event
  where event.fridge_uid = p_fridge_uid
    and event.event_type in ('consume', 'discard', 'stock')
    and event.occurred_at >= now() - interval '28 days';

  return jsonb_build_object(
    'activeSafeBatches', coalesce(active_safe, 0),
    'warningWindowBatches', coalesce(warning_batches, 0),
    'knownQuantityBatches', coalesce(known_quantity, 0),
    'priceCoverageRate', price_coverage,
    'activeDays28', coalesce(active_days_28, 0),
    'capturedAt', now()
  );
end;
$$;

create or replace function public.quest_is_eligible(p_eligibility_key text, p_snapshot jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_eligibility_key
    when 'safe_active_batch' then coalesce((p_snapshot->>'activeSafeBatches')::integer, 0) >= 1
    when 'warning_window_batch' then coalesce((p_snapshot->>'warningWindowBatches')::integer, 0) >= 1
    when 'known_quantity_batch' then coalesce((p_snapshot->>'knownQuantityBatches')::integer, 0) >= 1
    when 'warning_window_batches_2' then coalesce((p_snapshot->>'warningWindowBatches')::integer, 0) >= 2
    when 'safe_active_batches_4' then coalesce((p_snapshot->>'activeSafeBatches')::integer, 0) >= 4
    when 'recent_active_day' then coalesce((p_snapshot->>'activeDays28')::integer, 0) >= 1
    when 'price_coverage_80' then coalesce((p_snapshot->>'priceCoverageRate')::numeric, 0) >= 0.8
    when 'resolvable_batches_6' then coalesce((p_snapshot->>'activeSafeBatches')::integer, 0) >= 6
    else false
  end;
$$;

create or replace function public.quest_freeze_target(p_formula text, p_default integer, p_min integer, p_max integer, p_snapshot jsonb)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw_value numeric;
begin
  raw_value := case p_formula
    when 'fixed_one' then p_default
    when 'weekly_rescue' then round(coalesce((p_snapshot->>'warningWindowBatches')::numeric, 0) * 0.5)
    when 'weekly_use_in_time' then round(coalesce((p_snapshot->>'activeSafeBatches')::numeric, 0) * 0.25)
    when 'weekly_habit_days' then round(coalesce((p_snapshot->>'activeDays28')::numeric, 0) / 4.0) + 1
    when 'weekly_review' then round(coalesce((p_snapshot->>'activeSafeBatches')::numeric, 0) * 0.5)
    else p_default
  end;
  return greatest(p_min, least(p_max, greatest(coalesce(raw_value, p_default), p_min)::integer));
end;
$$;

create or replace function public.evaluate_quest_progress(
  p_fridge_uid uuid,
  p_quest_code text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_time_zone text
)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  progress_value numeric := 0;
begin
  if p_quest_code = 'use_it_today' then
    select count(distinct event.batch_uid)::numeric into progress_value
    from public.inventory_events as event
    where event.fridge_uid = p_fridge_uid
      and event.event_type = 'consume'
      and event.quantity_change < 0
      and event.occurred_at >= p_period_start
      and event.occurred_at < p_period_end;

  elsif p_quest_code = 'rescue_one' then
    select count(distinct event.batch_uid)::numeric into progress_value
    from public.inventory_events as event
    join public.inventory_batches as batch
      on batch.batch_uid = event.batch_uid and batch.fridge_uid = event.fridge_uid
    where event.fridge_uid = p_fridge_uid
      and event.event_type = 'consume'
      and event.was_in_warning_window
      and event.deadline_snapshot is not null
      and event.occurred_at <= event.deadline_snapshot
      and event.occurred_at >= p_period_start
      and event.occurred_at < p_period_end
      and (
        batch.lifecycle_state = 'consumed'
        or abs(event.quantity_change) >= greatest(coalesce(event.initial_quantity_snapshot, batch.initial_quantity, 0) * 0.25, 0)
      );

  elsif p_quest_code = 'finish_one_in_time' then
    select count(distinct event.batch_uid)::numeric into progress_value
    from public.inventory_events as event
    join public.inventory_batches as batch
      on batch.batch_uid = event.batch_uid and batch.fridge_uid = event.fridge_uid
    where event.fridge_uid = p_fridge_uid
      and event.event_type = 'consume'
      and batch.lifecycle_state = 'consumed'
      and event.deadline_snapshot is not null
      and event.occurred_at <= event.deadline_snapshot
      and event.occurred_at >= p_period_start
      and event.occurred_at < p_period_end;

  elsif p_quest_code = 'update_after_use' then
    select count(*)::numeric into progress_value
    from public.inventory_events as event
    join public.inventory_batches as batch
      on batch.batch_uid = event.batch_uid and batch.fridge_uid = event.fridge_uid
    where event.fridge_uid = p_fridge_uid
      and event.event_type = 'consume'
      and event.quantity_change < 0
      and batch.lifecycle_state = 'active'
      and batch.remaining_quantity > 0
      and event.occurred_at >= p_period_start
      and event.occurred_at < p_period_end;

  elsif p_quest_code = 'rescue_the_week' then
    select count(distinct event.batch_uid)::numeric into progress_value
    from public.inventory_events as event
    where event.fridge_uid = p_fridge_uid
      and event.event_type = 'consume'
      and event.was_in_warning_window
      and event.deadline_snapshot is not null
      and event.occurred_at <= event.deadline_snapshot
      and event.occurred_at >= p_period_start
      and event.occurred_at < p_period_end;

  elsif p_quest_code = 'use_four_in_time' then
    select count(distinct event.batch_uid)::numeric into progress_value
    from public.inventory_events as event
    where event.fridge_uid = p_fridge_uid
      and event.event_type = 'consume'
      and event.deadline_snapshot is not null
      and event.occurred_at <= event.deadline_snapshot
      and event.occurred_at >= p_period_start
      and event.occurred_at < p_period_end;

  elsif p_quest_code = 'three_day_rhythm' then
    select count(distinct date_trunc('day', event.occurred_at at time zone p_time_zone)::date)::numeric
    into progress_value
    from public.inventory_events as event
    where event.fridge_uid = p_fridge_uid
      and event.event_type in ('consume', 'discard')
      and event.occurred_at >= p_period_start
      and event.occurred_at < p_period_end;

  elsif p_quest_code = 'strong_utilisation_week' then
    select case
      when settled.settled_count >= 4
        and settled.consumed_value >= 0.75 * nullif(settled.consumed_value + settled.discarded_value, 0)
      then 1 else 0
    end into progress_value
    from (
      select
        count(distinct event.batch_uid) filter (where event.event_type in ('consume', 'discard'))::integer as settled_count,
        coalesce(sum(case when event.event_type = 'consume' then abs(event.value_change) else 0 end), 0) as consumed_value,
        coalesce(sum(case when event.event_type = 'discard' then abs(event.value_change) else 0 end), 0) as discarded_value
      from public.inventory_events as event
      join public.inventory_batches as batch
        on batch.batch_uid = event.batch_uid and batch.fridge_uid = event.fridge_uid
      where event.fridge_uid = p_fridge_uid
        and event.event_type in ('consume', 'discard')
        and batch.price_status in ('recorded', 'free')
        and event.occurred_at >= p_period_start
        and event.occurred_at < p_period_end
    ) as settled;

  elsif p_quest_code = 'know_the_outcome' then
    select count(distinct event.batch_uid)::numeric into progress_value
    from public.inventory_events as event
    join public.inventory_batches as batch
      on batch.batch_uid = event.batch_uid and batch.fridge_uid = event.fridge_uid
    where event.fridge_uid = p_fridge_uid
      and event.event_type in ('consume', 'discard')
      and batch.lifecycle_state in ('consumed', 'discarded')
      and event.occurred_at >= p_period_start
      and event.occurred_at < p_period_end;

  else
    progress_value := 0;
  end if;

  return coalesce(progress_value, 0);
end;
$$;

create or replace function public.assign_primary_quest(
  p_fridge_uid uuid,
  p_period_type text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_time_zone text,
  p_exclude_codes text[] default '{}'::text[],
  p_reroll_of uuid default null
)
returns public.fridge_quest_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
  chosen public.quest_definitions;
  frozen_target integer;
  created public.fridge_quest_assignments;
  preferred_category text;
begin
  snapshot := public.quest_eligibility_snapshot(p_fridge_uid, p_time_zone);

  preferred_category := (array['outcome', 'outcome', 'outcome', 'outcome', 'outcome', 'organisation', 'organisation', 'organisation', 'shopping', 'shopping'])[
    1 + floor(random() * 10)::integer
  ];

  select definition.* into chosen
  from public.quest_definitions as definition
  where definition.period_type = p_period_type
    and definition.is_enabled
    and not (definition.code = any (p_exclude_codes))
    and public.quest_is_eligible(definition.eligibility_key, snapshot)
  order by
    case when definition.category = preferred_category then 0 else 1 end,
    random()
  limit 1;

  if chosen.quest_uid is null then
    select definition.* into chosen
    from public.quest_definitions as definition
    where definition.period_type = p_period_type
      and definition.is_enabled
      and not (definition.code = any (p_exclude_codes))
      and public.quest_is_eligible(definition.eligibility_key, snapshot)
    order by random()
    limit 1;
  end if;

  if chosen.quest_uid is null then
    return null;
  end if;

  frozen_target := public.quest_freeze_target(
    chosen.target_formula, chosen.default_target, chosen.min_target, chosen.max_target, snapshot
  );

  insert into public.fridge_quest_assignments (
    fridge_uid, quest_uid, quest_code, period_type, period_start, period_end, time_zone,
    target, progress, reward_xp, eligibility_snapshot, status, rule_version, source_key, reroll_of_assignment_uid
  )
  values (
    p_fridge_uid, chosen.quest_uid, chosen.code, p_period_type, p_period_start, p_period_end, p_time_zone,
    frozen_target, 0, chosen.reward_xp, snapshot, 'assigned', chosen.rule_version,
    'quest:' || extensions.gen_random_uuid()::text, p_reroll_of
  )
  returning * into created;

  return created;
end;
$$;

create or replace function public.reconcile_fridge_quests(p_fridge_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fridge_time_zone text;
  bounds record;
  active_row public.fridge_quest_assignments;
  exclude_codes text[];
  progress_value numeric;
begin
  select fridge.time_zone into fridge_time_zone
  from public.fridges as fridge
  where fridge.fridge_uid = p_fridge_uid;

  if fridge_time_zone is null then
    return;
  end if;

  update public.fridge_quest_assignments as assignment
  set status = 'expired', updated_at = now()
  where assignment.fridge_uid = p_fridge_uid
    and assignment.status = 'assigned'
    and assignment.period_end <= now();

  -- daily
  select * into bounds from public.quest_period_bounds(fridge_time_zone, 'daily');
  select assignment.* into active_row
  from public.fridge_quest_assignments as assignment
  where assignment.fridge_uid = p_fridge_uid
    and assignment.period_type = 'daily'
    and assignment.period_start = bounds.period_start
    and assignment.status in ('assigned', 'completed')
  limit 1;

  if active_row.assignment_uid is null then
    select coalesce(array_agg(previous.quest_code), '{}'::text[]) into exclude_codes
    from (
      select assignment.quest_code
      from public.fridge_quest_assignments as assignment
      where assignment.fridge_uid = p_fridge_uid
        and assignment.period_type = 'daily'
        and assignment.period_start < bounds.period_start
      order by assignment.period_start desc
      limit 2
    ) as previous;
    perform public.assign_primary_quest(
      p_fridge_uid, 'daily', bounds.period_start, bounds.period_end, fridge_time_zone, exclude_codes, null
    );
  end if;

  -- weekly
  select * into bounds from public.quest_period_bounds(fridge_time_zone, 'weekly');
  select assignment.* into active_row
  from public.fridge_quest_assignments as assignment
  where assignment.fridge_uid = p_fridge_uid
    and assignment.period_type = 'weekly'
    and assignment.period_start = bounds.period_start
    and assignment.status in ('assigned', 'completed')
  limit 1;

  if active_row.assignment_uid is null then
    select coalesce(array_agg(previous.quest_code), '{}'::text[]) into exclude_codes
    from (
      select assignment.quest_code
      from public.fridge_quest_assignments as assignment
      where assignment.fridge_uid = p_fridge_uid
        and assignment.period_type = 'weekly'
        and assignment.period_start < bounds.period_start
      order by assignment.period_start desc
      limit 2
    ) as previous;
    perform public.assign_primary_quest(
      p_fridge_uid, 'weekly', bounds.period_start, bounds.period_end, fridge_time_zone, exclude_codes, null
    );
  end if;

  for active_row in
    select assignment.*
    from public.fridge_quest_assignments as assignment
    where assignment.fridge_uid = p_fridge_uid
      and assignment.status = 'assigned'
      and assignment.period_end > now()
  loop
    progress_value := public.evaluate_quest_progress(
      p_fridge_uid, active_row.quest_code, active_row.period_start, active_row.period_end, active_row.time_zone
    );
    progress_value := least(progress_value, active_row.target::numeric);

    update public.fridge_quest_assignments as assignment
    set progress = progress_value,
        updated_at = now(),
        status = case when progress_value >= assignment.target then 'completed' else assignment.status end,
        completed_at = case when progress_value >= assignment.target then coalesce(assignment.completed_at, now()) else assignment.completed_at end
    where assignment.assignment_uid = active_row.assignment_uid;

    if progress_value >= active_row.target and active_row.reward_xp > 0 then
      insert into public.fridge_xp_events (fridge_uid, source_key, reason_code, points, metadata)
      values (
        p_fridge_uid,
        active_row.source_key,
        'quest_completed',
        active_row.reward_xp,
        jsonb_build_object(
          'assignmentUid', active_row.assignment_uid,
          'questCode', active_row.quest_code,
          'periodType', active_row.period_type,
          'ruleVersion', active_row.rule_version
        )
      )
      on conflict do nothing;
    end if;
  end loop;

  update public.fridges as fridge
  set achievement_peak_xp = greatest(
    fridge.achievement_peak_xp,
    coalesce((select sum(xp.points) from public.fridge_xp_events as xp where xp.fridge_uid = p_fridge_uid), 0)
  )
  where fridge.fridge_uid = p_fridge_uid;
end;
$$;

create or replace function public.quest_assignment_json(p_assignment public.fridge_quest_assignments)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when p_assignment.assignment_uid is null then null else jsonb_build_object(
    'assignmentUid', p_assignment.assignment_uid,
    'questCode', p_assignment.quest_code,
    'periodType', p_assignment.period_type,
    'titleKey', definition.title_key,
    'descriptionKey', definition.description_key,
    'category', definition.category,
    'target', p_assignment.target,
    'progressCurrent', p_assignment.progress,
    'progressTarget', p_assignment.target,
    'rewardXp', p_assignment.reward_xp,
    'isReminderOnly', definition.is_reminder_only,
    'status', p_assignment.status,
    'periodStart', p_assignment.period_start,
    'periodEnd', p_assignment.period_end,
    'timeZone', p_assignment.time_zone,
    'completedAt', p_assignment.completed_at,
    'ruleVersion', p_assignment.rule_version,
    'canReroll', p_assignment.period_type = 'weekly'
      and p_assignment.status = 'assigned'
      and not exists (
        select 1
        from public.fridge_quest_assignments as prior
        where prior.fridge_uid = p_assignment.fridge_uid
          and prior.period_type = 'weekly'
          and prior.period_start = p_assignment.period_start
          and prior.status = 'rerolled'
      )
  ) end
  from public.quest_definitions as definition
  where definition.quest_uid = p_assignment.quest_uid;
$$;

create or replace function public.get_fridge_quests(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  fridge_time_zone text;
  daily_bounds record;
  weekly_bounds record;
  daily_row public.fridge_quest_assignments;
  weekly_row public.fridge_quest_assignments;
  weekly_rerolls_used integer;
begin
  current_fridge_uid := public.bootstrap_device(p_device_id);
  select fridge.time_zone into fridge_time_zone
  from public.fridges as fridge where fridge.fridge_uid = current_fridge_uid;

  perform public.reconcile_fridge_quests(current_fridge_uid);

  select * into daily_bounds from public.quest_period_bounds(fridge_time_zone, 'daily');
  select * into weekly_bounds from public.quest_period_bounds(fridge_time_zone, 'weekly');

  select assignment.* into daily_row
  from public.fridge_quest_assignments as assignment
  where assignment.fridge_uid = current_fridge_uid
    and assignment.period_type = 'daily'
    and assignment.period_start = daily_bounds.period_start
    and assignment.status in ('assigned', 'completed')
  limit 1;

  select assignment.* into weekly_row
  from public.fridge_quest_assignments as assignment
  where assignment.fridge_uid = current_fridge_uid
    and assignment.period_type = 'weekly'
    and assignment.period_start = weekly_bounds.period_start
    and assignment.status in ('assigned', 'completed')
  limit 1;

  select count(*)::integer into weekly_rerolls_used
  from public.fridge_quest_assignments as assignment
  where assignment.fridge_uid = current_fridge_uid
    and assignment.period_type = 'weekly'
    and assignment.period_start = weekly_bounds.period_start
    and assignment.status = 'rerolled';

  return jsonb_build_object(
    'daily', public.quest_assignment_json(daily_row),
    'weekly', public.quest_assignment_json(weekly_row),
    'weeklyRerollsRemaining', greatest(0, 1 - coalesce(weekly_rerolls_used, 0)),
    'updatedAt', now()
  );
end;
$$;

create or replace function public.reroll_weekly_quest(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  fridge_time_zone text;
  bounds record;
  active_row public.fridge_quest_assignments;
  rerolls_used integer;
  exclude_codes text[];
  replacement public.fridge_quest_assignments;
begin
  current_fridge_uid := public.bootstrap_device(p_device_id);
  select fridge.time_zone into fridge_time_zone
  from public.fridges as fridge where fridge.fridge_uid = current_fridge_uid;

  perform public.reconcile_fridge_quests(current_fridge_uid);
  select * into bounds from public.quest_period_bounds(fridge_time_zone, 'weekly');

  select count(*)::integer into rerolls_used
  from public.fridge_quest_assignments as assignment
  where assignment.fridge_uid = current_fridge_uid
    and assignment.period_type = 'weekly'
    and assignment.period_start = bounds.period_start
    and assignment.status = 'rerolled';

  if coalesce(rerolls_used, 0) >= 1 then
    raise exception 'weekly_quest_reroll_exhausted' using errcode = 'P0001';
  end if;

  select assignment.* into active_row
  from public.fridge_quest_assignments as assignment
  where assignment.fridge_uid = current_fridge_uid
    and assignment.period_type = 'weekly'
    and assignment.period_start = bounds.period_start
    and assignment.status = 'assigned'
  for update;

  if active_row.assignment_uid is null then
    raise exception 'weekly_quest_not_rerollable' using errcode = 'P0001';
  end if;

  update public.fridge_quest_assignments as assignment
  set status = 'rerolled', updated_at = now()
  where assignment.assignment_uid = active_row.assignment_uid;

  select coalesce(array_agg(distinct codes.code), array[active_row.quest_code]) into exclude_codes
  from (
    select active_row.quest_code as code
    union all
    select previous.quest_code
    from (
      select assignment.quest_code
      from public.fridge_quest_assignments as assignment
      where assignment.fridge_uid = current_fridge_uid
        and assignment.period_type = 'weekly'
        and assignment.period_start < bounds.period_start
      order by assignment.period_start desc
      limit 2
    ) as previous
  ) as codes;

  replacement := public.assign_primary_quest(
    current_fridge_uid, 'weekly', bounds.period_start, bounds.period_end, fridge_time_zone, exclude_codes, active_row.assignment_uid
  );

  if replacement.assignment_uid is null then
    -- Arthur: NarIyirm
    -- 中文：没有可替换挑战时回滚更换，恢复原分配，避免用户失去本周挑战。
    -- EN: If no eligible replacement exists, restore the original assignment so the fridge does not lose this week's quest.
    update public.fridge_quest_assignments as assignment
    set status = 'assigned', updated_at = now()
    where assignment.assignment_uid = active_row.assignment_uid;
    raise exception 'weekly_quest_reroll_unavailable' using errcode = 'P0001';
  end if;

  return public.get_fridge_quests(p_device_id);
end;
$$;

revoke execute on function public.quest_period_bounds(text, text) from public, anon, authenticated;
revoke execute on function public.quest_eligibility_snapshot(uuid, text) from public, anon, authenticated;
revoke execute on function public.quest_is_eligible(text, jsonb) from public, anon, authenticated;
revoke execute on function public.quest_freeze_target(text, integer, integer, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.evaluate_quest_progress(uuid, text, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.assign_primary_quest(uuid, text, timestamptz, timestamptz, text, text[], uuid) from public, anon, authenticated;
revoke execute on function public.reconcile_fridge_quests(uuid) from public, anon, authenticated;
revoke execute on function public.quest_assignment_json(public.fridge_quest_assignments) from public, anon, authenticated;
revoke execute on function public.get_fridge_quests(text) from public, anon, authenticated;
revoke execute on function public.reroll_weekly_quest(text) from public, anon, authenticated;

grant execute on function public.get_fridge_quests(text) to service_role;
grant execute on function public.reroll_weekly_quest(text) to service_role;

comment on table public.quest_definitions is 'Global daily/weekly quest catalogue; disabled rows wait for supporting events.';
comment on table public.fridge_quest_assignments is 'Fridge-owned quest assignments with frozen targets and idempotent XP source keys.';
comment on function public.get_fridge_quests(text) is 'Reconciles and returns the current daily/weekly quest cards for one device fridge.';
comment on function public.reroll_weekly_quest(text) is 'Allows one eligible weekly quest replacement per local week.';

notify pgrst, 'reload schema';
