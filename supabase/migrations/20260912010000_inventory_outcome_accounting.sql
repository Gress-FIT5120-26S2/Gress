-- Arthur: NarIyirm
-- 中文：为成就统计补齐价格来源、明确期限与库存结算审计；历史缺价保持“未知”，新写入由 v2 RPC 强制提供价格。
-- EN: Add price provenance, explicit deadlines, and auditable inventory outcomes; legacy missing prices stay unknown while v2 RPCs require new prices.

alter table public.inventory_batches
  add column best_before_at timestamptz,
  add column price_status text,
  add column price_source text;

update public.inventory_batches
set
  price_status = case when purchase_price is null then 'legacy_unknown' else case when purchase_price = 0 then 'free' else 'recorded' end end,
  price_source = 'legacy';

alter table public.inventory_batches
  alter column price_status set not null,
  alter column price_source set not null,
  alter column price_status set default 'legacy_unknown',
  alter column price_source set default 'legacy';

alter table public.inventory_batches
  add constraint inventory_batches_best_before_after_stocking
    check (best_before_at is null or best_before_at >= stocked_at),
  add constraint inventory_batches_price_status_valid
    check (price_status in ('recorded', 'free', 'legacy_unknown')),
  add constraint inventory_batches_price_source_valid
    check (price_source in ('user', 'barcode', 'recognition', 'legacy')),
  add constraint inventory_batches_price_state_consistent
    check (
      (price_status = 'legacy_unknown' and purchase_price is null)
      or (price_status = 'free' and purchase_price = 0)
      or (price_status = 'recorded' and purchase_price > 0)
    );

-- Arthur: NarIyirm
-- 中文：旧 RPC 尚未接收 price_status；在每次价格写入前同步状态，使兼容调用也始终满足价格一致性约束。
-- EN: Legacy RPCs do not accept price_status, so synchronize it before each price write to keep compatibility calls inside the consistency constraint.
create function public.sync_inventory_price_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.price_status := case
      when new.purchase_price is null then 'legacy_unknown'
      when new.purchase_price = 0 then 'free'
      else 'recorded'
    end;
  elsif new.purchase_price is distinct from old.purchase_price then
    new.price_status := case
      when new.purchase_price is null then 'legacy_unknown'
      when new.purchase_price = 0 then 'free'
      else 'recorded'
    end;
  end if;
  return new;
end;
$$;

create trigger inventory_batches_sync_price_status
before insert or update on public.inventory_batches
for each row execute function public.sync_inventory_price_status();

create index inventory_batches_fridge_best_before_idx
  on public.inventory_batches (fridge_uid, best_before_at)
  where lifecycle_state = 'active' and best_before_at is not null;

alter table public.inventory_events
  add column reason_code text,
  add column was_in_warning_window boolean not null default false,
  add column date_type_snapshot text,
  add column deadline_snapshot timestamptz,
  add column purchase_price_snapshot numeric(12, 2),
  add column currency_snapshot char(3),
  add column initial_quantity_snapshot numeric(12, 3);

alter table public.inventory_events
  add constraint inventory_events_reason_code_valid check (
    reason_code is null or reason_code in (
      'used', 'spoiled', 'overbought', 'forgotten', 'unwanted',
      'quality_rejected', 'other', 'confirmed_use_by_expiry',
      'auto_use_by_expiry', 'data_correction'
    )
  ),
  add constraint inventory_events_date_type_valid check (
    date_type_snapshot is null or date_type_snapshot in ('use_by', 'best_before', 'estimated_quality', 'legacy_expiry')
  );

-- Arthur: NarIyirm
-- 中文：创建入口仍复用已部署 RPC 的权限、库存流水和补货事务，再在同一数据库事务内写入新数据契约。
-- EN: The v2 create entry reuses the deployed RPC's permissions, stock event, and restock transaction, then writes the new contract in the same database transaction.
create function public.create_inventory_batch_v2(
  p_device_id text,
  p_category_code text,
  p_name text,
  p_storage_zone public.storage_zone,
  p_initial_quantity numeric,
  p_unit text,
  p_purchase_price numeric,
  p_price_source text,
  p_deadline_type text,
  p_deadline_at timestamptz,
  p_expiry_warning_days smallint,
  p_restock_enabled boolean,
  p_restock_minimum_quantity numeric,
  p_restock_target_quantity numeric,
  p_preset_uid uuid
)
returns public.inventory_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_batch public.inventory_batches;
begin
  if p_purchase_price is null or p_purchase_price < 0 then
    raise exception 'Purchase price is required and cannot be negative';
  end if;
  if p_price_source not in ('user', 'barcode', 'recognition') then
    raise exception 'Unknown price source';
  end if;
  if p_deadline_type not in ('none', 'use_by', 'best_before') then
    raise exception 'Unknown deadline type';
  end if;
  if (p_deadline_type = 'none') <> (p_deadline_at is null) then
    raise exception 'Deadline type and time are inconsistent';
  end if;

  created_batch := public.create_inventory_batch(
    p_device_id,
    p_category_code,
    p_name,
    p_storage_zone,
    p_initial_quantity,
    p_unit,
    p_expiry_warning_days,
    p_purchase_price,
    'AUD',
    p_deadline_at,
    p_restock_enabled,
    p_restock_minimum_quantity,
    p_restock_target_quantity,
    p_preset_uid
  );

  update public.inventory_batches
  set
    use_by_at = case when p_deadline_type = 'use_by' then p_deadline_at else null end,
    best_before_at = case when p_deadline_type = 'best_before' then p_deadline_at else null end,
    price_status = case when p_purchase_price = 0 then 'free' else 'recorded' end,
    price_source = p_price_source
  where batch_uid = created_batch.batch_uid
  returning * into created_batch;

  update public.inventory_events
  set
    purchase_price_snapshot = created_batch.purchase_price,
    currency_snapshot = created_batch.currency,
    initial_quantity_snapshot = created_batch.initial_quantity,
    date_type_snapshot = case when p_deadline_type = 'none' then null else p_deadline_type end,
    deadline_snapshot = p_deadline_at
  where batch_uid = created_batch.batch_uid
    and event_type = 'stock';

  return created_batch;
end;
$$;

revoke execute on function public.create_inventory_batch_v2(text, text, text, public.storage_zone, numeric, text, numeric, text, text, timestamptz, smallint, boolean, numeric, numeric, uuid) from public, anon, authenticated;
grant execute on function public.create_inventory_batch_v2(text, text, text, public.storage_zone, numeric, text, numeric, text, text, timestamptz, smallint, boolean, numeric, numeric, uuid) to service_role;

-- Arthur: NarIyirm
-- 中文：编辑入口先锁定并校验当前批次，过了 use-by 后禁止通过编辑或数量草稿把减少伪装成“已使用”。
-- EN: The v2 edit entry locks and validates the current batch so a post-use-by decrease cannot be disguised as consumption through editing or a quantity draft.
create function public.update_inventory_batch_details_v2(
  p_device_id text,
  p_batch_uid uuid,
  p_expected_version integer,
  p_category_code text,
  p_name text,
  p_storage_zone public.storage_zone,
  p_remaining_quantity numeric,
  p_unit text,
  p_purchase_price numeric,
  p_price_source text,
  p_deadline_type text,
  p_deadline_at timestamptz,
  p_expiry_warning_days smallint
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
  if p_purchase_price is null or p_purchase_price < 0 then
    raise exception 'Purchase price is required and cannot be negative';
  end if;
  if p_price_source not in ('user', 'barcode', 'recognition') then
    raise exception 'Unknown price source';
  end if;
  if p_deadline_type not in ('none', 'use_by', 'best_before') then
    raise exception 'Unknown deadline type';
  end if;
  if (p_deadline_type = 'none') <> (p_deadline_at is null) then
    raise exception 'Deadline type and time are inconsistent';
  end if;

  current_fridge_uid := public.bootstrap_device(p_device_id);
  select batch.* into current_batch
  from public.inventory_batches as batch
  where batch.batch_uid = p_batch_uid
    and batch.fridge_uid = current_fridge_uid
    and batch.lifecycle_state = 'active'
  for update;

  if current_batch.batch_uid is null then raise exception 'Inventory batch not found'; end if;
  if current_batch.version <> p_expected_version then raise exception 'Inventory batch version conflict'; end if;
  if p_remaining_quantity < current_batch.remaining_quantity and current_batch.use_by_at <= now() then
    raise exception 'inventory_use_by_expired';
  end if;
  quantity_delta := p_remaining_quantity - current_batch.remaining_quantity;

  updated_batch := public.update_inventory_batch_details(
    p_device_id,
    p_batch_uid,
    p_expected_version,
    p_category_code,
    p_name,
    p_storage_zone,
    p_remaining_quantity,
    p_unit,
    p_expiry_warning_days,
    p_purchase_price,
    p_deadline_at
  );

  update public.inventory_batches
  set
    use_by_at = case when p_deadline_type = 'use_by' then p_deadline_at else null end,
    best_before_at = case when p_deadline_type = 'best_before' then p_deadline_at else null end,
    price_status = case when p_purchase_price = 0 then 'free' else 'recorded' end,
    price_source = p_price_source
  where batch_uid = updated_batch.batch_uid
  returning * into updated_batch;

  if quantity_delta <> 0 then
    update public.inventory_events
    set
      reason_code = case when quantity_delta < 0 then 'used' else 'data_correction' end,
      was_in_warning_window = quantity_delta < 0 and p_deadline_at is not null
        and p_deadline_at >= now()
        and p_deadline_at <= now() + make_interval(days => coalesce(p_expiry_warning_days, 3)),
      date_type_snapshot = case when p_deadline_type = 'none' then null else p_deadline_type end,
      deadline_snapshot = p_deadline_at,
      purchase_price_snapshot = current_batch.purchase_price,
      currency_snapshot = current_batch.currency,
      initial_quantity_snapshot = current_batch.initial_quantity
    where event_uid = (
      select event.event_uid
      from public.inventory_events as event
      where event.batch_uid = current_batch.batch_uid
        and event.note = 'Changed while editing inventory details'
        and event.reason_code is null
      order by event.occurred_at desc
      limit 1
    );
  end if;

  return updated_batch;
end;
$$;

revoke execute on function public.update_inventory_batch_details_v2(text, uuid, integer, text, text, public.storage_zone, numeric, text, numeric, text, text, timestamptz, smallint) from public, anon, authenticated;
grant execute on function public.update_inventory_batch_details_v2(text, uuid, integer, text, text, public.storage_zone, numeric, text, numeric, text, text, timestamptz, smallint) to service_role;

-- Arthur: NarIyirm
-- 中文：所有“移出”语义在一次锁内结算数量、生命周期和金额流水；use-by 已过期时只允许丢弃或数据纠错。
-- EN: Resolve quantity, lifecycle, and value history under one lock for every removal; after use-by only discard or data correction is allowed.
create function public.resolve_inventory_batch(
  p_device_id text,
  p_batch_uid uuid,
  p_expected_version integer,
  p_outcome text,
  p_reason_code text
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
  event_kind public.inventory_event_type;
  next_lifecycle public.inventory_lifecycle;
  snapshot_date_type text;
  snapshot_deadline timestamptz;
  in_warning_window boolean := false;
begin
  if p_outcome not in ('consume', 'discard', 'correction') then raise exception 'Unknown inventory outcome'; end if;
  if p_reason_code not in ('used', 'spoiled', 'overbought', 'forgotten', 'unwanted', 'quality_rejected', 'other', 'confirmed_use_by_expiry', 'data_correction') then
    raise exception 'Unknown inventory outcome reason';
  end if;

  current_fridge_uid := public.bootstrap_device(p_device_id);
  select batch.* into current_batch
  from public.inventory_batches as batch
  where batch.batch_uid = p_batch_uid
    and batch.fridge_uid = current_fridge_uid
    and batch.lifecycle_state = 'active'
  for update;

  if current_batch.batch_uid is null then raise exception 'Inventory batch not found'; end if;
  if current_batch.version <> p_expected_version then raise exception 'Inventory batch version conflict'; end if;
  if p_outcome = 'consume' and current_batch.use_by_at <= now() then raise exception 'inventory_use_by_expired'; end if;
  if p_outcome = 'consume' and p_reason_code <> 'used' then raise exception 'Consume outcome requires used reason'; end if;
  if p_outcome = 'discard' and p_reason_code in ('used', 'data_correction') then raise exception 'Discard outcome requires a discard reason'; end if;
  if p_reason_code = 'confirmed_use_by_expiry' and (current_batch.use_by_at is null or current_batch.use_by_at > now()) then raise exception 'Use-by expiry is not confirmed'; end if;
  if p_outcome = 'correction' and p_reason_code <> 'data_correction' then raise exception 'Correction outcome requires data correction reason'; end if;

  if current_batch.use_by_at is not null then
    snapshot_date_type := 'use_by'; snapshot_deadline := current_batch.use_by_at;
  elsif current_batch.best_before_at is not null then
    snapshot_date_type := 'best_before'; snapshot_deadline := current_batch.best_before_at;
  elsif current_batch.estimated_quality_until is not null then
    snapshot_date_type := 'estimated_quality'; snapshot_deadline := current_batch.estimated_quality_until;
  elsif current_batch.expires_at is not null then
    snapshot_date_type := 'legacy_expiry'; snapshot_deadline := current_batch.expires_at;
  end if;

  in_warning_window := snapshot_deadline is not null
    and snapshot_deadline >= now()
    and snapshot_deadline <= now() + make_interval(days => coalesce(current_batch.expiry_warning_days, 3));
  event_kind := (case p_outcome when 'consume' then 'consume' when 'discard' then 'discard' else 'adjust' end)::public.inventory_event_type;
  next_lifecycle := (case p_outcome when 'consume' then 'consumed' when 'discard' then 'discarded' else 'archived' end)::public.inventory_lifecycle;

  update public.inventory_batches
  set remaining_quantity = 0, lifecycle_state = next_lifecycle, version = version + 1, updated_at = now()
  where batch_uid = current_batch.batch_uid
  returning * into updated_batch;

  insert into public.inventory_events (
    fridge_uid, batch_uid, actor_device_id, event_type, quantity_change, value_change, note,
    reason_code, was_in_warning_window, date_type_snapshot, deadline_snapshot,
    purchase_price_snapshot, currency_snapshot, initial_quantity_snapshot
  ) values (
    current_fridge_uid, current_batch.batch_uid, btrim(p_device_id), event_kind,
    -current_batch.remaining_quantity,
    case when current_batch.purchase_price is null then 0 else round((-current_batch.remaining_quantity / current_batch.initial_quantity) * current_batch.purchase_price, 2) end,
    'Resolved from inventory detail', p_reason_code, in_warning_window,
    snapshot_date_type, snapshot_deadline, current_batch.purchase_price,
    current_batch.currency, current_batch.initial_quantity
  );

  return updated_batch;
end;
$$;

revoke execute on function public.resolve_inventory_batch(text, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.resolve_inventory_batch(text, uuid, integer, text, text) to service_role;

-- Arthur: NarIyirm
-- 中文：详情数量快捷减少仍代表实际使用，但数据库现在会阻止 use-by 已过期批次被记为 consume，并保存统计快照。
-- EN: A quick detail quantity decrease still means actual use, but the database now blocks post-use-by consumption and records accounting snapshots.
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
  snapshot_date_type text;
  snapshot_deadline timestamptz;
begin
  if p_remaining_quantity is null or p_remaining_quantity < 0 then raise exception 'Remaining quantity cannot be negative'; end if;
  current_fridge_uid := public.bootstrap_device(p_device_id);
  select batch.* into current_batch from public.inventory_batches as batch
  where batch.batch_uid = p_batch_uid and batch.fridge_uid = current_fridge_uid and batch.lifecycle_state = 'active'
  for update;
  if current_batch.batch_uid is null then raise exception 'Inventory batch not found'; end if;
  if current_batch.version <> p_expected_version then raise exception 'Inventory batch version conflict'; end if;
  if p_remaining_quantity > current_batch.initial_quantity then raise exception 'Remaining quantity cannot exceed the stocked quantity'; end if;

  quantity_delta := p_remaining_quantity - current_batch.remaining_quantity;
  if quantity_delta < 0 and current_batch.use_by_at <= now() then raise exception 'inventory_use_by_expired'; end if;

  if current_batch.use_by_at is not null then snapshot_date_type := 'use_by'; snapshot_deadline := current_batch.use_by_at;
  elsif current_batch.best_before_at is not null then snapshot_date_type := 'best_before'; snapshot_deadline := current_batch.best_before_at;
  elsif current_batch.estimated_quality_until is not null then snapshot_date_type := 'estimated_quality'; snapshot_deadline := current_batch.estimated_quality_until;
  elsif current_batch.expires_at is not null then snapshot_date_type := 'legacy_expiry'; snapshot_deadline := current_batch.expires_at;
  end if;

  update public.inventory_batches
  set remaining_quantity = p_remaining_quantity,
      lifecycle_state = (case when p_remaining_quantity = 0 then 'consumed' else 'active' end)::public.inventory_lifecycle,
      version = version + 1, updated_at = now()
  where batch_uid = current_batch.batch_uid returning * into updated_batch;

  if quantity_delta <> 0 then
    insert into public.inventory_events (
      fridge_uid, batch_uid, actor_device_id, event_type, quantity_change, value_change, note,
      reason_code, was_in_warning_window, date_type_snapshot, deadline_snapshot,
      purchase_price_snapshot, currency_snapshot, initial_quantity_snapshot
    ) values (
      current_fridge_uid, current_batch.batch_uid, btrim(p_device_id),
      case when quantity_delta < 0 then 'consume'::public.inventory_event_type else 'adjust'::public.inventory_event_type end,
      quantity_delta,
      case when current_batch.purchase_price is null then 0 else round((quantity_delta / current_batch.initial_quantity) * current_batch.purchase_price, 2) end,
      'Changed from inventory detail', case when quantity_delta < 0 then 'used' else 'data_correction' end,
      quantity_delta < 0 and snapshot_deadline is not null and snapshot_deadline >= now()
        and snapshot_deadline <= now() + make_interval(days => coalesce(current_batch.expiry_warning_days, 3)),
      snapshot_date_type, snapshot_deadline, current_batch.purchase_price, current_batch.currency, current_batch.initial_quantity
    );
  end if;
  return updated_batch;
end;
$$;

comment on column public.inventory_batches.best_before_at is 'Quality date supplied by packaging; unlike use_by_at it does not make consumption unsafe.';
comment on column public.inventory_batches.price_status is 'recorded, free, or legacy_unknown; legacy unknown prices are excluded from money metrics.';
comment on function public.resolve_inventory_batch(text, uuid, integer, text, text) is 'Atomic outcome capture for consumed, discarded, or correction removals.';
