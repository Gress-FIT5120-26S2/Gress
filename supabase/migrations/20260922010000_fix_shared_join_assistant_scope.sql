-- Arthur: NarIyirm
-- 中文：个人冰箱并入家庭冰箱前先迁移创建设备私有的助手范围，并让依赖旧库存版本的动作失效，避免复合外键阻断加入事务。
-- EN: Move creator-private assistant scope before merging a personal fridge, invalidating actions tied to old inventory versions so composite foreign keys cannot block the join transaction.

create or replace function public.merge_personal_fridge_into_target(
  p_source_fridge uuid,
  p_target_fridge uuid,
  p_actor_device_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_category record;
  source_rule record;
  target_category_uid uuid;
  target_rule_uid uuid;
begin
  if p_source_fridge = p_target_fridge then
    raise exception 'same_fridge';
  end if;

  delete from public.notifications
  where fridge_uid = p_source_fridge;

  delete from public.shopping_cart_items
  where fridge_uid = p_source_fridge
    and source <> 'manual';

  -- Pending proposals were validated against the personal fridge's inventory version.
  -- They must not remain executable after the inventory is merged into another scope.
  update public.assistant_pending_actions
  set status = case when status in ('pending', 'confirmed') then 'expired' else status end,
      target_batch_uid = null
  where fridge_uid = p_source_fridge;

  -- Conversation history remains private to its creator, but follows that creator into
  -- the target fridge so history reads continue to use the authenticated current scope.
  update public.assistant_conversations
  set fridge_uid = p_target_fridge
  where fridge_uid = p_source_fridge
    and creator_device_id = btrim(p_actor_device_id);

  update public.assistant_request_audit
  set fridge_uid = p_target_fridge
  where fridge_uid = p_source_fridge
    and creator_device_id = btrim(p_actor_device_id);

  for source_category in
    select category_uid, name, normalized_name, system_code, colour, icon, is_default
    from public.food_categories
    where fridge_uid = p_source_fridge
    order by created_at
  loop
    target_category_uid := null;

    if source_category.system_code is not null then
      select category_uid into target_category_uid
      from public.food_categories
      where fridge_uid = p_target_fridge
        and system_code = source_category.system_code
      limit 1;
    end if;

    if target_category_uid is null then
      select category_uid into target_category_uid
      from public.food_categories
      where fridge_uid = p_target_fridge
        and normalized_name = source_category.normalized_name
      limit 1;
    end if;

    if target_category_uid is null then
      insert into public.food_categories (
        fridge_uid, name, system_code, colour, icon, is_default, created_by_device_id
      ) values (
        p_target_fridge,
        source_category.name,
        source_category.system_code,
        source_category.colour,
        source_category.icon,
        false,
        p_actor_device_id
      )
      returning category_uid into target_category_uid;
    end if;

    update public.inventory_batches
    set category_uid = target_category_uid,
        fridge_uid = p_target_fridge
    where fridge_uid = p_source_fridge
      and category_uid = source_category.category_uid;

    update public.shopping_cart_items
    set category_uid = target_category_uid,
        fridge_uid = p_target_fridge
    where fridge_uid = p_source_fridge
      and category_uid = source_category.category_uid
      and source = 'manual';
  end loop;

  update public.shopping_cart_items
  set fridge_uid = p_target_fridge
  where fridge_uid = p_source_fridge
    and category_uid is null
    and source = 'manual';

  for source_rule in
    select *
    from public.restock_rules
    where fridge_uid = p_source_fridge
    order by created_at
  loop
    target_rule_uid := null;

    if source_rule.preset_uid is not null then
      select rule_uid into target_rule_uid
      from public.restock_rules
      where fridge_uid = p_target_fridge
        and preset_uid = source_rule.preset_uid
        and unit = source_rule.unit
      limit 1
      for update;
    else
      select rule_uid into target_rule_uid
      from public.restock_rules
      where fridge_uid = p_target_fridge
        and preset_uid is null
        and normalized_item_name = source_rule.normalized_item_name
        and unit = source_rule.unit
      limit 1
      for update;
    end if;

    if target_rule_uid is null then
      update public.restock_rules
      set fridge_uid = p_target_fridge
      where rule_uid = source_rule.rule_uid;
    else
      update public.restock_rules
      set minimum_quantity = greatest(minimum_quantity, source_rule.minimum_quantity),
          target_quantity = greatest(target_quantity, source_rule.target_quantity),
          is_enabled = is_enabled or source_rule.is_enabled
      where rule_uid = target_rule_uid;

      delete from public.restock_rules
      where rule_uid = source_rule.rule_uid;
    end if;
  end loop;

  insert into public.fridge_achievements (fridge_uid, achievement_uid, unlocked_at, metric_value)
  select p_target_fridge, achievement_uid, unlocked_at, metric_value
  from public.fridge_achievements
  where fridge_uid = p_source_fridge
  on conflict (fridge_uid, achievement_uid) do update
    set unlocked_at = least(public.fridge_achievements.unlocked_at, excluded.unlocked_at),
        metric_value = greatest(public.fridge_achievements.metric_value, excluded.metric_value);

  delete from public.fridge_achievements
  where fridge_uid = p_source_fridge;
end;
$$;

revoke execute on function public.merge_personal_fridge_into_target(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.merge_personal_fridge_into_target(uuid, uuid, text) to service_role;

comment on function public.merge_personal_fridge_into_target(uuid, uuid, text) is
  'Merges a personal fridge into a shared target while preserving creator-private assistant history and invalidating old-scope assistant actions.';
