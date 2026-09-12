import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { AchievementCode, AchievementDashboard } from '../../services/achievementApi';

type BadgeCopy = {
  unlocked: string;
  locked: string;
  unlockedOn: (date: string) => string;
  reward: (xp: number) => string;
  holdHint: string;
  releaseHint: string;
  progressOf: (current: number, total: number) => string;
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
// 中文：Modal 内展示成就详情卡片；开关由父层控制，本组件只负责内容排版。
// EN: Renders the achievement detail card inside a Modal; the parent owns open/close while this component only lays out content.
export function AchievementBadgeHoldDetail({ achievement, copy, icon, unlockDateLabel }: AchievementBadgeHoldDetailProps) {
  const unlocked = achievement.status === 'unlocked' || achievement.unlocked;
  const progressCurrent = Number(achievement.progressCurrent ?? achievement.metricValue ?? 0);
  const progressTarget = Number(achievement.progressTarget ?? 0);
  const statusLabel = unlocked
    ? unlockDateLabel ?? copy.unlocked
    : achievement.status === 'in_progress'
      ? copy.inProgress
      : copy.locked;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View pointerEvents="none" style={styles.scrim} />
      <View accessibilityLiveRegion="polite" pointerEvents="none" style={styles.card}>
        <View style={[styles.iconWrap, !unlocked && styles.iconWrapLocked]}>
          <Ionicons color={unlocked ? '#C6661C' : '#8A9A93'} name={icon} size={28} />
        </View>
        <Text style={styles.title}>{copy.items[achievement.code]}</Text>
        <Text style={styles.status}>{statusLabel}</Text>
        <Text style={styles.description}>{copy.descriptions[achievement.code]}</Text>
        {progressTarget > 0 ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(Math.min(1, progressCurrent / progressTarget) * 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>{copy.progressOf(progressCurrent, progressTarget)}</Text>
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
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: '#FFE8C8',
  },
  iconWrapLocked: { backgroundColor: '#E4EBE8' },
  title: { marginTop: 14, color: '#173D31', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  status: { marginTop: 6, color: '#2A8A61', fontSize: 12.5, fontWeight: '800', textAlign: 'center' },
  description: { marginTop: 12, color: '#4F655C', fontSize: 13.5, fontWeight: '600', lineHeight: 20, textAlign: 'center' },
  progressBlock: { alignSelf: 'stretch', marginTop: 16 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#E7F0EC', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#2A8A61' },
  progressText: { marginTop: 8, color: '#5E756D', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  reward: { marginTop: 14, color: '#C6661C', fontSize: 13, fontWeight: '900' },
  holdHint: { marginTop: 10, color: '#8A9A93', fontSize: 11, fontWeight: '600' },
});
