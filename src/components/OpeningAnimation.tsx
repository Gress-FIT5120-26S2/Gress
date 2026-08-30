import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ComponentProps } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';

type OpeningAnimationProps = {
  canReveal: boolean;
  onSequenceComplete: () => void;
  onFinish: () => void;
};

type OrbitItem = {
  name: ComponentProps<typeof MaterialCommunityIcons>['name'];
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const LAUNCH_START_DELAY = 380;
const LAUNCH_STAGGER = 560;
const LAUNCH_DURATION = 1400;
const ORBIT_DURATION = 7600;
const ORBIT_SAMPLE_COUNT = 32;
const ORBIT_ITEMS: OrbitItem[] = [
  { name: 'silverware-fork-knife' },
  { name: 'pot-steam-outline' },
  { name: 'food-apple-outline' },
  { name: 'leaf' },
  { name: 'carrot' },
  { name: 'chef-hat' },
  { name: 'bread-slice-outline' },
];
// Arthur: NarIyirm
// 中文：所有食材共享同一个连续轨道时钟和等角度基准，落轨后天然保持固定间距。
// EN: Every ingredient shares one continuous orbit clock and equal-angle baseline, so spacing stays fixed after joining.
const ORBIT_BASE_ANGLES = ORBIT_ITEMS.map((_, index) => (index / ORBIT_ITEMS.length) * Math.PI * 2 - Math.PI / 2);

function OrbitIcon({ item, index, launchPhase, orbitPhase }: { item: OrbitItem; index: number; launchPhase: Animated.Value; orbitPhase: Animated.Value }) {
  const launchProgress = launchPhase;
  const launchOpacity = launchProgress.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] });
  const launchScale = launchProgress.interpolate({ inputRange: [0, 0.74, 1], outputRange: [0.78, 1.16, 1] });
  const orbitStartAngle = ORBIT_BASE_ANGLES[index];
  const targetPosition = { x: Math.cos(orbitStartAngle) * 94, y: Math.sin(orbitStartAngle) * 94 };
  const tangentBend = { x: -targetPosition.y * 0.24, y: targetPosition.x * 0.24 };
  const curvedMidpoint = { x: targetPosition.x * 0.55 + tangentBend.x, y: targetPosition.y * 0.55 + tangentBend.y };
  // Arthur: NarIyirm
  // 中文：用更密的圆周采样代替八边形轨迹，避免图标经过折点时产生上下跳动感。
  // EN: Densely sample the circle instead of tracing an octagon, preventing vertical jolts at segment corners.
  const orbitPhaseInput = Array.from({ length: ORBIT_SAMPLE_COUNT + 1 }, (_, step) => step / ORBIT_SAMPLE_COUNT);
  const orbitXOutput = orbitPhaseInput.map((step) => Math.cos(orbitStartAngle + step * Math.PI * 2) * 94);
  const orbitYOutput = orbitPhaseInput.map((step) => Math.sin(orbitStartAngle + step * Math.PI * 2) * 94);
  const orbitX = orbitPhase.interpolate({ inputRange: orbitPhaseInput, outputRange: orbitXOutput });
  const orbitY = orbitPhase.interpolate({ inputRange: orbitPhaseInput, outputRange: orbitYOutput });
  const launchX = launchProgress.interpolate({ inputRange: [0, 0.48, 1], outputRange: [0, curvedMidpoint.x, targetPosition.x] });
  const launchY = launchProgress.interpolate({ inputRange: [0, 0.48, 1], outputRange: [0, curvedMidpoint.y, targetPosition.y] });
  // 中文：喷射完成前保留弯曲路径，完成后无缝切换到同一轨道的圆周坐标。
  // EN: Keep the curved launch path until settling, then hand off seamlessly to the shared circular track.
  const positionX = Animated.add(launchX, Animated.multiply(Animated.subtract(orbitX, targetPosition.x), launchProgress));
  const positionY = Animated.add(launchY, Animated.multiply(Animated.subtract(orbitY, targetPosition.y), launchProgress));

  return (
    <Animated.View
      style={[
        styles.orbitItem,
        {
          opacity: launchOpacity,
          transform: [
            { translateX: positionX },
            { translateY: positionY },
            { scale: launchScale },
          ],
        },
      ]}
    >
      <MaterialCommunityIcons color="rgba(255, 246, 225, 0.77)" name={item.name} size={25} />
    </Animated.View>
  );
}

function LoadingDot({ index, phase, reveal }: { index: number; phase: Animated.Value; reveal: Animated.AnimatedInterpolation<number> }) {
  const dotOffset = Animated.modulo(Animated.add(phase, index / 3), 1);
  const dotOpacity = dotOffset.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.38, 1, 0.38] });
  const dotScale = dotOffset.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.72, 1.28, 0.72] });
  const dotTranslateY = dotOffset.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, -4, 1] });

  return <Animated.View style={[styles.dot, { opacity: Animated.multiply(reveal, dotOpacity), transform: [{ translateY: dotTranslateY }, { scale: dotScale }] }]} />;
}

function LoadingDots({ progress, phase }: { progress: Animated.Value; phase: Animated.Value }) {
  const reveal = progress.interpolate({ inputRange: [1560, 1840], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[
        styles.loadingDots,
        {
          opacity: reveal,
          transform: [{ translateY: progress.interpolate({ inputRange: [1560, 1840], outputRange: [6, 0], extrapolate: 'clamp' }) }],
        },
      ]}
    >
      <LoadingDot index={0} phase={phase} reveal={reveal} />
      <LoadingDot index={1} phase={phase} reveal={reveal} />
      <LoadingDot index={2} phase={phase} reveal={reveal} />
    </Animated.View>
  );
}

export function OpeningAnimation({ canReveal, onSequenceComplete, onFinish }: OpeningAnimationProps) {
  const { t } = useI18n();
  const progress = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const launchPhases = useRef(ORBIT_ITEMS.map(() => new Animated.Value(0))).current;
  const orbitPhase = useRef(new Animated.Value(0)).current;
  const loadingPhase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;

    const start = async () => {
      const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (cancelled) return;

      // Arthur: NarIyirm
      // 中文：这是一次性的启动过场，没有手势；使用原生驱动仅传递透明度和变换，可避开 Expo Go 的 Worklets 启动错误。
      // EN: This is a one-off, non-gesture opener; native-driven opacity and transforms avoid Expo Go Worklets startup failures.
      if (reducedMotion) {
        progress.setValue(1900);
        launchPhases.forEach((phase) => phase.setValue(1));
        completionTimer = setTimeout(onSequenceComplete, 180);
        return;
      }

      Animated.timing(progress, { toValue: 1900, duration: 1900, easing: EASE_OUT, useNativeDriver: true }).start();
      // Arthur: NarIyirm
      // 中文：食材独立发射；第一个落轨时启动唯一的主轨道时钟，后续食材在飞行中追踪正在移动的等间隔落点。
      // EN: Ingredients launch independently; the first landing starts one master clock, and later launches track moving, equally spaced destinations.
      launchPhases.forEach((launchPhase, index) => {
        const launchDelay = LAUNCH_START_DELAY + index * LAUNCH_STAGGER;
        Animated.sequence([
          Animated.delay(launchDelay),
          Animated.timing(launchPhase, { toValue: 1, duration: LAUNCH_DURATION, easing: EASE_OUT, useNativeDriver: true }),
        ]).start();
      });
      Animated.sequence([
        Animated.delay(LAUNCH_START_DELAY + LAUNCH_DURATION),
        Animated.loop(Animated.timing(orbitPhase, { toValue: 1, duration: ORBIT_DURATION, easing: Easing.linear, useNativeDriver: true })),
      ]).start();
      Animated.sequence([
        Animated.delay(1520),
        Animated.loop(Animated.timing(loadingPhase, { toValue: 1, duration: 1050, easing: Easing.inOut(Easing.ease), useNativeDriver: true })),
      ]).start();
      completionTimer = setTimeout(onSequenceComplete, LAUNCH_START_DELAY + (ORBIT_ITEMS.length - 1) * LAUNCH_STAGGER + LAUNCH_DURATION + 120);
    };

    void start();
    return () => {
      cancelled = true;
      progress.stopAnimation();
      launchPhases.forEach((phase) => phase.stopAnimation());
      orbitPhase.stopAnimation();
      loadingPhase.stopAnimation();
      if (completionTimer) clearTimeout(completionTimer);
    };
  }, [launchPhases, loadingPhase, onSequenceComplete, orbitPhase, progress]);

  useEffect(() => {
    if (!canReveal) return;

    // Arthur: NarIyirm
    // 中文：厨房首帧就绪后才淡出橙色启动层，确保用户不会看到 3D 画布的加载空白。
    // EN: Fade the orange opener only after the kitchen's first frame is ready, avoiding a blank 3D canvas.
    AccessibilityInfo.isReduceMotionEnabled().then((reducedMotion) => {
      Animated.timing(overlayOpacity, { toValue: 0, duration: reducedMotion ? 140 : 280, easing: EASE_OUT, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onFinish();
      });
    });

    return () => overlayOpacity.stopAnimation();
  }, [canReveal, onFinish, overlayOpacity]);

  const emblemStyle = {
    opacity: progress.interpolate({ inputRange: [220, 620], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [220, 620], outputRange: [14, 0], extrapolate: 'clamp' }) },
      { scale: progress.interpolate({ inputRange: [220, 620], outputRange: [0.93, 1], extrapolate: 'clamp' }) },
    ],
  };
  const haloStyle = {
    opacity: progress.interpolate({ inputRange: [240, 700], outputRange: [0, 0.27], extrapolate: 'clamp' }),
    transform: [{ scale: progress.interpolate({ inputRange: [240, 700], outputRange: [0.78, 1.16], extrapolate: 'clamp' }) }],
  };
  const wordmarkStyle = {
    opacity: progress.interpolate({ inputRange: [1060, 1420], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: progress.interpolate({ inputRange: [1060, 1420], outputRange: [12, 0], extrapolate: 'clamp' }) }],
  };

  return (
    <Animated.View pointerEvents="auto" style={[styles.overlay, { opacity: overlayOpacity }]}>
      <LinearGradient colors={['#FFA832', '#FF7559']} end={{ x: 0.92, y: 1 }} start={{ x: 0.08, y: 0 }} style={StyleSheet.absoluteFill} />
      <View accessible accessibilityLabel={`KitchMemo. ${t.opening.tagline}`} style={styles.content}>
        <View style={styles.orbit}>
          {ORBIT_ITEMS.map((item, index) => <OrbitIcon index={index} item={item} key={item.name} launchPhase={launchPhases[index]} orbitPhase={orbitPhase} />)}
          <Animated.View style={[styles.halo, haloStyle]} />
          <Animated.View style={[styles.emblem, emblemStyle]}>
            <View style={styles.emblemInset}>
              <MaterialCommunityIcons color="#FF8B35" name="fridge-outline" size={48} />
              <View style={styles.emblemCheck}><MaterialCommunityIcons color="#FFFFFF" name="check" size={13} /></View>
            </View>
          </Animated.View>
        </View>
        <Animated.View style={[styles.wordmark, wordmarkStyle]}>
          <Text style={styles.brand}>KitchMemo</Text>
          <Text style={styles.tagline}>{t.opening.tagline}</Text>
        </Animated.View>
        <LoadingDots phase={loadingPhase} progress={progress} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  orbit: { width: 280, height: 250, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 122, height: 122, borderRadius: 61, backgroundColor: '#FFE8BA' },
  emblem: { zIndex: 2, width: 94, height: 94, borderRadius: 47, padding: 5, backgroundColor: 'rgba(255, 255, 255, 0.34)' },
  emblemInset: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 42, backgroundColor: '#FFFFFF' },
  emblemCheck: { position: 'absolute', right: 13, bottom: 14, width: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFAA32' },
  orbitItem: { position: 'absolute', left: 127, top: 112 },
  wordmark: { alignItems: 'center', marginTop: 7 },
  brand: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -1.1 },
  tagline: { marginTop: 7, color: 'rgba(255, 249, 236, 0.88)', fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  loadingDots: { position: 'absolute', bottom: 82, flexDirection: 'row', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.94)' },
});
