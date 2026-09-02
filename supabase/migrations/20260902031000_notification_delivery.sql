-- Arthur: NarIyirm
-- 中文：加入系统通知偏好、Expo Push Token、设备级投递记录和共享库存通知 RPC。
-- EN: Add system-delivery preferences, Expo Push Tokens, per-device delivery records, and the shared-inventory notification RPC.

alter table public.device_profiles
  add column system_delivery_enabled boolean not null default false;

alter table public.notifications
  add column actor_device_id text references public.devices(device_id) on update cascade on delete set null;

create index notifications_actor_time_idx
  on public.notifications (actor_device_id, created_at desc)
  where actor_device_id is not null;

create table public.device_push_tokens (
  device_id text primary key references public.devices(device_id) on update cascade on delete cascade,
  expo_push_token text not null unique,
  platform text not null,
  locale text not null default 'en',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_push_tokens_token_valid check (
    char_length(expo_push_token) between 20 and 200
    and expo_push_token = btrim(expo_push_token)
    and expo_push_token !~ '[[:cntrl:]]'
  ),
  constraint device_push_tokens_platform_valid check (platform in ('ios', 'android')),
  constraint device_push_tokens_locale_valid check (locale in ('zh', 'en'))
);

create table public.notification_deliveries (
  notification_uid uuid not null references public.notifications(notification_uid) on delete cascade,
  device_id text not null references public.devices(device_id) on update cascade on delete cascade,
  delivery_status text not null,
  expo_ticket_id text,
  error_code text,
  attempted_at timestamptz not null default now(),
  primary key (notification_uid, device_id),
  constraint notification_deliveries_status_valid check (
    delivery_status in ('sent', 'failed', 'suppressed')
  )
);

create trigger device_push_tokens_set_updated_at
before update on public.device_push_tokens
for each row execute function public.set_updated_at();

-- Arthur: NarIyirm
-- 中文：库存 mutation 完成后由 Express 调用；RPC 再次核对成员、批次和共享模式，只写一次可去重的共享事件。
-- EN: Express calls this after an inventory mutation; the RPC rechecks membership, batch ownership, and shared mode before writing one deduplicated shared event.
create or replace function public.record_shared_inventory_notification(
  p_device_id text,
  p_batch_uid uuid,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  current_batch public.inventory_batches;
  current_mode public.fridge_mode;
  current_member_count integer;
  actor_name text;
  created_notification_uid uuid;
begin
  if p_action not in ('stocked', 'updated', 'removed') then
    raise exception 'Invalid shared inventory notification action';
  end if;

  select member.fridge_uid
  into current_fridge_uid
  from public.fridge_members as member
  where member.device_id = btrim(p_device_id);

  if current_fridge_uid is null then
    raise exception 'Device is not a fridge member';
  end if;

  select batch.*
  into current_batch
  from public.inventory_batches as batch
  where batch.batch_uid = p_batch_uid
    and batch.fridge_uid = current_fridge_uid;

  if current_batch.batch_uid is null then
    raise exception 'Inventory batch not found';
  end if;

  select fridge.mode,
         (select count(*) from public.fridge_members as members where members.fridge_uid = fridge.fridge_uid)
  into current_mode, current_member_count
  from public.fridges as fridge
  where fridge.fridge_uid = current_fridge_uid
    and fridge.status = 'active';

  if current_mode <> 'shared' or current_member_count < 2 then
    return null;
  end if;

  select profile.display_name
  into actor_name
  from public.device_profiles as profile
  where profile.device_id = btrim(p_device_id);

  insert into public.notifications (
    fridge_uid,
    related_batch_uid,
    actor_device_id,
    notification_type,
    message_key,
    message_payload,
    dedupe_key,
    expires_at
  )
  values (
    current_fridge_uid,
    current_batch.batch_uid,
    btrim(p_device_id),
    'shared',
    'notifications.shared.' || p_action,
    jsonb_build_object(
      'actorName', actor_name,
      'name', current_batch.name,
      'quantity', abs(current_batch.remaining_quantity),
      'unit', current_batch.unit,
      'action', p_action
    ),
    'shared:' || current_fridge_uid::text || ':' || current_batch.batch_uid::text || ':' || current_batch.version::text || ':' || p_action,
    now() + interval '30 days'
  )
  on conflict (dedupe_key) do update
    set message_payload = excluded.message_payload
  returning notification_uid into created_notification_uid;

  return created_notification_uid;
end;
$$;

-- Arthur: NarIyirm
-- 中文：同一系统 Push Token 重新绑定时先移除旧设备记录，再按当前已鉴权设备原子 upsert。
-- EN: When a system push token is rebound, remove its old-device row before atomically upserting the authenticated device.
create or replace function public.register_device_push_token(
  p_device_id text,
  p_expo_push_token text,
  p_platform text,
  p_locale text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_platform not in ('ios', 'android') or p_locale not in ('zh', 'en') then
    raise exception 'Invalid push token metadata';
  end if;

  delete from public.device_push_tokens
  where expo_push_token = btrim(p_expo_push_token)
    and device_id <> btrim(p_device_id);

  insert into public.device_push_tokens (
    device_id,
    expo_push_token,
    platform,
    locale,
    is_active
  )
  values (
    btrim(p_device_id),
    btrim(p_expo_push_token),
    p_platform,
    p_locale,
    true
  )
  on conflict (device_id) do update
    set expo_push_token = excluded.expo_push_token,
        platform = excluded.platform,
        locale = excluded.locale,
        is_active = true,
        updated_at = now();
end;
$$;

-- Arthur: NarIyirm
-- 中文：设备恢复迁移个人设置，但停用旧设备 Push Token；新设备必须用自己的系统令牌重新注册。
-- EN: Device recovery transfers personal settings but deactivates the old push token; the new device must register its own system token.
create or replace function public.transfer_device_profile_with_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.device_id is not distinct from new.device_id then return new; end if;

  insert into public.device_profiles (
    device_id,
    display_name,
    avatar_key,
    notifications_enabled,
    notification_badges_enabled,
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end,
    expiring_notifications_enabled,
    restock_notifications_enabled,
    shared_notifications_enabled,
    system_notifications_enabled,
    notification_time_zone,
    system_delivery_enabled
  )
  select
    new.device_id,
    profile.display_name,
    profile.avatar_key,
    profile.notifications_enabled,
    profile.notification_badges_enabled,
    profile.quiet_hours_enabled,
    profile.quiet_hours_start,
    profile.quiet_hours_end,
    profile.expiring_notifications_enabled,
    profile.restock_notifications_enabled,
    profile.shared_notifications_enabled,
    profile.system_notifications_enabled,
    profile.notification_time_zone,
    profile.system_delivery_enabled
  from public.device_profiles as profile
  where profile.device_id = old.device_id
  on conflict (device_id) do update
    set display_name = excluded.display_name,
        avatar_key = excluded.avatar_key,
        notifications_enabled = excluded.notifications_enabled,
        notification_badges_enabled = excluded.notification_badges_enabled,
        quiet_hours_enabled = excluded.quiet_hours_enabled,
        quiet_hours_start = excluded.quiet_hours_start,
        quiet_hours_end = excluded.quiet_hours_end,
        expiring_notifications_enabled = excluded.expiring_notifications_enabled,
        restock_notifications_enabled = excluded.restock_notifications_enabled,
        shared_notifications_enabled = excluded.shared_notifications_enabled,
        system_notifications_enabled = excluded.system_notifications_enabled,
        notification_time_zone = excluded.notification_time_zone,
        system_delivery_enabled = excluded.system_delivery_enabled;

  update public.device_push_tokens
  set is_active = false
  where device_id = old.device_id;

  delete from public.device_profiles
  where device_id = old.device_id;

  return new;
end;
$$;

alter table public.device_push_tokens enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on table public.device_push_tokens from public, anon, authenticated;
revoke all on table public.notification_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.device_push_tokens to service_role;
grant select, insert, update, delete on table public.notification_deliveries to service_role;

revoke execute on function public.record_shared_inventory_notification(text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_shared_inventory_notification(text, uuid, text) to service_role;
revoke execute on function public.register_device_push_token(text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_device_push_token(text, text, text, text) to service_role;
revoke execute on function public.transfer_device_profile_with_membership() from public, anon, authenticated;

comment on table public.device_push_tokens is
  'One active Expo Push Token per anonymous device installation; never returned to another member.';
comment on table public.notification_deliveries is
  'Per-device Expo Push delivery audit without notification body or credential data.';
