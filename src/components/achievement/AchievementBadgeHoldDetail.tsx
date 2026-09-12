import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { AchievementCode, AchievementDashboard } from '../../services/achievementApi';
import {
  formatBadgeProgressLabel,
  getBadgeProgressRatio,
  resolveVisibleBadgeStatus,
} from './badgePresentation';

type BadgeCopy = {
  unlocked: string;
  locked: string;
  unlockedOn: (date: string) => string;
  reward: (xp: number) => string;
  holdHint: string;
  releaseHint: string;
  progressOf: (current: number, total: number) => string;
  membersOf: (current: number, total: number) => string;
  xpOf: (current: number, total: number) => string;
  inProgress: string;
  items: Record<AchievementCode, string>;
  descriptions: Record<AchievementCode, string>;
};

type AchievementBadgeHoldDetailProps = {
  achievement: AchievementDashboard['achievements'][number];
  copy: BadgeCopy;
  icon: keyof typeof Ionicons.glyphMap;
  unlockDateLabel: string | null;
};

// Arthur: NarIyirm
// 中文：详情弹层按同一套 status + 进度分母四态排版；父层负责开关，这里不重算解锁。
// EN: The detail sheet uses the same status + progress-denominator four-state layout; the parent owns open/close and this view never recalculates unlocks.
export function AchievementBadgeHoldDetail({ achievement, copy, icon, unlockDateLabel }: AchievementBadgeHoldDetailProps) {
  const status = resolveVisibleBadgeStatus(achievement);
  const progressRatio = getBadgeProgressRatio(achievement);
  const progressLabel = formatBadgeProgressLabel(achievement, copy);
  const statusLabel = status === 'unlocked'
    ? unlockDateLabel ?? copy.unlocked
    : status === 'in_progress'
      ? copy.inProgress
      : copy.locked;
  const iconColor = status === 'unlocked' ? '#C6661C' : status === 'in_progress' ? '#A8895C' : '#8A9A93';
  const showProgress = status === 'in_progress' || (status === 'unlocked' && Number(achievement.progressTarget ?? 0) > 0);

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View pointerEvents="none" style={styles.scrim} />
      <View accessibilityLiveRegion="polite" pointerEvents="none" style={styles.card}>
        <View style={[
          styles.iconWrap,
          status === 'unlocked' && styles.iconWrapUnlocked,
          status === 'in_progress' && styles.iconWrapInProgress,
          status === 'locked' && styles.iconWrapLocked,
        ]}>
          <Ionicons color={iconColor} name={icon} size={28} />
        </View>
        <Text style={styles.title}>{copy.items[achievement.code]}</Text>
        <Text style={[styles.status, status === 'in_progress' && styles.statusInProgress, status === 'locked' && styles.statusLocked]}>{statusLabel}</Text>
        <Text style={styles.description}>{copy.descriptions[achievement.code]}</Text>
        {showProgress ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, status === 'in_progress' && styles.progressFillInProgress, { width: `${Math.round(progressRatio * 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>{progressLabel}</Text>
          </View>
        ) : null}
        <Text style={styles.reward}>{copy.reward(achievement.xpReward)}</Text>
        <Text style={styles.holdHint}>{copy.releaseHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18, 36, 31, 0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3EEE9',
    alignItems: 'center',
    shadowColor: '#123028',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  iconWrapUnlocked: { backgroundColor: '#FFE8C8' },
  iconWrapInProgress: { backgroundColor: '#EFE6D8' },
  iconWrapLocked: { backgroundColor: '#E4EBE8' },
  title: { marginTop: 14, color: '#173D31', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  status: { marginTop: 6, color: '#2A8A61', fontSize: 12.5, fontWeight: '800', textAlign: 'center' },
  statusInProgress: { color: '#8B6B3A' },
  statusLocked: { color: '#70827A' },
  description: { marginTop: 12, color: '#4F655C', fontSize: 13.5, fontWeight: '600', lineHeight: 20, textAlign: 'center' },
  progressBlock: { alignSelf: 'stretch', marginTop: 16 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#E7F0EC', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#2A8A61' },
  progressFillInProgress: { backgroundColor: '#C6661C' },
  progressText: { marginTop: 8, color: '#5E756D', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  reward: { marginTop: 14, color: '#C6661C', fontSize: 13, fontWeight: '900' },
  holdHint: { marginTop: 10, color: '#8A9A93', fontSize: 11, fontWeight: '600' },
});
