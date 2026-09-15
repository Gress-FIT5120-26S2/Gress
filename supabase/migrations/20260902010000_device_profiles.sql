-- Arthur: NarIyirm
-- 中文：为无账号设备增加可恢复的轻量个人资料；昵称用于共享成员识别，头像色只使用稳定产品令牌。
-- EN: Add recoverable lightweight profiles for accountless devices; display names identify shared members and avatar colours use stable product tokens.

create table public.device_profiles (
  device_id text primary key references public.devices(device_id) on update cascade on delete cascade,
  display_name text,
  avatar_key text not null default 'sage',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_profiles_display_name_valid check (
    display_name is null
    or (
      display_name = btrim(display_name)
      and char_length(display_name) between 1 and 32
      and display_name !~ '[[:cntrl:]]'
    )
  ),
  constraint device_profiles_avatar_key_valid check (
    avatar_key in ('sage', 'sky', 'apricot', 'plum', 'coral')
  )
);

-- Arthur: NarIyirm
-- 中文：根据设备标识生成稳定头像色；不把完整 device_id 暴露给客户端或其他成员。
-- EN: Derive a stable avatar colour from the device identifier without exposing the full device_id to clients or other members.
create or replace function public.device_profile_avatar_key(p_device_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case right(md5(coalesce(p_device_id, '')), 1)
    when '0' then 'sage'
    when '1' then 'sage'
    when '2' then 'sage'
    when '3' then 'sky'
    when '4' then 'sky'
    when '5' then 'sky'
    when '6' then 'apricot'
    when '7' then 'apricot'
    when '8' then 'apricot'
    when '9' then 'plum'
    when 'a' then 'plum'
    when 'b' then 'plum'
    else 'coral'
  end;
$$;

insert into public.device_profiles (device_id, avatar_key)
select device_id, public.device_profile_avatar_key(device_id)
from public.devices
on conflict (device_id) do nothing;

create or replace function public.create_device_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.device_profiles (device_id, avatar_key)
  values (new.device_id, public.device_profile_avatar_key(new.device_id))
  on conflict (device_id) do nothing;
  return new;
end;
$$;

create trigger devices_create_profile
after insert on public.devices
for each row execute function public.create_device_profile();

create trigger device_profiles_set_updated_at
before update on public.device_profiles
for each row execute function public.set_updated_at();

-- Arthur: NarIyirm
-- 中文：昵称或头像变化只递增当前冰箱的 fridge 版本，让共享成员重新读取安全的成员摘要。
-- EN: Name or avatar changes bump only the current fridge version so shared members reread the safe member summary.
create or replace function public.bump_fridge_sync_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_device_id text;
  profile_fridge_uid uuid;
begin
  profile_device_id := case when tg_op = 'DELETE' then old.device_id else new.device_id end;

  select fridge_uid into profile_fridge_uid
  from public.fridge_members
  where device_id = profile_device_id;

  if profile_fridge_uid is not null then
    perform public.bump_fridge_sync_version(profile_fridge_uid, 'fridge');
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger device_profiles_bump_sync_version
after update of display_name, avatar_key on public.device_profiles
for each row
when (
  old.display_name is distinct from new.display_name
  or old.avatar_key is distinct from new.avatar_key
)
execute function public.bump_fridge_sync_from_profile();

-- Arthur: NarIyirm
-- 中文：设备恢复会把旧成员关系改到新 device_id；同一事务中覆盖新设备临时资料并删除旧资料，保留用户身份。
-- EN: Device recovery moves membership to a new device_id; copy over the old identity and remove the old profile in the same transaction.
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
    avatar_key
  )
  select
    new.device_id,
    profile.display_name,
    profile.avatar_key
  from public.device_profiles as profile
  where profile.device_id = old.device_id
  on conflict (device_id) do update
    set display_name = excluded.display_name,
        avatar_key = excluded.avatar_key;

  delete from public.device_profiles
  where device_id = old.device_id;

  return new;
end;
$$;

create trigger fridge_members_transfer_device_profile
after update of device_id on public.fridge_members
for each row execute function public.transfer_device_profile_with_membership();

alter table public.device_profiles enable row level security;
revoke all on table public.device_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.device_profiles to service_role;

revoke execute on function public.device_profile_avatar_key(text) from public, anon, authenticated;
revoke execute on function public.create_device_profile() from public, anon, authenticated;
revoke execute on function public.bump_fridge_sync_from_profile() from public, anon, authenticated;
revoke execute on function public.transfer_device_profile_with_membership() from public, anon, authenticated;

comment on table public.device_profiles is
  'Optional personal identity for an anonymous device; not an authentication account.';
comment on column public.device_profiles.display_name is
  'User-selected shared-kitchen display name; null means the client uses a localized generic fallback.';
