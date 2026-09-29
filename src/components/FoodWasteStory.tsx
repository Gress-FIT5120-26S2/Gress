import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';

const OZHARVEST_SOURCE = 'https://www.ozharvest.org/australian-household-food-waste-research/';
const GOVERNMENT_SOURCE = 'https://www.dcceew.gov.au/environment/protection/waste/food-waste';

type Hotspot = { left: `${number}%`; top: `${number}%`; width: `${number}%`; height: `${number}%` };
type StoryScene = { id: string; image: number; hotspot?: Hotspot };

// Arthur: NarIyirm
// 中文：统计幕复用相邻画面作为背景，让用户看清数字属于调查群体而非新出现的虚构人物。
// EN: Data scenes reuse neighbouring artwork so the figures read as survey context rather than a new fictional household.
const SCENES: StoryScene[] = [
  { id: 'arrival', image: require('../../docs/art-direction/food-waste-animation/01-shopping.png'), hotspot: { left: '39%', top: '25%', width: '49%', height: '52%' } },
  { id: 'fridge', image: require('../../docs/art-direction/food-waste-animation/02-forgotten.png'), hotspot: { left: '50%', top: '49%', width: '46%', height: '40%' } },
  { id: 'categories', image: require('../../docs/art-direction/food-waste-animation/02-forgotten.png') },
  { id: 'discarded', image: require('../../docs/art-direction/food-waste-animation/04-discarded.png'), hotspot: { left: '33%', top: '65%', width: '48%', height: '28%' } },
  { id: 'youngHouseholds', image: require('../../docs/art-direction/food-waste-animation/04-discarded.png') },
  { id: 'national', image: require('../../docs/art-direction/food-waste-animation/05-neighbourhood.png'), hotspot: { left: '13%', top: '54%', width: '75%', height: '34%' } },
  { id: 'action', image: require('../../docs/art-direction/food-waste-animation/03-next-time.png'), hotspot: { left: '42%', top: '25%', width: '46%', height: '51%' } },
];

const copy = {
  zh: {
    title: '食物去哪了？', close: '关闭故事', previous: '上一幕', next: '下一幕', replay: '重新体验',
    progress: (current: number) => `第 ${current} 幕，共 ${SCENES.length} 幕`,
    instruction: '点击画面中标出的物件，或使用下方按钮',
    source: '查看资料来源',
    estimate: '研究估计',
    wholeSample: '以下是全体受访家庭的数据，并非年轻家庭专属',
    youthScope: '有 35 岁以下成员的家庭；不是画面中这户家庭的实际记录',
    nationalScope: '澳大利亚全国年度估计，依据 2021 年研究',
    scenes: [
      { eyebrow: '一袋新食材', title: '下班后，又买了一袋食材。', body: '忙碌的时候，很容易忘记家里已有些什么。', hotspot: '点冰箱，看看里面' },
      { eyebrow: '冰箱深处', title: '上次的食物，还在这里。', body: '绿叶菜和剩食被新买的东西挡住了。', hotspot: '点被忘记的食材' },
      { eyebrow: '常见的浪费', title: '被丢掉的，往往是熟悉的食物。', body: 'OzHarvest 2025 年调查中，47% 的家庭报告丢弃蔬菜，45% 报告丢弃剩食。', hotspot: '' },
      { eyebrow: '几天以后', title: '食物最后进了桶。', body: '这是一段示意故事。真正的损失比眼前这一桶更难看见。', hotspot: '点食物桶，看看数据' },
      { eyebrow: '年轻家庭', title: '一年累积下来，可能比想象中多。', body: 'OzHarvest 对澳大利亚家庭的调查估计：', hotspot: '' },
      { eyebrow: '放大到全国', title: '这不只发生在一间厨房。', body: '澳大利亚家庭每年浪费的食物，约占全国食物浪费总量的 30%。', hotspot: '点一户亮着灯的厨房' },
      { eyebrow: '下一次购物前', title: '先看一眼冰箱。', body: '看见已有的食材，才能决定真正需要买什么。', hotspot: '点冰箱，重新体验' },
    ],
    vegetables: '47%', vegetablesLabel: '家庭报告丢弃蔬菜',
    leftovers: '45%', leftoversLabel: '家庭报告丢弃剩食',
    youngAmount: '113 kg', youngAmountLabel: '每年丢弃的食物',
    youngValue: 'A$1,500+', youngValueLabel: '估计价值',
    nationalAmount: '250 万吨', nationalAmountLabel: '澳大利亚家庭每年浪费的食物',
    nationalShare: '约 30%', nationalShareLabel: '占全国食物浪费总量',
    imageDescriptions: [
      '年轻人带着购物袋回到厨房，旁边是蓝色冰箱和勺勺。',
      '从冰箱里面看出去，前景有剩食、蔬菜与番茄。',
      '冰箱里有蔬菜与剩食，画面上叠加了调查比例。',
      '食物桶里有变蔫的绿叶菜和剩食，主人与勺勺在旁边。',
      '食物桶场景上叠加了年轻家庭的年度估计数字。',
      '傍晚的澳大利亚社区里，有许多亮着灯的厨房。',
      '主人和勺勺一起查看冰箱里的食材。',
    ],
  },
  en: {
    title: 'Where did the food go?', close: 'Close story', previous: 'Previous', next: 'Next', replay: 'Start again',
    progress: (current: number) => `Scene ${current} of ${SCENES.length}`,
    instruction: 'Tap the marked object, or use the buttons below',
    source: 'View source',
    estimate: 'Research estimate',
    wholeSample: 'These figures cover all surveyed households, not only younger households',
    youthScope: 'Households with someone under 35; not a record of the household shown here',
    nationalScope: 'Australia-wide annual estimate based on a 2021 study',
    scenes: [
      { eyebrow: 'Another bag of food', title: 'After work, another bag comes home.', body: 'On busy days, it is easy to forget what is already in the fridge.', hotspot: 'Tap the fridge to look inside' },
      { eyebrow: 'Deep in the fridge', title: 'Last week’s food is still here.', body: 'The greens and leftovers have slipped behind the new food.', hotspot: 'Tap the forgotten food' },
      { eyebrow: 'Common losses', title: 'It is often familiar food that goes to waste.', body: 'In OzHarvest’s 2025 survey, 47% of households reported wasting vegetables and 45% reported wasting leftovers.', hotspot: '' },
      { eyebrow: 'A few days later', title: 'The food ends up in the bin.', body: 'This is an illustrative story. The wider loss is harder to see.', hotspot: 'Tap the food bin to see the data' },
      { eyebrow: 'Younger households', title: 'Over a year, small losses add up.', body: 'An OzHarvest survey of Australian households estimates:', hotspot: '' },
      { eyebrow: 'Across Australia', title: 'This happens beyond one kitchen.', body: 'Households account for about 30% of all food wasted in Australia each year.', hotspot: 'Tap a lit kitchen window' },
      { eyebrow: 'Before the next shop', title: 'Check the fridge first.', body: 'See what you have, then decide what you really need.', hotspot: 'Tap the fridge to start again' },
    ],
    vegetables: '47%', vegetablesLabel: 'reported wasting vegetables',
    leftovers: '45%', leftoversLabel: 'reported wasting leftovers',
    youngAmount: '113 kg', youngAmountLabel: 'food discarded each year',
    youngValue: 'A$1,500+', youngValueLabel: 'estimated value',
    nationalAmount: '2.5 million tonnes', nationalAmountLabel: 'food wasted by Australian households yearly',
    nationalShare: 'about 30%', nationalShareLabel: 'of all Australian food waste',
    imageDescriptions: [
      'A young adult returns to the kitchen with groceries beside a blue fridge and Spoonie.',
      'A view from inside the fridge, with leftovers, greens and tomatoes in front.',
      'Vegetables and leftovers in a fridge with survey figures overlaid.',
      'Wilted greens and leftovers in a food bin, with the household and Spoonie nearby.',
      'Annual estimates for younger households over a food bin scene.',
      'An Australian neighbourhood at dusk with many warmly lit kitchens.',
      'The household and Spoonie check the food in the fridge together.',
    ],
  },
} as const;

export function FoodWasteStory({ onClose }: { onClose: () => void }) {
  const { language } = useI18n();
  const t = copy[language];
  const [sceneIndex, setSceneIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const reveal = useRef(new Animated.Value(1)).current;
  const zoom = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const imageWidth = Math.min(width - 24, (height - insets.top - insets.bottom - 186) * 720 / 1280, 490);
  const scene = SCENES[sceneIndex];
  const sceneCopy = t.scenes[sceneIndex];
  const isLast = sceneIndex === SCENES.length - 1;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      reveal.setValue(1);
      zoom.setValue(1);
      return;
    }
    // Arthur: NarIyirm
    // 中文：用户主动切幕时只淡入并缓慢推进图片；数据卡片保持静止，方便阅读和返回核对。
    // EN: Each user-led scene fades in with a gentle image push; data cards stay still for reading and revisiting.
    const motion = Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(zoom, { toValue: 1, duration: 5400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    motion.start();
    return () => motion.stop();
  }, [reveal, reduceMotion, sceneIndex, zoom]);

  const goTo = (index: number) => {
    if (index < 0 || index >= SCENES.length) return;
    // Arthur: NarIyirm
    // 中文：先重置原生动画值，再换图，避免切幕时旧图闪现一帧。
    // EN: Reset native animation values before swapping assets so the previous image cannot flash for a frame.
    reveal.stopAnimation();
    zoom.stopAnimation();
    reveal.setValue(reduceMotion ? 1 : 0);
    zoom.setValue(reduceMotion ? 1 : 1.045);
    setSceneIndex(index);
  };

  const advance = () => goTo(isLast ? 0 : sceneIndex + 1);
  const sourceUrl = sceneIndex === 5 ? GOVERNMENT_SOURCE : OZHARVEST_SOURCE;

  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <View style={[styles.screen, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{t.title}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.progress}>{t.progress(sceneIndex + 1)}</Text>
          </View>
          <Pressable accessibilityLabel={t.close} accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Ionicons color="#173B31" name="close" size={23} />
          </Pressable>
        </View>

        <View style={styles.progressRail}>
          {SCENES.map((item, index) => <View key={item.id} style={[styles.progressSegment, index <= sceneIndex && styles.progressSegmentActive]} />)}
        </View>

        <View style={[styles.sceneFrame, { width: imageWidth }]}>
          <Animated.Image
            accessibilityLabel={t.imageDescriptions[sceneIndex]}
            resizeMode="cover"
            source={scene.image}
            style={[styles.sceneImage, { opacity: reveal, transform: [{ scale: zoom }] }]}
          />
          <View pointerEvents="none" style={styles.scrim} />

          {sceneIndex === 2 ? (
            <ScrollView contentContainerStyle={styles.dataCardContent} showsVerticalScrollIndicator={false} style={[styles.dataCard, { maxHeight: imageWidth * 1280 / 720 * 0.88 }]}>
              <Text style={styles.dataEyebrow}>{sceneCopy.eyebrow}</Text>
              <Text style={styles.dataTitle}>{sceneCopy.title}</Text>
              <Text style={styles.dataBody}>{sceneCopy.body}</Text>
              <View style={styles.statRow}>
                <Stat value={t.vegetables} label={t.vegetablesLabel} />
                <Stat value={t.leftovers} label={t.leftoversLabel} />
              </View>
              <Text style={styles.scope}>{t.wholeSample}</Text>
              <SourceLink label={t.source} url={OZHARVEST_SOURCE} />
            </ScrollView>
          ) : sceneIndex === 4 ? (
            <ScrollView contentContainerStyle={styles.dataCardContent} showsVerticalScrollIndicator={false} style={[styles.dataCard, { maxHeight: imageWidth * 1280 / 720 * 0.88 }]}>
              <Text style={styles.dataEyebrow}>{sceneCopy.eyebrow} · {t.estimate}</Text>
              <Text style={styles.dataTitle}>{sceneCopy.title}</Text>
              <Text style={styles.dataBody}>{sceneCopy.body}</Text>
              <View style={styles.stackedStats}>
                <Stat value={t.youngAmount} label={t.youngAmountLabel} />
                <Stat value={t.youngValue} label={t.youngValueLabel} />
              </View>
              <Text style={styles.scope}>{t.youthScope}</Text>
              <SourceLink label={t.source} url={OZHARVEST_SOURCE} />
            </ScrollView>
          ) : sceneIndex === 5 ? (
            <ScrollView contentContainerStyle={styles.dataCardContent} showsVerticalScrollIndicator={false} style={[styles.dataCard, { maxHeight: imageWidth * 1280 / 720 * 0.88 }]}>
              <Text style={styles.dataEyebrow}>{sceneCopy.eyebrow} · {t.estimate}</Text>
              <Text style={styles.dataTitle}>{sceneCopy.title}</Text>
              <Text style={styles.dataBody}>{sceneCopy.body}</Text>
              <View style={styles.stackedStats}>
                <Stat value={t.nationalAmount} label={t.nationalAmountLabel} />
                <Stat value={t.nationalShare} label={t.nationalShareLabel} />
              </View>
              <Text style={styles.scope}>{t.nationalScope}</Text>
              <SourceLink label={t.source} url={sourceUrl} />
            </ScrollView>
          ) : (
            <View pointerEvents="none" style={styles.captionCard}>
              <Text style={styles.captionEyebrow}>{sceneCopy.eyebrow}</Text>
              <Text style={styles.captionTitle}>{sceneCopy.title}</Text>
              <Text style={styles.captionBody}>{sceneCopy.body}</Text>
            </View>
          )}

          {scene.hotspot ? (
            <Pressable
              accessibilityLabel={sceneCopy.hotspot}
              accessibilityRole="button"
              onPress={advance}
              style={({ pressed }) => [styles.hotspot, scene.hotspot, pressed && styles.hotspotPressed]}
            >
              <View style={styles.hotspotBadge}>
                <View style={styles.hotspotDot}><Ionicons color="#173B31" name="arrow-forward" size={16} /></View>
                <Text style={styles.hotspotText}>{sceneCopy.hotspot}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.instruction}>{t.instruction}</Text>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" disabled={sceneIndex === 0} onPress={() => goTo(sceneIndex - 1)} style={[styles.backButton, sceneIndex === 0 && styles.disabled]}>
            <Ionicons color="#FFF8E8" name="arrow-back" size={19} />
            <Text style={styles.backText}>{t.previous}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={advance} style={styles.nextButton}>
            <Text style={styles.nextText}>{isLast ? t.replay : t.next}</Text>
            <Ionicons color="#173B31" name={isLast ? 'refresh' : 'arrow-forward'} size={19} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function SourceLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(url); }} style={styles.sourceLink}>
      <Text style={styles.sourceText}>{label}</Text>
      <Ionicons color="#CBE7D4" name="open-outline" size={13} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#173B31' },
  header: { width: '100%', maxWidth: 550, minHeight: 53, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  progress: { color: '#BED9C9', fontSize: 12, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8E8' },
  progressRail: { width: '90%', maxWidth: 490, flexDirection: 'row', gap: 5, marginVertical: 8 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  progressSegmentActive: { backgroundColor: '#F2B94B' },
  sceneFrame: { position: 'relative', aspectRatio: 720 / 1280, overflow: 'hidden', borderRadius: 24, backgroundColor: '#294A3F' },
  sceneImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8,30,26,0.08)' },
  captionCard: { position: 'absolute', top: '5%', left: '5%', right: '5%', padding: 17, borderRadius: 21, backgroundColor: 'rgba(255,251,242,0.94)' },
  captionEyebrow: { color: '#BD6729', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  captionTitle: { color: '#173B31', fontSize: 22, lineHeight: 29, fontWeight: '900', marginTop: 7 },
  captionBody: { color: '#45665A', fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 7 },
  hotspot: { position: 'absolute', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 9, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,249,221,0.7)', backgroundColor: 'rgba(255,247,219,0.08)' },
  hotspotPressed: { backgroundColor: 'rgba(255,247,219,0.24)' },
  hotspotBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '96%', paddingRight: 11, paddingVertical: 5, borderRadius: 18, backgroundColor: 'rgba(255,250,236,0.94)' },
  hotspotDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2B94B' },
  hotspotText: { flexShrink: 1, color: '#173B31', fontSize: 11, fontWeight: '800' },
  dataCard: { position: 'absolute', top: '5%', left: '5%', right: '5%', borderRadius: 22, backgroundColor: 'rgba(18,57,47,0.95)' },
  dataCardContent: { padding: 16 },
  dataEyebrow: { color: '#FFCA83', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  dataTitle: { color: '#FFF9EB', fontSize: 20, lineHeight: 26, fontWeight: '900', marginTop: 8 },
  dataBody: { color: '#D7EADD', fontSize: 13, lineHeight: 19, marginTop: 8 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 17 },
  stackedStats: { gap: 9, marginTop: 16 },
  stat: { flex: 1, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.09)' },
  statValue: { color: '#FFBE69', fontSize: 27, lineHeight: 32, fontWeight: '900' },
  statLabel: { color: '#FFF9EB', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  scope: { color: '#CBE1D1', fontSize: 11, lineHeight: 16, marginTop: 14 },
  sourceLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, marginTop: 2 },
  sourceText: { color: '#CBE7D4', fontSize: 11, textDecorationLine: 'underline' },
  instruction: { color: '#BED9C9', textAlign: 'center', fontSize: 11, marginTop: 8, paddingHorizontal: 20 },
  footer: { width: '100%', maxWidth: 550, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10, gap: 10 },
  backButton: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 17, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  disabled: { opacity: 0.35 },
  backText: { color: '#FFF8E8', fontSize: 14, fontWeight: '800' },
  nextButton: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 19, borderRadius: 15, backgroundColor: '#F2B94B' },
  nextText: { color: '#173B31', fontSize: 14, fontWeight: '900' },
});
