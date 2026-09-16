-- 中文：给购物车补上跟 inventory_batches 一致的护栏（名称长度、按单位缩放的数量上限、单位白名单）。
--       NOT VALID 保留历史异常行，让用户能改回安全范围而不是直接报错。
-- EN: Adds the same guardrails as inventory_batches (name length, unit-aware quantity
--     ceiling, unit allowlist). NOT VALID keeps existing outliers correctable.

alter table public.shopping_cart_items
  add constraint shopping_cart_items_name_length_guard
  check (char_length(name) <= 120) not valid;

alter table public.shopping_cart_items
  add constraint shopping_cart_items_quantity_unit_guard
  check (quantity is null or quantity < case when unit in ('g', 'ml') then 1000000 else 1000 end) not valid;

alter table public.shopping_cart_items
  add constraint shopping_cart_items_unit_allowlist_guard
  check (unit is null or unit in ('item', 'g', 'kg', 'ml', 'L', 'bag', 'bottle', 'box')) not valid;

comment on constraint shopping_cart_items_quantity_unit_guard on public.shopping_cart_items is
  'Mirrors inventory_batches'' unit-aware quantity ceiling so cart rows cannot carry pathological quantities into checkout.';
