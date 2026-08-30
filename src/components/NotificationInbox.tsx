import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n, type Translation } from '../i18n';
import {
  fetchNotifications,
  markNotificationRead,
  type KitchenNotification,
  type NotificationType,
} from '../services/notificationApi';

const APPEARANCE: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tone: string }> = {
  expiring: { icon: 'time-outline', tone: '#E8774C' },
  expired: { icon: 'warning-outline', tone: '#D94B51' },
  restock: { icon: 'cart-outline', tone: '#D39A3C' },
  system: { icon: 'mail-outline', tone: '#5E9686' },
};

function copyForItem(t: Translation, item: KitchenNotification) {
  const name = item.payload.name?.trim() || t.notifications.messages.system.title();
  if (item.type === 'expired') {
    return { title: t.notifications.messages.expired.title(name), detail: t.notifications.messages.expired.detail };
  }
  if (item.type === 'restock') {
    return {
      title: t.notifications.messages.restock.title(name),
      detail: t.notifications.messages.restock.detail(
        Number(item.payload.currentQuantity ?? 0),
        Number(item.payload.minimumQuantity ?? 0),
        item.payload.unit ?? '',
      ),
    };
  }
  if (item.type === 'system') {
    return { title: t.notifications.messages.system.title(), detail: t.notifications.messages.system.detail() };
  }
  return {
    title: t.notifications.messages.expiring.title(name, Number(item.payload.daysLeft ?? 0)),
    detail: t.notifications.messages.expiring.detail,
  };
}

export function NotificationInbox({ onUnreadCountChange }: { onUnreadCountChange?: (count: number) => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<KitchenNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const snapshot = await fetchNotifications();
      setItems(snapshot.items);
      setUnreadCount(snapshot.unreadCount);
      onUnreadCountChange?.(snapshot.unreadCount);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPress = useCallback(async (item: KitchenNotification) => {
    // Arthur: NarIyirm
    // 中文：先更新本地已读和角标，失败再整表重拉，避免点按后角标还停在旧数字。
    // EN: Update local read state and the badge first; reload the inbox if the request fails.
    if (item.isRead) return;

    setItems((previous) => previous.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
    const nextUnread = Math.max(0, unreadCount - 1);
    setUnreadCount(nextUnread);
    onUnreadCountChange?.(nextUnread);

    try {
      await markNotificationRead(item.id);
    } catch {
      void load();
    }
  }, [load, onUnreadCountChange, unreadCount]);

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.summary}>{unreadCount > 0 ? t.notifications.unreadSummary(unreadCount) : t.notifications.allRead}</Text>
        <View style={[styles.statusDot, unreadCount === 0 && styles.statusDotRead]} />
      </View>

      {loading ? (
        <ActivityIndicator color="#D47B21" style={styles.spinner} />
      ) : failed ? (
        <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t.notifications.loadError}</Text>
        </Pressable>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t.notifications.empty}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item, index) => {
            const appearance = APPEARANCE[item.type];
            const copy = copyForItem(t, item);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${copy.title}. ${item.isRead ? '' : t.notifications.markRead}`}
                onPress={() => void onPress(item)}
                style={[styles.item, index === items.length - 1 && styles.itemLast, item.isRead && styles.itemRead]}
              >
                <View style={[styles.iconWell, { backgroundColor: `${appearance.tone}18` }]}>
                  <Ionicons name={appearance.icon} size={20} color={appearance.tone} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title}>{copy.title}</Text>
                  <Text style={styles.detail}>{copy.detail}</Text>
                </View>
                {item.isRead ? null : <View style={styles.unreadDot} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 30 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summary: { color: '#53665D', fontSize: 13, fontWeight: '700' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8774C' },
  statusDotRead: { backgroundColor: '#83A398' },
  spinner: { marginTop: 28 },
  emptyBox: { marginTop: 14, minHeight: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.62)' },
  emptyText: { color: '#718078', fontSize: 13, fontWeight: '600' },
  list: { marginTop: 14, overflow: 'hidden', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.62)' },
  item: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(70,91,81,0.15)' },
  itemLast: { borderBottomWidth: 0 },
  itemRead: { opacity: 0.62 },
  iconWell: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  copy: { flex: 1, marginLeft: 13 },
  title: { color: '#244A3E', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  detail: { marginTop: 3, color: '#718078', fontSize: 12, lineHeight: 17 },
  unreadDot: { width: 7, height: 7, marginLeft: 10, borderRadius: 4, backgroundColor: '#E8774C' },
});
