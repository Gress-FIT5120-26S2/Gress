import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Animated, Easing, Linking, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialArtwork, WasteSortingInteraction } from './WasteSortingInteraction';
import { useI18n } from '../../i18n';
import { submitWasteAnswer, type WasteOpportunity, type WasteStream } from '../../services/wasteLearningApi';

type Props = { opportunity: WasteOpportunity | null; blurTarget?: RefObject<View | null>; onClose: () => void };
const STREAMS: WasteStream[] = ['organics', 'recycling', 'general'];
const COPY = {
  zh: {
    eyebrow: '分类练习', question: (material: string) => `${material}该去哪一类？`, instruction: '拖动或点击选择',
    streams: { organics: '厨余 / 堆肥', recycling: '可回收物', general: '普通垃圾' },
    materials: { eggshell: '鸡蛋壳', aluminium_can: '空铝罐', plastic_bottle: '空塑料瓶', unknown_bottle: '空瓶', unknown_container: '空饮料容器' },
    confirmTitle: '先确认包装材质', confirmBody: '这件饮品用完了。刚才的容器是哪一种？确认后再做分类题。', confirmPlastic: '硬塑料瓶', confirmCan: '铝罐', confirmUnknown: '其他 / 不确定，先跳过',
    right: '分类正确', wrong: '再试一次', retry: '重新选择',
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
    right: 'Correct choice', wrong: 'Try once more', retry: 'Choose again',
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

// Arthur: NarIyirm
// 中文：组件只记录用户对材质的学习选择，不宣称现实中的垃圾已投放，也不修改挽回金额。
// EN: This overlay records material-sorting learning only; it never claims physical disposal or changes rescued value.
export function WasteSortingOverlay({ opportunity, blurTarget, onClose }: Props) {
  const { language } = useI18n();
  const copy = COPY[language === 'zh' ? 'zh' : 'en'];
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const playWidth = Math.min(width - 28, 430);
  const topbarTop = Math.max(insets.top + 80, height * 0.29);
  const resultTop = Math.max(insets.top + 48, height * 0.15);
  const feedbackTop = Math.max(resultTop + 54, height * 0.29);
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
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
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
    setFeedbackDismissed(false);
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
  }, [itemOpacity, itemScale, opportunity?.eventUid, opportunity?.componentKey, position]);

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
        setFeedbackDismissed(false);
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
        submitWasteAnswer(opportunity.eventUid, stream, needsMaterial ? confirmedMaterial : null, opportunity.componentKey),
        landOnBin(index, true),
      ]);
      if (!result.isCorrect) await landOnBin(index, false);
      setSelected(stream);
      setFeedbackDismissed(false);
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
  const locale = language === 'zh' ? 'zh' : 'en';
  const materialName = opportunity.displayName?.[locale] ?? (copy.materials as Partial<Record<WasteOpportunity['material'], string>>)[activeMaterial] ?? copy.materials.unknown_container;
  const materialReason = opportunity.explanation?.[locale] ?? (copy.reasons as Partial<Record<WasteOpportunity['material'], string>>)[activeMaterial] ?? copy.reasons.unknown_container;
  const guidanceOnly = opportunity.correctStream === null && !needsMaterial;
  const answerStream = correctStream ?? opportunity.correctStream ?? 'recycling';
  const resultSuccess = isCorrect || practiceDone;
  const showFeedback = guidanceOnly || Boolean(selected && !feedbackDismissed);
  return <Modal animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent transparent visible>
    <View style={styles.root}>
      {/* Arthur: NarIyirm
          中文：复用主页面的模糊目标，让 Android 可模糊库存；暗色遮罩保证旧系统降级时文字仍清晰。
          EN: Reuse the screen blur target for Android inventory blur; the tint keeps text readable on older-system fallback. */}
      <BlurView blurMethod="dimezisBlurViewSdk31Plus" blurTarget={blurTarget} intensity={42} pointerEvents="none" style={StyleSheet.absoluteFill} tint="systemThinMaterialDark" />
      <Pressable accessibilityLabel={copy.skip} onPress={onClose} style={styles.scrim} />
      <View style={[styles.topline, { top: showFeedback ? resultTop : topbarTop }]}>
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
        {showFeedback ? <View style={[styles.feedbackWrap, { top: feedbackTop }]}>
          <View style={[styles.feedbackBoard, resultSuccess ? styles.feedbackSuccess : styles.feedbackWrong]}>
            <View style={styles.feedbackHeading}><View style={[styles.feedbackIcon, resultSuccess ? styles.feedbackIconSuccess : styles.feedbackIconWrong]}><Ionicons color={resultSuccess ? '#277351' : '#A46420'} name={resultSuccess ? 'checkmark' : 'information'} size={20} /></View><Text style={styles.feedbackTitle}>{guidanceOnly ? (locale === 'zh' ? '看看投放指引' : 'Check disposal guidance') : practiceDone ? copy.practiceDone : resultSuccess ? copy.right : copy.wrong}</Text></View>
            <Text style={styles.feedbackCategory}>{guidanceOnly ? materialName : `${copy.correct} · ${copy.streams[answerStream]}`}</Text>
            <Text style={styles.feedbackReason}>{materialReason}</Text>
            <Text style={styles.feedbackCouncil}>{copy.council}</Text>
            <View style={styles.feedbackSources}>{(['vic', 'nsw'] as const).map((state) => <Pressable accessibilityRole="link" key={state} onPress={() => void Linking.openURL(opportunity.sourceUrls[state])} style={styles.feedbackSource}><Text style={styles.feedbackSourceText}>{copy.source} · {state.toUpperCase()}</Text><Ionicons color="#536B60" name="open-outline" size={13} /></Pressable>)}</View>
            {resultSuccess || guidanceOnly ? <Pressable accessibilityRole="button" onPress={onClose} style={styles.continueAction}><Text style={styles.continueText}>{copy.close}</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={17} /></Pressable>
              : <Pressable accessibilityRole="button" onPress={() => { returnItem(); setFeedbackDismissed(true); }} style={styles.continueAction}><Text style={styles.continueText}>{copy.retry}</Text><Ionicons color="#FFFFFF" name="refresh" size={17} /></Pressable>}
          </View>
        </View> : <Text style={[styles.question, { top: topbarTop + 51 }]}>{copy.question(materialName)}</Text>}
        {!guidanceOnly ? <WasteSortingInteraction mode="inventory" width={playWidth} binY={binY} style={{ position: 'absolute', top: itemTop }} gestureHandlers={pan.panHandlers} itemStyle={itemStyle} hovered={hovered} reducedMotion={reduceMotion} disabled={saving || resultSuccess} itemDisabled={resultSuccess}
          itemLabel={`${materialName}${opportunity.quantity > 1 ? ` ×${opportunity.quantity}` : ''}`} onChoose={(index) => void choose(index)} choices={STREAMS.map(stream => ({ stream, label: copy.streams[stream], highlighted: Boolean(selected && !resultSuccess && stream === answerStream) }))}
          item={<><MaterialArtwork key={`${activeMaterial}:${opportunity.iconUrl}`} emoji={opportunity.iconEmoji} iconUrl={opportunity.iconUrl} material={activeMaterial} /><Text style={styles.itemText}>{materialName}{opportunity.quantity > 1 ? ` ×${opportunity.quantity}` : ''}</Text></>} /> : null}
        {saving || error ? <Text accessibilityLiveRegion="polite" style={[styles.status, error && styles.error, { bottom: insets.bottom + 73 }]}>{error ? copy.error : copy.saving}</Text> : null}
        {!showFeedback ? <View style={[styles.footer, { bottom: insets.bottom + 21 }]}><Text style={styles.instruction}>{copy.instruction}</Text></View> : null}
      </>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,30,26,0.26)' },
  topline: { position: 'absolute', left: 25, right: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#F2FCF3', fontSize: 15, fontWeight: '800', letterSpacing: 0.4, textShadowColor: 'rgba(4,30,22,0.5)', textShadowRadius: 5 },
  skipText: { color: '#F2FCF3', fontSize: 14, fontWeight: '800', textShadowColor: 'rgba(4,30,22,0.5)', textShadowRadius: 5 },
  question: { position: 'absolute', left: 22, right: 22, color: '#F4FFF7', fontSize: 30, fontWeight: '800', lineHeight: 37, textAlign: 'center', textShadowColor: 'rgba(4,30,22,0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  itemText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: 2, textAlign: 'center', textShadowColor: 'rgba(0,24,20,0.85)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
  footer: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  instruction: { color: '#F0FAF3', fontSize: 12, fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(3,30,20,0.75)', textShadowRadius: 4 },
  status: { position: 'absolute', left: 15, right: 15, color: '#F7FFF8', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  error: { color: '#FFE5BF' },
  feedbackWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center', zIndex: 10 },
  feedbackBoard: { width: '100%', maxWidth: 365, borderRadius: 16, backgroundColor: '#F8FAF8', paddingHorizontal: 20, paddingVertical: 19, shadowColor: '#102A21', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 8 },
  feedbackSuccess: {},
  feedbackWrong: {},
  feedbackHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedbackIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  feedbackIconSuccess: { backgroundColor: '#E0F2E7' },
  feedbackIconWrong: { backgroundColor: '#FFF0D7' },
  feedbackTitle: { color: '#19392F', fontSize: 23, fontWeight: '800' },
  feedbackCategory: { color: '#235746', fontSize: 14, fontWeight: '800', marginTop: 13 },
  feedbackReason: { color: '#42584E', fontSize: 13, lineHeight: 19, marginTop: 7 },
  feedbackCouncil: { color: '#607169', fontSize: 11, lineHeight: 16, marginTop: 15 },
  feedbackSources: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  feedbackSource: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 30 },
  feedbackSourceText: { color: '#49675A', fontSize: 11, textDecorationLine: 'underline' },
  continueAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, backgroundColor: '#277351', paddingHorizontal: 20, paddingVertical: 10, marginTop: 14, minHeight: 44 },
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
