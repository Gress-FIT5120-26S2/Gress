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

export const fetchNotifications = () =>
  requestApi<NotificationInboxSnapshot>('/api/notifications');

export const markNotificationRead = (id: string) =>
  requestApi<void>(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  });