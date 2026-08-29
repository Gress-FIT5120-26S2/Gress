-- Arthur: NarIyirm
-- 中文：详情页的修改全部通过原子函数完成，使批次版本、当前库存、库存流水和补货规则在共享冰箱中保持一致。
-- EN: Detail-sheet mutations run atomically so batch versions, current stock, inventory events, and restock rules stay consistent in shared fridges.

create or replace function public.adjust_inventory_batch_quantity(
  p_device_id text,
  p_batch_uid uuid,
  p_remaining_quantity numeric,
  p_expected_version integer
)
returns public.inventory_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  current_batch public.inventory_batches;
  updated_batch public.inventory_batches;
  quantity_delta numeric;
begin
  if p_remaining_quantity is null or p_remaining_quantity < 0 then
    raise exception 'Remaining quantity cannot be negative';
  end if;

  current_fridge_uid := public.bootstrap_device(p_device_id);

  select batch.*
  into current_batch
  from public.inventory_batches as batch
  where batch.batch_uid = p_batch_uid
    and batch.fridge_uid = current_fridge_uid
    and batch.lifecycle_state = 'active'
  for update;

  if current_batch.batch_uid is null then
    raise exception 'Inventory batch not found';
  end if;
  if current_batch.version <> p_expected_version then
    raise exception 'Inventory batch version conflict';
  end if;
  if p_remaining_quantity > current_batch.initial_quantity then
    raise exception 'Remaining quantity cannot exceed the stocked quantity';
  end if;

  quantity_delta := p_remaining_quantity - current_batch.remaining_quantity;

  update public.inventory_batches
  set
    remaining_quantity = p_remaining_quantity,
    lifecycle_state = case when p_remaining_quantity = 0 then 'consumed' else 'active' end,
    version = version + 1,
    updated_at = now()
  where batch_uid = current_batch.batch_uid
  returning * into updated_batch;

  if quantity_delta <> 0 then
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
      current_batch.batch_uid,
      btrim(p_device_id),
      case when quantity_delta < 0 then 'consume'::public.inventory_event_type else 'adjust'::public.inventory_event_type end,
      quantity_delta,
      case
        when current_batch.purchase_price is null then 0
        else (quantity_delta / current_batch.initial_quantity) * current_batch.purchase_price
      end,
      'Changed from inventory detail'
    );
  end if;

  return updated_batch;
end;
$$;

create or replace function public.update_inventory_batch_details(
  p_device_id text,
  p_batch_uid uuid,
  p_expected_version integer,
  p_category_code text,
  p_name text,
  p_storage_zone public.storage_zone,
  p_remaining_quantity numeric,
  p_unit text,
  p_purchase_price numeric default null,
  p_expires_at timestamptz default null
)
returns public.inventory_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  current_category_uid uuid;
  current_batch public.inventory_batches;
  current_rule public.restock_rules;
  updated_batch public.inventory_batches;
  quantity_delta numeric;
begin
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'A food name is required';
  end if;
  if p_unit is null or char_length(btrim(p_unit)) = 0 then
    raise exception 'A unit is required';
  end if;
  if p_remaining_quantity is null or p_remaining_quantity < 0 then
    raise exception 'Remaining quantity cannot be negative';
  end if;
  if p_purchase_price is not null and p_purchase_price < 0 then
    raise exception 'Purchase price cannot be negative';
  end if;

  current_fridge_uid := public.bootstrap_device(p_device_id);

  select batch.*
  into current_batch
  from public.inventory_batches as batch
  where batch.batch_uid = p_batch_uid
    and batch.fridge_uid = current_fridge_uid
    and batch.lifecycle_state = 'active'
  for update;

  if current_batch.batch_uid is null then
    raise exception 'Inventory batch not found';
  end if;
  if current_batch.version <> p_expected_version then
    raise exception 'Inventory batch version conflict';
  end if;
  if p_remaining_quantity > current_batch.initial_quantity then
    raise exception 'Remaining quantity cannot exceed the stocked quantity';
  end if;
  if p_expires_at is not null and p_expires_at < current_batch.stocked_at then
    raise exception 'Expiry time cannot be before the stocked time';
  end if;

  select category.category_uid
  into current_category_uid
  from public.food_categories as category
  where category.fridge_uid = current_fridge_uid
    and category.system_code = p_category_code;

  if current_category_uid is null then
    raise exception 'Unknown category code';
  end if;

  select rule.*
  into current_rule
  from public.restock_rules as rule
  where rule.fridge_uid = current_fridge_uid
    and rule.preset_uid is null
    and rule.normalized_item_name = current_batch.normalized_name
    and rule.unit = current_batch.unit
  for update;

  quantity_delta := p_remaining_quantity - current_batch.remaining_quantity;

  update public.inventory_batches
  set
    category_uid = current_category_uid,
    name = btrim(p_name),
    storage_zone = p_storage_zone,
    remaining_quantity = p_remaining_quantity,
    unit = btrim(p_unit),
    purchase_price = p_purchase_price,
    expires_at = p_expires_at,
    lifecycle_state = case when p_remaining_quantity = 0 then 'consumed' else 'active' end,
    version = version + 1,
    updated_at = now()
  where batch_uid = current_batch.batch_uid
  returning * into updated_batch;

  if quantity_delta <> 0 then
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
      current_batch.batch_uid,
      btrim(p_device_id),
      case when quantity_delta < 0 then 'consume'::public.inventory_event_type else 'adjust'::public.inventory_event_type end,
      quantity_delta,
      case
        when current_batch.purchase_price is null then 0
        else (quantity_delta / current_batch.initial_quantity) * current_batch.purchase_price
      end,
      'Changed while editing inventory details'
    );
  end if;

  if current_rule.rule_uid is not null and (
    current_batch.normalized_name <> lower(btrim(p_name))
    or current_batch.unit <> btrim(p_unit)
  ) then
    delete from public.restock_rules where rule_uid = current_rule.rule_uid;

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
      current_rule.minimum_quantity,
      current_rule.target_quantity,
      btrim(p_unit),
      current_rule.is_enabled
    )
    on conflict (fridge_uid, normalized_item_name, unit) where preset_uid is null
    do update set
      minimum_quantity = excluded.minimum_quantity,
      target_quantity = excluded.target_quantity,
      is_enabled = excluded.is_enabled,
      updated_at = now();
  end if;

  return updated_batch;
end;
$$;

create or replace function public.set_inventory_restock_rule(
  p_device_id text,
  p_batch_uid uuid,
  p_enabled boolean,
  p_minimum_quantity numeric default null,
  p_target_quantity numeric default null
)
returns public.restock_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  current_batch public.inventory_batches;
  saved_rule public.restock_rules;
begin
  current_fridge_uid := public.bootstrap_device(p_device_id);

  select batch.*
  into current_batch
  from public.inventory_batches as batch
  where batch.batch_uid = p_batch_uid
    and batch.fridge_uid = current_fridge_uid
    and batch.lifecycle_state = 'active';

  if current_batch.batch_uid is null then
    raise exception 'Inventory batch not found';
  end if;

  if not p_enabled then
    update public.restock_rules
    set is_enabled = false, updated_at = now()
    where fridge_uid = current_fridge_uid
      and preset_uid is null
      and normalized_item_name = current_batch.normalized_name
      and unit = current_batch.unit
    returning * into saved_rule;
    return saved_rule;
  end if;

  if p_minimum_quantity is null
    or p_target_quantity is null
    or p_minimum_quantity < 0
    or p_target_quantity <= p_minimum_quantity then
    raise exception 'Restock target must be higher than the minimum quantity';
  end if;

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
    current_batch.normalized_name,
    p_minimum_quantity,
    p_target_quantity,
    current_batch.unit,
    true
  )
  on conflict (fridge_uid, normalized_item_name, unit) where preset_uid is null
  do update set
    minimum_quantity = excluded.minimum_quantity,
    target_quantity = excluded.target_quantity,
    is_enabled = true,
    updated_at = now()
  returning * into saved_rule;

  return saved_rule;
end;
$$;

create or replace function public.archive_inventory_batch(
  p_device_id text,
  p_batch_uid uuid,
  p_expected_version integer
)
returns public.inventory_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  current_batch public.inventory_batches;
  archived_batch public.inventory_batches;
begin
  current_fridge_uid := public.bootstrap_device(p_device_id);

  select batch.*
  into current_batch
  from public.inventory_batches as batch
  where batch.batch_uid = p_batch_uid
    and batch.fridge_uid = current_fridge_uid
    and batch.lifecycle_state = 'active'
  for update;

  if current_batch.batch_uid is null then
    raise exception 'Inventory batch not found';
  end if;
  if current_batch.version <> p_expected_version then
    raise exception 'Inventory batch version conflict';
  end if;

  update public.inventory_batches
  set
    remaining_quantity = 0,
    lifecycle_state = 'archived',
    version = version + 1,
    updated_at = now()
  where batch_uid = current_batch.batch_uid
  returning * into archived_batch;

  if current_batch.remaining_quantity <> 0 then
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
      current_batch.batch_uid,
      btrim(p_device_id),
      'adjust',
      -current_batch.remaining_quantity,
      case
        when current_batch.purchase_price is null then 0
        else (-current_batch.remaining_quantity / current_batch.initial_quantity) * current_batch.purchase_price
      end,
      'Removed from active fridge inventory'
    );
  end if;

  return archived_batch;
end;
$$;

revoke execute on function public.adjust_inventory_batch_quantity(text, uuid, numeric, integer) from public, anon, authenticated;
revoke execute on function public.update_inventory_batch_details(text, uuid, integer, text, text, public.storage_zone, numeric, text, numeric, timestamptz) from public, anon, authenticated;
revoke execute on function public.set_inventory_restock_rule(text, uuid, boolean, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.archive_inventory_batch(text, uuid, integer) from public, anon, authenticated;

grant execute on function public.adjust_inventory_batch_quantity(text, uuid, numeric, integer) to service_role;
grant execute on function public.update_inventory_batch_details(text, uuid, integer, text, text, public.storage_zone, numeric, text, numeric, timestamptz) to service_role;
grant execute on function public.set_inventory_restock_rule(text, uuid, boolean, numeric, numeric) to service_role;
grant execute on function public.archive_inventory_batch(text, uuid, integer) to service_role;
