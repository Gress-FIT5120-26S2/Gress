import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';

const PROTOTYPE = {
  level: 3,
  xpRemaining: 550,
  xpProgress: 0.62,
  wasteKg: 12.5,
  moneySaved: 320,
  badges: [
    { key: 'cleanPlate' as const, icon: 'restaurant-outline' as const, unlocked: true },
    { key: 'fridgeCleaner' as const, icon: 'sparkles-outline' as const, unlocked: true },
    { key: 'ultimateSaver' as const, icon: 'lock-closed-outline' as const, unlocked: false },
  ],
  quests: [
    { key: 'cleanPlatePhoto' as const, current: 0, total: 1, reward: 50, done: false },
    { key: 'clearExpired' as const, current: 5, total: 7, reward: 100, done: false },
  ],
};

// 中文：Wins 页先用静态样板对齐线框四块内容；后续再接入 achievements API 与真实进度。
// EN: The Wins screen starts as a static prototype matching the four wireframe blocks; achievements API and live progress come later.
export function AchievementsScreen() {
  const { t } = useI18n();
  const copy = t.wins;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.prototypeNote}>{copy.prototypeNote}</Text>

        <View style={[styles.card, styles.levelCard]}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelMedal}>🥇</Text>
          </View>
          <View style={styles.levelCopy}>
            <Text style={styles.cardEyebrow}>{copy.level.title}</Text>
            <Text style={styles.levelName}>Lv.{PROTOTYPE.level} {copy.level.name}</Text>
            <Text style={styles.levelProgress}>{copy.level.progress(PROTOTYPE.xpRemaining)}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(PROTOTYPE.xpProgress * 100)}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📊</Text>
            <Text style={styles.sectionTitle}>{copy.impact.title}</Text>
          </View>
          <ImpactRow label={copy.impact.wasteReduced} value={copy.impact.wasteValue(PROTOTYPE.wasteKg)} tone="#32915C" />
          <ImpactRow label={copy.impact.moneySaved} value={copy.impact.moneyValue(PROTOTYPE.moneySaved)} tone="#D27619" last />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🏆</Text>
            <Text style={styles.sectionTitle}>{copy.badges.title}</Text>
          </View>
          <View style={styles.badgeRow}>
            {PROTOTYPE.badges.map((badge) => {
              const item = copy.badges.items[badge.key];
              return (
                <View key={badge.key} style={[styles.badgeCard, !badge.unlocked && styles.badgeCardLocked]}>
                  <View style={[styles.badgeIcon, !badge.unlocked && styles.badgeIconLocked]}>
                    <Ionicons color={badge.unlocked ? '#C6661C' : '#8A9A93'} name={badge.icon} size={22} />
                  </View>
                  <Text numberOfLines={2} style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]}>{item.name}</Text>
                  <Text style={styles.badgeState}>{badge.unlocked ? copy.badges.unlocked : copy.badges.locked}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, styles.lastCard]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🗓️</Text>
            <Text style={styles.sectionTitle}>{copy.quests.title}</Text>
          </View>
          {PROTOTYPE.quests.map((quest, index) => {
            const item = copy.quests.items[quest.key];
            return (
              <View key={quest.key} style={[styles.questRow, index === PROTOTYPE.quests.length - 1 && styles.questRowLast]}>
                <View style={[styles.questCheck, quest.done && styles.questCheckDone]}>
                  <Ionicons color={quest.done ? '#FFFFFF' : '#8A9A93'} name={quest.done ? 'checkmark' : 'ellipse-outline'} size={16} />
                </View>
                <View style={styles.questCopy}>
                  <Text style={styles.questTitle}>{item.title}</Text>
                  <Text style={styles.questDetail}>
                    {item.detail} · {copy.quests.progress(quest.current, quest.total)}
                  </Text>
                </View>
                <View style={styles.questReward}>
                  <Text style={styles.questRewardText}>{copy.quests.reward(quest.reward)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function ImpactRow({ label, last = false, tone, value }: { label: string; last?: boolean; tone: string; value: string }) {
  return (
    <View style={[styles.impactRow, last && styles.impactRowLast]}>
      <View style={[styles.impactDot, { backgroundColor: tone }]} />
      <View style={styles.impactCopy}>
        <Text style={styles.impactLabel}>{label}</Text>
        <Text style={styles.impactValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7FBFA' },
  content: { paddingHorizontal: 18, paddingTop: 68, paddingBottom: 132 },
  eyebrow: { color: '#3C6659', fontSize: 14, fontWeight: '700' },
  title: { marginTop: 7, color: '#173D31', fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  prototypeNote: { marginTop: 8, color: '#7A8F87', fontSize: 12, fontWeight: '600', lineHeight: 17 },
  card: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3EEE9',
  },
  lastCard: { marginBottom: 8 },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFF6EA', borderColor: '#F3DFC4' },
  levelBadge: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: '#FFE4B8',
  },
  levelMedal: { fontSize: 28 },
  levelCopy: { flex: 1, minWidth: 0 },
  cardEyebrow: { color: '#A86A28', fontSize: 12, fontWeight: '800' },
  levelName: { marginTop: 3, color: '#173D31', fontSize: 20, fontWeight: '900' },
  levelProgress: { marginTop: 4, color: '#6B7F77', fontSize: 12.5, fontWeight: '600' },
  progressTrack: { height: 8, marginTop: 10, overflow: 'hidden', borderRadius: 4, backgroundColor: '#F0E0C8' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#F58220' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { color: '#173D31', fontSize: 17, fontWeight: '900' },
  impactRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE8E3',
  },
  impactRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  impactDot: { width: 10, height: 10, borderRadius: 5 },
  impactCopy: { flex: 1, minWidth: 0 },
  impactLabel: { color: '#5E756D', fontSize: 12.5, fontWeight: '600' },
  impactValue: { marginTop: 3, color: '#173D31', fontSize: 16, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', gap: 10 },
  badgeCard: {
    flex: 1,
    minHeight: 126,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#FFF8EF',
  },
  badgeCardLocked: { backgroundColor: '#F3F6F5' },
  badgeIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#FFE8C8',
  },
  badgeIconLocked: { backgroundColor: '#E4EBE8' },
  badgeName: { marginTop: 10, color: '#173D31', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 16 },
  badgeNameLocked: { color: '#6F817A' },
  badgeState: { marginTop: 6, color: '#8A9A93', fontSize: 10, fontWeight: '700' },
  questRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE8E3',
  },
  questRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  questCheck: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C9D8D3',
    backgroundColor: '#FFFFFF',
  },
  questCheckDone: { borderColor: '#32915C', backgroundColor: '#32915C' },
  questCopy: { flex: 1, minWidth: 0 },
  questTitle: { color: '#173D31', fontSize: 14, fontWeight: '800', lineHeight: 19 },
  questDetail: { marginTop: 4, color: '#667D75', fontSize: 12, fontWeight: '600' },
  questReward: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: '#EAF8EF',
  },
  questRewardText: { color: '#2C7A4E', fontSize: 11.5, fontWeight: '900' },
});
