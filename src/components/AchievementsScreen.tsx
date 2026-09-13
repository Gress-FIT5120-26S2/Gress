import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { getApiErrorCode } from '../services/apiClient';
import type { AchievementCode, AchievementDashboard, FridgeQuestAssignment } from '../services/achievementApi';
import { rerollQuest } from '../services/achievementApi';
import { useAchievementData } from './AchievementDataProvider';
import { AchievementBadgeHoldDetail } from './achievement/AchievementBadgeHoldDetail';
import { AchievementCelebration } from './achievement/AchievementCelebration';
import { AchievementImpactCard } from './achievement/AchievementImpactCard';
import { AchievementJourneyModal } from './achievement/AchievementJourneyModal';
import { AchievementMountainHero } from './achievement/AchievementMountainHero';
import { AchievementQuestSection } from './achievement/AchievementQuestSection';
import {
  formatBadgeProgressLabel,
  getBadgeProgressRatio,
  isAchievementBadgeVisible,
  resolveVisibleBadgeStatus,
} from './achievement/badgePresentation';

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
  const [rerollingAssignmentUid, setRerollingAssignmentUid] = useState<string | null>(null);
  const [rerollError, setRerollError] = useState<string | null>(null);
  const [journeyVisible, setJourneyVisible] = useState(false);
  const [journeyInitialTab, setJourneyInitialTab] = useState<'journey' | 'medals'>('journey');
  const [celebrationXp, setCelebrationXp] = useState<number | null>(null);
  const latestXpEventRef = useRef<string | null | undefined>(undefined);

  // Arthur: NarIyirm
  // 中文：仅在当前会话观察到新的任务完成 XP 时庆祝，首次加载历史记录不会误触发动画。
  // EN: Celebrate only a newly observed quest XP event in this session; loading historical events never triggers the animation.
  useEffect(() => {
    const latest = dashboard?.recentXpEvents[0] ?? null;
    if (latestXpEventRef.current !== undefined && latest?.id !== latestXpEventRef.current && latest?.reasonCode === 'quest_completed') {
      setCelebrationXp(latest.points);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    latestXpEventRef.current = latest?.id ?? null;
  }, [dashboard?.recentXpEvents]);

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

  const handleReroll = async (assignment: FridgeQuestAssignment) => {
    if (rerollingAssignmentUid) return;
    setRerollingAssignmentUid(assignment.assignmentUid);
    setRerollError(null);
    try {
      await rerollQuest(assignment.assignmentUid);
      await refresh(true);
      void Haptics.selectionAsync().catch(() => undefined);
    } catch (error) {
      const code = getApiErrorCode(error);
      setRerollError(
        code === 'quest_reroll_exhausted'
          ? copy.quests.rerollUsed
          : code === 'quest_not_rerollable'
            ? copy.quests.rerollUnavailable
            : copy.quests.rerollFailed,
      );
    } finally {
      setRerollingAssignmentUid(null);
    }
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
  const currency = dashboard.metrics.currency === 'AUD' ? 'A$' : dashboard.metrics.currency;
  const numberLocale = language === 'zh' ? 'zh-CN' : 'en-AU';
  const money = (value: number) => `${currency}${Number(value).toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatUnlockDate = (value: string) => new Intl.DateTimeFormat(numberLocale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  const rescueMilestone = dashboard.achievements.find((achievement) => achievement.code === 'rescue_ten' && achievement.status !== 'unlocked' && achievement.status !== 'unavailable') ?? null;

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
        <AchievementImpactCard
          copy={copy.impact}
          metrics={dashboard.metrics}
          milestone={rescueMilestone}
          milestoneTitle={rescueMilestone ? copy.badges.items[rescueMilestone.code] : null}
          money={money}
          onOpenMilestone={() => { setJourneyInitialTab('journey'); setJourneyVisible(true); }}
        />

        <AchievementQuestSection
          copy={copy.quests}
          daily={dashboard.quests?.dailyAssignments ?? (dashboard.quests?.daily ? [dashboard.quests.daily] : [])}
          dailyRerollsRemaining={dashboard.quests?.dailyRerollsRemaining ?? 0}
          formatEndsAt={(iso) => new Intl.DateTimeFormat(numberLocale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))}
          onReroll={(assignment) => { void handleReroll(assignment); }}
          rerollingAssignmentUid={rerollingAssignmentUid}
          weekly={dashboard.quests?.weeklyAssignments ?? (dashboard.quests?.weekly ? [dashboard.quests.weekly] : [])}
          weeklyRerollsRemaining={dashboard.quests?.weeklyRerollsRemaining ?? 0}
        />
        {rerollError ? <Text style={styles.rerollError}>{rerollError}</Text> : null}

        <View style={styles.card}>
          <View style={styles.sectionHeader}><Text style={styles.sectionIcon}>🏆</Text><Text style={styles.sectionTitle}>{copy.badges.title}</Text><Pressable accessibilityRole="button" onPress={() => { setJourneyInitialTab('medals'); setJourneyVisible(true); }} style={styles.viewAll}><Text style={styles.viewAllText}>{language === 'zh' ? '查看奖牌馆' : 'View medals'}</Text><Ionicons color="#2A8A61" name="chevron-forward" size={14} /></Pressable></View>
          <View style={styles.badgeRow}>
            {dashboard.achievements.filter(isAchievementBadgeVisible).map((achievement) => {
              // Arthur: NarIyirm
              // 中文：四态只读服务端 status + 进度分母；unavailable 已过滤，locked 展示条件而非 0 进度失败感。
              // EN: Four states read server status plus progress denominators; unavailable is hidden and locked shows the requirement instead of failed zero progress.
              const status = resolveVisibleBadgeStatus(achievement);
              const progressRatio = getBadgeProgressRatio(achievement);
              const progressLabel = formatBadgeProgressLabel(achievement, copy.badges);
              const stateLabel = status === 'unlocked'
                ? (achievement.unlockedAt
                  ? copy.badges.unlockedOn(formatUnlockDate(achievement.unlockedAt))
                  : copy.badges.unlocked)
                : status === 'in_progress'
                  ? progressLabel
                  : copy.badges.descriptions[achievement.code];
              const iconColor = status === 'unlocked' ? '#C6661C' : status === 'in_progress' ? '#A8895C' : '#8A9A93';
              return (
                <Pressable
                  accessibilityHint={copy.badges.holdHint}
                  accessibilityLabel={`${copy.badges.items[achievement.code]}. ${status === 'locked' ? copy.badges.locked : status === 'in_progress' ? copy.badges.inProgress : copy.badges.unlocked}. ${stateLabel}. ${copy.badges.descriptions[achievement.code]}`}
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
                    status === 'unlocked' && styles.badgeCardUnlocked,
                    status === 'in_progress' && styles.badgeCardInProgress,
                    status === 'locked' && styles.badgeCardLocked,
                    (pressed || heldAchievement?.code === achievement.code) && styles.badgeCardPressed,
                  ]}
                >
                  <View style={[
                    styles.badgeIcon,
                    status === 'unlocked' && styles.badgeIconUnlocked,
                    status === 'in_progress' && styles.badgeIconInProgress,
                    status === 'locked' && styles.badgeIconLocked,
                  ]}>
                    <Ionicons color={iconColor} name={ACHIEVEMENT_ICONS[achievement.code]} size={22} />
                  </View>
                  <Text numberOfLines={2} style={[styles.badgeName, status !== 'unlocked' && styles.badgeNameMuted]}>{copy.badges.items[achievement.code]}</Text>
                  <Text numberOfLines={2} style={[styles.badgeState, status === 'unlocked' && styles.badgeStateUnlocked, status === 'in_progress' && styles.badgeStateInProgress]}>{stateLabel}</Text>
                  {status === 'in_progress' ? (
                    <View style={styles.badgeProgressTrack}>
                      <View style={[styles.badgeProgressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
                    </View>
                  ) : null}
                  {status === 'locked' ? <Text style={styles.badgeReward}>{copy.badges.reward(achievement.xpReward)}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, styles.lastCard]}>
          <View style={styles.sectionHeader}><Text style={styles.sectionIcon}>✨</Text><Text style={styles.sectionTitle}>{copy.recent.title}</Text></View>
          {dashboard.recentXpEvents.length === 0 ? <Text style={styles.emptyText}>{copy.recent.empty}</Text> : dashboard.recentXpEvents.slice(0, 5).map((event, index) => (
            <View key={event.id} style={[styles.xpRow, index === Math.min(4, dashboard.recentXpEvents.length - 1) && styles.rowLast]}>
              <View style={styles.xpIcon}><Ionicons name="sparkles" size={16} color="#2A8A61" /></View>
              <View style={styles.rowCopy}>
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
      <AchievementJourneyModal badgeCopy={copy.badges} dashboard={dashboard} initialTab={journeyInitialTab} language={language} onClose={() => setJourneyVisible(false)} visible={journeyVisible} />
      {celebrationXp !== null ? <AchievementCelebration onDone={() => setCelebrationXp(null)} xp={celebrationXp} /> : null}
    </View>
  );
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
  sectionTitle: { color: '#173D31', fontSize: 17, fontWeight: '900', flex: 1 },
  viewAll: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 10 },
  viewAllText: { color: '#2A8A61', fontSize: 11, fontWeight: '800' },
  rowLast: { borderBottomWidth: 0 },
  rowCopy: { flex: 1, minWidth: 0 },
  emptyText: { color: '#70827A', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  rerollError: { marginTop: 8, marginHorizontal: 18, color: '#B42318', fontSize: 12, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: { width: '47%', minHeight: 126, flexGrow: 1, alignItems: 'center', paddingHorizontal: 8, paddingTop: 14, paddingBottom: 12, borderRadius: 16, borderCurve: 'continuous' },
  badgeCardUnlocked: { backgroundColor: '#FFF8EF' },
  badgeCardInProgress: { backgroundColor: '#F7F4EE' },
  badgeCardLocked: { backgroundColor: '#F3F6F5' },
  badgeCardPressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  badgeIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  badgeIconUnlocked: { backgroundColor: '#FFE8C8' },
  badgeIconInProgress: { backgroundColor: '#EFE6D8' },
  badgeIconLocked: { backgroundColor: '#E4EBE8' },
  badgeName: { marginTop: 10, color: '#173D31', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 16 },
  badgeNameMuted: { color: '#6F817A' },
  badgeState: { marginTop: 6, color: '#8A9A93', fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 14 },
  badgeStateUnlocked: { color: '#2A8A61' },
  badgeStateInProgress: { color: '#8B6B3A' },
  badgeProgressTrack: { alignSelf: 'stretch', marginTop: 8, height: 6, borderRadius: 999, backgroundColor: '#E7E0D4', overflow: 'hidden' },
  badgeProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#C6661C' },
  badgeReward: { marginTop: 6, color: '#A0AFA8', fontSize: 10, fontWeight: '700' },
  xpRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE8E3' },
  xpIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#EAF8EF' },
  xpReason: { color: '#173D31', fontSize: 13, fontWeight: '800' },
  xpDate: { marginTop: 3, color: '#789087', fontSize: 10.5, fontWeight: '600' },
  xpPoints: { color: '#2A8A61', fontSize: 13, fontWeight: '900' },
  modalRoot: { flex: 1 },
});
