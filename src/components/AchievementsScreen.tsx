import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import type { AchievementCode, AchievementDashboard } from '../services/achievementApi';
import { useAchievementData } from './AchievementDataProvider';
import { AchievementBadgeHoldDetail } from './achievement/AchievementBadgeHoldDetail';
import { AchievementMountainHero } from './achievement/AchievementMountainHero';

const ACHIEVEMENT_ICONS: Record<AchievementCode, keyof typeof Ionicons.glyphMap> = {
  first_item: 'basket-outline',
  first_rescue: 'leaf-outline',
  waste_watcher: 'eye-outline',
  zero_waste_week: 'calendar-outline',
  rescue_ten: 'shield-checkmark-outline',
  fridge_regular: 'repeat-outline',
  shared_kitchen: 'people-outline',
  climate_summit: 'earth-outline',
};

const BADGE_LONG_PRESS_MS = 420;

// Arthur: NarIyirm
// 中文：页面只读取 App 级常驻成就快照；预取和后台同步由 AchievementDataProvider 负责，等级与解锁规则不在客户端复算。
// EN: This screen only reads the app-scoped achievement snapshot; AchievementDataProvider owns prefetch and background sync without recalculating authority client-side.
export function AchievementsScreen() {
  const { language, t } = useI18n();
  const { dashboard, failed, loading, refresh } = useAchievementData();
  const copy = t.wins;
  const [heroTailColor, setHeroTailColor] = useState('#60C7F5');
  const [heldAchievement, setHeldAchievement] = useState<AchievementDashboard['achievements'][number] | null>(null);
  const [badgeScrollEnabled, setBadgeScrollEnabled] = useState(true);

  // Arthur: NarIyirm
  // 中文：点击或长按打开 Modal；按下时暂停 ScrollView，避免滚动抢手势。松手不关，点遮罩才关。
  // EN: Tap or long-press opens the Modal; pause ScrollView while pressing so scroll cannot steal the gesture. Dismiss only via scrim tap.
  const showHeldAchievement = (achievement: AchievementDashboard['achievements'][number]) => {
    setHeldAchievement(achievement);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const dismissHeldAchievement = () => {
    setHeldAchievement(null);
    setBadgeScrollEnabled(true);
  };

  if (loading && !dashboard) {
    return <View style={styles.centerState}><ActivityIndicator color="#2A8A61" /><Text style={styles.stateText}>{copy.loading}</Text></View>;
  }

  if (failed && !dashboard) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="cloud-offline-outline" size={36} color="#70827A" />
        <Text style={styles.stateTitle}>{copy.loadError}</Text>
        <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retryButton}><Text style={styles.retryText}>{copy.retry}</Text></Pressable>
      </View>
    );
  }

  if (!dashboard) return null;
  const hasSettledData = dashboard.metrics.consumedBatchCount + dashboard.metrics.discardedBatchCount > 0;
  const currency = dashboard.metrics.currency === 'AUD' ? 'A$' : dashboard.metrics.currency;
  const numberLocale = language === 'zh' ? 'zh-CN' : 'en-AU';
  const money = (value: number) => `${currency}${Number(value).toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatUnlockDate = (value: string) => new Intl.DateTimeFormat(numberLocale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

  return (
    <View style={styles.screen}>
      <ScrollView
        alwaysBounceVertical={false}
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.content}
        overScrollMode="never"
        scrollEnabled={badgeScrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        <AchievementMountainHero copy={copy} dashboard={dashboard} key={dashboard.level.code} language={language} onTailColorChange={setHeroTailColor} rescuedValue={money(dashboard.metrics.rescuedValue)} />

        <View style={styles.sectionTransition}>
        {/* Arthur: NarIyirm */}
        {/* 中文：预览等级的底色从山峰组件传到内容区，在首张卡片背后继续向下渐变，形成跨组件的连续背景。 */}
        {/* EN: The preview level's tail color flows into the content area and fades behind the first card, creating one continuous cross-component background. */}
        <LinearGradient colors={[heroTailColor, '#F7FBFA']} end={{ x: 0.5, y: 1 }} pointerEvents="none" start={{ x: 0.5, y: 0 }} style={styles.sectionTransitionGradient} />
        <View style={styles.sections}>
        <View style={styles.card}>
          <View style={styles.sectionHeader}><Text style={styles.sectionIcon}>📊</Text><Text style={styles.sectionTitle}>{copy.impact.title}</Text></View>
          {hasSettledData ? (
            <>
              <ImpactRow label={copy.impact.rescuedValue} value={money(dashboard.metrics.rescuedValue)} tone="#32915C" />
              <ImpactRow label={copy.impact.consumedValue} value={money(dashboard.metrics.consumedValue)} tone="#258BB8" />
              <ImpactRow label={copy.impact.discardedValue} value={money(dashboard.metrics.discardedValue)} tone="#D27619" last />
              {dashboard.metrics.priceCoverageRate !== null && dashboard.metrics.priceCoverageRate < 0.8 ? <Text style={styles.coverageNote}>{copy.impact.partialCoverage(Math.round(dashboard.metrics.priceCoverageRate * 100))}</Text> : null}
            </>
          ) : <Text style={styles.emptyText}>{copy.impact.empty}</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}><Text style={styles.sectionIcon}>🏆</Text><Text style={styles.sectionTitle}>{copy.badges.title}</Text></View>
          <View style={styles.badgeRow}>
            {dashboard.achievements.filter((achievement) => achievement.status !== 'unavailable').map((achievement) => {
              const unlocked = achievement.status === 'unlocked' || achievement.unlocked;
              const stateLabel = unlocked && achievement.unlockedAt
                ? copy.badges.unlockedOn(formatUnlockDate(achievement.unlockedAt))
                : unlocked
                  ? copy.badges.unlocked
                  : achievement.status === 'in_progress' && achievement.progressTarget
                    ? copy.badges.progressOf(Number(achievement.progressCurrent ?? 0), Number(achievement.progressTarget))
                    : copy.badges.reward(achievement.xpReward);
              return (
                <Pressable
                  accessibilityHint={copy.badges.holdHint}
                  accessibilityLabel={`${copy.badges.items[achievement.code]}. ${stateLabel}. ${copy.badges.descriptions[achievement.code]}`}
                  accessibilityRole="button"
                  delayLongPress={BADGE_LONG_PRESS_MS}
                  key={achievement.code}
                  onLongPress={() => showHeldAchievement(achievement)}
                  onPress={() => showHeldAchievement(achievement)}
                  onPressIn={() => setBadgeScrollEnabled(false)}
                  onPressOut={() => {
                    if (heldAchievement === null) setBadgeScrollEnabled(true);
                  }}
                  style={({ pressed }) => [
                    styles.badgeCard,
                    !unlocked && styles.badgeCardLocked,
                    (pressed || heldAchievement?.code === achievement.code) && styles.badgeCardPressed,
                  ]}
                >
                  <View style={[styles.badgeIcon, !unlocked && styles.badgeIconLocked]}>
                    <Ionicons color={unlocked ? '#C6661C' : '#8A9A93'} name={ACHIEVEMENT_ICONS[achievement.code]} size={22} />
                  </View>
                  <Text numberOfLines={2} style={[styles.badgeName, !unlocked && styles.badgeNameLocked]}>{copy.badges.items[achievement.code]}</Text>
                  <Text numberOfLines={2} style={styles.badgeState}>{stateLabel}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, styles.lastCard]}>
          <View style={styles.sectionHeader}><Text style={styles.sectionIcon}>✨</Text><Text style={styles.sectionTitle}>{copy.recent.title}</Text></View>
          {dashboard.recentXpEvents.length === 0 ? <Text style={styles.emptyText}>{copy.recent.empty}</Text> : dashboard.recentXpEvents.slice(0, 5).map((event, index) => (
            <View key={event.id} style={[styles.xpRow, index === Math.min(4, dashboard.recentXpEvents.length - 1) && styles.impactRowLast]}>
              <View style={styles.xpIcon}><Ionicons name="sparkles" size={16} color="#2A8A61" /></View>
              <View style={styles.impactCopy}>
                <Text style={styles.xpReason}>{copy.recent.reasons[event.reasonCode as keyof typeof copy.recent.reasons] ?? copy.recent.fallback}</Text>
                <Text style={styles.xpDate}>{new Intl.DateTimeFormat(numberLocale, { dateStyle: 'medium' }).format(new Date(event.occurredAt))}</Text>
              </View>
              <Text style={styles.xpPoints}>+{event.points} XP</Text>
            </View>
          ))}
        </View>
        </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={dismissHeldAchievement}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={heldAchievement !== null}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel={copy.badges.releaseHint}
            accessibilityRole="button"
            onPress={dismissHeldAchievement}
            style={StyleSheet.absoluteFill}
          />
          {heldAchievement ? (
            <AchievementBadgeHoldDetail
              achievement={heldAchievement}
              copy={copy.badges}
              icon={ACHIEVEMENT_ICONS[heldAchievement.code]}
              unlockDateLabel={heldAchievement.unlockedAt ? copy.badges.unlockedOn(formatUnlockDate(heldAchievement.unlockedAt)) : null}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function ImpactRow({ label, last = false, tone, value }: { label: string; last?: boolean; tone: string; value: string }) {
  return <View style={[styles.impactRow, last && styles.impactRowLast]}><View style={[styles.impactDot, { backgroundColor: tone }]} /><View style={styles.impactCopy}><Text style={styles.impactLabel}>{label}</Text><Text style={styles.impactValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7FBFA' },
  content: { paddingBottom: 132 },
  sectionTransition: { position: 'relative', backgroundColor: '#F7FBFA' },
  sectionTransitionGradient: { position: 'absolute', top: 0, right: 0, left: 0, height: 260 },
  sections: { position: 'relative', zIndex: 1, paddingHorizontal: 18 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28, backgroundColor: '#F7FBFA' },
  stateText: { color: '#70827A', fontSize: 14, fontWeight: '700' },
  stateTitle: { color: '#173D31', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  retryButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#2A8A61' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  card: { marginTop: 18, padding: 16, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3EEE9' },
  lastCard: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { color: '#173D31', fontSize: 17, fontWeight: '900' },
  impactRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE8E3' },
  impactRowLast: { borderBottomWidth: 0 },
  impactDot: { width: 10, height: 10, borderRadius: 5 },
  impactCopy: { flex: 1, minWidth: 0 },
  impactLabel: { color: '#5E756D', fontSize: 12.5, fontWeight: '600' },
  impactValue: { marginTop: 3, color: '#173D31', fontSize: 16, fontWeight: '800' },
  coverageNote: { marginTop: 12, padding: 10, borderRadius: 11, backgroundColor: '#FFF6E9', color: '#8B632E', fontSize: 11.5, fontWeight: '700', lineHeight: 17 },
  emptyText: { color: '#70827A', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: { width: '47%', minHeight: 126, flexGrow: 1, alignItems: 'center', paddingHorizontal: 8, paddingTop: 14, paddingBottom: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFF8EF' },
  badgeCardLocked: { backgroundColor: '#F3F6F5' },
  badgeCardPressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  badgeIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#FFE8C8' },
  badgeIconLocked: { backgroundColor: '#E4EBE8' },
  badgeName: { marginTop: 10, color: '#173D31', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 16 },
  badgeNameLocked: { color: '#6F817A' },
  badgeState: { marginTop: 6, color: '#8A9A93', fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 14 },
  xpRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE8E3' },
  xpIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#EAF8EF' },
  xpReason: { color: '#173D31', fontSize: 13, fontWeight: '800' },
  xpDate: { marginTop: 3, color: '#789087', fontSize: 10.5, fontWeight: '600' },
  xpPoints: { color: '#2A8A61', fontSize: 13, fontWeight: '900' },
  modalRoot: { flex: 1 },
});
