import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { useAudioPlayer } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Linking, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';

const ASSETS = {
  hub: require('../../docs/art-direction/food-waste-animation/final-story/assets/hub.mp4'),
  fridgeIn: require('../../docs/art-direction/food-waste-animation/final-story/assets/fridge-in.mp4'),
  fridgeHold: require('../../docs/art-direction/food-waste-animation/final-story/assets/fridge-hold.mp4'),
  fridgeOut: require('../../docs/art-direction/food-waste-animation/final-story/assets/fridge-out.mp4'),
  shelfIn: require('../../docs/art-direction/food-waste-animation/final-story/assets/shelf-in.mp4'),
  shelfHold: require('../../docs/art-direction/food-waste-animation/final-story/assets/shelf-hold.mp4'),
  shelfOut: require('../../docs/art-direction/food-waste-animation/final-story/assets/shelf-out.mp4'),
  hubPoster: require('../../docs/art-direction/food-waste-animation/final-story/assets/hub-poster.png'),
  wastePoster: require('../../docs/art-direction/food-waste-animation/final-story/assets/waste-poster.png'),
  causesPoster: require('../../docs/art-direction/food-waste-animation/final-story/assets/causes-poster.png'),
  fridgeZh: require('../../docs/art-direction/food-waste-animation/final-story/assets/fridge-zh.wav'),
  fridgeEn: require('../../docs/art-direction/food-waste-animation/final-story/assets/fridge-en.wav'),
  shelfZh: require('../../docs/art-direction/food-waste-animation/final-story/assets/shelf-zh.wav'),
  shelfEn: require('../../docs/art-direction/food-waste-animation/final-story/assets/shelf-en.wav'),
} as const;

const SOURCE = 'https://www.ozharvest.org/australian-household-food-waste-research/';
type Branch = 'waste' | 'causes';
type Phase = 'hub' | 'loading-enter' | 'entering' | 'detail' | 'loading-return' | 'returning';

const copy = {
  zh: {
    close: '关闭动画', back: '返回厨房', source: '查看研究来源', soundOn: '关闭旁白', soundOff: '播放旁白',
    explore: '点选厨房中的物件',
    fridge: '冰箱 · 浪费数据', shelf: '货架 · 根因分析',
    fridgeIntro: '新买的食物，遮住了冰箱里原有的食材。',
    shelfIntro: '几个日常选择，让食物渐渐被遗忘。',
    action: '下一次购物前，先看看冰箱。',
    wasteEyebrow: '澳大利亚 · 2025 年调查估计',
    wasteTitle: '被遗忘的食物，积累起来有多重？',
    wasteValue: '113 kg',
    wasteLabel: '有 35 岁以下成员的家庭，估计每年丢弃的食物',
    wasteCost: '估计价值超过 A$1,500',
    wasteScope: '调查群体估计值，不代表每个家庭的实际丢弃量。',
    causesTitle: '为什么食物会被遗忘？',
    causesEyebrow: '购物与储存中的常见行为',
    causes: ['购物前没查看家中食材', '餐食安排缺少弹性', '日期标签容易混淆'],
    causesScope: '这些是研究提到的相关行为，并非年轻家庭的原因排名。',
  },
  en: {
    close: 'Close animation', back: 'Return to kitchen', source: 'View research source', soundOn: 'Mute narration', soundOff: 'Play narration',
    explore: 'Tap an object in the kitchen',
    fridge: 'Fridge · waste data', shelf: 'Shelf · possible causes',
    fridgeIntro: 'New groceries hide food already in the fridge.',
    shelfIntro: 'Small everyday choices can leave food forgotten.',
    action: 'Check the fridge before the next shop.',
    wasteEyebrow: 'Australia · 2025 survey estimate',
    wasteTitle: 'How much can forgotten food add up to?',
    wasteValue: '113 kg',
    wasteLabel: 'estimated food discarded each year by households with someone under 35',
    wasteCost: 'estimated value over A$1,500',
    wasteScope: 'A survey group estimate, not the measured amount for every household.',
    causesTitle: 'Why does food get forgotten?',
    causesEyebrow: 'Common shopping and storage behaviours',
    causes: ['Not checking food at home before shopping', 'Meal plans with little flexibility', 'Confusion over date labels'],
    causesScope: 'Behaviours noted in the research, not a ranking of causes for younger households.',
  },
} as const;

export function InteractiveFoodWasteStory({ onClose }: { onClose: () => void }) {
  const { language } = useI18n();
  const t = copy[language];
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sceneWidth = Math.min(width, height * 540 / 960);
  const sceneHeight = sceneWidth * 960 / 540;
  const [phase, setPhase] = useState<Phase>('hub');
  const [branch, setBranch] = useState<Branch | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [holdReady, setHoldReady] = useState(false);
  const [holdFirstFrameReady, setHoldFirstFrameReady] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const phaseRef = useRef<Phase>('hub');
  const branchRef = useRef<Branch | null>(null);
  const mountedRef = useRef(true);
  const soundOnRef = useRef(true);
  const holdLoadRef = useRef<Promise<void> | null>(null);
  const hubPlayer = useVideoPlayer(ASSETS.hub, player => {
    player.loop = true;
    player.muted = true;
  });
  const branchPlayer = useVideoPlayer(null, player => {
    player.muted = true;
  });
  const narrationPlayer = useAudioPlayer(null);
  const narrationPlayingRef = useRef(false);

  const voiceFor = (target: Branch) => target === 'waste'
    ? (language === 'zh' ? ASSETS.fridgeZh : ASSETS.fridgeEn)
    : (language === 'zh' ? ASSETS.shelfZh : ASSETS.shelfEn);

  const stopNarration = () => {
    if (!narrationPlayingRef.current) return;
    narrationPlayingRef.current = false;
    narrationPlayer.pause();
  };

  const startNarration = (target: Branch) => {
    if (!soundOnRef.current) return;
    // Arthur: NarIyirm
    // 中文：复用单个原生播放器并直接替换音源，避免异步 seek 在页面卸载后再次调用已释放对象。
    // EN: Reuse one native player and replace its source, avoiding a delayed seek callback after release.
    narrationPlayer.replace(voiceFor(target));
    narrationPlayer.play();
    narrationPlayingRef.current = true;
  };

  const changePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    mountedRef.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mountedRef.current) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (phaseRef.current !== 'hub') return;
    if (reducedMotion) hubPlayer.pause();
    else hubPlayer.play();
  }, [hubPlayer, reducedMotion]);

  useEffect(() => {
    if (phaseRef.current !== 'detail' || !holdReady) return;
    if (reducedMotion) branchPlayer.pause();
    else branchPlayer.play();
  }, [branchPlayer, holdReady, reducedMotion]);

  useEffect(() => {
    const target = branchRef.current;
    if (!target || !soundOnRef.current || (phaseRef.current !== 'entering' && phaseRef.current !== 'detail')) return;
    // Arthur: NarIyirm
    // 中文：语言在故事打开时变化，也立即切换旁白音轨，与界面文字保持一致。
    // EN: A live locale change restarts the matching narration so audio follows the visible copy.
    stopNarration();
    startNarration(target);
  }, [language]);

  useEventListener(branchPlayer, 'playToEnd', () => {
    // Arthur: NarIyirm
    // 中文：转场影片播完才进入可阅读的数据页或重新开放总场景热点，防止连续点击造成错乱。
    // EN: The video end event alone unlocks the detail or hub state so repeated taps cannot skip a transition.
    if (phaseRef.current === 'entering') {
      changePhase('detail');
      setFirstFrameReady(false);
      setHoldReady(false);
      setHoldFirstFrameReady(false);
      const target = branchRef.current;
      if (target && !reducedMotion) {
        // Arthur: NarIyirm
        // 中文：数据页循环在后台准备，海报承接同一构图以避免影片切换时闪黑。
        // EN: The matching poster bridges loading so the animated detail loop never flashes black.
        branchPlayer.loop = true;
        const holdLoad = branchPlayer.replaceAsync(target === 'waste' ? ASSETS.fridgeHold : ASSETS.shelfHold);
        holdLoadRef.current = holdLoad;
        void holdLoad
          .then(() => {
            if (!mountedRef.current || phaseRef.current !== 'detail' || branchRef.current !== target) return;
            branchPlayer.currentTime = 0;
            setHoldReady(true);
            branchPlayer.play();
          }).catch(() => {}).finally(() => {
            if (holdLoadRef.current === holdLoad) holdLoadRef.current = null;
          });
      }
    } else if (phaseRef.current === 'returning') {
      branchRef.current = null;
      setBranch(null);
      changePhase('hub');
      setFirstFrameReady(false);
      hubPlayer.currentTime = 0;
      if (!reducedMotion) hubPlayer.play();
    }
  });

  const enter = async (target: Branch) => {
    if (phaseRef.current !== 'hub') return;
    branchRef.current = target;
    setBranch(target);
    hubPlayer.pause();
    setHoldReady(false);
    setHoldFirstFrameReady(false);
    stopNarration();
    if (reducedMotion) {
      changePhase('detail');
      startNarration(target);
      return;
    }
    changePhase('loading-enter');
    setFirstFrameReady(false);
    try {
      branchPlayer.loop = false;
      await branchPlayer.replaceAsync(target === 'waste' ? ASSETS.fridgeIn : ASSETS.shelfIn);
      if (!mountedRef.current) return;
      branchPlayer.currentTime = 0;
      changePhase('entering');
      branchPlayer.play();
      startNarration(target);
    } catch {
      if (mountedRef.current) {
        changePhase('detail');
        startNarration(target);
      }
    }
  };

  const returnToHub = async () => {
    if (phaseRef.current !== 'detail' || !branchRef.current) return;
    stopNarration();
    if (holdReady) branchPlayer.pause();
    setHoldReady(false);
    if (reducedMotion) {
      branchRef.current = null;
      setBranch(null);
      changePhase('hub');
      return;
    }
    changePhase('loading-return');
    setFirstFrameReady(false);
    try {
      // Arthur: NarIyirm
      // 中文：若用户在数据循环片段仍加载时返回，先等该替换完成，避免两个原生视频替换并发造成错序。
      // EN: Finish a pending detail clip replacement before loading the return clip to keep native player operations ordered.
      await holdLoadRef.current?.catch(() => {});
      if (!mountedRef.current) return;
      branchPlayer.loop = false;
      await branchPlayer.replaceAsync(branchRef.current === 'waste' ? ASSETS.fridgeOut : ASSETS.shelfOut);
      if (!mountedRef.current) return;
      branchPlayer.currentTime = 0;
      changePhase('returning');
      branchPlayer.play();
    } catch {
      if (mountedRef.current) {
        branchRef.current = null;
        setBranch(null);
        changePhase('hub');
        hubPlayer.currentTime = 0;
        if (!reducedMotion) hubPlayer.play();
      }
    }
  };

  const close = () => {
    stopNarration();
    onClose();
  };

  const toggleSound = () => {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
    if (!next) stopNarration();
    else if (branchRef.current && (phaseRef.current === 'entering' || phaseRef.current === 'detail')) {
      startNarration(branchRef.current);
    }
  };

  const onSystemBack = () => {
    if (phaseRef.current === 'detail') void returnToHub();
    else if (phaseRef.current === 'hub') close();
  };

  const isHub = phase === 'hub' || phase === 'loading-enter';
  const isTransition = phase === 'entering' || phase === 'returning';
  const poster = branch === 'waste' ? ASSETS.wastePoster : ASSETS.causesPoster;
  const backgroundPoster = phase === 'hub' || phase === 'loading-enter' || phase === 'entering' ? ASSETS.hubPoster : poster;

  return (
    <Modal animationType="fade" onRequestClose={onSystemBack} presentationStyle="fullScreen" visible>
      <View style={styles.screen}>
        <View style={[styles.scene, { width: sceneWidth, height: sceneHeight }]}>
          <Image resizeMode="stretch" source={backgroundPoster} style={styles.media} />
          {phase === 'hub' && !reducedMotion ? (
            <VideoView contentFit="fill" nativeControls={false} player={hubPlayer} style={styles.media} surfaceType="textureView" />
          ) : null}
          {isTransition ? (
            <>
              <VideoView
                contentFit="fill"
                nativeControls={false}
                onFirstFrameRender={() => setFirstFrameReady(true)}
                player={branchPlayer}
                style={styles.media}
                surfaceType="textureView"
              />
              {!firstFrameReady ? <Image resizeMode="stretch" source={backgroundPoster} style={styles.media} /> : null}
            </>
          ) : null}
          {phase === 'detail' && holdReady && !reducedMotion ? (
            <>
              <VideoView contentFit="fill" nativeControls={false} onFirstFrameRender={() => setHoldFirstFrameReady(true)} player={branchPlayer} style={styles.media} surfaceType="textureView" />
              {!holdFirstFrameReady ? <Image resizeMode="stretch" source={poster} style={styles.media} /> : null}
            </>
          ) : null}

          {phase === 'hub' ? (
            <>
              <Pressable accessibilityHint={t.fridge} accessibilityLabel={t.fridge} accessibilityRole="button" onPress={() => { void enter('waste'); }} style={styles.fridgeHotspot} />
              <Pressable accessibilityHint={t.shelf} accessibilityLabel={t.shelf} accessibilityRole="button" onPress={() => { void enter('causes'); }} style={styles.shelfHotspot} />
              <View pointerEvents="none" style={styles.hubLegend}>
                <Text style={styles.hubHint}>{t.explore}</Text>
                <View style={styles.hubLabels}>
                  <Text style={styles.hubLabel}>{t.fridge}</Text>
                  <Text style={styles.hubLabel}>{t.shelf}</Text>
                </View>
              </View>
            </>
          ) : null}

          {phase === 'detail' && branch === 'waste' ? (
            <View style={styles.wasteContent}>
              <Text style={styles.wasteEyebrow}>{t.wasteEyebrow}</Text>
              <Text style={styles.wasteTitle}>{t.wasteTitle}</Text>
              <Text style={styles.wasteNumber}>{t.wasteValue}</Text>
              <Text style={styles.wasteLabel}>{t.wasteLabel}</Text>
              <Text style={styles.wasteCost}>{t.wasteCost}</Text>
              <Text style={styles.wasteScope}>{t.wasteScope}</Text>
              <SourceLink label={t.source} light />
            </View>
          ) : null}

          {phase === 'detail' && branch === 'causes' ? (
            <>
              <View pointerEvents="none" style={styles.causeRows}>
                {t.causes.map((cause, index) => <Text key={cause} style={[styles.causeRow, { top: `${20.5 + 13.2 * index}%` }]}>{cause}</Text>)}
              </View>
              <View style={styles.causesContent}>
                <Text style={styles.causesEyebrow}>{t.causesEyebrow}</Text>
                <Text style={styles.causesTitle}>{t.causesTitle}</Text>
                <Text style={styles.causesScope}>{t.causesScope}</Text>
                <SourceLink label={t.source} />
              </View>
            </>
          ) : null}

          {phase === 'entering' && branch ? (
            <View pointerEvents="none" style={[styles.caption, branch === 'waste' && styles.darkCaption]}>
              <Text style={[styles.captionText, branch === 'waste' && styles.lightCaptionText]}>{branch === 'waste' ? t.fridgeIntro : t.shelfIntro}</Text>
            </View>
          ) : null}
          {phase === 'detail' ? (
            <View pointerEvents="none" style={styles.action}>
              <Text style={[styles.actionText, branch === 'waste' && styles.lightActionText]}>{t.action}</Text>
            </View>
          ) : null}

          {phase === 'detail' ? (
            <Pressable accessibilityLabel={t.back} accessibilityRole="button" onPress={() => { void returnToHub(); }} style={[styles.topButton, branch === 'waste' && styles.darkTopButton, styles.backButton, { top: Math.max(insets.top, 76) }]}>
              <Ionicons color={branch === 'waste' ? '#F1EEE6' : '#19211D'} name="arrow-back" size={22} />
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel={soundOn ? t.soundOn : t.soundOff} accessibilityRole="button" onPress={toggleSound} style={[styles.topButton, !isHub && branch === 'waste' && styles.darkTopButton, styles.soundButton, { top: Math.max(insets.top, 76) }]}>
            <Ionicons color={isHub || branch === 'causes' ? '#19211D' : '#F1EEE6'} name={soundOn ? 'volume-medium-outline' : 'volume-mute-outline'} size={21} />
          </Pressable>
          <Pressable accessibilityLabel={t.close} accessibilityRole="button" onPress={close} style={[styles.topButton, !isHub && branch === 'waste' && styles.darkTopButton, styles.closeButton, { top: Math.max(insets.top, 76) }]}>
            <Ionicons color={isHub || branch === 'causes' ? '#19211D' : '#F1EEE6'} name="close" size={23} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SourceLink({ label, light = false }: { label: string; light?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(SOURCE); }} style={styles.sourceLink}>
      <Text style={[styles.sourceText, light && styles.lightText]}>{label}</Text>
      <Ionicons color={light ? '#D9E7DC' : '#45584B'} name="open-outline" size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFEDE5' },
  scene: { position: 'relative', overflow: 'hidden', backgroundColor: '#EFEDE5' },
  media: { position: 'absolute', width: '100%', height: '100%' },
  fridgeHotspot: { position: 'absolute', left: '8%', top: '26%', width: '42%', height: '52%' },
  shelfHotspot: { position: 'absolute', left: '56%', top: '30%', width: '38%', height: '49%' },
  hubLegend: { position: 'absolute', left: '5.5%', right: '5.5%', bottom: '8.5%' },
  hubHint: { color: '#4A544D', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  hubLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  hubLabel: { color: '#1B2B24', fontSize: 13, fontWeight: '700', width: '46%', textAlign: 'center' },
  wasteContent: { position: 'absolute', left: '7%', right: '7%', top: '55%' },
  wasteEyebrow: { color: '#D8A692', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  wasteTitle: { color: '#F1EEE6', fontSize: 20, fontWeight: '800', lineHeight: 26, marginTop: 7 },
  wasteNumber: { color: '#D87553', fontSize: 48, fontWeight: '900', letterSpacing: -2, marginTop: 6 },
  wasteLabel: { color: '#F1EEE6', fontSize: 13, lineHeight: 18, maxWidth: 420 },
  wasteCost: { color: '#A7C9AF', fontSize: 14, fontWeight: '700', marginTop: 4 },
  wasteScope: { color: '#ADBAB0', fontSize: 10, lineHeight: 14, marginTop: 8 },
  causeRows: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  causeRow: { position: 'absolute', left: '32%', right: '13%', color: '#263129', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  causesContent: { position: 'absolute', left: '7%', right: '7%', top: '61%' },
  causesEyebrow: { color: '#B46D54', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  causesTitle: { color: '#1E2923', fontSize: 26, fontWeight: '900', lineHeight: 33, marginTop: 10 },
  causesScope: { color: '#526158', fontSize: 13, lineHeight: 20, marginTop: 16 },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, alignSelf: 'flex-start', minHeight: 38 },
  sourceText: { color: '#45584B', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  lightText: { color: '#D9E7DC' },
  caption: { position: 'absolute', left: '7%', right: '7%', bottom: '9%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(239,237,229,0.88)' },
  darkCaption: { backgroundColor: 'rgba(34,43,39,0.86)' },
  captionText: { color: '#263129', fontSize: 15, fontWeight: '700', lineHeight: 21, textAlign: 'center' },
  lightCaptionText: { color: '#F1EEE6' },
  action: { position: 'absolute', left: '7%', right: '7%', bottom: '6%', alignItems: 'center' },
  actionText: { color: '#415649', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  lightActionText: { color: '#B8D5BF' },
  topButton: { position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(238,237,228,0.86)' },
  darkTopButton: { backgroundColor: 'rgba(46,55,50,0.86)' },
  backButton: { left: 18 },
  soundButton: { right: 70 },
  closeButton: { right: 18 },
});
