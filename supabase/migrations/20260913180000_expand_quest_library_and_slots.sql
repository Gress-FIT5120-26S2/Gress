-- Arthur: NarIyirm
-- 中文：扩展可由现有库存流水准确计算的任务库，并为多任务槽位与三次更换保留权威字段。
-- EN: Expand the event-backed quest library and add authoritative fields for multiple slots and three rerolls.

alter table public.fridge_quest_assignments
  add column if not exists slot_index smallint not null default 1,
  add column if not exists effective_start_at timestamptz;

update public.fridge_quest_assignments
set effective_start_at = period_start
where effective_start_at is null;

alter table public.fridge_quest_assignments
  alter column effective_start_at set not null,
  alter column effective_start_at set default now();

drop index if exists public.fridge_quest_assignments_active_period_unique;
create unique index fridge_quest_assignments_active_slot_unique
  on public.fridge_quest_assignments (fridge_uid, period_type, period_start, slot_index)
  where status in ('assigned', 'completed');

insert into public.quest_definitions (
  code, period_type, category, title_key, description_key, reward_xp,
  default_target, target_formula, min_target, max_target, eligibility_key,
  rule_version, sort_order, is_enabled, is_reminder_only
)
values
  ('use_oldest_first','daily','outcome','quests.useOldestFirst.title','quests.useOldestFirst.description',8,1,'fixed_one',1,1,'safe_active_batch',2,50,true,false),
  ('use_earliest_first','daily','outcome','quests.useEarliestFirst.title','quests.useEarliestFirst.description',8,1,'fixed_one',1,1,'dated_batch',2,60,true,false),
  ('finish_opened','daily','outcome','quests.finishOpened.title','quests.finishOpened.description',10,1,'fixed_one',1,1,'opened_batch',2,70,true,false),
  ('use_two_items','daily','outcome','quests.useTwoItems.title','quests.useTwoItems.description',10,2,'fixed_one',2,2,'active_batches_2',2,80,true,false),
  ('use_two_categories','daily','organisation','quests.useTwoCategories.title','quests.useTwoCategories.description',10,2,'fixed_one',2,2,'categories_2',2,90,true,false),
  ('use_chilled','daily','organisation','quests.useChilled.title','quests.useChilled.description',5,1,'fixed_one',1,1,'chilled_batch',2,100,true,false),
  ('use_frozen','daily','organisation','quests.useFrozen.title','quests.useFrozen.description',5,1,'fixed_one',1,1,'frozen_batch',2,110,true,false),
  ('use_pantry','daily','organisation','quests.usePantry.title','quests.usePantry.description',5,1,'fixed_one',1,1,'pantry_batch',2,120,true,false),
  ('use_two_warning_items','daily','outcome','quests.useTwoWarningItems.title','quests.useTwoWarningItems.description',15,2,'fixed_one',2,2,'warning_window_batches_2',2,130,true,false),
  ('use_three_items','daily','outcome','quests.useThreeItems.title','quests.useThreeItems.description',15,3,'fixed_one',3,3,'active_batches_3',2,140,true,false),
  ('five_day_rhythm','weekly','organisation','quests.fiveDayRhythm.title','quests.fiveDayRhythm.description',30,5,'fixed_one',5,5,'recent_active_day',2,190,true,false),
  ('finish_three','weekly','outcome','quests.finishThree.title','quests.finishThree.description',20,3,'fixed_one',3,3,'active_batches_3',2,200,true,false),
  ('finish_opened_two','weekly','outcome','quests.finishOpenedTwo.title','quests.finishOpenedTwo.description',20,2,'fixed_one',2,2,'opened_batches_2',2,210,true,false),
  ('oldest_first_three','weekly','outcome','quests.oldestFirstThree.title','quests.oldestFirstThree.description',20,3,'fixed_one',3,3,'active_batches_5',2,220,true,false),
  ('three_categories_week','weekly','organisation','quests.threeCategoriesWeek.title','quests.threeCategoriesWeek.description',15,3,'fixed_one',3,3,'categories_3',2,230,true,false),
  ('two_zones_week','weekly','organisation','quests.twoZonesWeek.title','quests.twoZonesWeek.description',15,2,'fixed_one',2,2,'zones_2',2,240,true,false),
  ('quantity_care_week','weekly','organisation','quests.quantityCareWeek.title','quests.quantityCareWeek.description',15,4,'fixed_one',4,4,'known_quantity_batches_4',2,250,true,false),
  ('warning_clearance_week','weekly','outcome','quests.warningClearanceWeek.title','quests.warningClearanceWeek.description',30,2,'weekly_rescue',1,5,'warning_window_batches_2',2,260,true,false),
  ('low_waste_week','weekly','outcome','quests.lowWasteWeek.title','quests.lowWasteWeek.description',25,1,'fixed_one',1,1,'active_batches_3',2,270,true,false),
  ('shared_kitchen_relay','weekly','organisation','quests.sharedKitchenRelay.title','quests.sharedKitchenRelay.description',20,2,'fixed_one',2,2,'members_2',2,280,true,false),
  ('rescue_two_days','weekly','outcome','quests.rescueTwoDays.title','quests.rescueTwoDays.description',25,2,'fixed_one',2,2,'warning_window_batches_2',2,290,true,false)
on conflict (code) do update set
  title_key=excluded.title_key, description_key=excluded.description_key,
  reward_xp=excluded.reward_xp, default_target=excluded.default_target,
  target_formula=excluded.target_formula, min_target=excluded.min_target,
  max_target=excluded.max_target, eligibility_key=excluded.eligibility_key,
  rule_version=excluded.rule_version, sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled, is_reminder_only=excluded.is_reminder_only;

-- Arthur: NarIyirm
-- 中文：把任务资格冻结为分配时快照，避免向用户发放当前库存无法完成的任务。
-- EN: Freeze eligibility at assignment time so users are not offered quests their current inventory cannot complete.
create or replace function public.quest_eligibility_snapshot(p_fridge_uid uuid, p_time_zone text)
returns jsonb language plpgsql stable set search_path='' as $$
declare a int; w int; q int; d int; o int; c int; z int; m int; ad int; chilled int; frozen int; pantry int; pc numeric;
begin
  select count(*)::int,
         count(*) filter(where coalesce(b.use_by_at,b.best_before_at,b.estimated_quality_until,b.expires_at) is not null)::int,
         count(*) filter(where b.opened_at is not null)::int,
         count(*) filter(where b.initial_quantity is not null and b.initial_quantity>0)::int,
         count(distinct b.storage_zone)::int
    into a,d,o,q,z
  from public.inventory_batches b where b.fridge_uid=p_fridge_uid and b.lifecycle_state='active';
  select count(*)::int into w from public.inventory_batches b where b.fridge_uid=p_fridge_uid and b.lifecycle_state='active'
    and coalesce(b.use_by_at,b.best_before_at,b.estimated_quality_until,b.expires_at) between now() and now()+make_interval(days=>greatest(coalesce(b.expiry_warning_days,3),0));
  select count(distinct b.category_uid)::int into c from public.inventory_batches b
    where b.fridge_uid=p_fridge_uid and b.lifecycle_state='active';
  select count(*) filter(where b.storage_zone='chilled')::int,count(*) filter(where b.storage_zone='frozen')::int,count(*) filter(where b.storage_zone='pantry')::int
    into chilled,frozen,pantry from public.inventory_batches b where b.fridge_uid=p_fridge_uid and b.lifecycle_state='active';
  select count(*)::int into m from public.fridge_members fm where fm.fridge_uid=p_fridge_uid;
  select count(distinct date_trunc('day',e.occurred_at at time zone p_time_zone)::date)::int into ad
    from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.occurred_at>=now()-interval '28 days' and e.event_type in('consume','discard','stock');
  select case when count(*) filter(where b.lifecycle_state in('consumed','discarded'))=0 then null else
    count(*) filter(where b.lifecycle_state in('consumed','discarded') and b.price_status in('recorded','free'))::numeric /
    nullif(count(*) filter(where b.lifecycle_state in('consumed','discarded')),0) end into pc
  from public.inventory_batches b where b.fridge_uid=p_fridge_uid;
  return jsonb_build_object('activeSafeBatches',coalesce(a,0),'warningWindowBatches',coalesce(w,0),'knownQuantityBatches',coalesce(q,0),
    'datedBatches',coalesce(d,0),'openedBatches',coalesce(o,0),'categoryCount',coalesce(c,0),'zoneCount',coalesce(z,0),
    'chilledBatches',coalesce(chilled,0),'frozenBatches',coalesce(frozen,0),'pantryBatches',coalesce(pantry,0),
    'memberCount',coalesce(m,0),'activeDays28',coalesce(ad,0),'priceCoverageRate',pc,'capturedAt',now());
end; $$;

create or replace function public.quest_is_eligible(p_eligibility_key text,p_snapshot jsonb)
returns boolean language sql immutable set search_path='' as $$
 select case p_eligibility_key
  when 'safe_active_batch' then coalesce((p_snapshot->>'activeSafeBatches')::int,0)>=1
  when 'warning_window_batch' then coalesce((p_snapshot->>'warningWindowBatches')::int,0)>=1
  when 'known_quantity_batch' then coalesce((p_snapshot->>'knownQuantityBatches')::int,0)>=1
  when 'warning_window_batches_2' then coalesce((p_snapshot->>'warningWindowBatches')::int,0)>=2
  when 'safe_active_batches_4' then coalesce((p_snapshot->>'activeSafeBatches')::int,0)>=4
  when 'recent_active_day' then coalesce((p_snapshot->>'activeDays28')::int,0)>=1
  when 'price_coverage_80' then coalesce((p_snapshot->>'priceCoverageRate')::numeric,0)>=.8
  when 'resolvable_batches_6' then coalesce((p_snapshot->>'activeSafeBatches')::int,0)>=6
  when 'dated_batch' then coalesce((p_snapshot->>'datedBatches')::int,0)>=1
  when 'opened_batch' then coalesce((p_snapshot->>'openedBatches')::int,0)>=1
  when 'opened_batches_2' then coalesce((p_snapshot->>'openedBatches')::int,0)>=2
  when 'active_batches_2' then coalesce((p_snapshot->>'activeSafeBatches')::int,0)>=2
  when 'active_batches_3' then coalesce((p_snapshot->>'activeSafeBatches')::int,0)>=3
  when 'active_batches_5' then coalesce((p_snapshot->>'activeSafeBatches')::int,0)>=5
  when 'categories_2' then coalesce((p_snapshot->>'categoryCount')::int,0)>=2
  when 'categories_3' then coalesce((p_snapshot->>'categoryCount')::int,0)>=3
  when 'zones_2' then coalesce((p_snapshot->>'zoneCount')::int,0)>=2
  when 'known_quantity_batches_4' then coalesce((p_snapshot->>'knownQuantityBatches')::int,0)>=4
  when 'members_2' then coalesce((p_snapshot->>'memberCount')::int,0)>=2
  when 'chilled_batch' then coalesce((p_snapshot->>'chilledBatches')::int,0)>=1
  when 'frozen_batch' then coalesce((p_snapshot->>'frozenBatches')::int,0)>=1
  when 'pantry_batch' then coalesce((p_snapshot->>'pantryBatches')::int,0)>=1
  else false end;
$$;

-- Arthur: NarIyirm
-- 中文：同一事件流水驱动全部新任务，刷新任务不会改变事实数据或重复发放经验。
-- EN: Drive every new quest from the same event ledger; rerolling never changes facts or duplicates XP.
create or replace function public.evaluate_quest_progress(p_fridge_uid uuid,p_quest_code text,p_period_start timestamptz,p_period_end timestamptz,p_time_zone text)
returns numeric language plpgsql stable set search_path='' as $$
declare v numeric:=0;
begin
 if p_quest_code in('use_it_today','use_oldest_first','use_earliest_first','use_two_items','use_three_items','use_four_in_time') then
  select count(distinct e.batch_uid) into v from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.event_type='consume' and e.quantity_change<0 and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code in('rescue_one','rescue_the_week','warning_clearance_week') then
  select count(distinct e.batch_uid) into v from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.event_type='consume' and e.was_in_warning_window and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code='rescue_two_days' then
  select count(distinct date_trunc('day',e.occurred_at at time zone p_time_zone)::date) into v from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.event_type='consume' and e.was_in_warning_window and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code in('finish_one_in_time','finish_three') then
  select count(distinct e.batch_uid) into v from public.inventory_events e join public.inventory_batches b on b.batch_uid=e.batch_uid where e.fridge_uid=p_fridge_uid and e.event_type='consume' and b.lifecycle_state='consumed' and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code in('finish_opened','finish_opened_two') then
  select count(distinct e.batch_uid) into v from public.inventory_events e join public.inventory_batches b on b.batch_uid=e.batch_uid where e.fridge_uid=p_fridge_uid and e.event_type='consume' and b.opened_at is not null and b.lifecycle_state='consumed' and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code in('update_after_use','quantity_care_week') then
  select count(distinct e.batch_uid) into v from public.inventory_events e join public.inventory_batches b on b.batch_uid=e.batch_uid where e.fridge_uid=p_fridge_uid and e.event_type='consume' and b.initial_quantity is not null and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code in('three_day_rhythm','five_day_rhythm') then
  select count(distinct date_trunc('day',e.occurred_at at time zone p_time_zone)::date) into v from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.event_type in('consume','discard') and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code in('use_two_categories','three_categories_week') then
  select count(distinct b.category_uid) into v from public.inventory_events e join public.inventory_batches b on b.batch_uid=e.batch_uid where e.fridge_uid=p_fridge_uid and e.event_type='consume' and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code='two_zones_week' then
  select count(distinct b.storage_zone) into v from public.inventory_events e join public.inventory_batches b on b.batch_uid=e.batch_uid where e.fridge_uid=p_fridge_uid and e.event_type='consume' and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code in('use_chilled','use_frozen','use_pantry') then
  select count(distinct e.batch_uid) into v from public.inventory_events e join public.inventory_batches b on b.batch_uid=e.batch_uid where e.fridge_uid=p_fridge_uid and e.event_type='consume' and b.storage_zone::text=case p_quest_code when 'use_chilled' then 'chilled' when 'use_frozen' then 'frozen' else 'pantry' end and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code='use_two_warning_items' then
  select count(distinct e.batch_uid) into v from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.event_type='consume' and e.was_in_warning_window and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code='shared_kitchen_relay' then
  select count(distinct e.actor_device_id) into v from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.event_type='consume' and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code='know_the_outcome' then
  select count(distinct e.batch_uid) into v from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.event_type in('consume','discard') and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code='low_waste_week' then
  select case when count(*) filter(where e.event_type in('consume','discard'))>=3 and count(*) filter(where e.event_type='discard')=0 then 1 else 0 end into v from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code='strong_utilisation_week' then
  select case when count(*) filter(where e.event_type in('consume','discard'))>=4 and count(*) filter(where e.event_type='consume')::numeric/nullif(count(*) filter(where e.event_type in('consume','discard')),0)>=.75 then 1 else 0 end into v from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 end if;
 return coalesce(v,0);
end; $$;

create or replace function public.assign_quest_slot(p_fridge_uid uuid,p_period_type text,p_period_start timestamptz,p_period_end timestamptz,p_time_zone text,p_slot_index int,p_exclude_codes text[] default '{}'::text[],p_reroll_of uuid default null)
returns public.fridge_quest_assignments language plpgsql security definer set search_path='' as $$
declare s jsonb; d public.quest_definitions; r public.fridge_quest_assignments; t int;
begin
 s:=public.quest_eligibility_snapshot(p_fridge_uid,p_time_zone);
 select q.* into d from public.quest_definitions q where q.period_type=p_period_type and q.is_enabled and not(q.code=any(p_exclude_codes)) and public.quest_is_eligible(q.eligibility_key,s) order by random() limit 1;
 if d.quest_uid is null then return null; end if;
 t:=public.quest_freeze_target(d.target_formula,d.default_target,d.min_target,d.max_target,s);
 insert into public.fridge_quest_assignments(fridge_uid,quest_uid,quest_code,period_type,period_start,period_end,effective_start_at,time_zone,slot_index,target,progress,reward_xp,eligibility_snapshot,status,rule_version,source_key,reroll_of_assignment_uid)
 values(p_fridge_uid,d.quest_uid,d.code,p_period_type,p_period_start,p_period_end,now(),p_time_zone,p_slot_index,t,0,d.reward_xp,s,'assigned',d.rule_version,'quest:'||extensions.gen_random_uuid()::text,p_reroll_of) returning * into r;
 return r;
end; $$;

create or replace function public.reconcile_fridge_quest_slots(p_fridge_uid uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tz text; b record; kind text; desired int; n int; ex text[]; a public.fridge_quest_assignments;
begin
 select time_zone into tz from public.fridges where fridge_uid=p_fridge_uid; if tz is null then return; end if;
 perform public.reconcile_fridge_quests(p_fridge_uid);
 foreach kind in array array['daily','weekly'] loop
  select * into b from public.quest_period_bounds(tz,kind);
  desired:=case when kind='daily' then case when (public.quest_eligibility_snapshot(p_fridge_uid,tz)->>'activeSafeBatches')::int>=6 then 3 else 2 end else case when (public.quest_eligibility_snapshot(p_fridge_uid,tz)->>'activeSafeBatches')::int>=10 then 9 when (public.quest_eligibility_snapshot(p_fridge_uid,tz)->>'activeSafeBatches')::int>=6 then 8 else 7 end end;
  for n in 2..desired loop
   if not exists(select 1 from public.fridge_quest_assignments x where x.fridge_uid=p_fridge_uid and x.period_type=kind and x.period_start=b.period_start and x.slot_index=n and x.status in('assigned','completed')) then
    select coalesce(array_agg(distinct x.quest_code),'{}'::text[]) into ex from public.fridge_quest_assignments x where x.fridge_uid=p_fridge_uid and x.period_type=kind and x.period_start=b.period_start;
    a:=public.assign_quest_slot(p_fridge_uid,kind,b.period_start,b.period_end,tz,n,ex,null);
   end if;
  end loop;
 end loop;
 perform public.reconcile_fridge_quests(p_fridge_uid);
end; $$;

-- Arthur: NarIyirm
-- 中文：更换后的任务仅统计确认后的事件；所有槽位仍通过唯一 source_key 幂等发放完成经验。
-- EN: Rerolled quests count only post-confirmation events while every slot awards completion XP idempotently through its unique source key.
create or replace function public.reconcile_fridge_quests(p_fridge_uid uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tz text; b record; kind text; qrow public.fridge_quest_assignments; ex text[]; value numeric;
begin
 select time_zone into tz from public.fridges where fridge_uid=p_fridge_uid; if tz is null then return; end if;
 update public.fridge_quest_assignments set status='expired',updated_at=now() where fridge_uid=p_fridge_uid and status='assigned' and period_end<=now();
 foreach kind in array array['daily','weekly'] loop
  select * into b from public.quest_period_bounds(tz,kind);
  if not exists(select 1 from public.fridge_quest_assignments x where x.fridge_uid=p_fridge_uid and x.period_type=kind and x.period_start=b.period_start and x.slot_index=1 and x.status in('assigned','completed')) then
   select coalesce(array_agg(distinct x.quest_code),'{}'::text[]) into ex from public.fridge_quest_assignments x where x.fridge_uid=p_fridge_uid and x.period_type=kind and x.period_start=b.period_start;
   qrow:=public.assign_quest_slot(p_fridge_uid,kind,b.period_start,b.period_end,tz,1,ex,null);
  end if;
 end loop;
 for qrow in select * from public.fridge_quest_assignments x where x.fridge_uid=p_fridge_uid and x.status='assigned' and x.period_end>now() loop
  value:=least(public.evaluate_quest_progress(p_fridge_uid,qrow.quest_code,qrow.effective_start_at,qrow.period_end,qrow.time_zone),qrow.target::numeric);
  update public.fridge_quest_assignments set progress=value,updated_at=now(),status=case when value>=target then 'completed' else status end,completed_at=case when value>=target then coalesce(completed_at,now()) else completed_at end where assignment_uid=qrow.assignment_uid;
  if value>=qrow.target and qrow.reward_xp>0 then
   insert into public.fridge_xp_events(fridge_uid,source_key,reason_code,points,metadata) values(p_fridge_uid,qrow.source_key,'quest_completed',qrow.reward_xp,jsonb_build_object('assignmentUid',qrow.assignment_uid,'questCode',qrow.quest_code,'periodType',qrow.period_type,'slotIndex',qrow.slot_index,'ruleVersion',qrow.rule_version)) on conflict do nothing;
  end if;
 end loop;
 update public.fridges f set achievement_peak_xp=greatest(f.achievement_peak_xp,coalesce((select sum(x.points) from public.fridge_xp_events x where x.fridge_uid=p_fridge_uid),0)) where f.fridge_uid=p_fridge_uid;
end; $$;

create or replace function public.quest_assignment_json(p_assignment public.fridge_quest_assignments)
returns jsonb language sql stable set search_path='' as $$
  select case when p_assignment.assignment_uid is null then null else jsonb_build_object(
    'assignmentUid',p_assignment.assignment_uid,'questCode',p_assignment.quest_code,
    'periodType',p_assignment.period_type,'titleKey',d.title_key,'descriptionKey',d.description_key,
    'category',d.category,'target',p_assignment.target,'progressCurrent',p_assignment.progress,
    'progressTarget',p_assignment.target,'rewardXp',p_assignment.reward_xp,
    'isReminderOnly',d.is_reminder_only,'status',p_assignment.status,
    'periodStart',p_assignment.period_start,'periodEnd',p_assignment.period_end,
    'effectiveStartAt',p_assignment.effective_start_at,'timeZone',p_assignment.time_zone,
    'completedAt',p_assignment.completed_at,'ruleVersion',p_assignment.rule_version,
    'slotIndex',p_assignment.slot_index,'canReroll',p_assignment.status='assigned'
  ) end
  from public.quest_definitions d where d.quest_uid=p_assignment.quest_uid;
$$;

-- Arthur: NarIyirm
-- 中文：多槽位读取保持 daily/weekly 首项兼容旧客户端，新客户端读取数组和独立更换额度。
-- EN: Multi-slot reads retain the legacy daily/weekly first item while new clients consume arrays and separate reroll quotas.
create or replace function public.get_fridge_quests(p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid; tz text; db record; wb record; ds jsonb; ws jsonb; dr int; wr int;
begin
  f:=public.bootstrap_device(p_device_id);
  select time_zone into tz from public.fridges where fridge_uid=f;
  perform public.reconcile_fridge_quest_slots(f);
  select * into db from public.quest_period_bounds(tz,'daily');
  select * into wb from public.quest_period_bounds(tz,'weekly');
  select coalesce(jsonb_agg(public.quest_assignment_json(x) order by x.slot_index),'[]'::jsonb) into ds
    from public.fridge_quest_assignments x where x.fridge_uid=f and x.period_type='daily' and x.period_start=db.period_start and x.status in('assigned','completed');
  select coalesce(jsonb_agg(public.quest_assignment_json(x) order by x.slot_index),'[]'::jsonb) into ws
    from public.fridge_quest_assignments x where x.fridge_uid=f and x.period_type='weekly' and x.period_start=wb.period_start and x.status in('assigned','completed');
  select count(*) into dr from public.fridge_quest_assignments x where x.fridge_uid=f and x.period_type='daily' and x.period_start=db.period_start and x.status='rerolled';
  select count(*) into wr from public.fridge_quest_assignments x where x.fridge_uid=f and x.period_type='weekly' and x.period_start=wb.period_start and x.status='rerolled';
  return jsonb_build_object('dailyAssignments',ds,'weeklyAssignments',ws,'daily',ds->0,'weekly',ws->0,'dailyRerollsRemaining',greatest(0,3-dr),'weeklyRerollsRemaining',greatest(0,3-wr),'updatedAt',now());
end;
$$;

-- Arthur: NarIyirm
-- 中文：每日和每周共享三次更换额度；新任务继承原槽位并从确认时开始计数。
-- EN: Daily and weekly quests each share three rerolls; replacements keep the slot and count from confirmation time.
create or replace function public.reroll_quest(p_device_id text,p_assignment_uid uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid; old public.fridge_quest_assignments; used int; ex text[]; replacement public.fridge_quest_assignments;
begin
 f:=public.bootstrap_device(p_device_id);
 perform public.reconcile_fridge_quest_slots(f);
 select * into old from public.fridge_quest_assignments where assignment_uid=p_assignment_uid and fridge_uid=f and status='assigned' for update;
 if old.assignment_uid is null then raise exception 'quest_not_rerollable' using errcode='P0001'; end if;
 select count(*)::int into used from public.fridge_quest_assignments where fridge_uid=f and period_type=old.period_type and period_start=old.period_start and status='rerolled';
 if used>=3 then raise exception 'quest_reroll_exhausted' using errcode='P0001'; end if;
 select coalesce(array_agg(distinct quest_code),'{}'::text[]) into ex from public.fridge_quest_assignments
   where fridge_uid=f and period_type=old.period_type and period_start=old.period_start;
 update public.fridge_quest_assignments set status='rerolled',updated_at=now() where assignment_uid=old.assignment_uid;
 replacement:=public.assign_quest_slot(f,old.period_type,old.period_start,old.period_end,old.time_zone,old.slot_index,ex,old.assignment_uid);
 if replacement.assignment_uid is null then
  update public.fridge_quest_assignments set status='assigned',updated_at=now() where assignment_uid=old.assignment_uid;
  raise exception 'quest_reroll_unavailable' using errcode='P0001';
 end if;
 return public.get_fridge_quests(p_device_id);
end; $$;

revoke execute on function public.reconcile_fridge_quest_slots(uuid) from public,anon,authenticated;
revoke execute on function public.assign_quest_slot(uuid,text,timestamptz,timestamptz,text,int,text[],uuid) from public,anon,authenticated;
revoke execute on function public.reroll_quest(text,uuid) from public,anon,authenticated;
grant execute on function public.reroll_quest(text,uuid) to service_role;
comment on function public.reroll_quest(text,uuid) is 'Rerolls one assigned quest slot with a no-repeat eligible replacement, up to three times per period type.';

notify pgrst,'reload schema';
