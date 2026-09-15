import { requestApi } from './apiClient';

export type NotificationType = 'expiring' | 'expired' | 'restock' | 'shared' | 'system';

export type KitchenNotification = {
  id: string;
  type: NotificationType;
  messageKey: string;
  payload: {
    name?: string;
    daysLeft?: number | null;
    unit?: string;
    currentQuantity?: number;
    minimumQuantity?: number;
    actorName?: string | null;
    action?: 'stocked' | 'updated' | 'removed';
    quantity?: number;
  };
  relatedBatchUid: string | null;
  createdAt: string;
  isRead: boolean;
};

export type NotificationInboxSnapshot = {
  unreadCount: number;
  badgeCount: number;
  items: KitchenNotification[];
};

export type NotificationPreferences = {
  notificationsEnabled: boolean;
  badgesEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  expiringEnabled: boolean;
  restockEnabled: boolean;
  sharedEnabled: boolean;
  systemEnabled: boolean;
  systemDeliveryEnabled: boolean;
  timeZone: string;
  updatedAt: string | null;
};

// Arthur: NarIyirm
// 中文：通知页和首页角标共用此快照；后端先按实时库存同步通知，再合并当前设备独立的已读状态。
// EN: The inbox and home badge share this snapshot; the backend first syncs notifications from live stock, then merges this device's read state.
export const fetchNotifications = () =>
  requestApi<NotificationInboxSnapshot>('/api/notifications');

// Arthur: NarIyirm
// 中文：点击通知后只写当前 deviceId 的 notification_reads；同一冰箱的其他成员不会被一起标记已读。
// EN: Opening a notification writes notification_reads only for the current deviceId, leaving other fridge members unread.
export const markNotificationRead = (id: string) =>
  requestApi<void>(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  });

export const fetchNotificationPreferences = () =>
  requestApi<NotificationPreferences>('/api/notification-preferences');

// Arthur: NarIyirm
// 中文：设置页按单个开关局部保存，避免快速调整多个选项时用旧快照覆盖其他偏好。
// EN: The settings screen saves one partial change at a time so rapid adjustments never overwrite other preferences with a stale snapshot.
export const updateNotificationPreferences = (patch: Partial<Omit<NotificationPreferences, 'updatedAt'>>) =>
  requestApi<NotificationPreferences>('/api/notification-preferences', {
    body: JSON.stringify(patch),
    method: 'PATCH',
  });

export const registerNotificationDelivery = (expoPushToken: string, platform: 'android' | 'ios', locale: 'en' | 'zh') =>
  requestApi<void>('/api/notification-delivery/register', {
    body: JSON.stringify({ expoPushToken, locale, platform }),
    method: 'POST',
  });
