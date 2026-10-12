-- Arthur: NarIyirm
-- 中文：所有设备、库存、聊天和删除都使用本事务随机夹具，检查后完整回滚；不触碰现有用户数据。
-- EN: Devices, inventory, chats and erasure use random transaction-local fixtures and fully roll back, never touching existing user data.
begin;
do $$
declare
  a text := 'privacy_fixture_a_' || extensions.gen_random_uuid();
  b text := 'privacy_fixture_b_' || extensions.gen_random_uuid();
  c text := 'privacy_fixture_c_' || extensions.gen_random_uuid();
  f uuid; temporary_f uuid; category uuid := extensions.gen_random_uuid();
  a_batch uuid; b_batch uuid; a_event uuid;
  other_category uuid; recovery_code text := 'privacy_fixture_' || extensions.gen_random_uuid();
  expected_hash text; deletion jsonb;
begin
  f := public.authenticate_device(a, repeat('a',64));
  temporary_f := public.authenticate_device(b, repeat('b',64));
  perform public.configure_shared_fridge(a, 'Private fixture kitchen', recovery_code, now() + interval '1 day');
  perform public.join_shared_fridge(b, recovery_code);
  select category_uid into other_category from public.food_categories where fridge_uid=f and system_code='other';
  insert into public.food_categories(category_uid,fridge_uid,name,created_by_device_id,icon_path,icon_source)
    values(category,f,'Private fixture category',a,'categories/'||f||'/'||category||'/v1.png','ai_generated');
  insert into public.inventory_batches(fridge_uid,category_uid,created_by_device_id,name,storage_zone,initial_quantity,remaining_quantity,unit,purchase_price)
    values(f,category,a,'Owned fixture','pantry',2,2,'item',0) returning batch_uid into a_batch;
  insert into public.inventory_batches(fridge_uid,category_uid,created_by_device_id,name,storage_zone,initial_quantity,remaining_quantity,unit,purchase_price)
    values(f,category,b,'Other member fixture','pantry',3,3,'item',0) returning batch_uid into b_batch;
  insert into public.inventory_events(fridge_uid,batch_uid,actor_device_id,event_type,quantity_change)
    values(f,a_batch,a,'stock',2) returning event_uid into a_event;
  insert into public.inventory_events(fridge_uid,batch_uid,actor_device_id,event_type,quantity_change,note)
    values(f,b_batch,a,'adjust',-1,'Private contributor note');
  insert into public.fridge_xp_events(fridge_uid,source_event_uid,reason_code,points)
    values(f,a_event,'batch_consumed',8);
  insert into public.shopping_cart_items(fridge_uid,name,source,added_by_device_id,owner_device_id)
    values(f,'Owned list fixture','manual',a,a),(f,'Other list fixture','manual',b,b);
  insert into public.assistant_conversations(fridge_uid,creator_device_id,language,summary)
    values(f,a,'en','Private owner summary'),(f,b,'en','Other member summary');
  perform public.learning_room_action(a,'state');
  perform public.learning_room_action(b,'state');
  insert into public.device_privacy_choices(device_id,ai_allowed,consent_version) values(a,true,'2026-10-12');

  begin
    perform public.erase_device_data(a,repeat('f',64));
    raise exception 'TEST: wrong credential was accepted';
  exception when others then
    if sqlerrm <> 'invalid_device_credential' then raise; end if;
  end;
  if not exists(select 1 from public.devices where device_id=a) then raise exception 'TEST: invalid deletion mutated data'; end if;
  deletion := public.erase_device_data(a,repeat('a',64));
  if deletion->>'deleted' <> 'true' then raise exception 'TEST: missing deletion confirmation'; end if;
  if exists(select 1 from public.devices where device_id=a)
    or exists(select 1 from public.assistant_conversations where creator_device_id=a)
    or exists(select 1 from public.learning_learners where owner_device_id=a)
    or exists(select 1 from public.device_privacy_choices where device_id=a)
    or exists(select 1 from public.inventory_batches where batch_uid=a_batch)
    or exists(select 1 from public.shopping_cart_items where added_by_device_id=a)
    or exists(select 1 from public.food_categories where category_uid=category) then raise exception 'TEST: private records survived'; end if;
  if not exists(select 1 from public.inventory_batches where batch_uid=b_batch and remaining_quantity=3 and category_uid=other_category)
    or not exists(select 1 from public.shopping_cart_items where added_by_device_id=b)
    or not exists(select 1 from public.assistant_conversations where creator_device_id=b)
    or not exists(select 1 from public.learning_learners where owner_device_id=b)
    or not exists(select 1 from public.fridge_members where device_id=b and fridge_uid=f) then raise exception 'TEST: other member data damaged'; end if;
  if exists(select 1 from public.inventory_events where actor_device_id=a)
    or exists(select 1 from public.inventory_events where note='Private contributor note') then raise exception 'TEST: contributor identity survived'; end if;
  if not exists(select 1 from public.erasure_asset_queue where icon_path='categories/'||f||'/'||category||'/v1.png') then raise exception 'TEST: asset cleanup not queued'; end if;
  begin
    perform public.authenticate_device(a,repeat('a',64));
    raise exception 'TEST: erased identity recreated';
  exception when others then
    if sqlerrm <> 'device_identity_erased' then raise; end if;
  end;
  if public.authenticate_device(b,repeat('b',64)) <> f then raise exception 'TEST: other member auth failed'; end if;

  -- Arthur: NarIyirm
  -- 中文：覆盖今后真实恢复链，删除新持有人必须同时删除旧安装的私人会话且不把旧授权转移到新安装。
  -- EN: Exercise future recovery lineage; erasing the new holder must remove the predecessor's private chats without transferring old AI permission.
  perform public.authenticate_device(c,repeat('c',64));
  perform public.set_device_recovery_code(b, repeat('d',64));
  perform public.recover_device(c,repeat('c',64),repeat('d',64),repeat('e',64));
  if not exists(select 1 from public.device_identity_links where predecessor_id=b and successor_id=c) then raise exception 'TEST: recovery lineage missing'; end if;
  if exists(select 1 from public.device_privacy_choices where device_id=c and ai_allowed) then raise exception 'TEST: consent silently transferred'; end if;
  perform public.erase_device_data(c,repeat('c',64));
  if exists(select 1 from public.devices where device_id in(b,c))
    or exists(select 1 from public.assistant_conversations where creator_device_id=b) then raise exception 'TEST: predecessor data survived erasure'; end if;
end;
$$;
rollback;
select 'PASS: credential isolation, private erasure, shared preservation, bootstrap revocation, asset queue and recovery lineage (fully rolled back)' as result;
