-- Arthur: NarIyirm
-- 中文：把每个库存批次的临期提前天数持久化，并通过兼容旧签名的 RPC 包装器让创建和编辑在同一事务中保存该值。
-- EN: Persist each batch's expiry lead time and use RPC wrappers over the existing signatures so create and edit save it in the same transaction.

alter table public.inventory_batches
  add column expiry_warning_days smallint;

alter table public.inventory_batches
  add constraint inventory_batches_expiry_warning_days_check
  check (expiry_warning_days is null or expiry_warning_days between 1 and 7);

update public.inventory_batches
set expiry_warning_days = 3
where expires_at is not null;

create function public.create_inventory_batch(
  p_device_id text,
  p_category_code text,
  p_name text,
  p_storage_zone public.storage_zone,
  p_initial_quantity numeric,
  p_unit text,
  p_expiry_warning_days smallint,
  p_purchase_price numeric default null,
  p_currency char(3) default 'AUD',
  p_expires_at timestamptz default null,
  p_restock_enabled boolean default false,
  p_restock_minimum_quantity numeric default null,
  p_restock_target_quantity numeric default null,
  p_preset_uid uuid default null
)
returns public.inventory_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_batch public.inventory_batches;
begin
  if p_expires_at is not null and (p_expiry_warning_days is null or p_expiry_warning_days not between 1 and 7) then
    raise exception 'Expiry warning days must be between 1 and 7';
  end if;

  created_batch := public.create_inventory_batch(
    p_device_id,
    p_category_code,
    p_name,
    p_storage_zone,
    p_initial_quantity,
    p_unit,
    p_purchase_price,
    p_currency,
    p_expires_at,
    p_restock_enabled,
    p_restock_minimum_quantity,
    p_restock_target_quantity,
    p_preset_uid
  );

  update public.inventory_batches
  set expiry_warning_days = case when p_expires_at is null then null else p_expiry_warning_days end
  where batch_uid = created_batch.batch_uid
  returning * into created_batch;

  return created_batch;
end;
$$;

revoke execute on function public.create_inventory_batch(
  text, text, text, public.storage_zone, numeric, text, smallint, numeric, char(3), timestamptz, boolean, numeric, numeric, uuid
) from public, anon, authenticated;

grant execute on function public.create_inventory_batch(
  text, text, text, public.storage_zone, numeric, text, smallint, numeric, char(3), timestamptz, boolean, numeric, numeric, uuid
) to service_role;

create function public.update_inventory_batch_details(
  p_device_id text,
  p_batch_uid uuid,
  p_expected_version integer,
  p_category_code text,
  p_name text,
  p_storage_zone public.storage_zone,
  p_remaining_quantity numeric,
  p_unit text,
  p_expiry_warning_days smallint,
  p_purchase_price numeric default null,
  p_expires_at timestamptz default null
)
returns public.inventory_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_batch public.inventory_batches;
begin
  if p_expires_at is not null and (p_expiry_warning_days is null or p_expiry_warning_days not between 1 and 7) then
    raise exception 'Expiry warning days must be between 1 and 7';
  end if;

  updated_batch := public.update_inventory_batch_details(
    p_device_id,
    p_batch_uid,
    p_expected_version,
    p_category_code,
    p_name,
    p_storage_zone,
    p_remaining_quantity,
    p_unit,
    p_purchase_price,
    p_expires_at
  );

  update public.inventory_batches
  set expiry_warning_days = case when p_expires_at is null then null else p_expiry_warning_days end
  where batch_uid = updated_batch.batch_uid
  returning * into updated_batch;

  return updated_batch;
end;
$$;

revoke execute on function public.update_inventory_batch_details(
  text, uuid, integer, text, text, public.storage_zone, numeric, text, smallint, numeric, timestamptz
) from public, anon, authenticated;

grant execute on function public.update_inventory_batch_details(
  text, uuid, integer, text, text, public.storage_zone, numeric, text, smallint, numeric, timestamptz
) to service_role;
