import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FridgeQuestAssignment, QuestCode } from '../../services/achievementApi';

type QuestCopy = {
  title: string;
  daily: string;
  weekly: string;
  empty: string;
  completed: string;
  reminderOnly: string;
  progressOf: (current: number, total: number) => string;
  remaining: (count: number) => string;
  reward: (xp: number) => string;
  endsAt: (time: string) => string;
  reroll: string;
  rerollUsed: string;
  rerolling: string;
  items: Record<QuestCode, string>;
  descriptions: Record<QuestCode, string>;
};

type AchievementQuestSectionProps = {
  copy: QuestCopy;
  daily: FridgeQuestAssignment | null;
  weekly: FridgeQuestAssignment | null;
  weeklyRerollsRemaining: number;
  rerolling: boolean;
  onRerollWeekly: () => void;
  formatEndsAt: (iso: string) => string;
};

// Arthur: NarIyirm
// 中文：挑战卡只渲染服务端冻结的目标与进度；更换周挑战由父层调 API，不在前端改写状态。
// EN: Quest cards only render server-frozen targets and progress; weekly reroll is triggered by the parent API call without local state rewriting.
export function AchievementQuestSection({
  copy,
  daily,
  weekly,
  weeklyRerollsRemaining,
  rerolling,
  onRerollWeekly,
  formatEndsAt,
}: AchievementQuestSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>🎯</Text>
        <Text style={styles.sectionTitle}>{copy.title}</Text>
      </View>
      <QuestCard
        copy={copy}
        formatEndsAt={formatEndsAt}
        label={copy.daily}
        quest={daily}
      />
      <QuestCard
        copy={copy}
        formatEndsAt={formatEndsAt}
        label={copy.weekly}
        onReroll={weekly?.canReroll && weeklyRerollsRemaining > 0 ? onRerollWeekly : undefined}
        quest={weekly}
        rerollLabel={rerolling ? copy.rerolling : weeklyRerollsRemaining > 0 ? copy.reroll : copy.rerollUsed}
        rerolling={rerolling}
        style={styles.weeklyCard}
      />
    </View>
  );
}

function QuestCard({
  copy,
  formatEndsAt,
  label,
  onReroll,
  quest,
  rerollLabel,
  rerolling = false,
  style,
}: {
  copy: QuestCopy;
  formatEndsAt: (iso: string) => string;
  label: string;
  onReroll?: () => void;
  quest: FridgeQuestAssignment | null;
  rerollLabel?: string;
  rerolling?: boolean;
  style?: object;
}) {
  if (!quest) {
    return (
      <View style={[styles.questCard, style]}>
        <Text style={styles.periodLabel}>{label}</Text>
        <Text style={styles.emptyText}>{copy.empty}</Text>
      </View>
    );
  }

  const current = Number(quest.progressCurrent ?? 0);
  const target = Number(quest.progressTarget ?? quest.target ?? 1);
  const ratio = Math.min(1, current / Math.max(target, 1));
  const completed = quest.status === 'completed';
  const title = copy.items[quest.questCode] ?? quest.questCode;
  const description = copy.descriptions[quest.questCode] ?? '';

  return (
    <View style={[styles.questCard, completed && styles.questCardCompleted, style]}>
      <View style={styles.questTop}>
        <Text style={styles.periodLabel}>{label}</Text>
        {quest.isReminderOnly ? <Text style={styles.reminderChip}>{copy.reminderOnly}</Text> : null}
        {completed ? <Text style={styles.completedChip}>{copy.completed}</Text> : null}
      </View>
      <Text style={styles.questTitle}>{title}</Text>
      <Text style={styles.questDescription}>{description}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
      <View style={styles.questMeta}>
        <Text style={styles.progressText}>
          {completed || current >= target
            ? copy.progressOf(target, target)
            : current > 0
              ? copy.progressOf(current, target)
              : copy.remaining(Math.max(target - current, 0))}
        </Text>
        {!quest.isReminderOnly && quest.rewardXp > 0 ? <Text style={styles.rewardText}>{copy.reward(quest.rewardXp)}</Text> : null}
      </View>
      <Text style={styles.endsAt}>{copy.endsAt(formatEndsAt(quest.periodEnd))}</Text>
      {onReroll ? (
        <Pressable
          accessibilityRole="button"
          disabled={rerolling}
          onPress={onReroll}
          style={({ pressed }) => [styles.rerollButton, (pressed || rerolling) && styles.rerollButtonPressed]}
        >
          <Ionicons color="#2A8A61" name="refresh-outline" size={16} />
          <Text style={styles.rerollText}>{rerollLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 16, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3EEE9' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { color: '#173D31', fontSize: 17, fontWeight: '900' },
  questCard: { padding: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F7FBFA', borderWidth: 1, borderColor: '#E3EEE9' },
  weeklyCard: { marginTop: 10 },
  questCardCompleted: { backgroundColor: '#EEF8F1', borderColor: '#CDE8D7' },
  questTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  periodLabel: { color: '#5E756D', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  reminderChip: { color: '#8B632E', backgroundColor: '#FFF6E9', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, fontSize: 10, fontWeight: '800' },
  completedChip: { color: '#2A8A61', backgroundColor: '#DCEFDF', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, fontSize: 10, fontWeight: '800' },
  questTitle: { marginTop: 8, color: '#173D31', fontSize: 15, fontWeight: '900' },
  questDescription: { marginTop: 4, color: '#5E756D', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  progressTrack: { marginTop: 12, height: 8, borderRadius: 999, backgroundColor: '#E7F0EC', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#2A8A61' },
  questMeta: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progressText: { color: '#5E756D', fontSize: 12, fontWeight: '700', flex: 1 },
  rewardText: { color: '#C6661C', fontSize: 12, fontWeight: '900' },
  endsAt: { marginTop: 6, color: '#8A9A93', fontSize: 11, fontWeight: '600' },
  emptyText: { marginTop: 8, color: '#70827A', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  rerollButton: { marginTop: 12, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: '#EAF8EF' },
  rerollButtonPressed: { opacity: 0.85 },
  rerollText: { color: '#2A8A61', fontSize: 13, fontWeight: '800' },
});
