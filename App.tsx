import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import { BlurTargetView } from 'expo-blur';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, InteractionManager, StyleSheet, Text, View } from 'react-native';
import { getApiHealth } from './src/api';
import { KITCHEN_MODEL_ASSET } from './src/assets/kitchenModel';
import { FloatingTabBar, type AppTab } from './src/components/FloatingTabBar';
import { OpeningAnimation } from './src/components/OpeningAnimation';

// Arthur: NarIyirm
// 中文：3D 代码在开场主体完成后才求值，避免 Expo GL 与动画高负载阶段同时初始化。
// EN: Evaluate 3D code after the main opener sequence so Expo GL does not initialize during its busiest phase.
const Kitchen3DPrototype = lazy(() =>
  import('./src/components/Kitchen3DPrototype').then((module) => ({ default: module.Kitchen3DPrototype })),
);

const screens: Record<AppTab, { eyebrow: string; title: string; description: string }> = {
  home: { eyebrow: 'GOOD EVENING', title: 'What can we make today?', description: 'Your kitchen is ready for a fresh idea.' },
  ingredients: { eyebrow: 'INGREDIENTS', title: 'Choose what you have', description: 'Start with the ingredients already in your kitchen.' },
  fridge: { eyebrow: 'MY FRIDGE', title: 'Keep food in view', description: 'Track freshness before good ingredients go to waste.' },
  recipes: { eyebrow: 'SAVED RECIPES', title: 'Made for your kitchen', description: 'A personal collection of recipes you want to remember.' },
  profile: { eyebrow: 'MY KITCHEN', title: 'Make it yours', description: 'Set your preferences, diets, and cooking goals.' },
};

const transitionTones: Record<AppTab, string> = {
  home: '#E6F1EE',
  ingredients: '#FFF1DC',
  fridge: '#E1F0EF',
  recipes: '#F5E9D6',
  profile: '#E8EEEA',
};
const SCREEN_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export default function App() {
  // Arthur: NarIyirm
  // 中文：开场层会等待厨房首帧完成，再淡出并显示可交互框架。
  // EN: The opener waits for the kitchen's first frame before revealing the interactive shell.
  const [isOpening, setIsOpening] = useState(true);
  const [isOpeningSequenceDone, setIsOpeningSequenceDone] = useState(false);
  const [canMountKitchen, setCanMountKitchen] = useState(false);
  const [canRevealKitchen, setCanRevealKitchen] = useState(false);
  const [status, setStatus] = useState('正在连接后端…');
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [isCinematicActive, setIsCinematicActive] = useState(false);
  const [isTransitionOverlayVisible, setIsTransitionOverlayVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [transitionTone, setTransitionTone] = useState(transitionTones.home);
  const blurTargetRef = useRef<View>(null);
  const transitionInProgressRef = useRef(false);
  const chromeOpacity = useRef(new Animated.Value(1)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;
  const transitionOverlayOpacity = useRef(new Animated.Value(0)).current;
  const finishOpening = useCallback(() => setIsOpening(false), []);
  const completeOpeningSequence = useCallback(() => setIsOpeningSequenceDone(true), []);
  const markKitchenReady = useCallback(() => setCanRevealKitchen(true), []);
  const screen = screens[activeTab];

  useEffect(() => {
    // Arthur: NarIyirm
    // 中文：开场动画播放时先把 GLB 放入本地缓存，稍后创建 Canvas 时可直接进入解析阶段。
    // EN: Cache the GLB while the opener plays so Canvas can proceed directly to parsing when it mounts.
    void Asset.loadAsync(KITCHEN_MODEL_ASSET).catch(() => undefined);
  }, []);

  useEffect(() => {
    // Arthur: NarIyirm
    // 中文：启动时调用 Express 健康检查，并把连接结果传给首页提示文字。
    // EN: On launch, call the Express health check and pass its result to the home status text.
    getApiHealth()
      .then(() => setStatus('后端与 Supabase 已连接'))
      .catch(() => setStatus('暂未连接后端 — 请检查 .env.local 和 server/.env'));
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpeningSequenceDone) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    // Arthur: NarIyirm
    // 中文：主体动画结束后再留出一帧级间隔创建 GL，避免两个高负载阶段直接重叠。
    // EN: Create GL just after the main sequence, leaving a frame-sized gap so the two heavy phases do not overlap.
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setCanMountKitchen(true), 120);
    });

    return () => {
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [isOpeningSequenceDone]);

  useEffect(() => {
    if (!canMountKitchen || canRevealKitchen) return;

    // Arthur: NarIyirm
    // 中文：极端情况下最多等待 12 秒，超时后显示原加载页，避免模型异常导致开场永久停留。
    // EN: After 12 seconds, reveal the normal loader so a model failure cannot trap the app on the opener forever.
    const safetyTimer = setTimeout(() => setCanRevealKitchen(true), 12000);
    return () => clearTimeout(safetyTimer);
  }, [canMountKitchen, canRevealKitchen]);

  const beginCinematicFocus = useCallback(() => {
    setIsCinematicActive(true);
    Animated.timing(chromeOpacity, {
      toValue: 0,
      duration: reduceMotion ? 80 : 180,
      easing: SCREEN_EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [chromeOpacity, reduceMotion]);

  const handleCinematicNavigate = useCallback((targetTab: AppTab) => {
    if (transitionInProgressRef.current || targetTab === activeTab) return;
    transitionInProgressRef.current = true;
    setIsCinematicActive(true);
    setIsTransitionOverlayVisible(true);
    setTransitionTone(transitionTones[targetTab]);
    transitionOverlayOpacity.setValue(0);

    // Arthur: NarIyirm
    // 中文：遮罩完全覆盖时才替换页面，再同时淡出遮罩和淡入目标页，避免卸载 3D Canvas 产生视觉断层。
    // EN: Swap screens only under a fully opaque veil, then reveal the destination while the 3D Canvas unmounts invisibly.
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(transitionOverlayOpacity, {
          toValue: 1,
          duration: reduceMotion ? 90 : 180,
          easing: SCREEN_EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(chromeOpacity, {
          toValue: 0,
          duration: reduceMotion ? 70 : 140,
          easing: SCREEN_EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;

        screenOpacity.setValue(0);
        screenScale.setValue(reduceMotion ? 1 : 0.985);
        setActiveTab(targetTab);

        requestAnimationFrame(() => {
          Animated.parallel([
            Animated.timing(transitionOverlayOpacity, {
              toValue: 0,
              duration: reduceMotion ? 150 : 300,
              easing: SCREEN_EASE_OUT,
              useNativeDriver: true,
            }),
            Animated.timing(screenOpacity, {
              toValue: 1,
              duration: reduceMotion ? 150 : 280,
              easing: SCREEN_EASE_OUT,
              useNativeDriver: true,
            }),
            Animated.timing(screenScale, {
              toValue: 1,
              duration: reduceMotion ? 1 : 340,
              easing: SCREEN_EASE_OUT,
              useNativeDriver: true,
            }),
            Animated.timing(chromeOpacity, {
              toValue: 1,
              duration: reduceMotion ? 130 : 260,
              easing: SCREEN_EASE_OUT,
              useNativeDriver: true,
            }),
          ]).start(() => {
            transitionInProgressRef.current = false;
            setIsCinematicActive(false);
            setIsTransitionOverlayVisible(false);
          });
        });
      });
    });
  }, [activeTab, chromeOpacity, reduceMotion, screenOpacity, screenScale, transitionOverlayOpacity]);

  return (
    <View style={styles.container}>
      {/* Arthur: NarIyirm
          中文：内容层是导航栏的模糊目标；导航栏在它之后渲染才能获得真实毛玻璃效果。
          EN: This content layer is the blur target; it renders before the bar for a real glass effect. */}
      <BlurTargetView ref={blurTargetRef} style={styles.content}>
        <Animated.View
          style={[
            styles.screenStage,
            activeTab === 'home' ? styles.homeContent : styles.standardContent,
            { opacity: screenOpacity, transform: [{ scale: screenScale }] },
          ]}
        >
          {activeTab === 'home' && canMountKitchen ? (
            <Suspense fallback={<KitchenLoading />}>
              <Kitchen3DPrototype
                onInteractionStart={beginCinematicFocus}
                onNavigate={handleCinematicNavigate}
                onReady={markKitchenReady}
              />
            </Suspense>
          ) : activeTab === 'home' && !isOpening ? (
            <KitchenLoading />
          ) : activeTab !== 'home' ? (
            <>
              <View style={[styles.glow, activeTab === 'fridge' && styles.glowCool]} />
              <Text style={styles.greeting}>KITCHMEMO</Text>
              <View style={styles.screenCopy}>
                <Text style={styles.eyebrow}>{screen.eyebrow}</Text>
                <Text style={styles.title}>{screen.title}</Text>
                <Text style={styles.description}>{screen.description}</Text>
                <Text style={styles.connection}>{status}</Text>
              </View>
            </>
          ) : null}
        </Animated.View>
      </BlurTargetView>
      {!isOpening && (
        <Animated.View
          pointerEvents={isCinematicActive ? 'none' : 'box-none'}
          style={[styles.chromeLayer, { opacity: chromeOpacity }]}
        >
          <FloatingTabBar activeTab={activeTab} onChange={setActiveTab} blurTarget={blurTargetRef} />
        </Animated.View>
      )}
      {isTransitionOverlayVisible ? (
        <Animated.View
          pointerEvents="auto"
          style={[styles.transitionOverlay, { backgroundColor: transitionTone, opacity: transitionOverlayOpacity }]}
        />
      ) : null}
      <StatusBar style="dark" />
      {isOpening && (
        <OpeningAnimation
          canReveal={canRevealKitchen}
          onSequenceComplete={completeOpeningSequence}
          onFinish={finishOpening}
        />
      )}
    </View>
  );
}

function KitchenLoading() {
  return (
    <View style={styles.kitchenLoading}>
      <ActivityIndicator size="small" color="#D47B21" />
      <Text style={styles.kitchenLoadingText}>正在准备 3D 厨房…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4EE' },
  content: { flex: 1, overflow: 'hidden' },
  screenStage: { flex: 1, overflow: 'hidden' },
  homeContent: { paddingHorizontal: 0, paddingTop: 0 },
  standardContent: { paddingHorizontal: 24, paddingTop: 82 },
  chromeLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
  transitionOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
  glow: { position: 'absolute', top: -120, right: -70, width: 310, height: 310, borderRadius: 180, backgroundColor: '#F6CC83', opacity: 0.5 },
  glowCool: { backgroundColor: '#9FD7D7' },
  greeting: { color: '#6C786F', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  screenCopy: { marginTop: 82 },
  eyebrow: { color: '#D47B21', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { maxWidth: 290, marginTop: 12, color: '#183D32', fontSize: 38, fontWeight: '700', lineHeight: 42, letterSpacing: -1.4 },
  description: { maxWidth: 285, marginTop: 16, color: '#64736A', fontSize: 16, lineHeight: 23 },
  connection: { marginTop: 24, color: '#7E8A83', fontSize: 12 },
  kitchenLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#D8EFF0' },
  kitchenLoadingText: { color: '#46645D', fontSize: 13, fontWeight: '600' },
});
