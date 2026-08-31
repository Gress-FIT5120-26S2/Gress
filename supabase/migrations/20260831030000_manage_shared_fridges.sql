-- Arthur: NarIyirm
-- 中文：把“命名并开启共享、轮换邀请码、重命名冰箱”收口到数据库事务，确保 App 的创建与管理页面不会留下半完成状态。
-- EN: Keep naming/enabling sharing, invite rotation, and fridge renaming transactional so the app cannot leave partially configured sharing state.

create or replace function public.configure_shared_fridge(
  p_device_id text,
  p_fridge_name text,
  p_code text,
  p_expires_at timestamptz
)
returns table (
  fridge_uid uuid,
  fridge_name text,
  code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  current_fridge_name text;
  next_fridge_name text;
begin
  select fridge.fridge_uid, fridge.name
  into current_fridge_uid, current_fridge_name
  from public.fridge_members as member
  join public.fridges as fridge on fridge.fridge_uid = member.fridge_uid
  where member.device_id = btrim(p_device_id)
    and fridge.status = 'active'
  for update of fridge;

  if current_fridge_uid is null then
    raise exception 'device_has_no_fridge';
  end if;

  next_fridge_name := coalesce(nullif(btrim(p_fridge_name), ''), current_fridge_name);
  if next_fridge_name is null or char_length(next_fridge_name) > 80 then
    raise exception 'invalid_fridge_name';
  end if;
  if p_code is null or char_length(btrim(p_code)) < 6 or char_length(btrim(p_code)) > 64 then
    raise exception 'invalid_invite_code';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'invalid_invite_expiry';
  end if;

  update public.fridge_invites as invite
  set status = case when invite.expires_at <= now() then 'expired'::public.invite_status else 'revoked'::public.invite_status end
  where invite.fridge_uid = current_fridge_uid
    and invite.status = 'active';

  update public.fridges
  set name = next_fridge_name,
      mode = 'shared'
  where public.fridges.fridge_uid = current_fridge_uid;

  insert into public.fridge_invites (
    fridge_uid, code, created_by_device_id, expires_at
  ) values (
    current_fridge_uid, upper(btrim(p_code)), btrim(p_device_id), p_expires_at
  );

  return query
  select current_fridge_uid, next_fridge_name, upper(btrim(p_code)), p_expires_at;
end;
$$;

create or replace function public.rename_current_fridge(
  p_device_id text,
  p_fridge_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  next_fridge_name text := nullif(btrim(p_fridge_name), '');
begin
  if next_fridge_name is null or char_length(next_fridge_name) > 80 then
    raise exception 'invalid_fridge_name';
  end if;

  select member.fridge_uid into current_fridge_uid
  from public.fridge_members as member
  join public.fridges as fridge on fridge.fridge_uid = member.fridge_uid
  where member.device_id = btrim(p_device_id)
    and fridge.status = 'active'
  for update of fridge;

  if current_fridge_uid is null then
    raise exception 'device_has_no_fridge';
  end if;

  update public.fridges
  set name = next_fridge_name
  where fridge_uid = current_fridge_uid;

  return current_fridge_uid;
end;
$$;

-- Arthur: NarIyirm
-- 中文：保留旧 RPC 签名供已部署服务端兼容，但统一使用新的单邀请码轮换规则并立即开启共享模式。
-- EN: Preserve the deployed RPC signature while routing it through the new single-invite rotation rule and enabling shared mode immediately.
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
begin
  return query
  select configured.code, configured.expires_at
  from public.configure_shared_fridge(
    p_device_id,
    null,
    p_code,
    p_expires_at
  ) as configured;
end;
$$;

revoke execute on function public.configure_shared_fridge(text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.rename_current_fridge(text, text) from public, anon, authenticated;
grant execute on function public.configure_shared_fridge(text, text, text, timestamptz) to service_role;
grant execute on function public.rename_current_fridge(text, text) to service_role;

comment on function public.configure_shared_fridge(text, text, text, timestamptz) is
  'Names the current fridge, enables shared mode, revokes any previous active invite, and creates one replacement invite atomically.';
comment on function public.rename_current_fridge(text, text) is
  'Renames the active fridge belonging to an authenticated device membership.';
