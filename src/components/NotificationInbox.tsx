import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n, type Translation } from '../i18n';
import { fetchNotifications, markNotificationRead, type KitchenNotification, type NotificationType } from '../services/notificationApi';
import { subscribeToSync } from '../services/realtimeSync';

const APPEARANCE: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tone: string; well: string }> = {
  expiring: { icon: 'time-outline', tone: '#D96818', well: '#FFF0E2' },
  expired: { icon: 'warning-outline', tone: '#C44850', well: '#FBEAEC' },
  restock: { icon: 'cart-outline', tone: '#A8751E', well: '#FBF2DA' },
  shared: { icon: 'people-outline', tone: '#168ACB', well: '#E5F4FA' },
  system: { icon: 'sparkles-outline', tone: '#3D806C', well: '#E5F2ED' },
};

// Arthur: NarIyirm
// 中文：数据库只保存稳定键和参数；共享通知在这里使用成员昵称和动作生成当前语言文案。
// EN: The database stores stable keys and parameters only; shared events use the member name and action here to build localized copy.
function copyForItem(t: Translation, item: KitchenNotification) {
  const name = item.payload.name?.trim() || t.notifications.messages.system.title();
  if (item.type === 'expired') return { title: t.notifications.messages.expired.title(name), detail: t.notifications.messages.expired.detail };
  if (item.type === 'restock') {
    return {
      title: t.notifications.messages.restock.title(name),
      detail: t.notifications.messages.restock.detail(Number(item.payload.currentQuantity ?? 0), Number(item.payload.minimumQuantity ?? 0), item.payload.unit ?? ''),
    };
  }
  if (item.type === 'shared') {
    const actor = item.payload.actorName?.trim() || t.notifications.messages.shared.fallbackActor;
    const action = item.payload.action ?? 'updated';
    return { title: t.notifications.messages.shared[action](actor, name), detail: t.notifications.messages.shared.detail };
  }
  if (item.type === 'system') return { title: t.notifications.messages.system.title(), detail: t.notifications.messages.system.detail() };
  return { title: t.notifications.messages.expiring.title(name, Number(item.payload.daysLeft ?? 0)), detail: t.notifications.messages.expiring.detail };
}

type NotificationInboxProps = { initialNotificationId?: string | null; onBack: () => void; onCountsChange?: (badgeCount: number, unreadCount: number) => void };

// Arthur: NarIyirm
// 中文：消息页使用完整页面层级；空状态、列表、详情和当前设备已读状态共用同一个权威快照。
// EN: The notification centre is a full page whose empty state, list, detail view, and device-specific read state share one authoritative snapshot.
export function NotificationInbox({ initialNotificationId, onBack, onCountsChange }: NotificationInboxProps) {
  const { language, t } = useI18n();
  const [items, setItems] = useState<KitchenNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<KitchenNotification | null>(null);
  const handledNotificationIdRef = useRef<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setFailed(false);
    try {
      const snapshot = await fetchNotifications();
      setItems(snapshot.items);
      setUnreadCount(snapshot.unreadCount);
      setBadgeCount(snapshot.badgeCount);
      onCountsChange?.(snapshot.badgeCount, snapshot.unreadCount);
    } catch {
      setFailed(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onCountsChange]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeToSync(['notifications', 'inventory', 'fridge'], () => { void load(true); }), [load]);

  const openItem = useCallback(async (item: KitchenNotification) => {
    setSelected(item);
    if (item.isRead) return;
    setItems((previous) => previous.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
    setSelected({ ...item, isRead: true });
    const nextUnread = Math.max(0, unreadCount - 1);
    const nextBadge = Math.max(0, badgeCount - 1);
    setUnreadCount(nextUnread);
    setBadgeCount(nextBadge);
    onCountsChange?.(nextBadge, nextUnread);
    try { await markNotificationRead(item.id); } catch { void load(); }
  }, [badgeCount, load, onCountsChange, unreadCount]);

  useEffect(() => {
    if (!initialNotificationId || handledNotificationIdRef.current === initialNotificationId) return;
    const target = items.find((item) => item.id === initialNotificationId);
    if (!target) return;
    handledNotificationIdRef.current = initialNotificationId;
    void openItem(target);
  }, [initialNotificationId, items, openItem]);

  const selectedCopy = useMemo(() => (selected ? copyForItem(t, selected) : null), [selected, t]);
  const selectedTime = selected
    ? new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.createdAt))
    : '';

  const renderItem = ({ item }: { item: KitchenNotification }) => {
    const appearance = APPEARANCE[item.type];
    const copy = copyForItem(t, item);
    return (
      <Pressable accessibilityLabel={`${copy.title}. ${copy.detail}`} accessibilityRole="button" onPress={() => { void openItem(item); }} style={({ pressed }) => [styles.item, item.isRead && styles.itemRead, pressed && styles.itemPressed]}>
        <View style={[styles.iconWell, { backgroundColor: appearance.well }]}><Ionicons color={appearance.tone} name={appearance.icon} size={21} /></View>
        <View style={styles.itemCopy}>
          <Text numberOfLines={1} style={styles.itemTitle}>{copy.title}</Text>
          <Text numberOfLines={2} style={styles.itemDetail}>{copy.detail}</Text>
        </View>
        {!item.isRead ? <View style={styles.unreadDot} /> : null}
        <Ionicons color="#779087" name="chevron-forward" size={18} />
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.skyGlow} />
      <View pointerEvents="none" style={styles.warmGlow} />
      <View style={styles.header}>
        <Pressable accessibilityLabel={t.notifications.back} accessibilityRole="button" hitSlop={8} onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}><Ionicons color="#294B40" name="chevron-back" size={28} /></Pressable>
        <Text style={styles.pageTitle}>{t.notifications.pageTitle}</Text>
        <Pressable accessibilityLabel={t.notifications.refresh} accessibilityRole="button" hitSlop={8} onPress={() => { void load(); }} style={({ pressed }) => [styles.refreshButton, pressed && styles.backPressed]}><Ionicons color="#4F7065" name="refresh-outline" size={20} /></Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#168ACB" /></View>
      ) : failed ? (
        <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.centerState}>
          <Ionicons color="#8A9B95" name="cloud-offline-outline" size={48} />
          <Text style={styles.emptyTitle}>{t.notifications.loadError}</Text>
          <Text style={styles.emptyDetail}>{t.notifications.retry}</Text>
        </Pressable>
      ) : items.length === 0 ? (
        <View style={styles.centerState}>
          <View style={styles.emptyIcon}><Ionicons color="#8B9793" name="notifications-off-outline" size={48} /></View>
          <Text style={styles.emptyTitle}>{t.notifications.empty}</Text>
          <Text style={styles.emptyDetail}>{t.notifications.emptyDetail}</Text>
        </View>
      ) : (
        <FlatList contentContainerStyle={styles.listContent} data={items} keyExtractor={(item) => item.id} ListHeaderComponent={<View style={styles.summaryRow}><Text style={styles.summary}>{unreadCount > 0 ? t.notifications.unreadSummary(unreadCount) : t.notifications.allRead}</Text><View style={[styles.summaryDot, unreadCount === 0 && styles.summaryDotRead]} /></View>} renderItem={renderItem} showsVerticalScrollIndicator={false} />
      )}

      <Modal animationType="fade" onRequestClose={() => setSelected(null)} presentationStyle="overFullScreen" transparent visible={selected !== null}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel={t.notifications.detail.close} onPress={() => setSelected(null)} style={StyleSheet.absoluteFill} />
          {selected && selectedCopy ? (
            <View style={styles.detailSheet}>
              <View style={styles.sheetHandle} />
              <View style={[styles.detailIcon, { backgroundColor: APPEARANCE[selected.type].well }]}><Ionicons color={APPEARANCE[selected.type].tone} name={APPEARANCE[selected.type].icon} size={25} /></View>
              <Text style={styles.detailTitle}>{selectedCopy.title}</Text>
              <Text style={styles.detailBody}>{selectedCopy.detail}</Text>
              <Text style={styles.detailTime}>{selectedTime}</Text>
              <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={({ pressed }) => [styles.doneButton, pressed && styles.itemPressed]}><Text style={styles.doneText}>{t.notifications.detail.close}</Text></Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#F7FBFA' },
  skyGlow: { position: 'absolute', top: 80, right: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(205,239,249,0.40)' },
  warmGlow: { position: 'absolute', bottom: 40, left: -110, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,231,208,0.30)' },
  header: { minHeight: 118, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 18, paddingBottom: 15 },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.86)' },
  refreshButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.62)' },
  backPressed: { opacity: 0.66, transform: [{ scale: 0.97 }] },
  pageTitle: { flex: 1, paddingBottom: 13, color: '#183E32', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 42, paddingBottom: 120 },
  emptyIcon: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 15, color: '#223F36', fontSize: 21, fontWeight: '800', textAlign: 'center' },
  emptyDetail: { marginTop: 8, color: '#6B7E77', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 130 },
  summaryRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  summary: { color: '#526A61', fontSize: 13, fontWeight: '700' },
  summaryDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8774C' },
  summaryDotRead: { backgroundColor: '#83A398' },
  item: { minHeight: 82, flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 15, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.90)' },
  itemRead: { opacity: 0.64 }, itemPressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  iconWell: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  itemCopy: { flex: 1, minWidth: 0, marginLeft: 12 }, itemTitle: { color: '#25473B', fontSize: 14, fontWeight: '800', lineHeight: 19 },
  itemDetail: { marginTop: 3, color: '#657970', fontSize: 12, lineHeight: 17 }, unreadDot: { width: 8, height: 8, marginHorizontal: 8, borderRadius: 4, backgroundColor: '#F58220' },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,37,31,0.34)' },
  detailSheet: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#F7FBFA' },
  sheetHandle: { width: 38, height: 5, alignSelf: 'center', borderRadius: 3, backgroundColor: '#CBD9D4' },
  detailIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 24, borderRadius: 16 },
  detailTitle: { marginTop: 18, color: '#1F4035', fontSize: 22, fontWeight: '900', lineHeight: 28 }, detailBody: { marginTop: 9, color: '#536D64', fontSize: 14, lineHeight: 21 },
  detailTime: { marginTop: 16, color: '#7A8B85', fontSize: 12 }, doneButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 24, borderRadius: 15, backgroundColor: '#168ACB' },
  doneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
