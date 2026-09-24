import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { getApiErrorCode } from '../services/apiClient';
import type { AchievementDashboard, FridgeQuestAssignment } from '../services/achievementApi';
import { rerollQuest } from '../services/achievementApi';
import { useAchievementData } from './AchievementDataProvider';
import { AchievementBadgeHoldDetail } from './achievement/AchievementBadgeHoldDetail';
import { AchievementCelebration } from './achievement/AchievementCelebration';
import { AchievementImpactCard } from './achievement/AchievementImpactCard';
import { AchievementJourneyModal, Medal } from './achievement/AchievementJourneyModal';
import { AchievementMountainHero } from './achievement/AchievementMountainHero';
import { AchievementQuestSection } from './achievement/AchievementQuestSection';
import { AchievementStageReport } from './achievement/AchievementStageReport';
import { getBadgeProgressRatio, isAchievementBadgeVisible, resolveVisibleBadgeStatus } from './achievement/badgePresentation';

type DetailRoute = 'quests' | 'impact' | 'report' | 'xp' | null;
type AchievementsScreenProps = { onAddFirstItem: () => void; onOpenInventoryItem: (batchUid: string) => void };
const BADGE_LONG_PRESS_MS = 420;

// Arthur: NarIyirm
// 中文：首页只展示等级、下一步与成果预览；完整挑战和记录留在按需打开的详情页，权威状态仍全部来自成就快照。
// EN: The overview shows level, next action, and impact previews; full challenges and history open on demand, with all authoritative state still coming from the achievement snapshot.
export function AchievementsScreen({ onAddFirstItem, onOpenInventoryItem }: AchievementsScreenProps) {
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const { dashboard, failed, loading, refresh } = useAchievementData();
  const copy = t.wins;
  const [heroTailColor, setHeroTailColor] = useState('#60C7F5');
  const [heldAchievement, setHeldAchievement] = useState<AchievementDashboard['achievements'][number] | null>(null);
  const [rerollingAssignmentUid, setRerollingAssignmentUid] = useState<string | null>(null);
  const [rerollError, setRerollError] = useState<string | null>(null);
  const [journeyRoute, setJourneyRoute] = useState<'journey' | 'medals' | null>(null);
  const [detailRoute, setDetailRoute] = useState<DetailRoute>(null);
  const [reportReturnRoute, setReportReturnRoute] = useState<'impact' | null>(null);
  const [initialQuestUid, setInitialQuestUid] = useState<string | null>(null);
  const [celebrationXp, setCelebrationXp] = useState<number | null>(null);
  const latestXpEventRef = useRef<string | null | undefined>(undefined);

  // Arthur: NarIyirm
  // 中文：报告可从概览或环保里程碑打开；系统返回键回到实际来源页面。
  // EN: The report can open from the overview or impact detail; system back returns to its actual source.
  useEffect(() => {
    if (!detailRoute) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setDetailRoute(detailRoute === 'report' ? reportReturnRoute : null);
      setInitialQuestUid(null);
      return true;
    });
    return () => subscription.remove();
  }, [detailRoute, reportReturnRoute]);

  // Arthur: NarIyirm
  // 中文：只庆祝本次会话新出现的挑战 XP，首次加载已有流水时不播放旧奖励。
  // EN: Celebrate only quest XP newly observed in this session, never historical events on first load.
  useEffect(() => {
    const latest = dashboard?.recentXpEvents[0] ?? null;
    if (latestXpEventRef.current !== undefined && latest?.id !== latestXpEventRef.current && latest?.reasonCode === 'quest_completed') {
      setCelebrationXp(latest.points);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    latestXpEventRef.current = latest?.id ?? null;
  }, [dashboard?.recentXpEvents]);

  const showHeldAchievement = (achievement: AchievementDashboard['achievements'][number]) => {
    setHeldAchievement(achievement);
    void Haptics.selectionAsync().catch(() => undefined);
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
    return <View style={styles.centerState}>
      <Ionicons color="#70827A" name="cloud-offline-outline" size={36} />
      <Text style={styles.stateTitle}>{copy.loadError}</Text>
      <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retryButton}><Text style={styles.retryText}>{copy.retry}</Text></Pressable>
    </View>;
  }
  if (!dashboard) return null;

  const currency = dashboard.metrics.currency === 'AUD' ? 'A$' : dashboard.metrics.currency;
  const numberLocale = language === 'zh' ? 'zh-CN' : 'en-AU';
  const money = (value: number) => `${currency}${Number(value).toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatUnlockDate = (value: string) => new Intl.DateTimeFormat(numberLocale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  const daily = dashboard.quests?.dailyAssignments ?? (dashboard.quests?.daily ? [dashboard.quests.daily] : []);
  const weekly = dashboard.quests?.weeklyAssignments ?? (dashboard.quests?.weekly ? [dashboard.quests.weekly] : []);
  const dailyDone = daily.filter((item) => item.status === 'completed').length;
  const weeklyDone = weekly.filter((item) => item.status === 'completed').length;
  // Arthur: NarIyirm
  // 中文：只在已分配且未完成的挑战中选焦点，先展示今日，再按服务端进度挑最接近完成的一项。
  // EN: Focus only on assigned unfinished challenges, prioritising today and then the closest server-reported progress.
  const focusQuest = [...daily, ...weekly]
    .filter((item) => item.status === 'assigned')
    .sort((a, b) => Number(b.periodType === 'daily') - Number(a.periodType === 'daily')
      || b.progressCurrent / Math.max(1, b.progressTarget) - a.progressCurrent / Math.max(1, a.progressTarget))[0] ?? null;
  const firstItemUnlocked = dashboard.achievements.find((item) => item.code === 'first_item')?.status === 'unlocked';
  const promptFirstItem = !focusQuest && daily.length + weekly.length === 0 && !firstItemUnlocked;
  const stepTitle = focusQuest
    ? copy.quests.items[focusQuest.questCode]
    : promptFirstItem ? copy.overview.addFirstItem : daily.length + weekly.length > 0 ? copy.overview.allDone : copy.overview.noEligible;
  const stepHint = focusQuest
    ? `${copy.quests.progressOf(focusQuest.progressCurrent, focusQuest.progressTarget)} · ${copy.quests.reward(focusQuest.rewardXp)}`
    : promptFirstItem ? copy.overview.addFirstItemHint : daily.length + weekly.length > 0 ? copy.overview.allDoneHint : copy.overview.noEligibleHint;
  const visibleBadges = dashboard.achievements.filter(isAchievementBadgeVisible);
  // Arthur: NarIyirm
  // 中文：预览优先露出最近解锁的奖牌，其次是已有进度的目标；零进度时保留目录原顺序。
  // EN: Preview recent unlocks first, then progressed goals; preserve catalog order when nothing has progress.
  const badgePreview = visibleBadges.map((item, index) => ({ item, index })).sort((a, b) => {
    const aStatus = resolveVisibleBadgeStatus(a.item);
    const bStatus = resolveVisibleBadgeStatus(b.item);
    const priority = (status: string) => status === 'unlocked' ? 0 : status === 'in_progress' ? 1 : 2;
    return priority(aStatus) - priority(bStatus)
      || (aStatus === 'unlocked' && bStatus === 'unlocked' ? (b.item.unlockedAt ?? '').localeCompare(a.item.unlockedAt ?? '') : 0)
      || (aStatus === 'in_progress' && bStatus === 'in_progress' ? getBadgeProgressRatio(b.item) - getBadgeProgressRatio(a.item) : 0)
      || a.index - b.index;
  }).slice(0, 2).map(({ item }) => item);
  const rescueMilestone = dashboard.achievements.find((item) => item.code === 'rescue_ten' && item.status !== 'unlocked' && item.status !== 'unavailable') ?? null;

  const openQuests = (questUid: string | null) => {
    setRerollError(null);
    setInitialQuestUid(questUid);
    setDetailRoute('quests');
  };
  const closeDetail = () => {
    setDetailRoute(detailRoute === 'report' ? reportReturnRoute : null);
    setInitialQuestUid(null);
  };
  const openReport = (source: 'impact' | null) => {
    setReportReturnRoute(source);
    setDetailRoute('report');
  };

  return <View style={styles.screen}>
    {detailRoute ? (
      <View style={styles.detailPage}>
        <View style={[styles.detailHeader, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <Pressable accessibilityLabel={detailRoute === 'report' && reportReturnRoute === 'impact' ? copy.report.backToImpact : copy.overview.back} accessibilityRole="button" hitSlop={10} onPress={closeDetail} style={styles.backButton}>
            <Ionicons color="#FFFFFF" name="chevron-back" size={25} />
          </Pressable>
          <Text style={styles.detailTitle}>{detailRoute === 'quests' ? copy.quests.title : detailRoute === 'impact' ? copy.impact.title : detailRoute === 'report' ? copy.report.title : copy.recent.title}</Text>
          <View style={styles.backButton} />
        </View>
        <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          {detailRoute === 'quests' ? <>
            <AchievementQuestSection
              copy={copy.quests}
              daily={daily}
              dailyRerollsRemaining={dashboard.quests?.dailyRerollsRemaining ?? 0}
              formatEndsAt={(iso) => new Intl.DateTimeFormat(numberLocale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))}
              initialQuestUid={initialQuestUid}
              onReroll={(assignment) => { void handleReroll(assignment); }}
              rerollingAssignmentUid={rerollingAssignmentUid}
              weekly={weekly}
              weeklyRerollsRemaining={dashboard.quests?.weeklyRerollsRemaining ?? 0}
            />
            {rerollError ? <Text style={styles.rerollError}>{rerollError}</Text> : null}
          </> : null}
          {detailRoute === 'impact' ? <><AchievementImpactCard
            copy={copy.impact}
            metrics={dashboard.metrics}
            milestone={rescueMilestone}
            milestoneTitle={rescueMilestone ? copy.badges.items[rescueMilestone.code] : null}
            money={money}
            onOpenMilestone={() => { closeDetail(); setJourneyRoute('journey'); }}
          />
            <Pressable accessibilityRole="button" onPress={() => openReport('impact')} style={({ pressed }) => [styles.reportEntry, pressed && styles.pressed]}>
              <View style={styles.reportEntryIcon}><Ionicons color="#2A8A61" name="stats-chart-outline" size={22} /></View>
              <View style={styles.rowCopy}><Text style={styles.reportEntryTitle}>{copy.report.entryTitle}</Text><Text style={styles.reportEntryHint}>{copy.report.entryHint}</Text></View>
              <Ionicons color="#70827A" name="chevron-forward" size={20} />
            </Pressable>
          </> : null}
          {detailRoute === 'report' ? <AchievementStageReport onOpenInventoryItem={onOpenInventoryItem} /> : null}
          {detailRoute === 'xp' ? <View style={styles.xpCard}>
            {dashboard.recentXpEvents.length === 0 ? <Text style={styles.emptyText}>{copy.recent.empty}</Text> : dashboard.recentXpEvents.map((event, index) => (
              <View key={event.id} style={[styles.xpRow, index === dashboard.recentXpEvents.length - 1 && styles.rowLast]}>
                <View style={styles.xpIcon}><Ionicons color="#2A8A61" name="sparkles" size={16} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.xpReason}>{copy.recent.reasons[event.reasonCode as keyof typeof copy.recent.reasons] ?? copy.recent.fallback}</Text>
                  <Text style={styles.xpDate}>{new Intl.DateTimeFormat(numberLocale, { dateStyle: 'medium' }).format(new Date(event.occurredAt))}</Text>
                </View>
                <Text style={styles.xpPoints}>{event.points > 0 ? '+' : ''}{event.points} XP</Text>
              </View>
            ))}
          </View> : null}
        </ScrollView>
      </View>
    ) : (
      <ScrollView
        alwaysBounceVertical={false}
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.content}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <AchievementMountainHero
          copy={copy}
          dashboard={dashboard}
          key={dashboard.level.code}
          language={language}
          onOpenXpHistory={() => setDetailRoute('xp')}
          onTailColorChange={setHeroTailColor}
          rescuedValue={money(dashboard.metrics.rescuedValue)}
          xpHistoryLabel={copy.overview.xpHistory}
        />
        <View style={styles.sectionTransition}>
          <LinearGradient colors={[heroTailColor, '#F7FBFA']} end={{ x: 0.5, y: 1 }} pointerEvents="none" start={{ x: 0.5, y: 0 }} style={styles.sectionTransitionGradient} />
          <View style={styles.sections}>
            <View style={styles.nextCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeadingGroup}><View style={styles.headerIcon}><Ionicons color="#2A8A61" name="flag" size={20} /></View><Text style={styles.cardTitle}>{copy.overview.nextStep}</Text></View>
                <Pressable accessibilityRole="button" onPress={() => openQuests(null)} style={styles.headerLink}><Text style={styles.headerLinkText}>{copy.overview.allChallenges}</Text><Ionicons color="#2A8A61" name="chevron-forward" size={16} /></Pressable>
              </View>
              <Pressable accessibilityRole="button" onPress={promptFirstItem ? onAddFirstItem : () => openQuests(focusQuest?.assignmentUid ?? null)} style={({ pressed }) => [styles.nextAction, pressed && styles.pressed]}>
                <View style={styles.actionIcon}><Ionicons color="#2A8A61" name={promptFirstItem ? 'basket-outline' : focusQuest ? 'leaf-outline' : 'checkmark-circle-outline'} size={25} /></View>
                <View style={styles.actionCopy}><Text numberOfLines={2} style={styles.actionTitle}>{stepTitle}</Text><Text numberOfLines={2} style={styles.actionHint}>{stepHint}</Text></View>
                <Ionicons color="#70827A" name="chevron-forward" size={20} />
              </Pressable>
              <Text style={styles.challengeCount}>{copy.overview.challengeCount(dailyDone, daily.length, weeklyDone, weekly.length)}</Text>
            </View>

            <View style={styles.impactSummary}>
              <View style={styles.impactSummaryHeader}>
                <View style={styles.cardHeadingGroup}><View style={styles.headerIcon}><Ionicons color="#2A8A61" name="leaf" size={22} /></View><Text style={styles.cardTitle}>{copy.impact.title}</Text></View>
                <Pressable accessibilityRole="button" onPress={() => openReport(null)} style={({ pressed }) => [styles.reportShortcut, pressed && styles.pressed]}>
                  <Text style={styles.reportShortcutText}>{copy.report.shortcut}</Text><Ionicons color="#2A8A61" name="chevron-forward" size={16} />
                </Pressable>
              </View>
              <Pressable accessibilityLabel={`${copy.impact.title} · ${copy.overview.impactSummary(dashboard.metrics.rescuedBatchCount, money(dashboard.metrics.rescuedValue))}`} accessibilityRole="button" onPress={() => setDetailRoute('impact')} style={({ pressed }) => [styles.impactSummaryBody, pressed && styles.pressed]}>
                <View style={styles.summaryCopy}>
                  <Text numberOfLines={1} style={styles.summaryValue}>{copy.overview.impactSummary(dashboard.metrics.rescuedBatchCount, money(dashboard.metrics.rescuedValue))}</Text>
                  {dashboard.metrics.priceCoverageRate !== null && dashboard.metrics.priceCoverageRate < 0.8
                    ? <Text style={styles.coverageNote}>{copy.impact.partialCoverage(Math.round(dashboard.metrics.priceCoverageRate * 100))}</Text>
                    : null}
                </View>
                <Ionicons color="#70827A" name="chevron-forward" size={20} />
              </Pressable>
            </View>

            <View style={styles.medalCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeadingGroup}><View style={styles.medalHeaderIcon}><Ionicons color="#BA741B" name="trophy" size={20} /></View><Text style={styles.cardTitle}>{copy.badges.title}</Text></View>
                <Pressable accessibilityRole="button" onPress={() => setJourneyRoute('medals')} style={styles.headerLink}><Text style={styles.headerLinkText}>{copy.overview.medalHall}</Text><Ionicons color="#2A8A61" name="chevron-forward" size={16} /></Pressable>
              </View>
              <View style={styles.medalPreviewRow}>
                {badgePreview.map((achievement) => {
                  const status = resolveVisibleBadgeStatus(achievement);
                  return <Pressable
                    accessibilityLabel={`${copy.badges.items[achievement.code]}. ${status === 'unlocked' ? copy.badges.unlocked : status === 'in_progress' ? copy.badges.inProgress : copy.badges.locked}`}
                    accessibilityRole="button"
                    delayLongPress={BADGE_LONG_PRESS_MS}
                    key={achievement.code}
                    onLongPress={() => showHeldAchievement(achievement)}
                    onPress={() => showHeldAchievement(achievement)}
                    style={({ pressed }) => [styles.medalPreview, pressed && styles.pressed]}
                  >
                    <Medal code={achievement.code} earned={status === 'unlocked'} size={72} />
                    <Text numberOfLines={1} style={styles.medalName}>{copy.badges.items[achievement.code]}</Text>
                    <Text numberOfLines={1} style={styles.medalState}>{status === 'in_progress' ? `${Math.floor(achievement.progressCurrent)}/${Math.floor(achievement.progressTarget)}` : status === 'unlocked' ? copy.badges.unlocked : copy.badges.locked}</Text>
                  </Pressable>;
                })}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    )}

    <Modal animationType="fade" onRequestClose={() => setHeldAchievement(null)} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={heldAchievement !== null}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel={copy.badges.releaseHint} accessibilityRole="button" onPress={() => setHeldAchievement(null)} style={StyleSheet.absoluteFill} />
        {heldAchievement ? <AchievementBadgeHoldDetail
          achievement={heldAchievement}
          copy={copy.badges}
          icon={medalIcon(heldAchievement.code)}
          unlockDateLabel={heldAchievement.unlockedAt ? copy.badges.unlockedOn(formatUnlockDate(heldAchievement.unlockedAt)) : null}
        /> : null}
      </View>
    </Modal>
    {journeyRoute ? <AchievementJourneyModal badgeCopy={copy.badges} dashboard={dashboard} initialTab={journeyRoute} language={language} onClose={() => setJourneyRoute(null)} visible /> : null}
    {celebrationXp !== null ? <AchievementCelebration onDone={() => setCelebrationXp(null)} xp={celebrationXp} /> : null}
  </View>;
}

function medalIcon(code: AchievementDashboard['achievements'][number]['code']): keyof typeof Ionicons.glyphMap {
  const icons: Record<AchievementDashboard['achievements'][number]['code'], keyof typeof Ionicons.glyphMap> = {
    first_item: 'basket-outline', first_rescue: 'leaf-outline', waste_watcher: 'eye-outline',
    zero_waste_week: 'calendar-outline', rescue_ten: 'shield-checkmark-outline',
    fridge_regular: 'repeat-outline', shared_kitchen: 'people-outline', climate_summit: 'earth-outline',
  };
  return icons[code];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7FBFA' },
  content: { paddingBottom: 132 },
  sectionTransition: { position: 'relative', backgroundColor: '#F7FBFA' },
  sectionTransitionGradient: { position: 'absolute', top: 0, right: 0, left: 0, height: 220 },
  sections: { position: 'relative', alignSelf: 'center', width: '100%', maxWidth: 760, paddingHorizontal: 18 },
  nextCard: { marginTop: 14, padding: 16, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDECE6' },
  cardHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardHeadingGroup: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  headerIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EAF6F1', alignItems: 'center', justifyContent: 'center' },
  medalHeaderIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF3DF', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#173D31', fontSize: 17, fontWeight: '900' },
  headerLink: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 4 },
  headerLinkText: { color: '#2A8A61', fontSize: 11, fontWeight: '800' },
  nextAction: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: '#F2FAF7' },
  actionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E0F3EA', alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: '#173D31', fontSize: 15, fontWeight: '900' },
  actionHint: { marginTop: 3, color: '#62776E', fontSize: 11.5, fontWeight: '600' },
  challengeCount: { marginTop: 10, color: '#426658', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  impactSummary: { marginTop: 14, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 6, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDECE6' },
  impactSummaryHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  impactSummaryBody: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  reportShortcut: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 6 },
  reportShortcutText: { color: '#2A8A61', fontSize: 11, fontWeight: '800' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryValue: { marginTop: 4, color: '#45695A', fontSize: 12.5, fontWeight: '700' },
  coverageNote: { marginTop: 3, color: '#70827A', fontSize: 10.5, fontWeight: '600' },
  medalCard: { marginTop: 14, padding: 16, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDECE6' },
  medalPreviewRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  medalPreview: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 4 },
  medalName: { marginTop: 4, color: '#173D31', fontSize: 12, fontWeight: '800' },
  medalState: { marginTop: 3, color: '#7C8E86', fontSize: 10.5, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  detailPage: { flex: 1, backgroundColor: '#F7FBFA' },
  detailHeader: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#245C6B' },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  detailContent: { alignSelf: 'center', width: '100%', maxWidth: 760, paddingHorizontal: 18, paddingBottom: 132 },
  reportEntry: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#DDECE6', backgroundColor: '#FFFFFF' },
  reportEntryIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EAF6F1' },
  reportEntryTitle: { color: '#173D31', fontSize: 14, fontWeight: '900' },
  reportEntryHint: { marginTop: 3, color: '#70827A', fontSize: 11, fontWeight: '600' },
  xpCard: { marginTop: 18, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDECE6' },
  xpRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE8E3' },
  rowLast: { borderBottomWidth: 0 },
  xpIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#EAF8EF' },
  rowCopy: { flex: 1, minWidth: 0 },
  xpReason: { color: '#173D31', fontSize: 13, fontWeight: '800' },
  xpDate: { marginTop: 3, color: '#789087', fontSize: 10.5, fontWeight: '600' },
  xpPoints: { color: '#2A8A61', fontSize: 13, fontWeight: '900' },
  emptyText: { paddingVertical: 22, color: '#70827A', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  rerollError: { marginTop: 8, marginHorizontal: 18, color: '#B42318', fontSize: 12, fontWeight: '700' },
  modalRoot: { flex: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28, backgroundColor: '#F7FBFA' },
  stateText: { color: '#70827A', fontSize: 14, fontWeight: '700' },
  stateTitle: { color: '#173D31', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  retryButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#2A8A61' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
