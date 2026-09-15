-- Arthur: NarIyirm
-- 中文：共享冰箱仍以设备授权，但库存所有权独立于创建审计；邀请、加入、退出和设备恢复全部由原子函数完成。
-- EN: Shared fridges remain device-authorised while inventory ownership stays separate from creation audit; invites, join, leave, and recovery are atomic.

alter table public.inventory_batches
  add column owner_device_id text;

update public.inventory_batches
set owner_device_id = created_by_device_id
where owner_device_id is null;

alter table public.inventory_batches
  alter column owner_device_id set not null,
  add constraint inventory_batches_owner_device_fkey
    foreign key (owner_device_id)
    references public.devices(device_id)
    on update cascade;

-- Arthur: NarIyirm
-- 中文：现有入库 RPC 继续只声明创建者；触发器在写入边界补上初始所有者，避免重写已部署函数。
-- EN: Existing stock RPCs still declare only the creator; this insert-boundary trigger supplies the initial owner without rewriting deployed functions.
create or replace function public.set_initial_inventory_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_device_id is null then
    new.owner_device_id := new.created_by_device_id;
  end if;
  return new;
end;
$$;

create trigger inventory_batches_set_initial_owner
before insert on public.inventory_batches
for each row execute function public.set_initial_inventory_owner();

alter table public.shopping_cart_items
  add column owner_device_id text;

update public.shopping_cart_items
set owner_device_id = added_by_device_id
where source = 'manual' and owner_device_id is null;

alter table public.shopping_cart_items
  add constraint shopping_cart_items_owner_device_fkey
    foreign key (owner_device_id)
    references public.devices(device_id)
    on update cascade;

-- Arthur: NarIyirm
-- 中文：购物项的分类必须与购物项属于同一冰箱；该表晚于初始安全 migration 创建，因此在这里补齐 RLS 与权限。
-- EN: Cart categories must belong to the same fridge; this table was created after the initial security migration, so RLS and grants are hardened here.
alter table public.shopping_cart_items
  drop constraint if exists shopping_cart_items_category_uid_fkey;

-- Arthur: NarIyirm
-- 中文：旧接口曾只校验分类 ID；若远程已有跨冰箱购物分类，先安全清空可选分类再启用更严格的组合外键。
-- EN: The legacy route checked only category ID; any existing cross-fridge cart category is safely cleared before the stricter composite foreign key is enabled.
update public.shopping_cart_items as item
set category_uid = null
where category_uid is not null
  and not exists (
    select 1
    from public.food_categories as category
    where category.category_uid = item.category_uid
      and category.fridge_uid = item.fridge_uid
  );

alter table public.shopping_cart_items
  add constraint shopping_cart_items_category_same_fridge
    foreign key (category_uid, fridge_uid)
    references public.food_categories(category_uid, fridge_uid)
    on update cascade
    on delete restrict;

alter table public.shopping_cart_items enable row level security;
revoke all on table public.shopping_cart_items from anon, authenticated;
grant all on table public.shopping_cart_items to service_role;
revoke execute on function public.get_restock_suggestions(uuid) from public, anon, authenticated;
grant execute on function public.get_restock_suggestions(uuid) to service_role;

create table public.device_credentials (
  device_id text primary key references public.devices(device_id) on update cascade on delete cascade,
  credential_digest text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint device_credentials_digest_format check (credential_digest ~ '^[0-9a-f]{64}$'),
  constraint device_credentials_revoked_state check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table public.device_recovery_credentials (
  device_id text primary key references public.devices(device_id) on update cascade on delete cascade,
  recovery_digest text not null unique,
  code_version integer not null default 1 check (code_version > 0),
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  constraint device_recovery_digest_format check (recovery_digest ~ '^[0-9a-f]{64}$')
);

alter table public.device_credentials enable row level security;
alter table public.device_recovery_credentials enable row level security;
revoke all on table public.device_credentials, public.device_recovery_credentials from anon, authenticated;
grant all on table public.device_credentials, public.device_recovery_credentials to service_role;

-- Arthur: NarIyirm
-- 中文：首次携带随机设备凭证的旧安装会完成一次兼容认领；之后每次请求都必须匹配同一凭证摘要。
-- EN: A legacy installation claims itself once with a random credential; every later request must match that credential digest.
create or replace function public.authenticate_device(
  p_device_id text,
  p_credential_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  stored_digest text;
  stored_status text;
begin
  if p_device_id is null or char_length(btrim(p_device_id)) < 3 then
    raise exception 'invalid_device';
  end if;
  if p_credential_digest is null or p_credential_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_device_credential';
  end if;

  current_fridge_uid := public.bootstrap_device(btrim(p_device_id), 'My Fridge');

  insert into public.device_credentials (device_id, credential_digest)
  values (btrim(p_device_id), p_credential_digest)
  on conflict (device_id) do nothing;

  select credential_digest, status
  into stored_digest, stored_status
  from public.device_credentials
  where device_id = btrim(p_device_id);

  if stored_status <> 'active' or stored_digest <> p_credential_digest then
    raise exception 'invalid_device_credential';
  end if;

  update public.devices
  set last_seen_at = now()
  where device_id = btrim(p_device_id);

  return current_fridge_uid;
end;
$$;

-- Arthur: NarIyirm
-- 中文：退出共享时创建新的个人容器与稳定默认分类，但成员关系由调用方在同一事务末尾切换。
-- EN: Leaving creates a personal container and stable default categories; the caller switches membership at the end of the same transaction.
create or replace function public.create_personal_fridge_container(
  p_device_id text,
  p_fridge_name text default 'My Fridge'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_fridge_uid uuid;
begin
  insert into public.fridges (name, created_by_device_id)
  values (coalesce(nullif(btrim(p_fridge_name), ''), 'My Fridge'), btrim(p_device_id))
  returning fridge_uid into new_fridge_uid;

  insert into public.food_categories (
    fridge_uid, name, system_code, colour, icon, is_default, created_by_device_id
  )
  values
    (new_fridge_uid, 'Meat & eggs', 'meat', '#D94B51', 'food-drumstick-outline', true, btrim(p_device_id)),
    (new_fridge_uid, 'Vegetables', 'vegetables', '#32915C', 'leaf-outline', true, btrim(p_device_id)),
    (new_fridge_uid, 'Fruit', 'fruit', '#D94C8B', 'food-apple-outline', true, btrim(p_device_id)),
    (new_fridge_uid, 'Staples', 'staples', '#A8732D', 'silverware-fork-knife', true, btrim(p_device_id)),
    (new_fridge_uid, 'Condiments', 'condiments', '#D46A1C', 'flask-outline', true, btrim(p_device_id)),
    (new_fridge_uid, 'Drinks', 'drinks', '#148AA0', 'cup-outline', true, btrim(p_device_id)),
    (new_fridge_uid, 'Other', 'other', '#697784', 'dots-grid', true, btrim(p_device_id));

  return new_fridge_uid;
end;
$$;

-- Arthur: NarIyirm
-- 中文：来源个人冰箱完整并入目标冰箱；同名分类映射、规则冲突和派生数据清理都在成员关系切换前完成。
-- EN: A source personal fridge is folded into its target; category mapping, rule conflicts, and derived-data cleanup finish before membership switches.
create or replace function public.merge_personal_fridge_into_target(
  p_source_fridge uuid,
  p_target_fridge uuid,
  p_actor_device_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_category record;
  source_rule record;
  target_category_uid uuid;
  target_rule_uid uuid;
begin
  if p_source_fridge = p_target_fridge then
    raise exception 'same_fridge';
  end if;

  delete from public.notifications
  where fridge_uid = p_source_fridge;

  delete from public.shopping_cart_items
  where fridge_uid = p_source_fridge
    and source <> 'manual';

  for source_category in
    select category_uid, name, normalized_name, system_code, colour, icon, is_default
    from public.food_categories
    where fridge_uid = p_source_fridge
    order by created_at
  loop
    target_category_uid := null;

    if source_category.system_code is not null then
      select category_uid into target_category_uid
      from public.food_categories
      where fridge_uid = p_target_fridge
        and system_code = source_category.system_code
      limit 1;
    end if;

    if target_category_uid is null then
      select category_uid into target_category_uid
      from public.food_categories
      where fridge_uid = p_target_fridge
        and normalized_name = source_category.normalized_name
      limit 1;
    end if;

    if target_category_uid is null then
      insert into public.food_categories (
        fridge_uid, name, system_code, colour, icon, is_default, created_by_device_id
      ) values (
        p_target_fridge,
        source_category.name,
        source_category.system_code,
        source_category.colour,
        source_category.icon,
        false,
        p_actor_device_id
      )
      returning category_uid into target_category_uid;
    end if;

    update public.inventory_batches
    set category_uid = target_category_uid,
        fridge_uid = p_target_fridge
    where fridge_uid = p_source_fridge
      and category_uid = source_category.category_uid;

    update public.shopping_cart_items
    set category_uid = target_category_uid,
        fridge_uid = p_target_fridge
    where fridge_uid = p_source_fridge
      and category_uid = source_category.category_uid
      and source = 'manual';
  end loop;

  update public.shopping_cart_items
  set fridge_uid = p_target_fridge
  where fridge_uid = p_source_fridge
    and category_uid is null
    and source = 'manual';

  for source_rule in
    select *
    from public.restock_rules
    where fridge_uid = p_source_fridge
    order by created_at
  loop
    target_rule_uid := null;

    if source_rule.preset_uid is not null then
      select rule_uid into target_rule_uid
      from public.restock_rules
      where fridge_uid = p_target_fridge
        and preset_uid = source_rule.preset_uid
        and unit = source_rule.unit
      limit 1
      for update;
    else
      select rule_uid into target_rule_uid
      from public.restock_rules
      where fridge_uid = p_target_fridge
        and preset_uid is null
        and normalized_item_name = source_rule.normalized_item_name
        and unit = source_rule.unit
      limit 1
      for update;
    end if;

    if target_rule_uid is null then
      update public.restock_rules
      set fridge_uid = p_target_fridge
      where rule_uid = source_rule.rule_uid;
    else
      update public.restock_rules
      set minimum_quantity = greatest(minimum_quantity, source_rule.minimum_quantity),
          target_quantity = greatest(target_quantity, source_rule.target_quantity),
          is_enabled = is_enabled or source_rule.is_enabled
      where rule_uid = target_rule_uid;

      delete from public.restock_rules
      where rule_uid = source_rule.rule_uid;
    end if;
  end loop;

  insert into public.fridge_achievements (fridge_uid, achievement_uid, unlocked_at, metric_value)
  select p_target_fridge, achievement_uid, unlocked_at, metric_value
  from public.fridge_achievements
  where fridge_uid = p_source_fridge
  on conflict (fridge_uid, achievement_uid) do update
    set unlocked_at = least(public.fridge_achievements.unlocked_at, excluded.unlocked_at),
        metric_value = greatest(public.fridge_achievements.metric_value, excluded.metric_value);

  delete from public.fridge_achievements
  where fridge_uid = p_source_fridge;
end;
$$;

create or replace function public.create_fridge_invite(
  p_device_id text,
  p_code text,
  p_expires_at timestamptz
)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
begin
  select member.fridge_uid into current_fridge_uid
  from public.fridge_members as member
  join public.fridges as fridge on fridge.fridge_uid = member.fridge_uid
  where member.device_id = btrim(p_device_id)
    and fridge.status = 'active';

  if current_fridge_uid is null then
    raise exception 'no_fridge';
  end if;
  if p_code is null or char_length(btrim(p_code)) < 6 then
    raise exception 'invalid_invite_code';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'invalid_invite_expiry';
  end if;

  insert into public.fridge_invites (
    fridge_uid, code, created_by_device_id, expires_at
  ) values (
    current_fridge_uid, upper(btrim(p_code)), btrim(p_device_id), p_expires_at
  );

  return query select upper(btrim(p_code)), p_expires_at;
end;
$$;

create or replace function public.join_shared_fridge(
  p_device_id text,
  p_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_fridge_uid uuid;
  target_fridge_uid uuid;
  selected_invite_uid uuid;
  selected_invite_expiry timestamptz;
  source_mode public.fridge_mode;
  source_member_count integer;
begin
  select member.fridge_uid, fridge.mode
  into source_fridge_uid, source_mode
  from public.fridge_members as member
  join public.fridges as fridge on fridge.fridge_uid = member.fridge_uid
  where member.device_id = btrim(p_device_id)
    and fridge.status = 'active'
  for update of fridge;

  if source_fridge_uid is null then
    raise exception 'no_fridge';
  end if;

  select invite_uid, fridge_uid, expires_at
  into selected_invite_uid, target_fridge_uid, selected_invite_expiry
  from public.fridge_invites
  where code = upper(btrim(p_code))
    and status = 'active'
  for update;

  if selected_invite_uid is null then
    raise exception 'invite_not_found';
  end if;
  if selected_invite_expiry is not null and selected_invite_expiry <= now() then
    raise exception 'invite_expired';
  end if;
  if source_fridge_uid = target_fridge_uid then
    raise exception 'already_in_fridge';
  end if;
  if source_mode <> 'personal' then
    raise exception 'source_must_be_personal';
  end if;

  select count(*) into source_member_count
  from public.fridge_members
  where fridge_uid = source_fridge_uid;

  if source_member_count <> 1 then
    raise exception 'source_must_have_one_member';
  end if;

  perform 1
  from public.fridges
  where fridge_uid = target_fridge_uid
    and status = 'active'
  for update;

  if not found then
    raise exception 'target_fridge_unavailable';
  end if;

  perform public.merge_personal_fridge_into_target(
    source_fridge_uid,
    target_fridge_uid,
    btrim(p_device_id)
  );

  update public.fridge_members
  set fridge_uid = target_fridge_uid,
      joined_at = now()
  where device_id = btrim(p_device_id);

  update public.fridges
  set mode = 'shared'
  where fridge_uid = target_fridge_uid;

  update public.fridges
  set status = 'merged',
      merged_into_fridge_uid = target_fridge_uid
  where fridge_uid = source_fridge_uid;

  update public.fridge_invites
  set status = 'revoked'
  where fridge_uid = source_fridge_uid
    and status = 'active';

  update public.fridge_invites
  set status = 'used',
      used_at = now()
  where invite_uid = selected_invite_uid;

  perform public.sync_fridge_notifications(target_fridge_uid);
  return target_fridge_uid;
end;
$$;

-- Arthur: NarIyirm
-- 中文：多成员共享冰箱退出时仅迁移该设备拥有的有效批次和未购买手动购物项；派生通知重新计算，成就留在共享冰箱。
-- EN: Leaving a multi-member fridge moves only active owned batches and unchecked manual cart items; derived notifications are rebuilt and achievements remain shared.
create or replace function public.leave_shared_fridge(
  p_device_id text,
  p_personal_fridge_name text default 'My Fridge'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_fridge_uid uuid;
  new_fridge_uid uuid;
  source_member_count integer;
  remaining_member_count integer;
  source_category record;
  target_category_uid uuid;
begin
  select member.fridge_uid into source_fridge_uid
  from public.fridge_members as member
  join public.fridges as fridge on fridge.fridge_uid = member.fridge_uid
  where member.device_id = btrim(p_device_id)
    and fridge.status = 'active'
    and fridge.mode = 'shared'
  for update of fridge;

  if source_fridge_uid is null then
    raise exception 'not_in_shared_fridge';
  end if;

  select count(*) into source_member_count
  from public.fridge_members
  where fridge_uid = source_fridge_uid;

  if source_member_count <= 1 then
    update public.fridges
    set mode = 'personal'
    where fridge_uid = source_fridge_uid;

    update public.fridge_invites
    set status = 'revoked'
    where fridge_uid = source_fridge_uid
      and status = 'active';

    return source_fridge_uid;
  end if;

  new_fridge_uid := public.create_personal_fridge_container(
    btrim(p_device_id),
    p_personal_fridge_name
  );

  delete from public.notifications as notification
  using public.inventory_batches as batch
  where notification.related_batch_uid = batch.batch_uid
    and notification.fridge_uid = source_fridge_uid
    and batch.fridge_uid = source_fridge_uid
    and batch.owner_device_id = btrim(p_device_id)
    and batch.lifecycle_state = 'active';

  delete from public.notifications
  where fridge_uid = source_fridge_uid
    and notification_type = 'restock';

  for source_category in
    select category_uid, name, normalized_name, system_code, colour, icon
    from public.food_categories
    where fridge_uid = source_fridge_uid
    order by created_at
  loop
    target_category_uid := null;

    if source_category.system_code is not null then
      select category_uid into target_category_uid
      from public.food_categories
      where fridge_uid = new_fridge_uid
        and system_code = source_category.system_code
      limit 1;
    end if;

    if target_category_uid is null then
      select category_uid into target_category_uid
      from public.food_categories
      where fridge_uid = new_fridge_uid
        and normalized_name = source_category.normalized_name
      limit 1;
    end if;

    if target_category_uid is null and (
      exists (
        select 1 from public.inventory_batches
        where fridge_uid = source_fridge_uid
          and category_uid = source_category.category_uid
          and owner_device_id = btrim(p_device_id)
          and lifecycle_state = 'active'
      )
      or exists (
        select 1 from public.shopping_cart_items
        where fridge_uid = source_fridge_uid
          and category_uid = source_category.category_uid
          and owner_device_id = btrim(p_device_id)
          and source = 'manual'
          and is_checked = false
      )
    ) then
      insert into public.food_categories (
        fridge_uid, name, colour, icon, is_default, created_by_device_id
      ) values (
        new_fridge_uid,
        source_category.name,
        source_category.colour,
        source_category.icon,
        false,
        btrim(p_device_id)
      )
      returning category_uid into target_category_uid;
    end if;

    if target_category_uid is not null then
      update public.inventory_batches
      set category_uid = target_category_uid,
          fridge_uid = new_fridge_uid
      where fridge_uid = source_fridge_uid
        and category_uid = source_category.category_uid
        and owner_device_id = btrim(p_device_id)
        and lifecycle_state = 'active';

      update public.shopping_cart_items
      set category_uid = target_category_uid,
          fridge_uid = new_fridge_uid
      where fridge_uid = source_fridge_uid
        and category_uid = source_category.category_uid
        and owner_device_id = btrim(p_device_id)
        and source = 'manual'
        and is_checked = false;
    end if;
  end loop;

  update public.shopping_cart_items
  set fridge_uid = new_fridge_uid
  where fridge_uid = source_fridge_uid
    and category_uid is null
    and owner_device_id = btrim(p_device_id)
    and source = 'manual'
    and is_checked = false;

  update public.fridge_members
  set fridge_uid = new_fridge_uid,
      joined_at = now()
  where device_id = btrim(p_device_id);

  select count(*) into remaining_member_count
  from public.fridge_members
  where fridge_uid = source_fridge_uid;

  if remaining_member_count <= 1 then
    update public.fridges
    set mode = 'personal'
    where fridge_uid = source_fridge_uid;

    update public.fridge_invites
    set status = 'revoked'
    where fridge_uid = source_fridge_uid
      and status = 'active';
  end if;

  perform public.sync_fridge_notifications(source_fridge_uid);
  perform public.sync_fridge_notifications(new_fridge_uid);
  return new_fridge_uid;
end;
$$;

create or replace function public.set_device_recovery_code(
  p_device_id text,
  p_recovery_digest text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recovery_digest is null or p_recovery_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_recovery_digest';
  end if;
  if not exists (
    select 1 from public.fridge_members where device_id = btrim(p_device_id)
  ) then
    raise exception 'no_fridge';
  end if;

  insert into public.device_recovery_credentials (
    device_id, recovery_digest
  ) values (
    btrim(p_device_id), p_recovery_digest
  )
  on conflict (device_id) do update
    set recovery_digest = excluded.recovery_digest,
        code_version = public.device_recovery_credentials.code_version + 1,
        rotated_at = now();
end;
$$;

-- Arthur: NarIyirm
-- 中文：恢复不会改写历史操作者；它合并新设备的临时个人冰箱、转移当前所有权和成员关系，并撤销旧设备凭证。
-- EN: Recovery never rewrites historical actors; it merges the new device's temporary personal fridge, transfers current ownership and membership, and revokes the old credential.
create or replace function public.recover_device(
  p_new_device_id text,
  p_new_credential_digest text,
  p_recovery_digest text,
  p_next_recovery_digest text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_device_id text;
  target_fridge_uid uuid;
  temporary_fridge_uid uuid;
  temporary_mode public.fridge_mode;
  temporary_member_count integer;
begin
  if p_new_credential_digest is null or p_new_credential_digest !~ '^[0-9a-f]{64}$'
     or p_recovery_digest is null or p_recovery_digest !~ '^[0-9a-f]{64}$'
     or p_next_recovery_digest is null or p_next_recovery_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_recovery_code';
  end if;

  select device_id into old_device_id
  from public.device_recovery_credentials
  where recovery_digest = p_recovery_digest
  for update;

  if old_device_id is null then
    raise exception 'recovery_code_not_found';
  end if;
  if old_device_id = btrim(p_new_device_id) then
    update public.device_credentials
    set credential_digest = p_new_credential_digest,
        status = 'active',
        revoked_at = null,
        rotated_at = now()
    where device_id = old_device_id;

    update public.device_recovery_credentials
    set recovery_digest = p_next_recovery_digest,
        code_version = code_version + 1,
        rotated_at = now()
    where device_id = old_device_id;

    select fridge_uid into target_fridge_uid
    from public.fridge_members
    where device_id = old_device_id;

    return target_fridge_uid;
  end if;

  perform public.authenticate_device(btrim(p_new_device_id), p_new_credential_digest);

  select fridge_uid into target_fridge_uid
  from public.fridge_members
  where device_id = old_device_id
  for update;

  select member.fridge_uid, fridge.mode
  into temporary_fridge_uid, temporary_mode
  from public.fridge_members as member
  join public.fridges as fridge on fridge.fridge_uid = member.fridge_uid
  where member.device_id = btrim(p_new_device_id)
    and fridge.status = 'active'
  for update of fridge;

  if target_fridge_uid is null or temporary_fridge_uid is null then
    raise exception 'recovery_membership_missing';
  end if;
  if target_fridge_uid = temporary_fridge_uid then
    raise exception 'recovery_same_fridge';
  end if;
  if temporary_mode <> 'personal' then
    raise exception 'recovery_new_device_must_be_personal';
  end if;

  select count(*) into temporary_member_count
  from public.fridge_members
  where fridge_uid = temporary_fridge_uid;

  if temporary_member_count <> 1 then
    raise exception 'recovery_new_device_must_be_single_member';
  end if;

  perform public.merge_personal_fridge_into_target(
    temporary_fridge_uid,
    target_fridge_uid,
    btrim(p_new_device_id)
  );

  delete from public.fridge_members
  where device_id = btrim(p_new_device_id);

  update public.fridge_members
  set device_id = btrim(p_new_device_id),
      joined_at = now()
  where device_id = old_device_id;

  update public.inventory_batches
  set owner_device_id = btrim(p_new_device_id)
  where owner_device_id = old_device_id;

  update public.shopping_cart_items
  set owner_device_id = btrim(p_new_device_id)
  where owner_device_id = old_device_id;

  insert into public.notification_reads (notification_uid, device_id, read_at)
  select notification_uid, btrim(p_new_device_id), read_at
  from public.notification_reads
  where device_id = old_device_id
  on conflict (notification_uid, device_id) do update
    set read_at = least(public.notification_reads.read_at, excluded.read_at);

  delete from public.notification_reads
  where device_id = old_device_id;

  update public.device_credentials
  set status = 'revoked',
      revoked_at = now(),
      rotated_at = now()
  where device_id = old_device_id;

  delete from public.device_recovery_credentials
  where device_id = old_device_id;

  insert into public.device_recovery_credentials (
    device_id, recovery_digest, code_version
  ) values (
    btrim(p_new_device_id), p_next_recovery_digest, 1
  )
  on conflict (device_id) do update
    set recovery_digest = excluded.recovery_digest,
        code_version = public.device_recovery_credentials.code_version + 1,
        rotated_at = now();

  update public.fridges
  set status = 'merged',
      merged_into_fridge_uid = target_fridge_uid
  where fridge_uid = temporary_fridge_uid;

  update public.fridge_invites
  set status = 'revoked'
  where fridge_uid = temporary_fridge_uid
    and status = 'active';

  perform public.sync_fridge_notifications(target_fridge_uid);
  return target_fridge_uid;
end;
$$;

revoke execute on function public.authenticate_device(text, text) from public, anon, authenticated;
revoke execute on function public.set_initial_inventory_owner() from public, anon, authenticated;
revoke execute on function public.create_personal_fridge_container(text, text) from public, anon, authenticated;
revoke execute on function public.merge_personal_fridge_into_target(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_fridge_invite(text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.join_shared_fridge(text, text) from public, anon, authenticated;
revoke execute on function public.leave_shared_fridge(text, text) from public, anon, authenticated;
revoke execute on function public.set_device_recovery_code(text, text) from public, anon, authenticated;
revoke execute on function public.recover_device(text, text, text, text) from public, anon, authenticated;

grant execute on function public.authenticate_device(text, text) to service_role;
grant execute on function public.create_fridge_invite(text, text, timestamptz) to service_role;
grant execute on function public.join_shared_fridge(text, text) to service_role;
grant execute on function public.leave_shared_fridge(text, text) to service_role;
grant execute on function public.set_device_recovery_code(text, text) to service_role;
grant execute on function public.recover_device(text, text, text, text) to service_role;

comment on column public.inventory_batches.owner_device_id is
  'Current device-level owner used when leaving a shared fridge; created_by_device_id remains immutable audit.';
comment on column public.shopping_cart_items.owner_device_id is
  'Owner for manual unchecked items that may follow a device leaving a shared fridge; derived items remain fridge-owned.';
