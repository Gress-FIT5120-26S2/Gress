import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AchievementDashboard } from '../../services/achievementApi';

type ImpactCopy = {
  title: string;
  subtitle: string;
  totalRescued: string;
  fromRescues: (count: number) => string;
  consumedValue: string;
  discardedValue: string;
  outcomeItems: (count: number) => string;
  nextMilestone: string;
  rescuesToUnlock: (count: number, title: string) => string;
  partialCoverage: (percent: number) => string;
  empty: string;
};

type AchievementImpactCardProps = {
  copy: ImpactCopy;
  metrics: AchievementDashboard['metrics'];
  milestone: AchievementDashboard['achievements'][number] | null;
  milestoneTitle: string | null;
  money: (value: number) => string;
  onOpenMilestone?: () => void;
};

// Arthur: NarIyirm
// 中文：主数字表达用户已创造的环保价值，结果条再解释食用与丢弃去向；低价格覆盖率时始终保留口径说明。
// EN: The primary number communicates earned impact, while the outcome bar explains used versus discarded value; low price coverage always retains its scope note.
export function AchievementImpactCard({ copy, metrics, milestone, milestoneTitle, money, onOpenMilestone }: AchievementImpactCardProps) {
  const hasSettledData = metrics.consumedBatchCount + metrics.discardedBatchCount > 0;
  const totalOutcomeValue = Math.max(0, metrics.consumedValue) + Math.max(0, metrics.discardedValue);
  const consumedShare = totalOutcomeValue > 0 ? Math.max(0, metrics.consumedValue) / totalOutcomeValue : 0;
  const discardedShare = totalOutcomeValue > 0 ? Math.max(0, metrics.discardedValue) / totalOutcomeValue : 0;
  const milestoneRemaining = milestone
    ? Math.max(0, Number(milestone.progressTarget) - Number(milestone.progressCurrent))
    : 0;

  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={styles.watermark}>
        <Ionicons color="rgba(50,145,92,0.10)" name="leaf" size={112} />
      </View>

      <View style={styles.header}>
        <View style={styles.mark}>
          <Ionicons color="#2A8A61" name="leaf" size={22} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
      </View>

      <Text style={styles.primaryLabel}>{copy.totalRescued}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.primaryValue}>{money(metrics.rescuedValue)}</Text>
      <Text style={styles.primarySupport}>{copy.fromRescues(metrics.rescuedBatchCount)}</Text>

      {hasSettledData ? (
        <>
          <View
            accessibilityLabel={`${copy.consumedValue}: ${money(metrics.consumedValue)}. ${copy.discardedValue}: ${money(metrics.discardedValue)}.`}
            accessible
            style={styles.outcomeTrack}
          >
            {consumedShare > 0 ? <View style={[styles.outcomeUsed, { flex: consumedShare }]} /> : null}
            {discardedShare > 0 ? <View style={[styles.outcomeDiscarded, { flex: discardedShare }]} /> : null}
          </View>

          <View style={styles.outcomeMetrics}>
            <OutcomeMetric color="#32915C" detail={copy.outcomeItems(metrics.consumedBatchCount)} label={copy.consumedValue} value={money(metrics.consumedValue)} />
            <View style={styles.outcomeDivider} />
            <OutcomeMetric color="#D27619" detail={copy.outcomeItems(metrics.discardedBatchCount)} label={copy.discardedValue} value={money(metrics.discardedValue)} />
          </View>
        </>
      ) : <Text style={styles.empty}>{copy.empty}</Text>}

      {milestone && milestoneTitle && milestoneRemaining > 0 ? (
        <Pressable
          accessibilityLabel={`${copy.nextMilestone}. ${copy.rescuesToUnlock(milestoneRemaining, milestoneTitle)}`}
          accessibilityRole="button"
          onPress={onOpenMilestone}
          style={({ pressed }) => [styles.milestone, pressed && styles.milestonePressed]}
        >
          <View style={styles.milestoneIcon}>
            <Ionicons color="#2A8A61" name="flag" size={20} />
          </View>
          <View style={styles.milestoneCopy}>
            <Text style={styles.milestoneTitle}>{copy.nextMilestone}</Text>
            <Text numberOfLines={2} style={styles.milestoneDescription}>{copy.rescuesToUnlock(milestoneRemaining, milestoneTitle)}</Text>
          </View>
          <Ionicons color="#71847C" name="chevron-forward" size={20} />
        </Pressable>
      ) : null}

      {metrics.priceCoverageRate !== null && metrics.priceCoverageRate < 0.8 ? (
        <View style={styles.coverageNote}>
          <Ionicons color="#71847C" name="information-circle-outline" size={17} />
          <Text style={styles.coverageText}>{copy.partialCoverage(Math.round(metrics.priceCoverageRate * 100))}</Text>
        </View>
      ) : null}
    </View>
  );
}

function OutcomeMetric({ color, detail, label, value }: { color: string; detail: string; label: string; value: string }) {
  return (
    <View style={styles.outcomeMetric}>
      <View style={[styles.outcomeDot, { backgroundColor: color }]} />
      <View style={styles.outcomeCopy}>
        <Text style={styles.outcomeLabel}>{label}</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={styles.outcomeValue}>{value}</Text>
        <Text style={styles.outcomeDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'relative', marginTop: 18, padding: 18, overflow: 'hidden', borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDECE6' },
  watermark: { position: 'absolute', top: 94, right: -12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  mark: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EAF6F1' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: '#173D31', fontSize: 20, fontWeight: '900', letterSpacing: -0.35 },
  subtitle: { marginTop: 2, color: '#70827A', fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  primaryLabel: { marginTop: 24, color: '#687C74', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  primaryValue: { marginTop: 3, color: '#164E3C', fontSize: 34, fontWeight: '900', letterSpacing: -1.1 },
  primarySupport: { marginTop: 2, color: '#5E756D', fontSize: 12.5, fontWeight: '600' },
  outcomeTrack: { height: 9, flexDirection: 'row', marginTop: 20, overflow: 'hidden', borderRadius: 999, backgroundColor: '#E4EEE9' },
  outcomeUsed: { minWidth: 3, backgroundColor: '#32915C' },
  outcomeDiscarded: { minWidth: 3, backgroundColor: '#D27619' },
  outcomeMetrics: { flexDirection: 'row', alignItems: 'stretch', marginTop: 16 },
  outcomeMetric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  outcomeDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 12, backgroundColor: '#D9E7E1' },
  outcomeDot: { width: 11, height: 11, borderRadius: 6 },
  outcomeCopy: { flex: 1, minWidth: 0 },
  outcomeLabel: { color: '#6B7E76', fontSize: 11.5, fontWeight: '700' },
  outcomeValue: { marginTop: 2, color: '#173D31', fontSize: 17, fontWeight: '900' },
  outcomeDetail: { marginTop: 2, color: '#81928B', fontSize: 10, fontWeight: '600' },
  empty: { marginTop: 18, color: '#70827A', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  milestone: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 20, padding: 11, borderRadius: 14, backgroundColor: '#F3FAF7' },
  milestonePressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  milestoneIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#DDEFE6' },
  milestoneCopy: { flex: 1, minWidth: 0 },
  milestoneTitle: { color: '#245E4A', fontSize: 12.5, fontWeight: '900' },
  milestoneDescription: { marginTop: 3, color: '#60756D', fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  coverageNote: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F1F6F4' },
  coverageText: { flex: 1, color: '#687C74', fontSize: 10.5, fontWeight: '600', lineHeight: 15 },
});
