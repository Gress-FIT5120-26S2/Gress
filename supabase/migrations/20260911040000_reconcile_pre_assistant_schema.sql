-- Arthur: NarIyirm
-- 中文：生产库曾通过迁移历史之外的方式提前创建这些对象；本迁移以幂等方式统一开发与生产的最终数据契约。
-- EN: Production previously received these objects outside migration history; this idempotent migration reconciles the final contract across environments.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_batches'::regclass
      and conname = 'inventory_batches_name_length_guard'
  ) then
    alter table public.inventory_batches
      add constraint inventory_batches_name_length_guard
      check (char_length(name) <= 120) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_batches'::regclass
      and conname = 'inventory_batches_unit_allowlist_guard'
  ) then
    alter table public.inventory_batches
      add constraint inventory_batches_unit_allowlist_guard
      check (unit in ('item', 'g', 'kg', 'ml', 'L', 'bag', 'bottle', 'box')) not valid;
  end if;
end
$$;

alter table public.inventory_batches
  drop constraint if exists inventory_batches_initial_quantity_unit_guard,
  drop constraint if exists inventory_batches_remaining_quantity_guard;

alter table public.inventory_batches
  add constraint inventory_batches_initial_quantity_unit_guard
  check (initial_quantity < case when unit in ('g', 'ml') then 1000000 else 1000 end) not valid,
  add constraint inventory_batches_remaining_quantity_guard
  check (remaining_quantity < case when unit in ('g', 'ml') then 1000000 else 1000 end) not valid;

alter table public.restock_rules
  drop constraint if exists restock_rules_minimum_quantity_unit_guard,
  drop constraint if exists restock_rules_target_quantity_unit_guard;

alter table public.restock_rules
  add constraint restock_rules_minimum_quantity_unit_guard
  check (minimum_quantity < case when unit in ('g', 'ml') then 1000000 else 1000 end) not valid,
  add constraint restock_rules_target_quantity_unit_guard
  check (target_quantity < case when unit in ('g', 'ml') then 1000000 else 1000 end) not valid;

alter table public.food_categories
  add column if not exists icon_path text,
  add column if not exists icon_source text;

alter table public.food_categories
  drop constraint if exists food_categories_icon_source_guard,
  drop constraint if exists food_categories_name_length_guard;

alter table public.food_categories
  add constraint food_categories_icon_source_guard
  check (icon_source is null or icon_source in ('ai_generated')) not valid,
  add constraint food_categories_name_length_guard
  check (char_length(name) <= 24) not valid;

comment on constraint inventory_batches_remaining_quantity_guard on public.inventory_batches is
  'Enforces unit-aware quantity ceilings while legacy outliers remain available for correction.';

comment on column public.food_categories.icon_path is
  'Object path in the public food-preset-icons bucket; clients receive only the derived public URL.';
