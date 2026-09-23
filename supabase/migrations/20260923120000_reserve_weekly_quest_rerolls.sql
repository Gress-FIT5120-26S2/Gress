-- Arthur: NarIyirm
-- 中文：为每周任务保留三次真正不同的更换选择，并给已分配满槽位的本周补充基础候选。
-- EN: Reserve three distinct weekly rerolls and add basic candidates for weeks whose slots are already full.

insert into public.quest_definitions (
  code, period_type, category, title_key, description_key, reward_xp,
  default_target, target_formula, min_target, max_target, eligibility_key,
  rule_version, sort_order, is_enabled, is_reminder_only
)
values
  ('weekly_use_one','weekly','outcome','quests.weeklyUseOne.title','quests.weeklyUseOne.description',8,1,'fixed_one',1,1,'always',1,300,true,false),
  ('weekly_use_two','weekly','outcome','quests.weeklyUseTwo.title','quests.weeklyUseTwo.description',12,2,'fixed_one',2,2,'always',1,310,true,false),
  ('weekly_finish_one','weekly','outcome','quests.weeklyFinishOne.title','quests.weeklyFinishOne.description',10,1,'fixed_one',1,1,'always',1,320,true,false),
  ('weekly_two_day_rhythm','weekly','organisation','quests.weeklyTwoDayRhythm.title','quests.weeklyTwoDayRhythm.description',15,2,'fixed_one',2,2,'always',1,330,true,false);

create or replace function public.quest_is_eligible(p_eligibility_key text,p_snapshot jsonb)
returns boolean language sql immutable set search_path='' as $$
 select case p_eligibility_key
  when 'always' then true
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
-- 中文：新周任务只统计分配或更换后的事件，其他任务继续走原有进度计算。
-- EN: New weekly quests count events after assignment or reroll; existing quests keep their current evaluator.
create function public.evaluate_quest_progress_with_weekly_basics(p_fridge_uid uuid,p_quest_code text,p_period_start timestamptz,p_period_end timestamptz,p_time_zone text)
returns numeric language plpgsql stable set search_path='' as $$
declare v numeric;
begin
 if p_quest_code in ('weekly_use_one','weekly_use_two') then
  select count(distinct e.batch_uid)::numeric into v from public.inventory_events e
   where e.fridge_uid=p_fridge_uid and e.event_type='consume' and e.quantity_change<0
    and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code='weekly_finish_one' then
  select count(distinct e.batch_uid)::numeric into v from public.inventory_events e
   join public.inventory_batches b on b.batch_uid=e.batch_uid
   where e.fridge_uid=p_fridge_uid and e.event_type='consume' and b.lifecycle_state='consumed'
    and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 elsif p_quest_code='weekly_two_day_rhythm' then
  select count(distinct date_trunc('day',e.occurred_at at time zone p_time_zone)::date)::numeric into v
   from public.inventory_events e where e.fridge_uid=p_fridge_uid and e.event_type in('consume','discard')
    and e.occurred_at>=p_period_start and e.occurred_at<p_period_end;
 else
  return public.evaluate_quest_progress(p_fridge_uid,p_quest_code,p_period_start,p_period_end,p_time_zone);
 end if;
 return coalesce(v,0);
end; $$;

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
  value:=least(public.evaluate_quest_progress_with_weekly_basics(p_fridge_uid,qrow.quest_code,qrow.effective_start_at,qrow.period_end,qrow.time_zone),qrow.target::numeric);
  update public.fridge_quest_assignments set progress=value,updated_at=now(),status=case when value>=target then 'completed' else status end,completed_at=case when value>=target then coalesce(completed_at,now()) else completed_at end where assignment_uid=qrow.assignment_uid;
  if value>=qrow.target and qrow.reward_xp>0 then
   insert into public.fridge_xp_events(fridge_uid,source_key,reason_code,points,metadata) values(p_fridge_uid,qrow.source_key,'quest_completed',qrow.reward_xp,jsonb_build_object('assignmentUid',qrow.assignment_uid,'questCode',qrow.quest_code,'periodType',qrow.period_type,'slotIndex',qrow.slot_index,'ruleVersion',qrow.rule_version)) on conflict do nothing;
  end if;
 end loop;
 update public.fridges f set achievement_peak_xp=greatest(f.achievement_peak_xp,coalesce((select sum(x.points) from public.fridge_xp_events x where x.fridge_uid=p_fridge_uid),0)) where f.fridge_uid=p_fridge_uid;
end; $$;

-- Arthur: NarIyirm
-- 中文：每周活跃槽位最多占用符合资格的候选总数减三；已分配的任务不撤销。
-- EN: Weekly active slots use at most the eligible pool minus three; existing assignments stay intact.
create or replace function public.reconcile_fridge_quest_slots(p_fridge_uid uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tz text; b record; kind text; desired int; eligible_count int; n int; ex text[]; a public.fridge_quest_assignments; snapshot jsonb;
begin
 select time_zone into tz from public.fridges where fridge_uid=p_fridge_uid; if tz is null then return; end if;
 perform public.reconcile_fridge_quests(p_fridge_uid);
 foreach kind in array array['daily','weekly'] loop
  select * into b from public.quest_period_bounds(tz,kind);
  snapshot:=public.quest_eligibility_snapshot(p_fridge_uid,tz);
  desired:=case when kind='daily' then case when (snapshot->>'activeSafeBatches')::int>=6 then 3 else 2 end else case when (snapshot->>'activeSafeBatches')::int>=10 then 9 when (snapshot->>'activeSafeBatches')::int>=6 then 8 else 7 end end;
  if kind='weekly' then
   select count(*)::int into eligible_count from public.quest_definitions q
    where q.period_type='weekly' and q.is_enabled and public.quest_is_eligible(q.eligibility_key,snapshot);
   desired:=least(desired,greatest(1,eligible_count-3));
  end if;
  for n in 2..desired loop
   if not exists(select 1 from public.fridge_quest_assignments x where x.fridge_uid=p_fridge_uid and x.period_type=kind and x.period_start=b.period_start and x.slot_index=n and x.status in('assigned','completed')) then
    select coalesce(array_agg(distinct x.quest_code),'{}'::text[]) into ex from public.fridge_quest_assignments x where x.fridge_uid=p_fridge_uid and x.period_type=kind and x.period_start=b.period_start;
    a:=public.assign_quest_slot(p_fridge_uid,kind,b.period_start,b.period_end,tz,n,ex,null);
   end if;
  end loop;
 end loop;
 perform public.reconcile_fridge_quests(p_fridge_uid);
end; $$;

revoke execute on function public.evaluate_quest_progress_with_weekly_basics(uuid,text,timestamptz,timestamptz,text) from public,anon,authenticated;
notify pgrst,'reload schema';
