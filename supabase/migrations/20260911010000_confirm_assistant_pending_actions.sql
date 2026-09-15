-- Arthur: NarIyirm
-- 中文：把助手动作的权限、有效期、乐观锁、业务写入和最终状态放进一个事务，避免重复确认或并发请求执行两次。
-- EN: Keep assistant-action authorization, expiry, optimistic locking, business mutation, and final state in one transaction so duplicate or concurrent confirmations cannot execute twice.

create function public.confirm_assistant_pending_action(
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
  saved_rule public.restock_rules;
  cart_item_uid uuid;
  action_result jsonb := '{}'::jsonb;
  item_name text;
  item_unit text;
  item_quantity numeric;
  new_use_by timestamptz;
  minimum_quantity numeric;
  target_quantity numeric;
  enabled boolean;
begin
  select member.fridge_uid
  into current_fridge_uid
  from public.fridge_members as member
  where member.device_id = btrim(p_device_id);

  if current_fridge_uid is null then
    raise exception 'Assistant action not found';
  end if;

  select action.*
  into pending_action
  from public.assistant_pending_actions as action
  where action.action_uid = p_action_uid
    and action.creator_device_id = btrim(p_device_id)
    and action.fridge_uid = current_fridge_uid
  for update;

  if pending_action.action_uid is null then
    raise exception 'Assistant action not found';
  end if;

  if pending_action.status <> 'pending' then
    return pg_catalog.jsonb_build_object(
      'status', pending_action.status,
      'actionType', pending_action.action_type,
      'replayed', pending_action.status = 'executed'
    );
  end if;

  if pending_action.expires_at <= pg_catalog.now() then
    update public.assistant_pending_actions
    set status = 'expired'
    where action_uid = pending_action.action_uid;
    return pg_catalog.jsonb_build_object('status', 'expired', 'actionType', pending_action.action_type);
  end if;

  if pending_action.target_batch_uid is not null then
    select batch.*
    into current_batch
    from public.inventory_batches as batch
    where batch.batch_uid = pending_action.target_batch_uid
      and batch.fridge_uid = current_fridge_uid
      and batch.lifecycle_state = 'active'
    for update;

    if current_batch.batch_uid is null
      or pending_action.expected_batch_version is null
      or current_batch.version <> pending_action.expected_batch_version then
      update public.assistant_pending_actions
      set status = 'conflict'
      where action_uid = pending_action.action_uid;
      return pg_catalog.jsonb_build_object('status', 'conflict', 'actionType', pending_action.action_type);
    end if;
  end if;

  case pending_action.action_type
    when 'prepare_cart_item' then
      if pending_action.target_batch_uid is not null then
        raise exception 'Assistant cart action cannot target a batch';
      end if;
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
      select changed.* into changed_batch
      from public.archive_inventory_batch(
        btrim(p_device_id), current_batch.batch_uid, pending_action.expected_batch_version
      ) as changed;
      action_result := pg_catalog.jsonb_build_object('batchUid', changed_batch.batch_uid, 'version', changed_batch.version);

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
      from public.adjust_inventory_batch_quantity(
        btrim(p_device_id), current_batch.batch_uid, 0, pending_action.expected_batch_version
      ) as changed;
      action_result := pg_catalog.jsonb_build_object('batchUid', changed_batch.batch_uid, 'remainingQuantity', 0, 'version', changed_batch.version);

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
        or (enabled and (minimum_quantity is null or target_quantity is null or minimum_quantity < 0 or target_quantity <= minimum_quantity)) then
        raise exception 'Assistant restock action payload is invalid';
      end if;
      select saved.* into saved_rule
      from public.set_inventory_restock_rule(
        btrim(p_device_id), current_batch.batch_uid, enabled,
        case when enabled then minimum_quantity else null end,
        case when enabled then target_quantity else null end
      ) as saved;
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
  set
    status = 'executed',
    confirmed_at = pg_catalog.now(),
    executed_at = pg_catalog.now()
  where action_uid = pending_action.action_uid;

  return pg_catalog.jsonb_build_object(
    'status', 'executed',
    'actionType', pending_action.action_type,
    'result', action_result,
    'replayed', false
  );
end;
$$;

create function public.cancel_assistant_pending_action(
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
  final_status text;
begin
  select member.fridge_uid
  into current_fridge_uid
  from public.fridge_members as member
  where member.device_id = btrim(p_device_id);

  select action.*
  into pending_action
  from public.assistant_pending_actions as action
  where action.action_uid = p_action_uid
    and action.creator_device_id = btrim(p_device_id)
    and action.fridge_uid = current_fridge_uid
  for update;

  if pending_action.action_uid is null then
    raise exception 'Assistant action not found';
  end if;

  if pending_action.status <> 'pending' then
    return pg_catalog.jsonb_build_object('status', pending_action.status, 'actionType', pending_action.action_type);
  end if;

  final_status := case when pending_action.expires_at <= pg_catalog.now() then 'expired' else 'cancelled' end;
  update public.assistant_pending_actions
  set status = final_status
  where action_uid = pending_action.action_uid;

  return pg_catalog.jsonb_build_object('status', final_status, 'actionType', pending_action.action_type);
end;
$$;

revoke all on function public.confirm_assistant_pending_action(text, uuid) from public, anon, authenticated;
revoke all on function public.cancel_assistant_pending_action(text, uuid) from public, anon, authenticated;
grant execute on function public.confirm_assistant_pending_action(text, uuid) to service_role;
grant execute on function public.cancel_assistant_pending_action(text, uuid) to service_role;

comment on function public.confirm_assistant_pending_action(text, uuid) is
  'Atomically validates and executes one creator-scoped, unexpired assistant action with batch-version conflict protection.';
comment on function public.cancel_assistant_pending_action(text, uuid) is
  'Atomically cancels one creator-scoped pending assistant action without executing its business mutation.';
