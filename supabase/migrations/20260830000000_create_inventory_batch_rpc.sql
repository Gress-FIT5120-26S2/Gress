-- Arthur: NarIyirm
-- 中文：以一个数据库函数原子创建库存批次、入库流水和可选补货规则，避免前端串行请求留下半完成数据。
-- EN: Create a batch, stock event, and optional restock rule atomically so sequential client requests cannot leave partial data.
create or replace function public.create_inventory_batch(
  p_device_id text,
  p_category_code text,
  p_name text,
  p_storage_zone public.storage_zone,
  p_initial_quantity numeric,
  p_unit text,
  p_purchase_price numeric default null,
  p_currency char(3) default 'AUD',
  p_expires_at timestamptz default null,
  p_restock_enabled boolean default false,
  p_restock_minimum_quantity numeric default null,
  p_restock_target_quantity numeric default null
)
returns public.inventory_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  current_category_uid uuid;
  created_batch public.inventory_batches;
begin
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'A food name is required';
  end if;

  if p_initial_quantity is null or p_initial_quantity <= 0 then
    raise exception 'Initial quantity must be greater than zero';
  end if;

  if p_unit is null or char_length(btrim(p_unit)) = 0 then
    raise exception 'A unit is required';
  end if;

  if p_purchase_price is not null and p_purchase_price < 0 then
    raise exception 'Purchase price cannot be negative';
  end if;

  if p_expires_at is not null and p_expires_at < now() then
    raise exception 'Expiry time must be in the future';
  end if;

  if p_restock_enabled and (
    p_restock_minimum_quantity is null
    or p_restock_target_quantity is null
    or p_restock_minimum_quantity < 0
    or p_restock_target_quantity <= p_restock_minimum_quantity
  ) then
    raise exception 'Restock target must be higher than the minimum quantity';
  end if;

  current_fridge_uid := public.bootstrap_device(p_device_id);

  select category.category_uid
  into current_category_uid
  from public.food_categories as category
  where category.fridge_uid = current_fridge_uid
    and category.system_code = p_category_code;

  if current_category_uid is null then
    raise exception 'Unknown category code';
  end if;

  insert into public.inventory_batches (
    fridge_uid,
    category_uid,
    created_by_device_id,
    preset_uid,
    name,
    storage_zone,
    initial_quantity,
    remaining_quantity,
    unit,
    purchase_price,
    currency,
    expires_at
  )
  values (
    current_fridge_uid,
    current_category_uid,
    btrim(p_device_id),
    null,
    btrim(p_name),
    p_storage_zone,
    p_initial_quantity,
    p_initial_quantity,
    btrim(p_unit),
    p_purchase_price,
    coalesce(p_currency, 'AUD'),
    p_expires_at
  )
  returning * into created_batch;

  insert into public.inventory_events (
    fridge_uid,
    batch_uid,
    actor_device_id,
    event_type,
    quantity_change,
    value_change,
    note
  )
  values (
    current_fridge_uid,
    created_batch.batch_uid,
    btrim(p_device_id),
    'stock',
    p_initial_quantity,
    0,
    'Created by inventory entry'
  );

  if p_restock_enabled then
    insert into public.restock_rules (
      fridge_uid,
      preset_uid,
      normalized_item_name,
      minimum_quantity,
      target_quantity,
      unit,
      is_enabled
    )
    values (
      current_fridge_uid,
      null,
      lower(btrim(p_name)),
      p_restock_minimum_quantity,
      p_restock_target_quantity,
      btrim(p_unit),
      true
    )
    on conflict (fridge_uid, normalized_item_name, unit) where preset_uid is null
    do update set
      minimum_quantity = excluded.minimum_quantity,
      target_quantity = excluded.target_quantity,
      is_enabled = true,
      updated_at = now();
  end if;

  return created_batch;
end;
$$;

revoke execute on function public.create_inventory_batch(
  text, text, text, public.storage_zone, numeric, text, numeric, char(3), timestamptz, boolean, numeric, numeric
) from public, anon, authenticated;

grant execute on function public.create_inventory_batch(
  text, text, text, public.storage_zone, numeric, text, numeric, char(3), timestamptz, boolean, numeric, numeric
) to service_role;
