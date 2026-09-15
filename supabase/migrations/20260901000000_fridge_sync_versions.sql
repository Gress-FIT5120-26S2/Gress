-- Arthur: NarIyirm
-- 中文：为 Vercel 无状态函数提供轻量同步版本；客户端只轮询版本，变化后再读取当前页面的权威数据。
-- EN: Provide lightweight sync versions for stateless Vercel functions; clients poll versions and fetch authoritative data only when the current page changed.

create table public.fridge_sync_versions (
  fridge_uid uuid primary key references public.fridges(fridge_uid) on delete cascade,
  inventory_version bigint not null default 0 check (inventory_version >= 0),
  cart_version bigint not null default 0 check (cart_version >= 0),
  fridge_version bigint not null default 0 check (fridge_version >= 0),
  notifications_version bigint not null default 0 check (notifications_version >= 0),
  updated_at timestamptz not null default now()
);

insert into public.fridge_sync_versions (fridge_uid)
select fridge_uid from public.fridges
on conflict (fridge_uid) do nothing;

alter table public.fridge_sync_versions enable row level security;
revoke all on table public.fridge_sync_versions from public, anon, authenticated;
grant select, insert, update, delete on table public.fridge_sync_versions to service_role;

create or replace function public.bump_fridge_sync_version(p_fridge_uid uuid, p_domain text)
returns void
language plpgsql
security definer
set search_path = public
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
end;
$$;

create or replace function public.bump_fridge_sync_from_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_fridge_uid uuid;
  new_fridge_uid uuid;
begin
  if tg_op <> 'INSERT' then old_fridge_uid := old.fridge_uid; end if;
  if tg_op <> 'DELETE' then new_fridge_uid := new.fridge_uid; end if;

  perform public.bump_fridge_sync_version(coalesce(new_fridge_uid, old_fridge_uid), tg_argv[0]);
  if old_fridge_uid is not null and new_fridge_uid is distinct from old_fridge_uid then
    perform public.bump_fridge_sync_version(old_fridge_uid, tg_argv[0]);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger fridges_bump_sync_version
after insert or update on public.fridges
for each row execute function public.bump_fridge_sync_from_row('fridge');

create trigger fridge_members_bump_sync_version
after insert or update or delete on public.fridge_members
for each row execute function public.bump_fridge_sync_from_row('fridge');

create trigger fridge_invites_bump_sync_version
after insert or update or delete on public.fridge_invites
for each row execute function public.bump_fridge_sync_from_row('fridge');

create trigger food_categories_bump_sync_version
after insert or update or delete on public.food_categories
for each row execute function public.bump_fridge_sync_from_row('inventory');

create trigger inventory_batches_bump_sync_version
after insert or update or delete on public.inventory_batches
for each row execute function public.bump_fridge_sync_from_row('inventory');

create trigger restock_rules_bump_sync_version
after insert or update or delete on public.restock_rules
for each row execute function public.bump_fridge_sync_from_row('inventory');

create trigger shopping_cart_items_bump_sync_version
after insert or update or delete on public.shopping_cart_items
for each row execute function public.bump_fridge_sync_from_row('cart');

create trigger notifications_bump_sync_version
after insert or update or delete on public.notifications
for each row execute function public.bump_fridge_sync_from_row('notifications');

revoke execute on function public.bump_fridge_sync_version(uuid, text) from public, anon, authenticated;
revoke execute on function public.bump_fridge_sync_from_row() from public, anon, authenticated;
grant execute on function public.bump_fridge_sync_version(uuid, text) to service_role;
