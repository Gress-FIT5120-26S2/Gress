-- Arthur: NarIyirm
-- 中文：随机设备与所有业务写入只存在于显式回滚事务，验证真实 RPC 而不留下生产测试记录。
-- EN: Keep random devices and all business writes inside an explicitly rolled-back transaction while exercising real RPCs.
begin;
set local statement_timeout='60s';
set local role service_role;
do $$
declare
  device text:='migration_verify_'||gen_random_uuid()::text;
  fridge uuid;
  batch public.inventory_batches;
  snapshot jsonb;
  event_id uuid;
  assignment uuid;
  previous_codes text[];
  replacement text;
  result jsonb;
  empty_fridge uuid;
begin
  fridge:=public.authenticate_device(device,repeat('a',64));
  if fridge is null then raise exception 'verification_bootstrap_failed'; end if;
  result:=public.get_fridge_quests(device);
  select array_agg(quest_code) into previous_codes from public.fridge_quest_assignments where fridge_uid=fridge and period_type='weekly';
  for iteration in 1..3 loop
    select assignment_uid into assignment from public.fridge_quest_assignments where fridge_uid=fridge and period_type='weekly' and status='assigned' order by slot_index limit 1;
    result:=public.reroll_quest(device,assignment);
    select quest_code into replacement from public.fridge_quest_assignments where fridge_uid=fridge and reroll_of_assignment_uid=assignment;
    if replacement is null or replacement=any(previous_codes) then raise exception 'verification_reroll_duplicate'; end if;
    previous_codes:=array_append(previous_codes,replacement);
  end loop;
  select assignment_uid into assignment from public.fridge_quest_assignments where fridge_uid=fridge and period_type='weekly' and status='assigned' order by slot_index limit 1;
  begin
    perform public.reroll_quest(device,assignment);
    raise exception 'verification_reroll_limit_missing';
  exception when raise_exception then
    if sqlerrm<>'quest_reroll_exhausted' then raise; end if;
  end;
  select * into batch from public.create_inventory_batch_v3(device,'other','Migration smoke item','pantry',2,'item',0,'user','best_before',now()+interval '7 days',3::smallint,false,null,null,null,'[{"material":"plastic_bottle","trigger":"per_unit"}]');
  select * into batch from public.adjust_inventory_batch_quantity(device,batch.batch_uid,1,batch.version);
  select event_uid,waste_profile_snapshot into event_id,snapshot from public.inventory_events where batch_uid=batch.batch_uid and event_type='consume';
  if snapshot is distinct from '[{"material":"plastic_bottle","trigger":"per_unit"}]'::jsonb then raise exception 'verification_waste_snapshot_failed'; end if;
  insert into public.waste_sorting_attempts(fridge_uid,event_uid,actor_device_id,question_code,selected_stream,correct_stream,component_key)
    values(fridge,event_id,device,'migration-smoke','recycling','recycling','component-1');
  begin
    insert into public.waste_sorting_attempts(fridge_uid,event_uid,actor_device_id,question_code,selected_stream,correct_stream,component_key)
      values(fridge,event_id,device,'migration-smoke','recycling','recycling','component-1');
    raise exception 'verification_waste_idempotency_missing';
  exception when unique_violation then null;
  end;
  result:=public.get_fridge_stage_report(device);
  if result is null then raise exception 'verification_stage_report_failed'; end if;
  begin
    perform public.learning_room_action(device,'state','{}',false);
    raise exception 'verification_course_draft_leaked';
  exception when raise_exception then
    if sqlerrm<>'content_unavailable' then raise; end if;
  end;
  begin
    perform public.learning_tutor_context(device,'{"kind":"general","contentVersion":"learning-room-v1"}',null,false);
    raise exception 'verification_tutor_draft_leaked';
  exception when raise_exception then
    if sqlerrm<>'tutor_content_unavailable' then raise; end if;
  end;
  result:=public.learning_tutor_action(device,'preferences','{}',false);
  if result->>'dwellHintsEnabled'<>'false' then raise exception 'verification_tutor_preferences_failed'; end if;
  empty_fridge:=public.authenticate_device('migration_verify_'||gen_random_uuid()::text,repeat('b',64));
  delete from public.fridges where fridge_uid=empty_fridge;
  if exists(select 1 from public.fridge_sync_versions where fridge_uid=empty_fridge) then raise exception 'verification_deleted_fridge_sync'; end if;
end $$;
rollback;
select 'passed; all fixture writes rolled back' as verification;
