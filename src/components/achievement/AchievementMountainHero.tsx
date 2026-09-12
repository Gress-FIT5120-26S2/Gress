import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { AchievementDashboard, AchievementLevelCode } from '../../services/achievementApi';

type Language = 'zh' | 'en';

type HeroCopy = {
  levels: Record<AchievementLevelCode, string>;
  level: {
    progress: (remaining: number) => string;
    maxLevel: (xp: number) => string;
    xp: string;
    rescues: string;
  };
  hero: {
    rescuedValue: string;
    mountains: Record<AchievementLevelCode, { name: string; elevation: string }>;
    aboveCurrent: string;
    currentProgress: (remaining: number) => string;
    lockedProgress: (remaining: number) => string;
    accessibilitySummary: (viewedLevel: number, currentLevel: number, levelName: string, xp: number, rescues: number, rescuedValue: string) => string;
    viewLevel: (level: number, levelName: string) => string;
  };
};

type AchievementMountainHeroProps = {
  copy: HeroCopy;
  dashboard: AchievementDashboard;
  language: Language;
  onTailColorChange?: (color: string) => void;
  rescuedValue: string;
};

type LevelVisual = {
  colors: readonly [string, string, string];
  image: ImageSource;
  imageScale: number;
};

const LEVEL_VISUALS: Record<AchievementLevelCode, LevelVisual> = {
  rocky_seedling: { colors: ['#24B2F2', '#249FE8', '#60C7F5'], image: require('../../assets/achievements/mountain-lv1.png'), imageScale: 1.04 },
  polar_guardian: { colors: ['#3C9CF3', '#418EE3', '#6CC6F2'], image: require('../../assets/achievements/mountain-lv2.png'), imageScale: 1.02 },
  cloud_saver: { colors: ['#2E96EF', '#3187E3', '#61BAF4'], image: require('../../assets/achievements/mountain-lv3.png'), imageScale: 1.02 },
  snowline_steward: { colors: ['#20A6C4', '#2793B7', '#67C3D5'], image: require('../../assets/achievements/mountain-lv4.png'), imageScale: 1.04 },
  climate_summit: { colors: ['#20156E', '#30209A', '#5642B8'], image: require('../../assets/achievements/mountain-lv5.png'), imageScale: 1.06 },
};

const HERO_MAX_WIDTH = 560;
const SWIPE_DISTANCE = 42;
const SWIPE_AXIS_RATIO = 1.2;
const CLOUD_BACK = require('../../assets/achievements/cloud-back.png');
const CLOUD_FRONT = require('../../assets/achievements/cloud-front.png');

// Arthur: NarIyirm
// 中文：山峰、路线和数据文案分层渲染；本地预览只切换服务端目录中的视觉定义，不改变权威等级或重新计算规则。
// EN: Mountain art, route, and data copy render as separate layers; local preview only swaps visual definitions from the server catalog without changing the authoritative level or recalculating rules.
export function AchievementMountainHero({ copy, dashboard, language, onTailColorChange, rescuedValue }: AchievementMountainHeroProps) {
  const { width } = useWindowDimensions();
  const reducedMotion = usePrefersReducedMotion();
  const { backCloudProgress, frontCloudProgress } = useCloudMotion(reducedMotion);
  const entrance = useRef(new Animated.Value(1)).current;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const transitionDirection = useRef(0);
  const [viewedLevel, setViewedLevel] = useState(dashboard.level.current);
  const viewedDefinition = dashboard.levelCatalog.find((definition) => definition.level === viewedLevel) ?? dashboard.levelCatalog[dashboard.level.current - 1];
  const viewedCode = viewedDefinition?.code ?? dashboard.level.code;
  const levelVisual = LEVEL_VISUALS[viewedCode];
  const mountain = copy.hero.mountains[viewedCode];
  const levelName = copy.levels[viewedCode];
  const nextXp = dashboard.level.nextLevelMinimumXp === null ? 0 : Math.max(0, dashboard.level.nextLevelMinimumXp - dashboard.level.totalXp);
  const viewedMinimumXp = viewedDefinition?.minimumXp ?? dashboard.level.currentLevelMinimumXp;
  const levelStatus = viewedLevel < dashboard.level.current
    ? copy.hero.aboveCurrent
    : viewedLevel > dashboard.level.current
      ? copy.hero.lockedProgress(Math.max(0, viewedMinimumXp - dashboard.level.totalXp))
      : dashboard.level.isMaxLevel
        ? copy.level.maxLevel(dashboard.level.totalXp)
        : copy.hero.currentProgress(nextXp);
  const previousLevel = viewedLevel > 1 ? viewedLevel - 1 : null;
  const nextLevel = viewedLevel < dashboard.levelCatalog.length ? viewedLevel + 1 : null;
  const heroWidth = Math.min(width, HERO_MAX_WIDTH);
  const heroHeight = Math.max(430, Math.min(476, heroWidth * 1.14));

  useEffect(() => {
    onTailColorChange?.(levelVisual.colors[2]);
  }, [levelVisual.colors, onTailColorChange]);

  useEffect(() => {
    entrance.stopAnimation();
    entrance.setValue(reducedMotion ? 1 : 0);
    if (!reducedMotion) {
      const animation = Animated.timing(entrance, {
        duration: 240,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        toValue: 1,
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }
  }, [entrance, reducedMotion, viewedLevel]);

  const viewLevel = (level: number) => {
    if (level === viewedLevel) return;
    transitionDirection.current = level > viewedLevel ? 1 : -1;
    entrance.stopAnimation();
    entrance.setValue(reducedMotion ? 1 : 0);
    setViewedLevel(level);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  // Arthur: NarIyirm
  // 中文：仅在触摸结束时判断明显的水平滑动，纵向页面滚动仍交给外层 ScrollView；预览始终限制在服务端返回的等级目录内。
  // EN: Resolve only a deliberate horizontal swipe on release so the parent ScrollView keeps vertical control; previews remain bounded by the server-provided level catalog.
  const rememberSwipeStart = (event: GestureResponderEvent) => {
    swipeStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
  };

  const finishSwipe = (event: GestureResponderEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;

    const deltaX = event.nativeEvent.pageX - start.x;
    const deltaY = event.nativeEvent.pageY - start.y;
    if (Math.abs(deltaX) < SWIPE_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_AXIS_RATIO) return;

    if (deltaX < 0 && nextLevel !== null) viewLevel(nextLevel);
    if (deltaX > 0 && previousLevel !== null) viewLevel(previousLevel);
  };

  const mountainStyle = {
    opacity: entrance,
    transform: [
      { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
      { translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [transitionDirection.current * 22, 0] }) },
      { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.965, levelVisual.imageScale] }) },
    ],
  };
  const routeStyle = {
    opacity: entrance.interpolate({ inputRange: [0, 0.32, 1], outputRange: [0, 0, 1] }),
    transform: [
      { translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [transitionDirection.current * 14, 0] }) },
      { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };
  const contentStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
  const cloudTransitionStyle = {
    opacity: entrance.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] }),
    transform: [{ translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [transitionDirection.current * 12, 0] }) }],
  };
  const backCloudStyle = {
    opacity: backCloudProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.34, 0.46, 0.34] }),
    transform: [
      { translateX: backCloudProgress.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] }) },
      { scale: backCloudProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.01, 1.035, 1.01] }) },
    ],
  };
  const frontCloudStyle = {
    opacity: frontCloudProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.42, 0.56, 0.42] }),
    transform: [
      { translateX: frontCloudProgress.interpolate({ inputRange: [0, 1], outputRange: [24, -24] }) },
      { scale: frontCloudProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.015, 1.04, 1.015] }) },
    ],
  };

  return (
    <View
      onTouchCancel={() => { swipeStart.current = null; }}
      onTouchEnd={finishSwipe}
      onTouchStart={rememberSwipeStart}
      style={[styles.heroFrame, { height: heroHeight }]}
    >
      <LinearGradient colors={levelVisual.colors} end={{ x: 0.5, y: 1 }} locations={[0, 0.58, 1]} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />

      <Animated.View
        accessibilityLabel={copy.hero.accessibilitySummary(viewedLevel, dashboard.level.current, levelName, dashboard.level.totalXp, dashboard.metrics.rescuedBatchCount, rescuedValue)}
        accessible
        pointerEvents="none"
        style={[styles.heading, contentStyle]}
      >
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.levelTitle}>Lv.{viewedLevel} {levelName}</Text>
        <Text numberOfLines={1} style={styles.levelSubtitle}>{levelStatus}</Text>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.levelPager}>
          {dashboard.levelCatalog.map((definition) => (
            <View key={definition.code} style={[styles.levelPagerDot, definition.level === viewedLevel && styles.levelPagerDotActive]} />
          ))}
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.mountainLabel, contentStyle]}>
        <Text numberOfLines={1} style={styles.mountainName}>{mountain.name}</Text>
        <Text style={styles.mountainElevation}>{mountain.elevation}</Text>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.cloudBackLayer, cloudTransitionStyle]}>
        <Animated.View style={[styles.cloudFill, backCloudStyle]}>
          <Image accessible={false} contentFit="cover" priority="high" source={CLOUD_BACK} style={styles.cloudImage} />
        </Animated.View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.mountainLayer, mountainStyle]}>
        <Image accessible={false} cachePolicy="memory" contentFit="contain" priority="high" source={levelVisual.image} style={styles.mountainImage} transition={reducedMotion ? 0 : 180} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.cloudFrontLayer, cloudTransitionStyle]}>
        <Animated.View style={[styles.cloudFill, frontCloudStyle]}>
          <Image accessible={false} contentFit="cover" priority="high" source={CLOUD_FRONT} style={styles.cloudImage} />
        </Animated.View>
      </Animated.View>

      <Animated.View pointerEvents="box-none" style={[styles.routeLayer, routeStyle]}>
        <Svg height="100%" pointerEvents="none" preserveAspectRatio="none" viewBox="0 0 390 520" width="100%">
          <Path d="M 10 292 L 195 364 L 380 292" fill="none" opacity={0.18} stroke="#FFFFFF" strokeLinecap="round" strokeWidth={9} />
          <Path d="M 10 292 L 195 364 L 380 292" fill="none" opacity={0.86} stroke="rgba(255,255,255,0.96)" strokeLinecap="round" strokeWidth={2.4} />
        </Svg>
        {previousLevel !== null ? (
          <LevelNode
            accessibilityLabel={copy.hero.viewLevel(previousLevel, copy.levels[dashboard.levelCatalog[previousLevel - 1].code])}
            label={`Lv.${previousLevel}`}
            onPress={() => viewLevel(previousLevel)}
            position="previous"
          />
        ) : null}
        <LevelNode current label={`Lv.${viewedLevel}`} position="current" />
        {nextLevel !== null ? (
          <LevelNode
            accessibilityLabel={copy.hero.viewLevel(nextLevel, copy.levels[dashboard.levelCatalog[nextLevel - 1].code])}
            label={`Lv.${nextLevel}`}
            onPress={() => viewLevel(nextLevel)}
            position="next"
          />
        ) : null}
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.metrics, contentStyle]}>
        <HeroMetric label={copy.level.xp} value={dashboard.level.totalXp.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-AU')} />
        <View style={styles.metricDivider} />
        <HeroMetric label={copy.level.rescues} value={dashboard.metrics.rescuedBatchCount.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-AU')} />
        <View style={styles.metricDivider} />
        <HeroMetric label={copy.hero.rescuedValue} value={rescuedValue} />
      </Animated.View>
    </View>
  );
}

// Arthur: NarIyirm
// 中文：先按“减少动态效果”处理，读取系统偏好后再决定是否播放；这样首帧不会违背用户的辅助功能设置。
// EN: Default to reduced motion, then decide whether to animate after reading the system preference so the first frame never violates accessibility settings.
function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

// Arthur: NarIyirm
// 中文：前后云层使用独立的原生驱动循环形成错速景深；减少动态效果开启时停在中点，并在卸载时停止循环。
// EN: Independent native-driven loops give the cloud layers parallax depth; reduced motion holds both at rest and unmounting stops every loop.
function useCloudMotion(reducedMotion: boolean) {
  const backCloudProgress = useRef(new Animated.Value(0.5)).current;
  const frontCloudProgress = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    backCloudProgress.stopAnimation();
    frontCloudProgress.stopAnimation();
    backCloudProgress.setValue(0.5);
    frontCloudProgress.setValue(0.5);
    if (reducedMotion) return;

    const cloudEase = Easing.bezier(0.42, 0, 0.58, 1);
    const backLoop = Animated.loop(Animated.sequence([
      Animated.timing(backCloudProgress, { duration: 6500, easing: cloudEase, isInteraction: false, toValue: 1, useNativeDriver: true }),
      Animated.timing(backCloudProgress, { duration: 13000, easing: cloudEase, isInteraction: false, toValue: 0, useNativeDriver: true }),
      Animated.timing(backCloudProgress, { duration: 6500, easing: cloudEase, isInteraction: false, toValue: 0.5, useNativeDriver: true }),
    ]), { resetBeforeIteration: false });
    const frontLoop = Animated.loop(Animated.sequence([
      Animated.timing(frontCloudProgress, { duration: 5000, easing: cloudEase, isInteraction: false, toValue: 0, useNativeDriver: true }),
      Animated.timing(frontCloudProgress, { duration: 10000, easing: cloudEase, isInteraction: false, toValue: 1, useNativeDriver: true }),
      Animated.timing(frontCloudProgress, { duration: 5000, easing: cloudEase, isInteraction: false, toValue: 0.5, useNativeDriver: true }),
    ]), { resetBeforeIteration: false });

    backLoop.start();
    frontLoop.start();
    return () => {
      backLoop.stop();
      frontLoop.stop();
    };
  }, [backCloudProgress, frontCloudProgress, reducedMotion]);

  return { backCloudProgress, frontCloudProgress };
}

function LevelNode({ accessibilityLabel, current = false, label, onPress, position }: { accessibilityLabel?: string; current?: boolean; label: string; onPress?: () => void; position: 'previous' | 'current' | 'next' }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: current }}
      disabled={!onPress}
      hitSlop={8}
      onPress={onPress}
      pressRetentionOffset={12}
      style={({ pressed }) => [styles.node, styles[`${position}Node`], current && styles.currentNode, pressed && styles.nodePressed]}
    >
      <LinearGradient
        colors={current ? ['#FFFFFF', '#EAF1F8', '#C7D5E5'] : ['rgba(255,255,255,0.98)', 'rgba(224,234,243,0.96)']}
        end={{ x: 0.8, y: 1 }}
        start={{ x: 0.16, y: 0.08 }}
        style={styles.nodeSurface}
      >
        <Text style={[styles.nodeText, current && styles.currentNodeText]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.metricValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroFrame: { alignSelf: 'center', width: '100%', maxWidth: HERO_MAX_WIDTH, overflow: 'hidden', backgroundColor: '#2798E7' },
  heading: { position: 'absolute', zIndex: 5, top: 52, right: 22, left: 22, alignItems: 'center' },
  levelTitle: { maxWidth: '100%', color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.35, textAlign: 'center', textShadowColor: 'rgba(20,76,130,0.18)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  levelSubtitle: { marginTop: 6, color: 'rgba(255,255,255,0.78)', fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  levelPager: { height: 10, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  levelPagerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.38)' },
  levelPagerDotActive: { width: 16, backgroundColor: 'rgba(255,255,255,0.94)' },
  mountainLabel: { position: 'absolute', zIndex: 6, top: 128, left: 20, maxWidth: 142 },
  mountainName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(13,62,104,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  mountainElevation: { marginTop: 4, color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '600' },
  cloudBackLayer: { position: 'absolute', zIndex: 1, top: 156, right: -34, left: -34, height: 126, overflow: 'hidden' },
  cloudFrontLayer: { position: 'absolute', zIndex: 3, top: 226, right: -46, left: -46, height: 142, overflow: 'hidden' },
  cloudFill: { flex: 1 },
  cloudImage: { width: '100%', height: '100%' },
  mountainLayer: { position: 'absolute', zIndex: 2, top: 116, right: -18, left: -18, height: 238 },
  mountainImage: { width: '100%', height: '100%' },
  routeLayer: { position: 'absolute', zIndex: 4, top: 0, right: 0, bottom: 0, left: 0 },
  node: { position: 'absolute', width: 50, height: 50, borderRadius: 25, shadowColor: '#164A80', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  nodeSurface: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.84)', overflow: 'hidden' },
  nodePressed: { transform: [{ scale: 0.96 }], opacity: 0.88 },
  previousNode: { top: '52%', left: '17%' },
  nextNode: { top: '52%', right: '17%' },
  currentNode: { top: '63%', left: '50%', width: 64, height: 64, marginLeft: -32, borderRadius: 32, shadowOpacity: 0.28, shadowRadius: 11, elevation: 6 },
  nodeText: { color: '#27416A', fontSize: 12.5, fontWeight: '800', letterSpacing: -0.15 },
  currentNodeText: { fontSize: 15.5, fontWeight: '900' },
  metrics: { position: 'absolute', zIndex: 7, right: 18, bottom: 22, left: 18, minHeight: 50, flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 3 },
  metricValue: { width: '100%', color: '#FFFFFF', fontSize: 18.5, fontWeight: '800', letterSpacing: -0.35, textAlign: 'center', fontVariant: ['tabular-nums'] },
  metricLabel: { marginTop: 3, color: 'rgba(255,255,255,0.72)', fontSize: 9.5, fontWeight: '600', textAlign: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: 'rgba(255,255,255,0.22)' },
});
