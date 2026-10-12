-- Arthur: NarIyirm
-- 中文：只汇总既有业务记录指纹；排除新增包装字段，迁移前后可核对原数据是否一致。
-- EN: Aggregate existing business record fingerprints, excluding new packaging fields, to compare original data before and after migration.
with fingerprints as (
  select 'devices' as name,md5(to_jsonb(t)::text) as hash from public.devices t
  union all select 'fridges',md5(to_jsonb(t)::text) from public.fridges t
  union all select 'fridge_members',md5(to_jsonb(t)::text) from public.fridge_members t
  union all select 'fridge_invites',md5(to_jsonb(t)::text) from public.fridge_invites t
  union all select 'inventory_batches',md5((to_jsonb(t)-'waste_profile')::text) from public.inventory_batches t
  union all select 'inventory_events',md5((to_jsonb(t)-array['waste_profile_snapshot','waste_remaining_snapshot','waste_initial_snapshot','waste_unit_snapshot'])::text) from public.inventory_events t
  union all select 'food_categories',md5(to_jsonb(t)::text) from public.food_categories t
  union all select 'restock_rules',md5(to_jsonb(t)::text) from public.restock_rules t
  union all select 'shopping_cart_items',md5(to_jsonb(t)::text) from public.shopping_cart_items t
  union all select 'notifications',md5(to_jsonb(t)::text) from public.notifications t
  union all select 'notification_reads',md5(to_jsonb(t)::text) from public.notification_reads t
  union all select 'device_profiles',md5(to_jsonb(t)::text) from public.device_profiles t
  union all select 'device_credentials',md5(to_jsonb(t)::text) from public.device_credentials t
  union all select 'device_recovery_credentials',md5(to_jsonb(t)::text) from public.device_recovery_credentials t
  union all select 'device_push_tokens',md5(to_jsonb(t)::text) from public.device_push_tokens t
  union all select 'notification_deliveries',md5(to_jsonb(t)::text) from public.notification_deliveries t
  union all select 'fridge_achievements',md5(to_jsonb(t)::text) from public.fridge_achievements t
  union all select 'fridge_xp_events',md5(to_jsonb(t)::text) from public.fridge_xp_events t
  union all select 'fridge_quest_assignments',md5(to_jsonb(t)::text) from public.fridge_quest_assignments t
  union all select 'assistant_conversations',md5(to_jsonb(t)::text) from public.assistant_conversations t
  union all select 'assistant_messages',md5(to_jsonb(t)::text) from public.assistant_messages t
  union all select 'assistant_pending_actions',md5(to_jsonb(t)::text) from public.assistant_pending_actions t
)
select name,count(*) as count,md5(string_agg(hash,'' order by hash)) as hash
from fingerprints group by name order by name;
