-- Arthur: NarIyirm
-- 中文：购物车之前只对数量做了 > 0 的检查，名称长度和单位都没有边界；这里补上跟
--       inventory_batches 一致的护栏（名称长度、按单位缩放的数量上限、单位白名单），
--       防止异常商品名或超量数字把前端撑爆或写进坏数据。NOT VALID 保留任何历史异常行，
--       让用户仍能把旧数据改回安全范围，而不是直接报错卡住。
-- EN: The cart previously only checked quantity > 0, with no bound on name length or
--     unit. This adds the same guardrails as inventory_batches (name length, unit-aware
--     quantity ceiling, unit allowlist) so a pathological item name or an oversized
--     number can't blow up the client or land in the table. NOT VALID keeps any existing
--     outliers usable so users can correct them instead of hitting a hard failure.

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
