import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';

const PREVIEW_NOTIFICATION_TYPES = [
  { key: 'freshness', icon: 'time-outline', tone: '#E8774C' },
  { key: 'shopping', icon: 'cart-outline', tone: '#D39A3C' },
  { key: 'shared', icon: 'people-outline', tone: '#5E9686' },
] as const;

export function NotificationInbox({ unreadCount }: { unreadCount: number }) {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.summary}>{unreadCount > 0 ? t.notifications.unreadSummary(unreadCount) : t.notifications.allRead}</Text>
        <View style={[styles.statusDot, unreadCount === 0 && styles.statusDotRead]} />
      </View>

      {/* Arthur: NarIyirm
          中文：通知页先使用可替换的样例列表；接入 Supabase 后只需把查询结果映射成相同的标题、详情和类型字段。
          EN: The inbox uses replaceable preview rows; Supabase results can later map into the same title, detail, and type fields. */}
      <View style={styles.list}>
        {PREVIEW_NOTIFICATION_TYPES.map((notification, index) => {
          const copy = t.notifications.items[notification.key];
          return (
          <View key={notification.key} style={[styles.item, unreadCount <= PREVIEW_NOTIFICATION_TYPES.length && index === PREVIEW_NOTIFICATION_TYPES.length - 1 && styles.itemLast]}>
            <View style={[styles.iconWell, { backgroundColor: `${notification.tone}18` }]}>
              <Ionicons name={notification.icon} size={20} color={notification.tone} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.detail}>{copy.detail}</Text>
            </View>
            {index < unreadCount ? <View style={styles.unreadDot} /> : null}
          </View>
          );
        })}
        {unreadCount > PREVIEW_NOTIFICATION_TYPES.length ? (
          <View style={styles.moreRow}>
            <Text style={styles.moreText}>{t.notifications.older(unreadCount - PREVIEW_NOTIFICATION_TYPES.length)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 30 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summary: { color: '#53665D', fontSize: 13, fontWeight: '700' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8774C' },
  statusDotRead: { backgroundColor: '#83A398' },
  list: { marginTop: 14, overflow: 'hidden', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.62)' },
  item: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(70,91,81,0.15)' },
  itemLast: { borderBottomWidth: 0 },
  iconWell: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  copy: { flex: 1, marginLeft: 13 },
  title: { color: '#244A3E', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  detail: { marginTop: 3, color: '#718078', fontSize: 12, lineHeight: 17 },
  unreadDot: { width: 7, height: 7, marginLeft: 10, borderRadius: 4, backgroundColor: '#E8774C' },
  moreRow: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#718078', fontSize: 12, fontWeight: '600' },
});
