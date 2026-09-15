-- Arthur: NarIyirm
-- 中文：加入共享冰箱时保留邀请码的真实终态，使过期、已使用和已撤销不会再被折叠为未找到。
-- EN: Preserve an invite's terminal state during shared-fridge joins so expired, used, and revoked codes no longer collapse into not found.

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
  selected_invite_status public.invite_status;
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

  select invite_uid, fridge_uid, expires_at, status
  into selected_invite_uid, target_fridge_uid, selected_invite_expiry, selected_invite_status
  from public.fridge_invites
  where code = upper(btrim(p_code))
  for update;

  if selected_invite_uid is null then
    raise exception 'invite_not_found';
  end if;
  if selected_invite_status = 'expired' or (selected_invite_expiry is not null and selected_invite_expiry <= now()) then
    raise exception 'invite_expired';
  end if;
  if selected_invite_status = 'used' then
    raise exception 'invite_used';
  end if;
  if selected_invite_status = 'revoked' then
    raise exception 'invite_revoked';
  end if;
  if selected_invite_status <> 'active' then
    raise exception 'invite_unavailable';
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

revoke execute on function public.join_shared_fridge(text, text) from public, anon, authenticated;
grant execute on function public.join_shared_fridge(text, text) to service_role;

