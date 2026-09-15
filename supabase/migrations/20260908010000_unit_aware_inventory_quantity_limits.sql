-- Arthur: NarIyirm
-- 中文：将库存和补货数量上限按单位缩放；克/毫升允许到一百万以下，其余单位保持一千以下，并保留旧异常记录供修正。
-- EN: Scale inventory and restock ceilings by unit; grams/millilitres allow values below one million while other units stay below one thousand, preserving legacy outliers for correction.

alter table public.inventory_batches
  drop constraint if exists inventory_batches_remaining_quantity_guard;

alter table public.inventory_batches
  add constraint inventory_batches_initial_quantity_unit_guard
  check (initial_quantity < case when unit in ('g', 'ml') then 1000000 else 1000 end) not valid;

alter table public.inventory_batches
  add constraint inventory_batches_remaining_quantity_guard
  check (remaining_quantity < case when unit in ('g', 'ml') then 1000000 else 1000 end) not valid;

alter table public.restock_rules
  add constraint restock_rules_minimum_quantity_unit_guard
  check (minimum_quantity < case when unit in ('g', 'ml') then 1000000 else 1000 end) not valid;

alter table public.restock_rules
  add constraint restock_rules_target_quantity_unit_guard
  check (target_quantity < case when unit in ('g', 'ml') then 1000000 else 1000 end) not valid;

comment on constraint inventory_batches_remaining_quantity_guard on public.inventory_batches is
  'Enforces unit-aware quantity ceilings while legacy outliers remain available for correction.';
