-- Arthur: NarIyirm
-- 中文：为设备制共享冰箱增加只携带领域版本的 Broadcast 失效通知；频道能力值不包含业务数据，权威读取仍只经过 Express。
-- EN: Add domain-version Broadcast invalidations for device-based shared fridges; capability topics carry no domain data and authoritative reads still go through Express.

alter table public.fridge_sync_versions
  add column broadcast_topic text
  default encode(extensions.gen_random_bytes(32), 'hex');

update public.fridge_sync_versions
set broadcast_topic = encode(extensions.gen_random_bytes(32), 'hex')
where broadcast_topic is null;

alter table public.fridge_sync_versions
  alter column broadcast_topic set not null;

create unique index fridge_sync_versions_broadcast_topic_key
  on public.fridge_sync_versions (broadcast_topic);

create or replace function public.send_fridge_sync_broadcast(
  p_fridge_uid uuid,
  p_domain text
)
returns void
language plpgsql
security definer
set search_path = public, realtime, extensions
as $$
declare
  sync_row public.fridge_sync_versions%rowtype;
  domain_version text;
begin
  if p_fridge_uid is null or p_domain not in ('inventory', 'cart', 'fridge', 'notifications') then
    return;
  end if;

  select sync_versions.*
  into sync_row
  from public.fridge_sync_versions as sync_versions
  join public.fridges as fridge on fridge.fridge_uid = sync_versions.fridge_uid
  where sync_versions.fridge_uid = p_fridge_uid
    and fridge.mode = 'shared'
    and fridge.status = 'active';

  if not found then return; end if;

  domain_version := case p_domain
    when 'inventory' then sync_row.inventory_version::text
    when 'cart' then sync_row.cart_version::text
    when 'fridge' then sync_row.fridge_version::text
    when 'notifications' then sync_row.notifications_version::text
  end;

  begin
    perform realtime.send(
      jsonb_build_object(
        'domain', p_domain,
        'version', domain_version,
        'emittedAt', now()
      ),
      'sync_invalidated',
      'kitchmemo:fridge:' || sync_row.broadcast_topic,
      false
    );
  exception when others then
    -- Broadcast 不可用时不能回滚库存事务，客户端仍会通过版本探针补偿。
    -- A Realtime outage must not roll back domain writes because the version probe remains the fallback.
    raise warning 'KitchMemo Broadcast unavailable for fridge % and domain %: %', p_fridge_uid, p_domain, sqlerrm;
  end;
end;
$$;

create or replace function public.bump_fridge_sync_version(p_fridge_uid uuid, p_domain text)
returns void
language plpgsql
security definer
set search_path = public, realtime, extensions
as $$
begin
  if p_fridge_uid is null or p_domain not in ('inventory', 'cart', 'fridge', 'notifications') then
    return;
  end if;

  insert into public.fridge_sync_versions (
    fridge_uid,
    inventory_version,
    cart_version,
    fridge_version,
    notifications_version
  ) values (
    p_fridge_uid,
    case when p_domain = 'inventory' then 1 else 0 end,
    case when p_domain = 'cart' then 1 else 0 end,
    case when p_domain = 'fridge' then 1 else 0 end,
    case when p_domain = 'notifications' then 1 else 0 end
  )
  on conflict (fridge_uid) do update set
    inventory_version = public.fridge_sync_versions.inventory_version
      + case when p_domain = 'inventory' then 1 else 0 end,
    cart_version = public.fridge_sync_versions.cart_version
      + case when p_domain = 'cart' then 1 else 0 end,
    fridge_version = public.fridge_sync_versions.fridge_version
      + case when p_domain = 'fridge' then 1 else 0 end,
    notifications_version = public.fridge_sync_versions.notifications_version
      + case when p_domain = 'notifications' then 1 else 0 end,
    updated_at = now();

  perform public.send_fridge_sync_broadcast(p_fridge_uid, p_domain);
end;
$$;

revoke execute on function public.send_fridge_sync_broadcast(uuid, text) from public, anon, authenticated;
grant execute on function public.send_fridge_sync_broadcast(uuid, text) to service_role;
