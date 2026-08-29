-- Derived "need to buy" list. Nothing is stored -- this recomputes on every
-- call from restock rules + current stock, matching section 5.1 of the doc:
-- sum active batches per item, return those at or below the minimum quantity.
-- Put this in a NEW migration whose timestamp is later than the initial schema
-- (e.g. supabase/migrations/20260830000000_restock_and_cart.sql), together
-- with the shopping_cart_items table -- do not edit the initial migration.
create or replace function public.get_restock_suggestions(p_fridge uuid)
returns table (
  rule_uid          uuid,
  name              text,
  unit              text,
  current_quantity  numeric,
  minimum_quantity  numeric,
  target_quantity   numeric,
  preset_uid        uuid
) language sql stable as $$
  select
    r.rule_uid,
    coalesce(fp.canonical_name, r.normalized_item_name) as name,
    r.unit,
    coalesce(sum(b.remaining_quantity), 0) as current_quantity,
    r.minimum_quantity,
    r.target_quantity,
    r.preset_uid
  from public.restock_rules r
  left join public.food_presets fp
    on fp.preset_uid = r.preset_uid
  left join public.inventory_batches b
    on b.fridge_uid = r.fridge_uid
   and b.lifecycle_state = 'active'
   and (
         -- match by preset when the rule has one, else by normalized name
         (r.preset_uid is not null and b.preset_uid = r.preset_uid)
      or (r.preset_uid is null and lower(b.name) = r.normalized_item_name)
       )
  where r.fridge_uid = p_fridge
    and r.is_enabled = true
  group by r.rule_uid, fp.canonical_name, r.normalized_item_name, r.unit,
           r.minimum_quantity, r.target_quantity, r.preset_uid
  having coalesce(sum(b.remaining_quantity), 0) <= r.minimum_quantity;
$$;