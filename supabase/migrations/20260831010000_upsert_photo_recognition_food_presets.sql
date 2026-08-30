-- Arthur: NarIyirm
-- 中文：补齐视觉模型支持的八类食材，让识别名称可以通过同一预设表得到分类、储存方式和基础保质期。
-- EN: Add every food supported by the vision model so a recognised name can resolve category, storage, and baseline shelf life through one preset table.

insert into public.food_presets (
  canonical_name,
  aliases,
  suggested_storage_zone,
  suggested_shelf_life_days,
  suggested_category_code,
  notes
)
values
  ('banana', array['banana', 'bananas', '香蕉'], 'pantry', 3, 'fruit', 'Ripen at room temperature; refrigerating ripe fruit may darken the peel.'),
  ('bittermelon', array['bittermelon', 'bitter melon', 'bitter gourd', 'karela', '苦瓜', '凉瓜'], 'chilled', 5, 'vegetables', 'Keep dry in the crisper and use promptly; bitter melon is sensitive to prolonged chilling.'),
  ('cucumber', array['cucumber', 'cucumbers', '黄瓜', '青瓜'], 'chilled', 5, 'vegetables', 'Keep dry in the crisper and avoid the coldest part of the refrigerator.'),
  ('eggplant', array['eggplant', 'eggplants', 'aubergine', 'aubergines', '茄子'], 'chilled', 4, 'vegetables', 'Keep unwashed near the front of the refrigerator and use within a few days.'),
  ('orange', array['orange', 'oranges', '橙子', '橙', '甜橙'], 'chilled', 14, 'fruit', 'Keep whole fruit in the crisper for best quality.'),
  ('papaya', array['papaya', 'papayas', '木瓜', '番木瓜'], 'pantry', 5, 'fruit', 'Ripen at room temperature; move ripe fruit to the refrigerator if it will not be used promptly.'),
  ('pineapple', array['pineapple', 'pineapples', '菠萝', '凤梨'], 'chilled', 5, 'fruit', 'Keep whole fruit refrigerated in a bag; cut fruit needs an airtight container.'),
  ('tomato', array['tomato', 'tomatoes', '番茄', '西红柿'], 'pantry', 5, 'vegetables', 'Keep ripe whole tomatoes at room temperature away from sunlight for best flavour.')
on conflict (canonical_name) do update
set
  aliases = excluded.aliases,
  suggested_storage_zone = excluded.suggested_storage_zone,
  suggested_shelf_life_days = excluded.suggested_shelf_life_days,
  suggested_category_code = excluded.suggested_category_code,
  notes = excluded.notes,
  is_enabled = true;

-- Sources reviewed 2026-08-31:
-- USDA FSIS FoodKeeper dataset catalogue: https://catalog.data.gov/dataset/fsis-foodkeeper-data
-- Oregon State University Extension PNW 612 storage chart: https://extension.oregonstate.edu/sites/extd8/files/2023-08/pnw612.pdf
-- Oregon State University Extension pineapple guidance: https://extension.oregonstate.edu/newsletter/food-hero-monthly/pineapple-pineapple
-- Bitter melon postharvest study: https://pmc.ncbi.nlm.nih.gov/articles/PMC8405796/
