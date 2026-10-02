-- Arthur: NarIyirm
-- 中文：删除测试冰箱时级联删除成员会触发同步版本写入；冰箱已不存在时跳过这次无意义的版本与广播。
-- EN: Cascaded member deletion can bump sync after its fridge is gone; skip the version and broadcast for a deleted fridge.

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
  if not exists (select 1 from public.fridges where fridge_uid = p_fridge_uid) then
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
