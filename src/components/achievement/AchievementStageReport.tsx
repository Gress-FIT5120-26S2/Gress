import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useI18n } from '../../i18n';
import { getAchievementStageReport, type AchievementStageReport as StageReport } from '../../services/achievementApi';

type Props = { onOpenInventoryItem: (batchUid: string) => void };

function localDateLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function AchievementStageReport({ onOpenInventoryItem }: Props) {
  const { language, t } = useI18n();
  const copy = t.wins.report;
  const locale = language === 'zh' ? 'zh-CN' : 'en-AU';
  const { width } = useWindowDimensions();
  const [report, setReport] = useState<StageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  // Arthur: NarIyirm
  // 中文：详情卸载后忽略未完成请求，避免用户快速返回时更新旧页面状态。
  // EN: Ignore an unfinished request after this detail unmounts, so a quick back navigation cannot update stale state.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    getAchievementStageReport().then((value) => {
      if (active) setReport(value);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadVersion]);

  if (loading && !report) return <View style={styles.state}><ActivityIndicator color="#298361" /><Text style={styles.muted}>{copy.loading}</Text></View>;
  if (error && !report) return <View style={styles.state}><Text style={styles.muted}>{copy.error}</Text><Pressable accessibilityRole="button" onPress={() => setLoadVersion((version) => version + 1)} style={styles.retry}><Text style={styles.retryText}>{copy.retry}</Text></Pressable></View>;
  if (!report) return null;

  const currency = report.currency === 'AUD' ? 'A$' : report.currency;
  const discardedValue = report.overview.discardRecordCount > 0 && report.overview.pricedDiscardCount === 0
    ? '—' : `${currency}${Number(report.overview.discardedValue).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const maxTrend = Math.max(1, ...report.trend.flatMap((row) => [row.usedRecords, row.discardedRecords]));
  const reasonNames = t.fridge.itemDetail.discardReasons;
  const categoryNames = t.fridge.categories;
  const reasonRows = report.reasons.map((row) => ({ key: row.code, name: reasonNames[row.code as keyof typeof reasonNames] ?? copy.unknownReason, count: row.count }));
  const categoryRows = report.categories.map((row) => ({
    key: row.categoryUid ?? 'other',
    name: row.systemCode && row.systemCode in categoryNames ? categoryNames[row.systemCode as keyof typeof categoryNames] : row.categoryUid ? row.name : copy.otherCategory,
    count: row.count,
  }));

  return <View style={styles.root}>
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
      <Text style={styles.introTitle}>{copy.title}</Text>
      <Text style={styles.muted}>{copy.subtitle}</Text>
      <Text style={styles.period}>{new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', timeZone: report.timeZone }).format(new Date(report.periodStart))} – {new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', timeZone: report.timeZone }).format(new Date(report.periodEnd))}</Text>
    </View>

    <View style={styles.stats}>
      <View style={styles.stat}><Text style={styles.statLabel}>{copy.completed}</Text><Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.statValue}>{report.overview.completedBatchCount}<Text style={styles.statUnit}> {copy.batchUnit}</Text></Text></View>
      <View style={styles.stat}><Text style={styles.statLabel}>{copy.discarded}</Text><Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.statValue}>{report.overview.discardedBatchCount}<Text style={styles.statUnit}> {copy.batchUnit}</Text></Text></View>
      <View style={styles.stat}><Text style={styles.statLabel}>{copy.discardedValue}</Text><Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.statValue}>{discardedValue}</Text></View>
    </View>
    {report.overview.priceCoverageRate !== null && report.overview.priceCoverageRate > 0 && report.overview.priceCoverageRate < 1 ? <Text style={styles.coverage}>{copy.coverage(Math.round(report.overview.priceCoverageRate * 100))}</Text> : null}
    {report.overview.discardRecordCount > 0 && report.overview.pricedDiscardCount === 0 ? <Text style={styles.coverage}>{copy.noPrice}</Text> : null}

    <View style={styles.card}>
      <Text style={styles.cardTitle}>{copy.trendTitle}</Text>
      <Text style={styles.cardHint}>{copy.trendHint}</Text>
      <View style={styles.legend}><View style={[styles.legendDot, styles.usedColor]} /><Text style={styles.legendText}>{copy.usedRecords}</Text><View style={[styles.legendDot, styles.discardColor]} /><Text style={styles.legendText}>{copy.discardedRecords}</Text></View>
      <View style={styles.chart}>
        {report.trend.map((row) => <View accessible accessibilityLabel={`${localDateLabel(row.startDate, locale)}–${localDateLabel(row.endDate, locale)}: ${copy.usedRecords} ${row.usedRecords}, ${copy.discardedRecords} ${row.discardedRecords}`} key={row.startDate} style={styles.chartGroup}>
          <View style={styles.barPair}>
            <View style={[styles.bar, styles.usedColor, { height: Math.max(row.usedRecords ? 5 : 1, row.usedRecords / maxTrend * 102) }]} />
            <View style={[styles.bar, styles.discardColor, { height: Math.max(row.discardedRecords ? 5 : 1, row.discardedRecords / maxTrend * 102) }]} />
          </View>
          <Text numberOfLines={1} style={styles.chartLabel}>{localDateLabel(row.startDate, locale)}</Text>
        </View>)}
      </View>
    </View>

    <View style={[styles.rankings, width >= 620 && styles.rankingsWide]}>
      <Ranking title={copy.reasonsTitle} rows={reasonRows} empty={copy.noDiscard} recordUnit={copy.recordUnit} />
      <Ranking title={copy.categoriesTitle} rows={categoryRows} empty={copy.noDiscard} recordUnit={copy.recordUnit} />
    </View>

    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: upcomingOpen }} onPress={() => setUpcomingOpen((open) => !open)} style={styles.upcomingHeading}>
        <View style={styles.upcomingIcon}><Ionicons color="#287D61" name="calendar-outline" size={22} /></View>
        <View style={styles.upcomingCopy}><Text style={styles.cardTitle}>{copy.upcomingTitle}</Text><Text style={styles.cardHint}>{copy.upcomingHint(report.upcomingCount)}</Text></View>
        <Ionicons color="#638077" name={upcomingOpen ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {upcomingOpen ? <View style={styles.upcomingList}>
        {report.upcoming.length === 0 ? <Text style={styles.muted}>{copy.upcomingEmpty}</Text> : report.upcoming.map((item) => <Pressable accessibilityRole="button" key={item.batchUid} onPress={() => onOpenInventoryItem(item.batchUid)} style={styles.upcomingRow}>
          <View style={styles.upcomingCopy}><Text numberOfLines={1} style={styles.itemName}>{item.name}</Text><Text style={styles.itemDate}>{copy.dateTypes[item.dateType]} · {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: report.timeZone }).format(new Date(item.deadlineAt))}</Text></View>
          <Ionicons color="#638077" name="chevron-forward" size={17} />
        </Pressable>)}
        {report.upcomingCount > report.upcoming.length ? <Text style={styles.cardHint}>{copy.upcomingMore(report.upcomingCount - report.upcoming.length)}</Text> : null}
      </View> : null}
    </View>
  </View>;
}

function Ranking({ title, rows, empty, recordUnit }: { title: string; rows: Array<{ key: string; name: string; count: number }>; empty: string; recordUnit: (count: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <View style={[styles.card, styles.ranking]}><Text style={styles.cardTitle}>{title}</Text>
    {rows.length === 0 ? <Text style={[styles.muted, styles.rankingEmpty]}>{empty}</Text> : rows.map((row) => <View key={row.key} style={styles.rankRow}>
      <View style={styles.rankHeading}><Text numberOfLines={1} style={styles.rankName}>{row.name}</Text><Text style={styles.rankCount}>{recordUnit(row.count)}</Text></View>
      <View style={styles.rankTrack}><View style={[styles.rankFill, { width: `${row.count / max * 100}%` }]} /></View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingTop: 18 },
  intro: { paddingHorizontal: 3, paddingBottom: 4 },
  eyebrow: { color: '#2A8A61', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  introTitle: { marginTop: 5, color: '#183F32', fontSize: 25, fontWeight: '900' },
  muted: { color: '#71847C', fontSize: 12, lineHeight: 18 },
  period: { marginTop: 11, color: '#315F50', fontSize: 12, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, minHeight: 94, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 12, borderRadius: 15, backgroundColor: '#E8F5EE' },
  statLabel: { color: '#5E776B', fontSize: 10.5, fontWeight: '700' },
  statValue: { marginTop: 7, color: '#1B6449', fontSize: 20, fontWeight: '900' },
  statUnit: { fontSize: 11 },
  coverage: { marginTop: -5, paddingHorizontal: 3, color: '#71847C', fontSize: 11, lineHeight: 16 },
  card: { padding: 16, borderRadius: 17, borderWidth: 1, borderColor: '#DDECE6', backgroundColor: '#FFFFFF' },
  cardTitle: { color: '#173D31', fontSize: 16, fontWeight: '900' },
  cardHint: { marginTop: 4, color: '#73877E', fontSize: 11, lineHeight: 16 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { marginRight: 12, color: '#61766B', fontSize: 11, fontWeight: '700' },
  usedColor: { backgroundColor: '#3B996B' },
  discardColor: { backgroundColor: '#DBA45C' },
  chart: { height: 138, flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 8, borderBottomWidth: 1, borderBottomColor: '#E4EEE9' },
  chartGroup: { flex: 1, minWidth: 0, alignItems: 'center' },
  barPair: { height: 108, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bar: { width: 13, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chartLabel: { height: 25, paddingTop: 7, color: '#75877E', fontSize: 10, fontWeight: '700' },
  rankings: { gap: 14 },
  rankingsWide: { flexDirection: 'row' },
  ranking: { flex: 1 },
  rankingEmpty: { marginTop: 14 },
  rankRow: { marginTop: 13 },
  rankHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rankName: { flex: 1, color: '#365D4D', fontSize: 12, fontWeight: '700' },
  rankCount: { color: '#5C7569', fontSize: 11, fontWeight: '700' },
  rankTrack: { height: 6, marginTop: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: '#EDF3EF' },
  rankFill: { height: 6, borderRadius: 3, backgroundColor: '#70B994' },
  upcomingHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 47 },
  upcomingIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F6EF' },
  upcomingCopy: { flex: 1, minWidth: 0 },
  upcomingList: { marginTop: 14, gap: 10 },
  upcomingRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E1ECE6' },
  itemName: { color: '#254C3D', fontSize: 13, fontWeight: '800' },
  itemDate: { marginTop: 3, color: '#71847C', fontSize: 11 },
  state: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 12 },
  retry: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 11, backgroundColor: '#2A8A61' },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
