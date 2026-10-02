import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Linking, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import { submitWasteAnswer, type WasteOpportunity, type WasteStream } from '../../services/wasteLearningApi';

type Props = { opportunity: WasteOpportunity | null; onClose: () => void };
const STREAMS: WasteStream[] = ['organics', 'recycling', 'general'];
const ICONS: Record<WasteOpportunity['material'], keyof typeof MaterialCommunityIcons.glyphMap> = {
  eggshell: 'egg-outline',
  aluminium_can: 'cylinder',
  plastic_bottle: 'bottle-soda-outline',
  unknown_bottle: 'bottle-soda-outline',
};
const COPY = {
  zh: {
    eyebrow: '用完之后 · 分类小挑战', question: '我该去哪一类？', instruction: '拖动材料到下方，或轻点一种类别',
    streams: { organics: '厨余 / 堆肥', recycling: '可回收物', general: '普通垃圾' },
    materials: { eggshell: '鸡蛋壳', aluminium_can: '空铝罐', plastic_bottle: '空塑料瓶', unknown_bottle: '空瓶' },
    confirmTitle: '先确认瓶身材质', confirmBody: '这件物品用完了。瓶身是硬塑料吗？确认后再做分类题。', confirmYes: '是硬塑料瓶', confirmUnknown: '不是 / 不确定，先跳过',
    right: '分对了！', wrong: '再认识一下它',
    rightBody: '你掌握了一次分类知识，已计入成果页的学习记录。',
    wrongBody: '这次选择已记入学习记录。下次可以试试正确类别。',
    reasons: {
      eggshell: '蛋壳属于厨余。能否放入绿色桶取决于你所在地的厨余收集服务；也可以按当地指引堆肥。',
      aluminium_can: '倒空的铝罐属于金属包装，可进入常见的可回收物流；符合条件的饮料罐也可考虑容器退费。',
      plastic_bottle: '倒空的塑料饮料瓶通常属于可回收包装；具体收集方式请查当地 council。',
    },
    correct: '正确类别', council: '实际投放请查当地 council 指引', source: '官方依据', close: '完成', skip: '稍后再学', saving: '正在记录…', error: '记录失败，请重试',
  },
  en: {
    eyebrow: 'After use · sorting moment', question: 'Where should I go?', instruction: 'Drag to a category or tap one below',
    streams: { organics: 'Organics / compost', recycling: 'Recycling', general: 'General waste' },
    materials: { eggshell: 'Eggshell', aluminium_can: 'Empty aluminium can', plastic_bottle: 'Empty plastic bottle', unknown_bottle: 'Empty bottle' },
    confirmTitle: 'Confirm the container', confirmBody: 'This item is empty. Is its bottle made of rigid plastic?', confirmYes: 'Yes, rigid plastic', confirmUnknown: 'No / unsure, skip for now',
    right: 'You got it!', wrong: 'Let’s learn this one',
    rightBody: 'One more sorting lesson has been added to your achievement page.',
    wrongBody: 'This choice is in your learning record. Try the right category next time.',
    reasons: {
      eggshell: 'Eggshell is organic material. Use a FOGO bin only where your local service accepts it, or follow local composting guidance.',
      aluminium_can: 'An empty aluminium can is recyclable metal packaging. Eligible drink cans may also be returned through a container deposit scheme.',
      plastic_bottle: 'An empty plastic drink bottle is commonly recyclable packaging. Check your council’s collection instructions.',
    },
    correct: 'Correct category', council: 'Check your council before real disposal', source: 'Official guidance', close: 'Done', skip: 'Maybe later', saving: 'Saving…', error: 'Could not save. Please try again',
  },
};

function BinChoice({ stream, index, hovered, label, onPress, disabled }: {
  stream: WasteStream; index: number; hovered: number; label: string; onPress: () => void; disabled: boolean;
}) {
  const tone = stream === 'recycling' ? '#B7DCEB' : stream === 'organics' ? '#BCE2B5' : '#D5D4D0';
  const lid = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(lid, { toValue: hovered === index ? 1 : 0, useNativeDriver: true, speed: 19, bounciness: 3 }).start();
  }, [hovered, index, lid]);
  const lidStyle = {
    transform: [
      { translateX: lid.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
      { translateY: lid.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
      { rotate: lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-17deg'] }) },
    ],
  };
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.binTouch}>
    <Animated.View style={[styles.bin, hovered === index ? styles.binHovered : null]}>
      <View style={styles.binArtwork}>
        <Animated.View style={[styles.binLid, { backgroundColor: tone }, lidStyle]} />
        <View style={[styles.binBody, { borderColor: tone }]}><MaterialCommunityIcons color={tone} name={stream === 'recycling' ? 'recycle' : stream === 'organics' ? 'leaf' : 'dots-horizontal'} size={19} /></View>
      </View>
      <Text style={styles.binText}>{label}</Text>
    </Animated.View>
  </Pressable>;
}

// Arthur: NarIyirm
// 中文：组件只记录用户对材质的学习选择，不宣称现实中的垃圾已投放，也不修改挽回金额。
// EN: This overlay records material-sorting learning only; it never claims physical disposal or changes rescued value.
export function WasteSortingOverlay({ opportunity, onClose }: Props) {
  const { language } = useI18n();
  const copy = COPY[language === 'zh' ? 'zh' : 'en'];
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const playWidth = Math.min(width * 0.91 - 40, 380);
  const position = useRef(new Animated.ValueXY()).current;
  const [hovered, setHovered] = useState(-1);
  const [selected, setSelected] = useState<WasteStream | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctStream, setCorrectStream] = useState<WasteStream | null>(null);
  const [confirmedPlastic, setConfirmedPlastic] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    setSelected(null);
    setIsCorrect(false);
    setCorrectStream(null);
    setConfirmedPlastic(false);
    setError(false);
    savingRef.current = false;
    position.setValue({ x: 0, y: 0 });
    setHovered(-1);
  }, [opportunity?.eventUid, position]);

  const returnItem = useCallback(() => {
    if (reduceMotion) position.setValue({ x: 0, y: 0 });
    else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true, speed: 18, bounciness: 5 }).start();
    setHovered(-1);
  }, [position, reduceMotion]);

  const choose = useCallback(async (index: number) => {
    if (!opportunity || savingRef.current || selected || index < 0 || index > 2
      || (opportunity.material === 'unknown_bottle' && !confirmedPlastic)) return;
    savingRef.current = true;
    setSaving(true);
    setError(false);
    const stream = STREAMS[index];
    try {
      const result = await submitWasteAnswer(opportunity.eventUid, stream, opportunity.material === 'unknown_bottle' ? 'plastic_bottle' : null);
      setSelected(stream);
      setIsCorrect(result.isCorrect);
      setCorrectStream(result.correctStream);
      void Haptics.notificationAsync(result.isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    } catch {
      setError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
      returnItem();
    }
  }, [confirmedPlastic, opportunity, returnItem, selected]);

  // Arthur: NarIyirm
  // 中文：用应用现有的手势实现拖拽；松手时按物品中心定位垃圾桶，避免启动时加载新的原生动画模块。
  // EN: Reuse the app's gesture path and resolve the bin from the item's center on release, avoiding new native animation modules at startup.
  const binAt = useCallback((dx: number, dy: number) => {
    const x = playWidth / 2 + dx;
    return dy > 58 && x >= 0 && x < playWidth ? Math.floor(x / (playWidth / 3)) : -1;
  }, [playWidth]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => position.stopAnimation(),
    onPanResponderMove: (_event, gesture) => {
      position.setValue({ x: gesture.dx, y: gesture.dy });
      setHovered(binAt(gesture.dx, gesture.dy));
    },
    onPanResponderRelease: (_event, gesture) => {
      const index = binAt(gesture.dx, gesture.dy);
      if (index >= 0) void choose(index);
      else returnItem();
    },
    onPanResponderTerminate: returnItem,
    onPanResponderTerminationRequest: () => false,
  }), [binAt, choose, position, returnItem]);
  const itemStyle = { transform: position.getTranslateTransform() };

  if (!opportunity) return null;
  const activeMaterial = opportunity.material === 'unknown_bottle' && confirmedPlastic ? 'plastic_bottle' : opportunity.material;
  const answerStream = correctStream ?? opportunity.correctStream ?? 'recycling';
  return <Modal animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent transparent visible>
    <View style={styles.root}>
      <Pressable accessibilityLabel={copy.skip} onPress={onClose} style={styles.scrim} />
      <View style={[styles.card, { marginTop: Math.max(insets.top, 22), marginBottom: Math.max(insets.bottom, 22) }]}>
        <View style={styles.topline}><Text style={styles.eyebrow}>{copy.eyebrow}</Text><Pressable accessibilityLabel={copy.skip} accessibilityRole="button" hitSlop={12} onPress={onClose}><Ionicons color="#C8D9D1" name="close" size={22} /></Pressable></View>
        {selected ? <>
          <View style={[styles.resultMark, isCorrect ? styles.successMark : styles.wrongMark]}><Ionicons color={isCorrect ? '#B7E6C5' : '#F2D786'} name={isCorrect ? 'checkmark' : 'information'} size={29} /></View>
          <Text style={styles.title}>{isCorrect ? copy.right : copy.wrong}</Text>
          <Text style={styles.body}>{isCorrect ? copy.rightBody : copy.wrongBody}</Text>
          <View style={styles.lesson}><Text style={styles.lessonLabel}>{copy.correct} · {copy.streams[answerStream]}</Text><Text style={styles.lessonBody}>{copy.reasons[activeMaterial === 'unknown_bottle' ? 'plastic_bottle' : activeMaterial]}</Text></View>
          <Text style={styles.council}>{copy.council}</Text>
          <View style={styles.sources}>{(['vic', 'nsw'] as const).map((state) => <Pressable accessibilityRole="link" key={state} onPress={() => void Linking.openURL(opportunity.sourceUrls[state])} style={styles.source}><Text style={styles.sourceText}>{copy.source} · {state.toUpperCase()}</Text><Ionicons color="#AACABB" name="open-outline" size={15} /></Pressable>)}</View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.done}><Text style={styles.doneText}>{copy.close}</Text></Pressable>
        </> : opportunity.material === 'unknown_bottle' && !confirmedPlastic ? <>
          <View style={styles.confirmIcon}><MaterialCommunityIcons color="#27483A" name="bottle-soda-outline" size={48} /></View>
          <Text style={styles.title}>{copy.confirmTitle}</Text>
          <Text style={styles.body}>{copy.confirmBody}</Text>
          <Pressable accessibilityRole="button" onPress={() => setConfirmedPlastic(true)} style={styles.done}><Text style={styles.doneText}>{copy.confirmYes}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.skip}><Text style={styles.skipText}>{copy.confirmUnknown}</Text></Pressable>
        </> : <>
          <Text style={styles.title}>{copy.question}</Text>
          <Text style={styles.body}>{copy.instruction}</Text>
          <View style={[styles.playfield, { width: playWidth }]}>
            <Animated.View {...pan.panHandlers} accessibilityLabel={`${copy.materials[activeMaterial]}${opportunity.quantity > 1 ? ` ×${opportunity.quantity}` : ''}`} style={[styles.item, itemStyle]}><MaterialCommunityIcons color="#183D32" name={ICONS[activeMaterial]} size={39} /><Text style={styles.itemText}>{copy.materials[activeMaterial]}{opportunity.quantity > 1 ? ` ×${opportunity.quantity}` : ''}</Text></Animated.View>
            <View style={styles.bins}>{STREAMS.map((stream, index) => <BinChoice disabled={saving} hovered={hovered} index={index} key={stream} label={copy.streams[stream]} onPress={() => void choose(index)} stream={stream} />)}</View>
          </View>
          {saving ? <Text style={styles.status}>{copy.saving}</Text> : error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{copy.error}</Text> : null}
          <Text style={styles.council}>{copy.council}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.skip}><Text style={styles.skipText}>{copy.skip}</Text></Pressable>
        </>}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,31,25,0.46)' },
  card: { width: '91%', maxWidth: 420, borderRadius: 27, padding: 20, backgroundColor: '#17382F', borderWidth: 1, borderColor: 'rgba(230,247,236,0.22)', shadowColor: '#061C16', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.28, shadowRadius: 32, elevation: 18 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#A9D2B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: '#F3F8F2', fontSize: 26, fontWeight: '700', letterSpacing: -0.7, marginTop: 13 },
  body: { color: '#C4D9CF', fontSize: 13, lineHeight: 19, marginTop: 7 },
  playfield: { height: 180, alignSelf: 'center', marginTop: 21, justifyContent: 'flex-end' },
  item: { width: 90, height: 79, backgroundColor: '#E9E6D6', borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', position: 'absolute', top: 0, zIndex: 2, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 9, elevation: 8 },
  itemText: { color: '#27463A', fontSize: 10, fontWeight: '700', marginTop: 1, textAlign: 'center' },
  bins: { flexDirection: 'row', gap: 6 },
  binTouch: { flex: 1 },
  bin: { height: 90, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, backgroundColor: '#24473D' },
  binHovered: { transform: [{ scale: 1.07 }], borderColor: '#F2D786' },
  binArtwork: { width: 44, height: 48, alignItems: 'center', justifyContent: 'flex-end' },
  binLid: { position: 'absolute', top: 2, width: 42, height: 6, borderRadius: 3 },
  binBody: { width: 36, height: 37, borderWidth: 2, borderTopWidth: 0, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, alignItems: 'center', justifyContent: 'center' },
  binText: { color: '#E2EEE7', fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 5 },
  status: { color: '#C4D9CF', fontSize: 12, textAlign: 'center', marginTop: 9 },
  error: { color: '#F2B6A5', fontSize: 12, textAlign: 'center', marginTop: 9 },
  council: { color: '#9FB8AA', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 17 },
  skip: { alignItems: 'center', padding: 12, marginTop: 6 },
  skipText: { color: '#C4D9CF', fontWeight: '700', fontSize: 13 },
  resultMark: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  confirmIcon: { width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDE9D9', marginTop: 23 },
  successMark: { backgroundColor: '#2D6B4D' },
  wrongMark: { backgroundColor: '#6B5738' },
  lesson: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#24483E', padding: 15, marginTop: 19 },
  lessonLabel: { color: '#E9E6C8', fontSize: 13, fontWeight: '800' },
  lessonBody: { color: '#D5E4D9', fontSize: 13, lineHeight: 20, marginTop: 7 },
  source: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 9, marginTop: 5 },
  sources: { flexDirection: 'row', justifyContent: 'center' },
  sourceText: { color: '#AACABB', fontSize: 12, textDecorationLine: 'underline' },
  done: { backgroundColor: '#DBE9B0', borderRadius: 13, padding: 14, alignItems: 'center', marginTop: 13 },
  doneText: { color: '#254232', fontSize: 14, fontWeight: '800' },
});
