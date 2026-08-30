-- EN: Opening the inbox upserts notifications from live stock; dedupe_key prevents duplicate rows.

create or replace function public.sync_fridge_notifications(p_fridge uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    fridge_uid, related_batch_uid, notification_type,
    message_key, message_payload, dedupe_key
  )
  select
    b.fridge_uid,
    b.batch_uid,
    'expiring',
    'notifications.expiring',
    jsonb_build_object('name', b.name),
    'expiring:' || b.fridge_uid::text || ':' || b.batch_uid::text
  from public.inventory_batches as b
  where b.fridge_uid = p_fridge
    and b.lifecycle_state = 'active'
    and b.expires_at is not null
    and b.expires_at > now()
    and b.expires_at <= now() + interval '3 days'
  on conflict (dedupe_key) do nothing;

  insert into public.notifications (
    fridge_uid, related_batch_uid, notification_type,
    message_key, message_payload, dedupe_key
  )
  select
    b.fridge_uid,
    b.batch_uid,
    'expired',
    'notifications.expired',
    jsonb_build_object('name', b.name),
    'expired:' || b.fridge_uid::text || ':' || b.batch_uid::text
  from public.inventory_batches as b
  where b.fridge_uid = p_fridge
    and b.lifecycle_state = 'active'
    and b.expires_at is not null
    and b.expires_at <= now()
  on conflict (dedupe_key) do nothing;

  insert into public.notifications (
    fridge_uid, related_batch_uid, notification_type,
    message_key, message_payload, dedupe_key
  )
  select
    p_fridge,
    null,
    'restock',
    'notifications.restock',
    jsonb_build_object(
      'name', s.name,
      'unit', s.unit,
      'currentQuantity', s.current_quantity,
      'minimumQuantity', s.minimum_quantity
    ),
    'restock:' || p_fridge::text || ':' || lower(s.name) || ':' || s.unit
  from public.get_restock_suggestions(p_fridge) as s
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke execute on function public.sync_fridge_notifications(uuid) from public, anon, authenticated;
grant execute on function public.sync_fridge_notifications(uuid) to service_role;