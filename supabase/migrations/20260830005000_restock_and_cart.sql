-- Derived "need to buy" list. Nothing is stored -- this recomputes on every
-- call from restock rules + current stock, matching section 5.1 of the doc:
-- sum active batches per item, return those at or below the minimum quantity.
-- Version was 20260830000000; renamed because that timestamp was already used
-- by create_inventory_batch_rpc, which is applied on the remote project.
-- Migration: shopping cart + restock suggestions.
-- Later than the initial schema; do not edit the initial migration.
-- Order: create the shopping_cart_items table, then the restock function.
-- (No seed/test data here -- that stays in seed_test_data.sql.)

-- ============================================================
-- shopping_cart_items: a shared shopping list scoped to one fridge.
-- Owned by fridge_uid (device_id only records who acted). Unlike
-- notification_reads, the checked (bought) state lives on the row and is
-- shared by all members -- "milk is bought" is true for everyone.
-- ============================================================
create table shopping_cart_items (
  item_uid              uuid primary key default gen_random_uuid(),
  fridge_uid            uuid not null references fridges(fridge_uid),
  name                  text not null,
  category_uid          uuid references food_categories(category_uid),
  preset_uid            uuid references food_presets(preset_uid),
  quantity              numeric(12,3) check (quantity is null or quantity > 0),
  unit                  text,
  -- how the item entered the list: typed by a user, or auto-added from a
  -- restock rule / an expiring notification
  source                text not null default 'manual'
                          check (source in ('manual', 'restock', 'notification')),
  is_checked            boolean not null default false,
  added_by_device_id    text not null references devices(device_id),
  checked_by_device_id  text references devices(device_id),
  created_at            timestamptz not null default now(),
  checked_at            timestamptz
);

create index idx_cart_fridge on shopping_cart_items(fridge_uid);

-- Stop the same restock rule from spamming duplicate rows.
-- Manual entries may repeat, so this only guards non-manual sources.
create unique index idx_cart_dedupe
  on shopping_cart_items(fridge_uid, lower(name), source)
  where source <> 'manual';


-- ============================================================
-- get_restock_suggestions: derived "need to buy" list. Nothing is stored --
-- it recomputes from restock rules + current stock (doc section 5.1): sum
-- active batches per item, return those at or below the minimum quantity.
-- ============================================================
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
