-- Arthur: NarIyirm
-- 中文：让助手的整批使用、丢弃和录入纠错复用权威库存结算函数，使库存流水、成就、XP 与挑战使用同一事实来源。
-- EN: Route assistant full-use, discard, and data-correction actions through the authoritative inventory resolver so events, achievements, XP, and quests share one source of truth.

alter table public.assistant_pending_actions
  drop constraint assistant_pending_actions_type_valid;

alter table public.assistant_pending_actions
  add constraint assistant_pending_actions_type_valid check (
    action_type in ('prepare_cart_item', 'archive_batch', 'discard_batch', 'adjust_quantity', 'mark_consumed', 'edit_use_by', 'set_restock_rule')
  );

create or replace function public.confirm_assistant_pending_action(
  p_device_id text,
  p_action_uid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  pending_action public.assistant_pending_actions;
  current_batch public.inventory_batches;
  changed_batch public.inventory_batches;
  cart_item_uid uuid;
  action_result jsonb := '{}'::jsonb;
  item_name text;
  item_unit text;
  item_quantity numeric;
  new_use_by timestamptz;
  outcome_reason text;
  minimum_quantity numeric;
  target_quantity numeric;
  enabled boolean;
begin
  select member.fridge_uid into current_fridge_uid
  from public.fridge_members as member
  where member.device_id = btrim(p_device_id);

  if current_fridge_uid is null then raise exception 'Assistant action not found'; end if;

  select action.* into pending_action
  from public.assistant_pending_actions as action
  where action.action_uid = p_action_uid
    and action.creator_device_id = btrim(p_device_id)
    and action.fridge_uid = current_fridge_uid
  for update;

  if pending_action.action_uid is null then raise exception 'Assistant action not found'; end if;
  if pending_action.status <> 'pending' then
    return pg_catalog.jsonb_build_object(
      'status', pending_action.status,
      'actionType', pending_action.action_type,
      'replayed', pending_action.status = 'executed'
    );
  end if;

  if pending_action.expires_at <= pg_catalog.now() then
    update public.assistant_pending_actions set status = 'expired'
    where action_uid = pending_action.action_uid;
    return pg_catalog.jsonb_build_object('status', 'expired', 'actionType', pending_action.action_type);
  end if;

  if pending_action.target_batch_uid is not null then
    select batch.* into current_batch
    from public.inventory_batches as batch
    where batch.batch_uid = pending_action.target_batch_uid
      and batch.fridge_uid = current_fridge_uid
      and batch.lifecycle_state = 'active'
    for update;

    if current_batch.batch_uid is null
      or pending_action.expected_batch_version is null
      or current_batch.version <> pending_action.expected_batch_version then
      update public.assistant_pending_actions set status = 'conflict'
      where action_uid = pending_action.action_uid;
      return pg_catalog.jsonb_build_object('status', 'conflict', 'actionType', pending_action.action_type);
    end if;
  end if;

  case pending_action.action_type
    when 'prepare_cart_item' then
      if pending_action.target_batch_uid is not null then raise exception 'Assistant cart action cannot target a batch'; end if;
      item_name := btrim(pending_action.action_payload ->> 'itemName');
      item_unit := nullif(btrim(pending_action.action_payload ->> 'unit'), '');
      item_quantity := nullif(pending_action.action_payload ->> 'quantity', '')::numeric;
      if item_name is null or char_length(item_name) not between 1 and 120
        or (item_unit is not null and item_unit not in ('item', 'g', 'kg', 'ml', 'L', 'bag', 'bottle', 'box'))
        or (item_quantity is not null and (item_quantity <= 0 or item_quantity >= (case when item_unit in ('g', 'ml') then 1000000 else 1000 end))) then
        raise exception 'Assistant cart action payload is invalid';
      end if;
      insert into public.shopping_cart_items (
        fridge_uid, name, quantity, unit, source, added_by_device_id, owner_device_id
      ) values (
        current_fridge_uid, item_name, item_quantity, item_unit, 'manual', btrim(p_device_id), btrim(p_device_id)
      ) returning item_uid into cart_item_uid;
      action_result := pg_catalog.jsonb_build_object('itemUid', cart_item_uid);

    when 'archive_batch' then
      if current_batch.batch_uid is null then raise exception 'Assistant action target is required'; end if;
      if (pending_action.action_payload ->> 'reasonCode') is distinct from 'data_correction' then
        raise exception 'Assistant archive action requires data correction reason';
      end if;
      select changed.* into changed_batch
      from public.resolve_inventory_batch(
        btrim(p_device_id), current_batch.batch_uid, pending_action.expected_batch_version, 'correction', 'data_correction'
      ) as changed;
      action_result := pg_catalog.jsonb_build_object('batchUid', changed_batch.batch_uid, 'version', changed_batch.version);

    when 'discard_batch' then
      if current_batch.batch_uid is null then raise exception 'Assistant action target is required'; end if;
      outcome_reason := pending_action.action_payload ->> 'reasonCode';
      if outcome_reason is null or outcome_reason not in ('spoiled', 'overbought', 'forgotten', 'unwanted', 'quality_rejected', 'other', 'confirmed_use_by_expiry') then
        raise exception 'Assistant discard action requires a discard reason';
      end if;
      select changed.* into changed_batch
      from public.resolve_inventory_batch(
        btrim(p_device_id), current_batch.batch_uid, pending_action.expected_batch_version, 'discard', outcome_reason
      ) as changed;
      action_result := pg_catalog.jsonb_build_object(
        'batchUid', changed_batch.batch_uid,
        'lifecycleState', changed_batch.lifecycle_state,
        'remainingQuantity', changed_batch.remaining_quantity,
        'version', changed_batch.version
      );

    when 'adjust_quantity' then
      if current_batch.batch_uid is null then raise exception 'Assistant action target is required'; end if;
      item_quantity := (pending_action.action_payload ->> 'quantity')::numeric;
      if item_quantity < 0
        or item_quantity > current_batch.initial_quantity
        or item_quantity >= (case when current_batch.unit in ('g', 'ml') then 1000000 else 1000 end) then
        raise exception 'Assistant quantity action payload is invalid';
      end if;
      select changed.* into changed_batch
      from public.adjust_inventory_batch_quantity(
        btrim(p_device_id), current_batch.batch_uid, item_quantity, pending_action.expected_batch_version
      ) as changed;
      action_result := pg_catalog.jsonb_build_object(
        'batchUid', changed_batch.batch_uid,
        'remainingQuantity', changed_batch.remaining_quantity,
        'version', changed_batch.version
      );

    when 'mark_consumed' then
      if current_batch.batch_uid is null then raise exception 'Assistant action target is required'; end if;
      select changed.* into changed_batch
      from public.resolve_inventory_batch(
        btrim(p_device_id), current_batch.batch_uid, pending_action.expected_batch_version, 'consume', 'used'
      ) as changed;
      action_result := pg_catalog.jsonb_build_object(
        'batchUid', changed_batch.batch_uid,
        'lifecycleState', changed_batch.lifecycle_state,
        'remainingQuantity', changed_batch.remaining_quantity,
        'version', changed_batch.version
      );

    when 'edit_use_by' then
      if current_batch.batch_uid is null then raise exception 'Assistant action target is required'; end if;
      new_use_by := (pending_action.action_payload ->> 'useByAt')::timestamptz;
      if new_use_by is null or new_use_by < current_batch.stocked_at then
        raise exception 'Assistant use-by action payload is invalid';
      end if;
      update public.inventory_batches
      set use_by_at = new_use_by, version = version + 1, updated_at = pg_catalog.now()
      where batch_uid = current_batch.batch_uid
      returning * into changed_batch;
      action_result := pg_catalog.jsonb_build_object(
        'batchUid', changed_batch.batch_uid,
        'useByAt', changed_batch.use_by_at,
        'version', changed_batch.version
      );

    when 'set_restock_rule' then
      if current_batch.batch_uid is null then raise exception 'Assistant action target is required'; end if;
      enabled := (pending_action.action_payload ->> 'enabled')::boolean;
      minimum_quantity := nullif(pending_action.action_payload ->> 'minimumQuantity', '')::numeric;
      target_quantity := nullif(pending_action.action_payload ->> 'targetQuantity', '')::numeric;
      if enabled is null
        or (enabled and (
          minimum_quantity is null
          or target_quantity is null
          or minimum_quantity < 0
          or target_quantity <= minimum_quantity
          or minimum_quantity >= (case when current_batch.unit in ('g', 'ml') then 1000000 else 1000 end)
          or target_quantity >= (case when current_batch.unit in ('g', 'ml') then 1000000 else 1000 end)
        )) then
        raise exception 'Assistant restock action payload is invalid';
      end if;
      perform public.set_inventory_restock_rule(
        btrim(p_device_id), current_batch.batch_uid, enabled,
        case when enabled then minimum_quantity else null end,
        case when enabled then target_quantity else null end
      );
      action_result := pg_catalog.jsonb_build_object(
        'batchUid', current_batch.batch_uid,
        'enabled', enabled,
        'minimumQuantity', case when enabled then minimum_quantity else null end,
        'targetQuantity', case when enabled then target_quantity else null end
      );

    else
      raise exception 'Assistant action type is not supported';
  end case;

  update public.assistant_pending_actions
  set status = 'executed', confirmed_at = pg_catalog.now(), executed_at = pg_catalog.now()
  where action_uid = pending_action.action_uid;

  return pg_catalog.jsonb_build_object(
    'status', 'executed',
    'actionType', pending_action.action_type,
    'result', action_result,
    'replayed', false
  );
end;
$$;

comment on function public.confirm_assistant_pending_action(text, uuid) is
  'Atomically executes assistant actions; full consumption, discard, and correction reuse the authoritative inventory outcome ledger for achievement reconciliation.';
