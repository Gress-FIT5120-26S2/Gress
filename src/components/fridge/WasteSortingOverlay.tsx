import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Linking, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { useI18n } from '../../i18n';
import { submitWasteAnswer, type WasteOpportunity, type WasteStream } from '../../services/wasteLearningApi';

type Props = { opportunity: WasteOpportunity | null; onClose: () => void };
const STREAMS: WasteStream[] = ['organics', 'recycling', 'general'];
const BIN_COLORS: Record<WasteStream, readonly [string, string, string]> = {
  organics: ['#9BE886', '#54BA55', '#277D42'],
  recycling: ['#FFE77A', '#F7BE32', '#D68013'],
  general: ['#FF9E8F', '#EE6658', '#AD3E3B'],
};
const ICONS: Record<WasteOpportunity['material'], keyof typeof MaterialCommunityIcons.glyphMap> = {
  eggshell: 'egg-outline',
  aluminium_can: 'cylinder',
  plastic_bottle: 'bottle-soda-outline',
  unknown_bottle: 'bottle-soda-outline',
  unknown_container: 'help-circle-outline',
};
const COPY = {
  zh: {
    eyebrow: '分类练习', question: (material: string) => `${material}该去哪一类？`, instruction: '拖动或点击选择',
    streams: { organics: '厨余 / 堆肥', recycling: '可回收物', general: '普通垃圾' },
    materials: { eggshell: '鸡蛋壳', aluminium_can: '空铝罐', plastic_bottle: '空塑料瓶', unknown_bottle: '空瓶', unknown_container: '空饮料容器' },
    confirmTitle: '先确认包装材质', confirmBody: '这件饮品用完了。刚才的容器是哪一种？确认后再做分类题。', confirmPlastic: '硬塑料瓶', confirmCan: '铝罐', confirmUnknown: '其他 / 不确定，先跳过',
    right: '答对啦！', wrong: '再试一次',
    rightBody: '这次分类知识已计入成果页。',
    wrongBody: '试着把它放进正确的桶里。',
    reasons: {
      eggshell: '蛋壳属于厨余。能否放入绿色桶取决于你所在地的厨余收集服务；也可以按当地指引堆肥。',
      aluminium_can: '倒空的铝罐属于金属包装，可进入常见的可回收物流；符合条件的饮料罐也可考虑容器退费。',
      plastic_bottle: '倒空的塑料饮料瓶通常属于可回收包装；具体收集方式请查当地 council。',
      unknown_bottle: '请先确认容器材质，再参考当地投放指引。',
      unknown_container: '请先确认容器材质，再参考当地投放指引。',
    },
    correct: '正确类别', council: '实际投放请查当地 council 指引', source: '官方依据', close: '继续', skip: '跳过', saving: '正在记录…', error: '记录失败，请重试', practiceDone: '记住啦！', practiceHint: '下次也这样分类。',
  },
  en: {
    eyebrow: 'Sorting moment', question: (material: string) => `Where does this ${material.toLowerCase()} go?`, instruction: 'Drag or tap to choose',
    streams: { organics: 'Organics / compost', recycling: 'Recycling', general: 'General waste' },
    materials: { eggshell: 'Eggshell', aluminium_can: 'Empty aluminium can', plastic_bottle: 'Empty plastic bottle', unknown_bottle: 'Empty bottle', unknown_container: 'Empty drink container' },
    confirmTitle: 'Confirm the packaging', confirmBody: 'You have finished this drink. What was its container made of?', confirmPlastic: 'Rigid plastic bottle', confirmCan: 'Aluminium can', confirmUnknown: 'Other / unsure, skip for now',
    right: 'You got it!', wrong: 'Try once more',
    rightBody: 'This lesson has been added to your learning record.',
    wrongBody: 'Try dropping it into the right bin.',
    reasons: {
      eggshell: 'Eggshell is organic material. Use a FOGO bin only where your local service accepts it, or follow local composting guidance.',
      aluminium_can: 'An empty aluminium can is recyclable metal packaging. Eligible drink cans may also be returned through a container deposit scheme.',
      plastic_bottle: 'An empty plastic drink bottle is commonly recyclable packaging. Check your council’s collection instructions.',
      unknown_bottle: 'Confirm the container material, then check your local collection guidance.',
      unknown_container: 'Confirm the container material, then check your local collection guidance.',
    },
    correct: 'Correct category', council: 'Check your council before real disposal', source: 'Official guidance', close: 'Continue', skip: 'Skip', saving: 'Saving…', error: 'Could not save. Please try again', practiceDone: 'Now you know!', practiceHint: 'You can sort it this way next time.',
  },
};

function BinChoice({ stream, index, hovered, highlighted, label, onPress, disabled, reducedMotion }: {
  stream: WasteStream; index: number; hovered: number; highlighted: boolean; label: string; onPress: () => void; disabled: boolean; reducedMotion: boolean;
}) {
  const lid = useRef(new Animated.Value(0)).current;
  const isOpen = hovered === index;
  const colors = BIN_COLORS[stream];
  useEffect(() => {
    if (reducedMotion) lid.setValue(isOpen ? 1 : 0);
    else Animated.timing(lid, { toValue: isOpen ? 1 : 0, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [isOpen, lid, reducedMotion]);
  const lidStyle = { transform: [
    { translateY: lid.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) },
    { rotate: lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-22deg'] }) },
  ] };
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.binTouch}>
    <View style={[styles.binFigure, (isOpen || highlighted) && styles.binFigureActive]}>
      <View style={styles.binOpening} />
      <LinearGradient colors={[colors[0], colors[1], colors[2]]} locations={[0, 0.45, 1]} style={styles.binBody}>
        <View style={styles.binFace}><View style={styles.binEye} /><View style={styles.binEye} /></View>
        <View style={styles.binSmile} />
        <MaterialCommunityIcons color="#FFFBF0" name={stream === 'recycling' ? 'recycle' : stream === 'organics' ? 'leaf' : 'delete-outline'} size={35} style={styles.binSymbol} />
      </LinearGradient>
      <Animated.View style={[styles.binLid, lidStyle]}>
        <LinearGradient colors={[colors[0], colors[1], colors[2]]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.binLidSurface}>
          <View style={styles.binLidShine} />
        </LinearGradient>
      </Animated.View>
    </View>
    <Text numberOfLines={2} style={styles.binText}>{label}</Text>
  </Pressable>;
}

function MaterialArtwork({ material }: { material: WasteOpportunity['material'] }) {
  if (material === 'eggshell') {
    return <Svg height={91} viewBox="0 0 100 91" width={100}>
      <Defs><SvgLinearGradient id="shell" x1="0" x2="1" y1="0" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#ECD9AF" /></SvgLinearGradient></Defs>
      <Path d="M17 37 C19 18 33 7 50 7 C68 7 81 20 83 37 L72 31 L61 40 L49 31 L37 42 L26 34 Z" fill="url(#shell)" stroke="#D6BE92" strokeWidth="2.5" />
      <Path d="M13 45 L24 37 L36 46 L49 36 L62 46 L75 37 L87 45 C86 69 71 84 50 84 C29 84 14 69 13 45 Z" fill="url(#shell)" stroke="#D6BE92" strokeLinejoin="round" strokeWidth="2.5" />
      <Path d="M22 58 C27 70 36 76 45 77" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="5" />
    </Svg>;
  }
  if (material === 'aluminium_can') {
    return <View style={styles.canArt}>
      <View style={styles.canTop} />
      <LinearGradient colors={['#F4F8F3', '#8DD3DD', '#2C9AAC', '#D9F1E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.canBody}>
        <MaterialCommunityIcons color="#FFE277" name="circle-slice-8" size={38} />
      </LinearGradient>
      <View style={styles.canBottom} />
    </View>;
  }
  return <MaterialCommunityIcons
    color="#CDEEF1"
    name={ICONS[material]}
    size={96}
    style={styles.materialGlyph}
  />;
}

// Arthur: NarIyirm
// 中文：组件只记录用户对材质的学习选择，不宣称现实中的垃圾已投放，也不修改挽回金额。
// EN: This overlay records material-sorting learning only; it never claims physical disposal or changes rescued value.
export function WasteSortingOverlay({ opportunity, onClose }: Props) {
  const { language } = useI18n();
  const copy = COPY[language === 'zh' ? 'zh' : 'en'];
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const playWidth = Math.min(width - 28, 430);
  const topbarTop = Math.max(insets.top + 80, height * 0.29);
  const resultTop = Math.max(insets.top + 48, height * 0.15);
  const itemTop = Math.max(topbarTop + 122, height * 0.43);
  const binTop = Math.min(height - insets.bottom - 186, height * 0.64);
  const binY = binTop - itemTop;
  const position = useRef(new Animated.ValueXY()).current;
  const dragOrigin = useRef({ x: 0, y: 0 });
  const itemScale = useRef(new Animated.Value(1)).current;
  const itemOpacity = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(-1);
  const hoveredRef = useRef(-1);
  const [selected, setSelected] = useState<WasteStream | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctStream, setCorrectStream] = useState<WasteStream | null>(null);
  const [practiceDone, setPracticeDone] = useState(false);
  const [confirmedMaterial, setConfirmedMaterial] = useState<'plastic_bottle' | 'aluminium_can' | null>(null);
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
    setPracticeDone(false);
    setConfirmedMaterial(null);
    setError(false);
    savingRef.current = false;
    position.setValue({ x: 0, y: 0 });
    dragOrigin.current = { x: 0, y: 0 };
    itemScale.setValue(1);
    itemOpacity.setValue(1);
    hoveredRef.current = -1;
    setHovered(-1);
  }, [itemOpacity, itemScale, opportunity?.eventUid, position]);

  const returnItem = useCallback(() => {
    if (reduceMotion) {
      position.setValue({ x: 0, y: 0 });
      itemScale.setValue(1);
      itemOpacity.setValue(1);
    } else Animated.parallel([
      Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true, speed: 18, bounciness: 5 }),
      Animated.timing(itemScale, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(itemOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    hoveredRef.current = -1;
    setHovered(-1);
  }, [itemOpacity, itemScale, position, reduceMotion]);

  const landOnBin = useCallback((index: number, inside: boolean) => new Promise<void>((resolve) => {
    const target = { x: (index - 1) * playWidth / 3, y: binY - (inside ? 20 : 100) };
    if (reduceMotion) {
      position.setValue(target);
      itemScale.setValue(inside ? 0.48 : 0.94);
      itemOpacity.setValue(inside ? 0.3 : 1);
      resolve();
      return;
    }
    Animated.parallel([
      Animated.timing(position, { toValue: target, duration: inside ? 260 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(itemScale, { toValue: inside ? 0.48 : 0.94, duration: inside ? 260 : 220, useNativeDriver: true }),
      Animated.timing(itemOpacity, { toValue: inside ? 0.3 : 1, duration: 240, useNativeDriver: true }),
    ]).start(() => resolve());
  }), [binY, itemOpacity, itemScale, playWidth, position, reduceMotion]);

  const choose = useCallback(async (index: number) => {
    const needsMaterial = opportunity?.material === 'unknown_bottle' || opportunity?.material === 'unknown_container';
    if (!opportunity || savingRef.current || index < 0 || index > 2
      || (needsMaterial && !confirmedMaterial)) return;
    if (selected) {
      if (!isCorrect && !practiceDone && STREAMS[index] === correctStream) {
        await landOnBin(index, true);
        setPracticeDone(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(false);
    const stream = STREAMS[index];
    try {
      // Arthur: NarIyirm
      // 中文：物品落桶与判分并行；答错时弹回桶上方，首次答案仍只向服务端记录一次。
      // EN: The object lands while grading runs; a wrong answer rebounds above the bin, and only the first attempt is recorded.
      const [result] = await Promise.all([
        submitWasteAnswer(opportunity.eventUid, stream, needsMaterial ? confirmedMaterial : null),
        landOnBin(index, true),
      ]);
      if (!result.isCorrect) await landOnBin(index, false);
      setSelected(stream);
      setIsCorrect(result.isCorrect);
      setCorrectStream(result.correctStream);
      void Haptics.notificationAsync(result.isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    } catch {
      setError(true);
      returnItem();
    } finally {
      savingRef.current = false;
      setSaving(false);
      hoveredRef.current = -1;
      setHovered(-1);
    }
  }, [confirmedMaterial, correctStream, isCorrect, landOnBin, opportunity, practiceDone, returnItem, selected]);

  // Arthur: NarIyirm
  // 中文：用应用现有的手势实现拖拽；松手时按物品中心定位垃圾桶，避免启动时加载新的原生动画模块。
  // EN: Reuse the app's gesture path and resolve the bin from the item's center on release, avoiding new native animation modules at startup.
  const binAt = useCallback((dx: number, dy: number) => {
    const x = playWidth / 2 + dx;
    return dy >= binY - 85 && dy <= binY + 135 && x >= 0 && x < playWidth ? Math.floor(x / (playWidth / 3)) : -1;
  }, [binY, playWidth]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => {
      position.stopAnimation((value) => { dragOrigin.current = value; });
      itemScale.stopAnimation();
      itemOpacity.stopAnimation();
      if (!reduceMotion) Animated.timing(itemScale, { toValue: 1.08, duration: 110, useNativeDriver: true }).start();
    },
    onPanResponderMove: (_event, gesture) => {
      const x = dragOrigin.current.x + gesture.dx;
      const y = dragOrigin.current.y + gesture.dy;
      position.setValue({ x, y });
      const next = binAt(x, y);
      if (next !== hoveredRef.current) {
        hoveredRef.current = next;
        setHovered(next);
      }
    },
    onPanResponderRelease: (_event, gesture) => {
      const index = binAt(dragOrigin.current.x + gesture.dx, dragOrigin.current.y + gesture.dy);
      if (index >= 0) void choose(index);
      else returnItem();
    },
    onPanResponderTerminate: returnItem,
    onPanResponderTerminationRequest: () => false,
  }), [binAt, choose, itemOpacity, itemScale, position, reduceMotion, returnItem]);
  const itemStyle = { opacity: itemOpacity, transform: [...position.getTranslateTransform(), { scale: itemScale }] };

  if (!opportunity) return null;
  const needsMaterial = opportunity.material === 'unknown_bottle' || opportunity.material === 'unknown_container';
  const activeMaterial = needsMaterial && confirmedMaterial ? confirmedMaterial : opportunity.material;
  const answerStream = correctStream ?? opportunity.correctStream ?? 'recycling';
  const resultSuccess = isCorrect || practiceDone;
  return <Modal animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent transparent visible>
    <View style={styles.root}>
      <Pressable accessibilityLabel={copy.skip} onPress={onClose} style={styles.scrim} />
      <View style={[styles.topline, { top: selected ? resultTop : topbarTop }]}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Pressable accessibilityLabel={copy.skip} accessibilityRole="button" hitSlop={12} onPress={onClose}><Text style={styles.skipText}>{copy.skip}</Text></Pressable>
      </View>
      {needsMaterial && !confirmedMaterial ? <View style={[styles.confirmBoard, { top: topbarTop + 48 }]}>
        <Text style={styles.confirmTitle}>{copy.confirmTitle}</Text>
        <Text style={styles.confirmBody}>{copy.confirmBody}</Text>
        <View style={styles.materialOptions}>
          <Pressable accessibilityRole="button" onPress={() => setConfirmedMaterial('plastic_bottle')} style={styles.materialOption}><MaterialCommunityIcons color="#E9F9ED" name="bottle-soda-outline" size={29} /><Text style={styles.materialOptionText}>{copy.confirmPlastic}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirmedMaterial('aluminium_can')} style={styles.materialOption}><MaterialCommunityIcons color="#E9F9ED" name="cylinder" size={29} /><Text style={styles.materialOptionText}>{copy.confirmCan}</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.unknownAction}><Text style={styles.unknownText}>{copy.confirmUnknown}</Text></Pressable>
      </View> : <>
        {selected ? <View style={[styles.feedbackWrap, { top: resultTop + 42 }]}>
          <View style={[styles.feedbackBoard, resultSuccess ? styles.feedbackSuccess : styles.feedbackWrong]}>
            <View style={styles.feedbackHeading}><Ionicons color={resultSuccess ? '#C0F4C7' : '#FFE088'} name={resultSuccess ? 'checkmark-circle' : 'help-circle'} size={29} /><Text style={styles.feedbackTitle}>{practiceDone ? copy.practiceDone : resultSuccess ? copy.right : copy.wrong}</Text></View>
            <Text style={styles.feedbackCategory}>{copy.correct} · {copy.streams[answerStream]}</Text>
            <Text style={styles.feedbackReason}>{copy.reasons[activeMaterial]}</Text>
            {!resultSuccess ? <Text style={styles.feedbackHint}>{copy.wrongBody}</Text> : null}
          </View>
          {resultSuccess ? <Pressable accessibilityRole="button" onPress={onClose} style={styles.continueAction}><Text style={styles.continueText}>{copy.close}</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={17} /></Pressable> : null}
        </View> : <Text style={[styles.question, { top: topbarTop + 51 }]}>{copy.question(copy.materials[activeMaterial])}</Text>}
        <View style={[styles.playArea, { top: itemTop, width: playWidth, height: Math.max(245, binY + 176) }]}>
          <Animated.View {...pan.panHandlers} accessibilityLabel={`${copy.materials[activeMaterial]}${opportunity.quantity > 1 ? ` ×${opportunity.quantity}` : ''}`} pointerEvents={resultSuccess ? 'none' : 'auto'} style={[styles.item, resultSuccess && styles.itemBehindBin, itemStyle]}>
            <MaterialArtwork material={activeMaterial} />
            <Text style={styles.itemText}>{copy.materials[activeMaterial]}{opportunity.quantity > 1 ? ` ×${opportunity.quantity}` : ''}</Text>
          </Animated.View>
          <View style={[styles.bins, { top: binY }]}>{STREAMS.map((stream, index) => <BinChoice disabled={saving || resultSuccess} highlighted={Boolean(selected && !resultSuccess && stream === answerStream)} hovered={hovered} index={index} key={stream} label={copy.streams[stream]} onPress={() => void choose(index)} reducedMotion={reduceMotion} stream={stream} />)}</View>
        </View>
        {saving || error ? <Text accessibilityLiveRegion="polite" style={[styles.status, error && styles.error, { bottom: insets.bottom + 73 }]}>{error ? copy.error : copy.saving}</Text> : null}
        <View style={[styles.footer, { bottom: insets.bottom + 21 }]}>
          <Text style={styles.instruction}>{selected ? copy.council : copy.instruction}</Text>
          {selected ? <View style={styles.sources}>{(['vic', 'nsw'] as const).map((state) => <Pressable accessibilityRole="link" key={state} onPress={() => void Linking.openURL(opportunity.sourceUrls[state])} style={styles.source}><Text style={styles.sourceText}>{copy.source} · {state.toUpperCase()}</Text><Ionicons color="#E3F5E9" name="open-outline" size={13} /></Pressable>)}</View> : null}
        </View>
      </>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,30,26,0.50)' },
  topline: { position: 'absolute', left: 25, right: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#F2FCF3', fontSize: 15, fontWeight: '800', letterSpacing: 0.4, textShadowColor: 'rgba(4,30,22,0.5)', textShadowRadius: 5 },
  skipText: { color: '#F2FCF3', fontSize: 14, fontWeight: '800', textShadowColor: 'rgba(4,30,22,0.5)', textShadowRadius: 5 },
  question: { position: 'absolute', left: 22, right: 22, color: '#F4FFF7', fontSize: 30, fontWeight: '800', lineHeight: 37, textAlign: 'center', textShadowColor: 'rgba(4,30,22,0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  playArea: { position: 'absolute', alignSelf: 'center' },
  item: { position: 'absolute', top: 0, left: '50%', marginLeft: -55, width: 110, height: 122, zIndex: 5, alignItems: 'center', justifyContent: 'center' },
  itemBehindBin: { zIndex: 1 },
  materialGlyph: { textShadowColor: 'rgba(255,255,255,0.55)', textShadowOffset: { width: -2, height: -2 }, textShadowRadius: 10 },
  itemText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: 2, textAlign: 'center', textShadowColor: 'rgba(0,24,20,0.85)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
  canArt: { width: 67, height: 91, alignItems: 'center', transform: [{ rotate: '15deg' }], shadowColor: '#001F23', shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  canTop: { width: 58, height: 10, borderRadius: 9, backgroundColor: '#E7ECEB', borderWidth: 2, borderColor: '#7A9598', zIndex: 2 },
  canBody: { width: 60, height: 72, marginTop: -2, borderWidth: 1, borderColor: '#DBF7F3', alignItems: 'center', justifyContent: 'center' },
  canBottom: { width: 57, height: 8, marginTop: -2, borderRadius: 8, backgroundColor: '#9BB6B5', borderWidth: 1, borderColor: '#ECF8F1' },
  bins: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', zIndex: 2 },
  binTouch: { flex: 1, minHeight: 168, alignItems: 'center', justifyContent: 'flex-start' },
  binFigure: { width: 99, height: 123, alignItems: 'center', shadowColor: '#081C18', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.34, shadowRadius: 10, elevation: 9 },
  binFigureActive: { transform: [{ scale: 1.07 }], shadowOpacity: 0.5 },
  binOpening: { position: 'absolute', top: 27, width: 86, height: 25, borderRadius: 14, backgroundColor: '#143A2D', zIndex: 1 },
  binBody: { position: 'absolute', top: 36, width: 84, height: 84, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.48)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  binFace: { position: 'absolute', top: 21, flexDirection: 'row', gap: 23 },
  binEye: { width: 6, height: 8, borderRadius: 4, backgroundColor: '#14332A' },
  binSmile: { position: 'absolute', top: 34, width: 14, height: 8, borderBottomWidth: 3, borderBottomColor: '#14332A', borderBottomLeftRadius: 9, borderBottomRightRadius: 9 },
  binSymbol: { marginTop: 28, textShadowColor: 'rgba(0,0,0,0.12)', textShadowRadius: 3 },
  binLid: { position: 'absolute', top: 11, width: 99, height: 31, zIndex: 3 },
  binLidSurface: { width: 99, height: 28, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.57)', alignItems: 'center' },
  binLidShine: { width: 61, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.58)', marginTop: 4 },
  binText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 15, textAlign: 'center', marginTop: 2, paddingHorizontal: 2, textShadowColor: 'rgba(3,30,20,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  footer: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  instruction: { color: '#F0FAF3', fontSize: 12, fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(3,30,20,0.75)', textShadowRadius: 4 },
  status: { position: 'absolute', left: 15, right: 15, color: '#F7FFF8', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  error: { color: '#FFE5BF' },
  sources: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 6 },
  sourceText: { color: '#E3F5E9', fontSize: 10, textDecorationLine: 'underline' },
  feedbackWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  feedbackBoard: { width: '100%', maxWidth: 365, borderRadius: 16, backgroundColor: 'rgba(15,58,47,0.94)', paddingHorizontal: 18, paddingVertical: 16, shadowColor: '#031D16', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 10, elevation: 8 },
  feedbackSuccess: { borderWidth: 1, borderColor: '#BCEBC2' },
  feedbackWrong: { borderWidth: 1, borderColor: '#EAD79E' },
  feedbackHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  feedbackTitle: { color: '#F7FFF7', fontSize: 25, fontWeight: '800' },
  feedbackCategory: { color: '#EAF7D1', fontSize: 14, fontWeight: '800', marginTop: 10 },
  feedbackReason: { color: '#E3F1E7', fontSize: 12, lineHeight: 18, marginTop: 5 },
  feedbackHint: { color: '#FFE7AD', fontSize: 12, fontWeight: '700', marginTop: 8 },
  continueAction: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 24, backgroundColor: '#3F8868', paddingHorizontal: 20, paddingVertical: 10, marginTop: 12, minHeight: 44 },
  continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  confirmBoard: { position: 'absolute', left: 24, right: 24, alignSelf: 'center', maxWidth: 365, borderRadius: 16, backgroundColor: 'rgba(15,58,47,0.95)', padding: 19, borderWidth: 1, borderColor: '#B2D9BE', shadowColor: '#031D16', shadowOpacity: 0.3, shadowRadius: 9, elevation: 8 },
  confirmTitle: { color: '#F8FFF8', fontSize: 24, fontWeight: '800' },
  confirmBody: { color: '#E2F1E8', fontSize: 14, lineHeight: 20, marginTop: 7 },
  materialOptions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  materialOption: { flex: 1, minHeight: 82, borderRadius: 13, backgroundColor: '#367A60', alignItems: 'center', justifyContent: 'center', padding: 8 },
  materialOptionText: { color: '#F9FFF7', fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  unknownAction: { alignItems: 'center', padding: 10, marginTop: 7, minHeight: 44 },
  unknownText: { color: '#D7EADC', fontSize: 12, fontWeight: '700' },
});
