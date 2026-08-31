import { requestApi } from './apiClient';

export type NotificationType = 'expiring' | 'expired' | 'restock' | 'system';

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
  };
  createdAt: string;
  isRead: boolean;
};

export type NotificationInboxSnapshot = {
  unreadCount: number;
  items: KitchenNotification[];
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
