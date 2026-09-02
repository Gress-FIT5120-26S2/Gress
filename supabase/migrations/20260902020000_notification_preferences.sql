-- Arthur: NarIyirm
-- 中文：在设备资料中保存独立通知偏好，让共享成员可以分别控制提醒类别、角标和免打扰时段。
-- EN: Persist device-specific notification preferences so shared members can independently control categories, badges, and quiet hours.

alter table public.device_profiles
  add column notifications_enabled boolean not null default true,
  add column notification_badges_enabled boolean not null default true,
  add column quiet_hours_enabled boolean not null default false,
  add column quiet_hours_start time without time zone not null default time '22:00',
  add column quiet_hours_end time without time zone not null default time '08:00',
  add column expiring_notifications_enabled boolean not null default true,
  add column restock_notifications_enabled boolean not null default true,
  add column shared_notifications_enabled boolean not null default true,
  add column system_notifications_enabled boolean not null default true,
  add column notification_time_zone text not null default 'UTC',
  add constraint device_profiles_quiet_hours_distinct check (quiet_hours_start <> quiet_hours_end),
  add constraint device_profiles_notification_time_zone_valid check (
    char_length(notification_time_zone) between 1 and 100
    and notification_time_zone = btrim(notification_time_zone)
    and notification_time_zone !~ '[[:cntrl:]]'
  );

-- Arthur: NarIyirm
-- 中文：设备恢复时连同通知偏好一起覆盖新设备的临时资料，保持用户原来的安静时段和提醒选择。
-- EN: Device recovery carries notification preferences into the new device profile, preserving quiet hours and category choices.
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
    notification_time_zone
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
    profile.notification_time_zone
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
        notification_time_zone = excluded.notification_time_zone;

  delete from public.device_profiles
  where device_id = old.device_id;

  return new;
end;
$$;

revoke execute on function public.transfer_device_profile_with_membership() from public, anon, authenticated;

comment on column public.device_profiles.notifications_enabled is
  'Master switch for reminders shown to this device; shared notification records are not deleted.';
comment on column public.device_profiles.shared_notifications_enabled is
  'Reserved device preference for shared-fridge activity notifications.';
comment on column public.device_profiles.notification_time_zone is
  'IANA time zone used to evaluate this device quiet-hours window.';
