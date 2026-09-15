-- Arthur: NarIyirm
-- 中文：为共享冰箱成员的库存操作增加独立通知类型，便于每台设备单独过滤和展示。
-- EN: Add a dedicated notification type for shared-fridge inventory activity so each device can filter and present it independently.

alter type public.notification_type add value if not exists 'shared';
