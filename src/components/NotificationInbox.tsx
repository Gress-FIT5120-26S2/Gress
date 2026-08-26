import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

const PREVIEW_NOTIFICATIONS = [
  { icon: 'time-outline', title: '草莓还有 2 天到期', detail: '今晚使用，口感会更好', tone: '#E8774C' },
  { icon: 'cart-outline', title: '购物清单有 3 项待购买', detail: '牛奶、鸡蛋和燕麦库存偏低', tone: '#D39A3C' },
  { icon: 'people-outline', title: '共享厨房有新变化', detail: '一件商品刚刚被标记为已购买', tone: '#5E9686' },
] as const;

export function NotificationInbox({ unreadCount }: { unreadCount: number }) {
  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.summary}>{unreadCount > 0 ? `${unreadCount} 条未读提醒` : '所有提醒都已读'}</Text>
        <View style={[styles.statusDot, unreadCount === 0 && styles.statusDotRead]} />
      </View>

      {/* Arthur: NarIyirm
          中文：通知页先使用可替换的样例列表；接入 Supabase 后只需把查询结果映射成相同的标题、详情和类型字段。
          EN: The inbox uses replaceable preview rows; Supabase results can later map into the same title, detail, and type fields. */}
      <View style={styles.list}>
        {PREVIEW_NOTIFICATIONS.map((notification, index) => (
          <View key={notification.title} style={[styles.item, unreadCount <= PREVIEW_NOTIFICATIONS.length && index === PREVIEW_NOTIFICATIONS.length - 1 && styles.itemLast]}>
            <View style={[styles.iconWell, { backgroundColor: `${notification.tone}18` }]}>
              <Ionicons name={notification.icon} size={20} color={notification.tone} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{notification.title}</Text>
              <Text style={styles.detail}>{notification.detail}</Text>
            </View>
            {index < unreadCount ? <View style={styles.unreadDot} /> : null}
          </View>
        ))}
        {unreadCount > PREVIEW_NOTIFICATIONS.length ? (
          <View style={styles.moreRow}>
            <Text style={styles.moreText}>另有 {unreadCount - PREVIEW_NOTIFICATIONS.length} 条较早提醒</Text>
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
