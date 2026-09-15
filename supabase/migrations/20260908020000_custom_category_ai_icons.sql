-- Arthur: NarIyirm
-- 中文：自定义冰箱分类保存一次生成的 AI 图标路径，后续库存快照可直接读取而不阻塞页面首屏。
-- EN: Custom fridge categories persist their one-time AI icon path so later inventory snapshots can render immediately without blocking first paint.

alter table public.food_categories
  add column icon_path text,
  add column icon_source text;

alter table public.food_categories
  add constraint food_categories_icon_source_guard
  check (icon_source is null or icon_source in ('ai_generated')) not valid;

alter table public.food_categories
  add constraint food_categories_name_length_guard
  check (char_length(name) <= 24) not valid;

comment on column public.food_categories.icon_path is
  'Object path in the public food-preset-icons bucket; clients receive only the derived public URL.';
