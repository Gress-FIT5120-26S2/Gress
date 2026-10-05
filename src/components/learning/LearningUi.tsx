import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import type { LearningBodyBlock, LearningSource, PublicLearningContent } from '../../types/learningContent';
import type { LearningSessionView } from '../../types/learningRoom';
import { getLearningImageSource, learningAssets, learningSdgAttribution, type LearningAssetKey } from './learningAssets';
import { learningColors as c, learningLayout, learningMotion, learningStyles as s, learningTypography as type } from './learningTheme';
import { useLearningViewport } from './learningViewport';

export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 0 },
  group: { gap: 8 }, section: { gap: 12 }, center: { alignItems: 'center' },
  panel: { padding: 16, borderRadius: 16, borderCurve: 'continuous', backgroundColor: c.mintSurface },
  title: { ...type.title, color: c.textPrimary }, body: { ...type.body, color: c.textPrimary },
  secondary: { ...type.subtitle, color: c.textSecondaryReadable }, caption: { ...type.caption, color: c.textSecondaryReadable },
  sectionTitle: { ...type.section, color: c.textPrimary }, eyebrow: { ...type.eyebrow, color: c.learningGreenReadable },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  backText: { ...type.body, color: c.learningGreenReadable, flexShrink: 1 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 16, fontWeight: '700', color: c.textPrimary, letterSpacing: -0.5 },
  footer: { paddingTop: 12, paddingBottom: 12, gap: 4, backgroundColor: c.background },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { ...type.subtitle, color: c.learningGreenReadable, flexShrink: 1 },
  iconDisc: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.mintStrong },
  error: { ...type.caption, color: c.error }, progressTrack: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: c.border },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: c.learningGreen },
  cover: { width: '100%', aspectRatio: 2, borderRadius: 16, backgroundColor: c.mintSurface },
  listRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  listTitle: { ...type.body, fontWeight: '700', color: c.textPrimary },
  timelineRow: { minHeight: 64, flexDirection: 'row', gap: 12 },
  timelineTrack: { width: 28, alignItems: 'center' },
  timelineNode: { width: 27, height: 27, borderRadius: 14, borderWidth: 1.5, borderColor: c.learningGreen, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  doneNode: { backgroundColor: c.learningGreen }, activeNode: { backgroundColor: c.mintStrong, borderWidth: 3 },
  lockedNode: { borderColor: c.border, backgroundColor: c.border },
  timelineLine: { width: 1, flex: 1, minHeight: 20, backgroundColor: c.border, marginVertical: 4 },
  timelineCopy: { flex: 1, gap: 2, paddingTop: 1, paddingBottom: 16 },
  timelineNumber: { ...type.subtitle, color: c.textSecondaryReadable, width: 22, paddingTop: 2 },
  fact: { ...type.statistic, color: c.textPrimary },
});

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function LearningIcon({ name, size = 22, color = c.learningGreenReadable }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}

export function LearningImage({ assetKey, label, style }: { assetKey: LearningAssetKey; label?: string; style: React.ComponentProps<typeof Image>['style'] }) {
  const { language } = useI18n();
  return <Image source={getLearningImageSource(assetKey, language)} contentFit={learningAssets[assetKey].contentFit}
    style={style} accessible={Boolean(label)} accessibilityLabel={label} transition={0} />;
}

export function LearningButton({ label, onPress, disabled = false, testID, compact = false }: {
  label: string; onPress: () => void; disabled?: boolean; testID?: string; compact?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    testID={testID} style={({ pressed }) => [s.primaryButton, compact ? { paddingHorizontal: 14 } : null, disabled ? { opacity: 0.48 } : null, pressed ? s.pressed : null]}>
    <Text style={[s.primaryButtonLabel, compact ? { fontSize: 16 } : null]}>{label}</Text>
  </Pressable>;
}

export function LearningLink({ label, onPress, icon = 'chevron-forward', centered = false }: {
  label: string; onPress: () => void; icon?: IconName; centered?: boolean;
}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [ui.link, centered ? { justifyContent: 'center' } : null, pressed ? s.pressed : null]}>
    <Text style={ui.linkText}>{label}</Text><LearningIcon name={icon} size={18} />
  </Pressable>;
}

export function LearningSourceLink({ label, url }: { label: string; url: string }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const open = async () => {
    setFailed(false);
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid source');
      await Linking.openURL(url);
    } catch { setFailed(true); }
  };
  return <View><Pressable accessibilityRole="link" onPress={() => { void open(); }} style={({ pressed }) => [ui.link, pressed ? s.pressed : null]}>
    <Text style={ui.linkText}>{label}</Text><LearningIcon name="open-outline" size={17} />
  </Pressable>{failed ? <Text accessibilityLiveRegion="polite" style={ui.error}>{t.learning.sourceFailed}</Text> : null}</View>;
}

export function LearningProgress({ value, label }: { value: number; label: string }) {
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(value, 1)) * 100)}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(value, 1)) * 100) }} style={ui.progressTrack}>
    <View style={[ui.progressFill, { width: `${Math.max(0, Math.min(value, 1)) * 100}%` }]} />
  </View>;
}

export function LearningPage({ backLabel, onBack, onClose, brand = false, children, footer, error, testID, contentGap = 18 }: {
  backLabel: string; onBack: () => void; onClose?: () => void; brand?: boolean;
  children: ReactNode; footer?: ReactNode; error?: string | null; testID?: string; contentGap?: number;
}) {
  const { t } = useI18n();
  const { width } = useLearningViewport();
  const gutter = width < learningLayout.narrowWidth ? 18 : 24;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let mounted = true;
    const enter = (reduce: boolean) => {
      opacity.stopAnimation();
      if (reduce || Platform.OS === 'web') opacity.setValue(1);
      else { opacity.setValue(0); Animated.timing(opacity, { toValue: 1, duration: learningMotion.enterMs, useNativeDriver: true }).start(); }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => { if (mounted) enter(reduce); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enter);
    return () => { mounted = false; subscription.remove(); opacity.stopAnimation(); };
  }, [opacity]);
  // Arthur: NarIyirm
  // 中文：顶部和底部由同一个安全区容器处理，滚动区不重复自动加 inset，固定 CTA 不覆盖正文。
  // EN: One safe-area container owns the top and bottom; scrolling does not add duplicate automatic insets, and fixed actions never cover body content.
  return <SafeAreaView style={s.screen} edges={['top', 'bottom', 'left', 'right']} testID={testID}>
    <View style={[ui.header, { paddingHorizontal: gutter }]}>
      <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [ui.back, pressed ? s.pressed : null]}>
        <LearningIcon name="chevron-back" size={25} /><Text style={ui.backText}>{backLabel}</Text>
      </Pressable>
      {brand ? <View style={[ui.row, { gap: 3 }]}><Text style={ui.brand}>KitchMemo</Text><LearningIcon name="leaf" size={18} /></View> : null}
      {onClose ? <Pressable accessibilityRole="button" accessibilityLabel={t.learning.close} onPress={onClose} style={ui.iconButton}><LearningIcon name="close-outline" size={27} color={c.textPrimary} /></Pressable> : null}
    </View>
    <Animated.View style={{ flex: 1, opacity }}>
      <ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 20, gap: contentGap }}>
        {children}
        {error && !footer ? <Text accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}
      </ScrollView>
    </Animated.View>
    {footer ? <View style={[ui.footer, { paddingHorizontal: gutter }]}>
      {error ? <Text accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}{footer}
    </View> : null}
  </SafeAreaView>;
}

export function LearningPath({ content, session, onCourse }: { content: PublicLearningContent; session: LearningSessionView; onCourse?: (code: string) => void }) {
  const { language, t } = useI18n();
  const copy = t.learning;
  return <View>{content.stages.map((stage, index) => {
    const status = session.stageStatus[stage.stageCode];
    const course = content.courses.find((item) => item.courseCode === stage.courseCode)!;
    const previous = content.stages[index - 1];
    const detail = status === 'completed' ? copy.completed : status === 'unlocked' ? copy.unlocked : previous ? copy.unlockHint(previous.title[language]) : copy.locked;
    const inner = <><View style={ui.timelineTrack}>
      <View style={[ui.timelineNode, status === 'completed' ? ui.doneNode : status === 'locked' ? ui.lockedNode : ui.activeNode]}>
        {status === 'completed' ? <LearningIcon name="checkmark" size={18} color={c.surface} /> : status === 'locked' ? <LearningIcon name="lock-closed" size={13} color={c.textSecondaryReadable} /> : <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: c.learningGreen }} />}
      </View>{index < content.stages.length - 1 ? <View style={ui.timelineLine} /> : null}
    </View><Text style={ui.timelineNumber}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={ui.timelineCopy}><Text style={ui.listTitle}>{stage.title[language]}</Text><Text style={ui.caption}>{course.title[language]} · {detail}</Text></View>
    </>;
    return onCourse ? <Pressable key={stage.stageCode} accessibilityRole="button" accessibilityLabel={`${stage.title[language]}, ${course.title[language]}, ${detail}`}
      onPress={() => onCourse(course.courseCode)} style={({ pressed }) => [ui.timelineRow, pressed ? s.pressed : null]}>{inner}</Pressable>
      : <View key={stage.stageCode} style={ui.timelineRow}>{inner}</View>;
  })}</View>;
}

export function LearningBody({ blocks, sources, gap = 18 }: { blocks: LearningBodyBlock[]; sources: LearningSource[]; gap?: number }) {
  const { language, t } = useI18n();
  return <View style={{ gap }}>{blocks.map((block, index) => {
    switch (block.type) {
      case 'paragraph': return <Text key={index} style={ui.body}>{block.text[language]}</Text>;
      case 'bullet-list': return <View key={index} style={ui.group}>{block.items.map((item, i) => <View key={i} style={[ui.row, { alignItems: 'flex-start', gap: 8 }]}><Text style={ui.body}>•</Text><Text style={[ui.body, ui.flex]}>{item[language]}</Text></View>)}</View>;
      case 'reflection': return <View key={index} style={[ui.panel, ui.row]}><View style={ui.iconDisc}><LearningIcon name="leaf-outline" /></View><View style={ui.flex}><Text style={ui.eyebrow}>{block.title[language]}</Text><Text style={ui.body}>{block.text[language]}</Text></View></View>;
      case 'image': return <LearningImage key={index} assetKey={block.assetKey} label={block.alt[language]} style={ui.cover} />;
      case 'fact': return <View key={index} style={ui.group}><Text style={ui.fact}>{block.value[language]}</Text><Text style={ui.body}>{block.text[language]}</Text><Text style={ui.caption}>{block.scope[language]}</Text></View>;
      case 'sdg-callout': return <View key={index} style={[ui.panel, ui.row, { backgroundColor: c.skySurface }]}>
        <LearningImage assetKey={block.assetKey} label={t.learning.sdgAlt} style={{ width: 76, height: 76 }} />
        <View style={ui.flex}><Text style={ui.listTitle}>{block.title[language]}</Text><Text style={ui.body}>{block.text[language]}</Text><Text style={ui.caption}>{block.detail[language]}</Text></View>
      </View>;
      case 'source': return <View key={index}>{block.sourceRefs.map((code) => { const source = sources.find((item) => item.sourceCode === code); return source ? <LearningSourceLink key={code} label={`${source.publisher} · ${source.title}`} url={source.url} /> : null; })}</View>;
    }
  })}</View>;
}

export function LearningAttribution() {
  const { language } = useI18n();
  return <View style={ui.group}><Text style={ui.caption}>{learningSdgAttribution[language]}</Text><LearningSourceLink label="United Nations" url={learningSdgAttribution.url} /></View>;
}
