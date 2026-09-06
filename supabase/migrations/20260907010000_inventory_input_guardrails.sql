-- Arthur: NarIyirm
-- 中文：为新写入与后续修改增加库存硬边界；NOT VALID 保留历史异常记录，使用户仍能把旧数量修正到安全范围。
-- EN: Add hard boundaries for new writes and later edits; NOT VALID preserves legacy outliers so users can still correct their quantities into the safe range.

alter table public.inventory_batches
  add constraint inventory_batches_name_length_guard
  check (char_length(name) <= 120) not valid;

alter table public.inventory_batches
  add constraint inventory_batches_remaining_quantity_guard
  check (remaining_quantity < 1000) not valid;

alter table public.inventory_batches
  add constraint inventory_batches_unit_allowlist_guard
  check (unit in ('item', 'g', 'kg', 'ml', 'L', 'bag', 'bottle', 'box')) not valid;

comment on constraint inventory_batches_remaining_quantity_guard on public.inventory_batches is
  'Prevents pathological inventory quantities from entering new writes while legacy outliers remain available for correction.';
