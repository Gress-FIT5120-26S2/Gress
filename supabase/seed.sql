-- Arthur: NarIyirm
-- 中文：种子只保存跨冰箱共享的食材建议和成就定义；每个冰箱的默认分类由 bootstrap_device 创建。
-- EN: Seeds contain global food guidance and achievement definitions; bootstrap_device creates per-fridge default categories.
insert into public.food_presets (
  canonical_name,
  aliases,
  suggested_storage_zone,
  suggested_shelf_life_days,
  suggested_category_code,
  notes
)
values
  ('tomato', array['tomato', 'tomatoes', '番茄', '西红柿'], 'pantry', 5, 'vegetables', 'Keep ripe whole tomatoes at room temperature away from sunlight for best flavour.'),
  ('banana', array['banana', 'bananas', '香蕉'], 'pantry', 3, 'fruit', 'Ripen at room temperature; refrigerating ripe fruit may darken the peel.'),
  ('bittermelon', array['bittermelon', 'bitter melon', 'bitter gourd', 'karela', '苦瓜', '凉瓜'], 'chilled', 5, 'vegetables', 'Keep dry in the crisper and use promptly; bitter melon is sensitive to prolonged chilling.'),
  ('cucumber', array['cucumber', 'cucumbers', '黄瓜', '青瓜'], 'chilled', 5, 'vegetables', 'Keep dry in the crisper and avoid the coldest part of the refrigerator.'),
  ('eggplant', array['eggplant', 'eggplants', 'aubergine', 'aubergines', '茄子'], 'chilled', 4, 'vegetables', 'Keep unwashed near the front of the refrigerator and use within a few days.'),
  ('orange', array['orange', 'oranges', '橙子', '橙', '甜橙'], 'chilled', 14, 'fruit', 'Keep whole fruit in the crisper for best quality.'),
  ('papaya', array['papaya', 'papayas', '木瓜', '番木瓜'], 'pantry', 5, 'fruit', 'Ripen at room temperature; move ripe fruit to the refrigerator if it will not be used promptly.'),
  ('pineapple', array['pineapple', 'pineapples', '菠萝', '凤梨'], 'chilled', 5, 'fruit', 'Keep whole fruit refrigerated in a bag; cut fruit needs an airtight container.'),
  ('milk', array['milk', 'fresh milk', '牛奶', '鲜牛奶'], 'chilled', 7, 'drinks', 'Keep sealed and refrigerated.'),
  ('egg', array['egg', 'eggs', '鸡蛋'], 'chilled', 28, 'meat', 'Keep refrigerated in the original carton.'),
  ('blueberry', array['blueberry', 'blueberries', '蓝莓'], 'chilled', 7, 'fruit', 'Keep dry and wash immediately before eating.'),
  ('rice', array['rice', '大米', '米'], 'pantry', 365, 'staples', 'Store dry in an airtight container.'),
  ('peas', array['peas', 'green peas', '青豆', '豌豆'], 'frozen', 180, 'vegetables', 'Keep frozen after purchase.'),
  ('soy sauce', array['soy sauce', '酱油'], 'pantry', 365, 'condiments', 'Refrigerate after opening if preferred.'),
  ('yogurt', array['yogurt', 'yoghurt', '酸奶'], 'chilled', 14, 'drinks', 'Keep refrigerated.'),
  ('bread', array['bread', 'wholemeal bread', '面包', '全麦面包'], 'pantry', 5, 'staples', 'Freeze portions for longer storage.')
on conflict (canonical_name) do update
set
  aliases = excluded.aliases,
  suggested_storage_zone = excluded.suggested_storage_zone,
  suggested_shelf_life_days = excluded.suggested_shelf_life_days,
  suggested_category_code = excluded.suggested_category_code,
  notes = excluded.notes,
  is_enabled = true;

insert into public.achievements (
  code,
  title_key,
  description_key,
  rule_type,
  threshold
)
values
  ('first_item', 'achievements.firstItem.title', 'achievements.firstItem.description', 'stock_event_count', 1),
  ('waste_watcher', 'achievements.wasteWatcher.title', 'achievements.wasteWatcher.description', 'consumed_value', 25),
  ('fridge_regular', 'achievements.fridgeRegular.title', 'achievements.fridgeRegular.description', 'active_days', 7),
  ('shared_kitchen', 'achievements.sharedKitchen.title', 'achievements.sharedKitchen.description', 'member_count', 2)
on conflict (code) do update
set
  title_key = excluded.title_key,
  description_key = excluded.description_key,
  rule_type = excluded.rule_type,
  threshold = excluded.threshold,
  is_enabled = true;
