-- Arthur: NarIyirm
-- 中文：匿名设备同样需要明确的 AI 授权和真正的数据删除；指纹表仅阻止已删除身份被迟到请求重新创建，不保留原 ID 或凭证。
-- EN: Anonymous devices need explicit AI permission and real erasure; fingerprints prevent late requests from recreating erased identities without retaining IDs or credentials.
create table public.device_privacy_choices (
  device_id text primary key references public.devices(device_id) on update cascade on delete cascade,
  ai_allowed boolean not null default false,
  consent_version text not null check (consent_version = '2026-10-12'),
  updated_at timestamptz not null default now()
);
create table public.erased_device_fingerprints (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{64}$')
);
create table public.erasure_asset_queue (
  icon_path text primary key check (icon_path ~ '^categories/[0-9a-f-]+/[0-9a-f-]+/v[0-9]+\.png$'),
  queued_at timestamptz not null default now()
);
alter table public.device_privacy_choices enable row level security;
alter table public.erased_device_fingerprints enable row level security;
alter table public.erasure_asset_queue enable row level security;
revoke all on public.device_privacy_choices, public.erased_device_fingerprints from public, anon, authenticated;
revoke all on public.erasure_asset_queue from public, anon, authenticated;
grant select, insert, update, delete on public.device_privacy_choices to service_role;
grant select on public.erased_device_fingerprints to service_role;
grant select, delete on public.erasure_asset_queue to service_role;

-- Arthur: NarIyirm
-- 中文：记录今后的身份恢复链，让当前持有人删除时也清理已撤销旧安装的私人记录；不猜测历史设备之间的关系。
-- EN: Record future recovery lineage so the current holder can erase revoked predecessors' private records; never guess relationships between historical devices.
create table public.device_identity_links (
  predecessor_id text primary key references public.devices(device_id) on delete cascade,
  successor_id text not null references public.devices(device_id) on delete cascade,
  check (predecessor_id <> successor_id)
);
alter table public.device_identity_links enable row level security;
revoke all on public.device_identity_links from public, anon, authenticated, service_role;
create function public.record_device_recovery_lineage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.device_id <> new.device_id then
    insert into public.device_identity_links(predecessor_id, successor_id)
      values(old.device_id, new.device_id) on conflict (predecessor_id) do update set successor_id = excluded.successor_id;
  end if;
  return new;
end;
$$;
create trigger fridge_members_recovery_lineage after update of device_id on public.fridge_members
for each row execute function public.record_device_recovery_lineage();
revoke all on function public.record_device_recovery_lineage() from public, anon, authenticated, service_role;

create function public.prevent_erased_device_bootstrap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('privacy:' || new.device_id, 0));
  if exists (select 1 from public.erased_device_fingerprints
    where fingerprint = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(new.device_id, 'UTF8')), 'hex')) then
    raise exception 'device_identity_erased';
  end if;
  return new;
end;
$$;
create trigger devices_prevent_erased_bootstrap before insert on public.devices
for each row execute function public.prevent_erased_device_bootstrap();
revoke all on function public.prevent_erased_device_bootstrap() from public, anon, authenticated, service_role;

-- Arthur: NarIyirm
-- 中文：保留其他成员的共享容器和无身份统计，允许删除者的原始作者关联完全移除；其本人输入的内容由删除 RPC 清除。
-- EN: Preserve other members' containers and anonymous statistics while removing the erased creator link; the RPC removes that person's contributed content.
alter table public.fridges alter column created_by_device_id drop not null;
alter table public.food_categories alter column created_by_device_id drop not null;
alter table public.inventory_events alter column actor_device_id drop not null;
alter table public.fridges drop constraint fridges_created_by_device_id_fkey;
alter table public.fridges add constraint fridges_created_by_device_id_fkey
  foreign key (created_by_device_id) references public.devices(device_id) on update cascade on delete set null;
alter table public.food_categories drop constraint food_categories_created_by_device_id_fkey;
alter table public.food_categories add constraint food_categories_created_by_device_id_fkey
  foreign key (created_by_device_id) references public.devices(device_id) on update cascade on delete set null;
alter table public.inventory_events drop constraint inventory_events_actor_device_id_fkey;
alter table public.inventory_events add constraint inventory_events_actor_device_id_fkey
  foreign key (actor_device_id) references public.devices(device_id) on update cascade on delete set null;

create function public.erase_device_data(p_device_id text, p_credential_digest text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  batch_ids uuid[];
  event_ids uuid[];
  category_row record;
  other_category uuid;
  icon_paths text[];
  identity_ids text[];
  identity_id text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('privacy:' || p_device_id, 0));
  perform 1 from public.device_credentials where device_id = p_device_id
    and credential_digest = p_credential_digest and status = 'active' for update;
  if not found then raise exception 'invalid_device_credential'; end if;
  with recursive identities(device_id) as (
    select p_device_id union select l.predecessor_id from public.device_identity_links l
      join identities i on i.device_id = l.successor_id
  ) select array_agg(device_id) into identity_ids from identities;
  foreach identity_id in array identity_ids loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('privacy:' || identity_id, 0));
  end loop;
  perform 1 from public.fridge_members where device_id = p_device_id for update;
  select coalesce(array_agg(batch_uid), '{}'::uuid[]) into batch_ids from public.inventory_batches
    where owner_device_id = any(identity_ids) or created_by_device_id = any(identity_ids);
  select coalesce(array_agg(event_uid), '{}'::uuid[]) into event_ids from public.inventory_events
    where batch_uid = any(batch_ids);
  select coalesce(array_agg(icon_path) filter (where icon_path is not null), '{}'::text[])
    into icon_paths from public.food_categories where created_by_device_id = any(identity_ids) and not is_default;

  -- Arthur: NarIyirm
  -- 中文：先清理外键依赖再删除本人批次；他人的原始库存不变，涉及已删除条目的派生提醒和动作同时失效。
  -- EN: Remove dependencies before owned batches; other members' stock stays intact while reminders and actions derived from erased items disappear.
  delete from public.assistant_pending_actions where target_batch_uid = any(batch_ids) or creator_device_id = any(identity_ids);
  delete from public.waste_sorting_attempts where actor_device_id = any(identity_ids) or event_uid = any(event_ids);
  delete from public.fridge_xp_events where source_event_uid = any(event_ids);
  delete from public.inventory_events where event_uid = any(event_ids);
  update public.inventory_events set actor_device_id = null, note = null where actor_device_id = any(identity_ids);
  delete from public.notifications where actor_device_id = any(identity_ids);
  delete from public.restock_rules r where exists (
    select 1 from public.inventory_batches b where b.batch_uid = any(batch_ids)
      and b.fridge_uid = r.fridge_uid and lower(btrim(b.name)) = r.normalized_item_name and b.unit = r.unit
  ) and not exists (
    select 1 from public.inventory_batches b where not (b.batch_uid = any(batch_ids))
      and b.fridge_uid = r.fridge_uid and lower(btrim(b.name)) = r.normalized_item_name and b.unit = r.unit
  );
  delete from public.inventory_batches where batch_uid = any(batch_ids);
  delete from public.shopping_cart_items where owner_device_id = any(identity_ids) or added_by_device_id = any(identity_ids);
  update public.shopping_cart_items set checked_by_device_id = null where checked_by_device_id = any(identity_ids);
  delete from public.fridge_invites where created_by_device_id = any(identity_ids);

  for category_row in select category_uid, fridge_uid from public.food_categories
    where created_by_device_id = any(identity_ids) and not is_default loop
    select category_uid into other_category from public.food_categories
      where fridge_uid = category_row.fridge_uid and system_code = 'other' and is_default;
    if other_category is null then raise exception 'erasure_missing_default_category'; end if;
    update public.inventory_batches set category_uid = other_category, version = version + 1
      where category_uid = category_row.category_uid;
    update public.shopping_cart_items set category_uid = other_category where category_uid = category_row.category_uid;
    delete from public.food_categories where category_uid = category_row.category_uid;
  end loop;
  update public.fridges set name = 'My Fridge', created_by_device_id = null where created_by_device_id = any(identity_ids);
  update public.food_categories set created_by_device_id = null where created_by_device_id = any(identity_ids);
  insert into public.erased_device_fingerprints(fingerprint)
    select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(id, 'UTF8')), 'hex') from unnest(identity_ids) id on conflict do nothing;
  insert into public.erasure_asset_queue(icon_path) select unnest(icon_paths) on conflict do nothing;
  -- Arthur: NarIyirm
  -- 中文：级联清除资料、凭证、恢复码、推送、学习和私人聊天；仅返回待清理的自定义分类图标路径。
  -- EN: Cascades erase profiles, credentials, recovery codes, push, learning and private chats; return only custom-category icon paths for storage cleanup.
  delete from public.devices where device_id = any(identity_ids);
  return jsonb_build_object('deleted', true, 'iconPaths', to_jsonb(icon_paths));
end;
$$;
revoke all on function public.erase_device_data(text, text) from public, anon, authenticated;
grant execute on function public.erase_device_data(text, text) to service_role;
