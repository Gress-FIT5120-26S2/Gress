-- Arthur: NarIyirm
-- 中文：保留候选的分配规则不变，移除开发库 lint 发现的循环变量遮蔽和未使用结果。
-- EN: Keep the candidate-reservation rule while removing shadowed loop variables and an unused result found by development lint.
create or replace function public.reconcile_fridge_quest_slots(p_fridge_uid uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tz text; b record; kind text; desired int; eligible_count int; ex text[]; snapshot jsonb;
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
  for slot_no in 2..desired loop
   if not exists(select 1 from public.fridge_quest_assignments x where x.fridge_uid=p_fridge_uid and x.period_type=kind and x.period_start=b.period_start and x.slot_index=slot_no and x.status in('assigned','completed')) then
    select coalesce(array_agg(distinct x.quest_code),'{}'::text[]) into ex from public.fridge_quest_assignments x where x.fridge_uid=p_fridge_uid and x.period_type=kind and x.period_start=b.period_start;
    perform public.assign_quest_slot(p_fridge_uid,kind,b.period_start,b.period_end,tz,slot_no,ex,null);
   end if;
  end loop;
 end loop;
 perform public.reconcile_fridge_quests(p_fridge_uid);
end; $$;
