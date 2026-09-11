import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';

type PetDock = 'left' | 'right' | 'top';
type StoredPetPosition = { side: PetDock; yRatio: number; xRatio?: number };
type Point = { x: number; y: number };
type SpooniePetEntryProps = { activitySignal: number; onOpen: () => void; visible: boolean };

const POSITION_KEY = 'kitchmemo.spoonie.pet-position.v1';
const PET_SIZE = 96;
const PET_HEIGHT = 104;
const PEEK_VISIBLE = 48;
const TOP_PEEK_VISIBLE = 52;
const IDLE_EDGE_OFFSET = PET_SIZE - PEEK_VISIBLE;
const ACTIVE_EDGE_GAP = 10;
const IDLE_DELIGHT_DELAY_MS = 18_000;
const BUBBLE_WIDTH = 214;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function playDockHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

// Arthur: NarIyirm
// 中文：角色保留在 RN 原生驱动动画上，避免额外 GL 场景和 Worklets 初始化影响 Expo Go；拖动位置只在松手后持久化。
// EN: The character stays on native-driven RN animation to avoid another GL scene and Worklets startup in Expo Go; drag position persists only on release.
export function SpooniePetEntry({ activitySignal, onOpen, visible }: SpooniePetEntryProps) {
  const { t } = useI18n();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [side, setSide] = useState<PetDock>('right');
  const [showGreeting, setShowGreeting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const openingRef = useRef(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const interactionAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasMovedRef = useRef(false);
  const isDockingRef = useRef(false);
  const delightingRef = useRef(false);
  const draggingRef = useRef(false);

  const rightDockX = width - PEEK_VISIBLE;
  const leftDockX = PEEK_VISIBLE - PET_SIZE;
  const rightActiveX = width - PET_SIZE - ACTIVE_EDGE_GAP;
  const leftActiveX = ACTIVE_EDGE_GAP;
  const minY = insets.top + 70;
  const maxY = Math.max(minY, height - insets.bottom - 116 - PET_HEIGHT);
  const topDockY = insets.top + TOP_PEEK_VISIBLE - PET_HEIGHT;
  const topActiveY = insets.top + ACTIVE_EDGE_GAP;
  const minTopX = ACTIVE_EDGE_GAP;
  const maxTopX = Math.max(minTopX, width - PET_SIZE - ACTIVE_EDGE_GAP);

  const initialPosition = { x: rightDockX, y: height * 0.43 };
  const position = useRef(new Animated.ValueXY(initialPosition)).current;
  const currentPositionRef = useRef<Point>(initialPosition);
  const dragStartRef = useRef<Point>(initialPosition);
  const bob = useRef(new Animated.Value(0)).current;
  const edgeBreath = useRef(new Animated.Value(0)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const depth = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const anchorFor = useCallback((dock: PetDock, point: Point) => (
    dock === 'top' ? clamp(point.x, minTopX, maxTopX) : clamp(point.y, minY, maxY)
  ), [maxTopX, maxY, minTopX, minY]);

  const dockPointFor = useCallback((dock: PetDock, anchor: number): Point => {
    if (dock === 'top') return { x: clamp(anchor, minTopX, maxTopX), y: topDockY };
    return { x: dock === 'left' ? leftDockX : rightDockX, y: clamp(anchor, minY, maxY) };
  }, [leftDockX, maxTopX, maxY, minTopX, minY, rightDockX, topDockY]);

  const activePointFor = useCallback((dock: PetDock, anchor: number): Point => {
    if (dock === 'top') return { x: clamp(anchor, minTopX, maxTopX), y: topActiveY };
    return { x: dock === 'left' ? leftActiveX : rightActiveX, y: clamp(anchor, minY, maxY) };
  }, [leftActiveX, maxTopX, maxY, minTopX, minY, rightActiveX, topActiveY]);

  const persistPosition = useCallback((nextDock: PetDock, anchor: number) => {
    setSide(nextDock);
    const yRatio = nextDock === 'top' || maxY === minY ? 0.5 : (anchor - minY) / (maxY - minY);
    const xRatio = nextDock === 'top' && maxTopX !== minTopX ? (anchor - minTopX) / (maxTopX - minTopX) : undefined;
    const value: StoredPetPosition = { side: nextDock, yRatio: clamp(yRatio, 0, 1), xRatio: xRatio === undefined ? undefined : clamp(xRatio, 0, 1) };
    void AsyncStorage.setItem(POSITION_KEY, JSON.stringify(value)).catch(() => undefined);
  }, [maxTopX, maxY, minTopX, minY]);

  const stopMotion = useCallback(() => {
    idleAnimationRef.current?.stop();
    interactionAnimationRef.current?.stop();
    position.stopAnimation();
    bob.stopAnimation();
    edgeBreath.stopAnimation();
    jump.stopAnimation();
    tilt.stopAnimation();
    scale.stopAnimation();
    depth.stopAnimation();
    spin.stopAnimation();
  }, [bob, depth, edgeBreath, jump, position, scale, spin, tilt]);

  // Arthur: NarIyirm
  // 中文：点击先让勺勺从边缘转身跳入，再用现成的举手造型完成两次轻跳，最后才打开助手面板。
  // EN: A tap turns Spoonie out from the edge, performs two raised-hand hops with the existing pose, and only then opens the assistant panel.
  const openAfterGreeting = useCallback(() => {
    if (openingRef.current) return;
    openingRef.current = true;
    stopMotion();
    setShowGreeting(true);
    const anchor = anchorFor(side, currentPositionRef.current);
    const activeTarget = activePointFor(side, anchor);

    if (reducedMotion) {
      position.setValue(activeTarget);
      scale.setValue(1.02);
      depth.setValue(1);
    } else {
      interactionAnimationRef.current = Animated.parallel([
        Animated.spring(position, {
          toValue: activeTarget, damping: 15, stiffness: 210, mass: 0.82, useNativeDriver: true,
        }),
        Animated.timing(depth, { toValue: 1, duration: 190, easing: EASE_OUT, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(jump, { toValue: -15, duration: 150, easing: EASE_OUT, useNativeDriver: true }),
          Animated.spring(jump, { toValue: 0, damping: 10, stiffness: 240, mass: 0.62, useNativeDriver: true }),
          Animated.timing(jump, { toValue: -8, duration: 105, easing: EASE_OUT, useNativeDriver: true }),
          Animated.spring(jump, { toValue: 0, damping: 12, stiffness: 260, mass: 0.58, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(tilt, { toValue: side === 'right' ? -8 : 8, duration: 150, easing: EASE_OUT, useNativeDriver: true }),
          Animated.timing(tilt, { toValue: side === 'right' ? 4 : -4, duration: 170, easing: EASE_OUT, useNativeDriver: true }),
          Animated.spring(tilt, { toValue: 0, damping: 14, stiffness: 210, mass: 0.7, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.08, duration: 150, easing: EASE_OUT, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 230, mass: 0.65, useNativeDriver: true }),
        ]),
      ]);
      interactionAnimationRef.current.start();
    }

    playDockHaptic();
    openTimerRef.current = setTimeout(() => {
      setShowGreeting(false);
      openingRef.current = false;
      openTimerRef.current = null;
      onOpen();
    }, reducedMotion ? 220 : 820);
  }, [activePointFor, anchorFor, depth, jump, onOpen, position, reducedMotion, scale, side, stopMotion, tilt]);

  const returnToDock = useCallback((targetSide: PetDock, anchor: number) => {
    stopMotion();
    isDockingRef.current = true;
    setSide(targetSide);
    const activeTarget = activePointFor(targetSide, anchor);
    const dockTarget = dockPointFor(targetSide, anchor);

    if (reducedMotion) {
      position.setValue(dockTarget);
      scale.setValue(1);
      tilt.setValue(0);
      depth.setValue(0);
      isDockingRef.current = false;
      return;
    }

    // Arthur: NarIyirm
    // 中文：松手后先落到屏幕内侧，再收回成探头姿势，让“吸附”看起来像角色主动抓住边缘。
    // EN: Release lands just inside the screen before retreating to the peek pose, making docking feel like an intentional edge grab.
    interactionAnimationRef.current = Animated.sequence([
      Animated.parallel([
        Animated.spring(position, { toValue: activeTarget, damping: 16, stiffness: 190, mass: 0.9, useNativeDriver: true }),
        Animated.spring(tilt, { toValue: 0, damping: 16, stiffness: 210, mass: 0.75, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 16, stiffness: 220, mass: 0.7, useNativeDriver: true }),
        Animated.timing(depth, { toValue: 0.75, duration: 180, easing: EASE_OUT, useNativeDriver: true }),
      ]),
      Animated.delay(110),
      Animated.parallel([
        Animated.spring(position, { toValue: dockTarget, damping: 18, stiffness: 180, mass: 0.92, useNativeDriver: true }),
        Animated.timing(depth, { toValue: 0, duration: 240, easing: EASE_OUT, useNativeDriver: true }),
      ]),
    ]);
    interactionAnimationRef.current.start(() => { isDockingRef.current = false; });
  }, [activePointFor, depth, dockPointFor, position, reducedMotion, scale, stopMotion, tilt]);

  useEffect(() => {
    const xListener = position.x.addListener(({ value }) => { currentPositionRef.current.x = value; });
    const yListener = position.y.addListener(({ value }) => { currentPositionRef.current.y = value; });
    return () => {
      position.x.removeListener(xListener);
      position.y.removeListener(yListener);
    };
  }, [position]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (visible) return;
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
    openingRef.current = false;
    isDockingRef.current = false;
    setShowGreeting(false);
    stopMotion();
  }, [stopMotion, visible]);

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    stopMotion();
  }, [stopMotion]);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(POSITION_KEY).then((raw) => {
      if (!mounted || !raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredPetPosition>;
      if ((parsed.side !== 'left' && parsed.side !== 'right' && parsed.side !== 'top') || typeof parsed.yRatio !== 'number') return;
      const anchor = parsed.side === 'top'
        ? minTopX + clamp(parsed.xRatio ?? 0.5, 0, 1) * (maxTopX - minTopX)
        : minY + clamp(parsed.yRatio, 0, 1) * (maxY - minY);
      const restored = dockPointFor(parsed.side, anchor);
      setSide(parsed.side);
      currentPositionRef.current = restored;
      position.setValue(restored);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, [dockPointFor, maxTopX, maxY, minTopX, minY, position]);

  useEffect(() => {
    if (isDockingRef.current) return;
    const bounded = dockPointFor(side, anchorFor(side, currentPositionRef.current));
    currentPositionRef.current = bounded;
    position.setValue(bounded);
  }, [anchorFor, dockPointFor, position, side]);

  useEffect(() => {
    idleAnimationRef.current?.stop();
    bob.setValue(0);
    edgeBreath.setValue(0);
    if (!visible || reducedMotion || openingRef.current) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(2800),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bob, { toValue: side === 'top' ? 3 : -3, duration: 480, easing: EASE_OUT, useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 620, easing: EASE_OUT, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(edgeBreath, { toValue: 1, duration: 420, easing: EASE_OUT, useNativeDriver: true }),
          Animated.timing(edgeBreath, { toValue: 0, duration: 680, easing: EASE_OUT, useNativeDriver: true }),
        ]),
      ]),
    ]));
    idleAnimationRef.current = animation;
    animation.start();
    return () => animation.stop();
  }, [bob, edgeBreath, reducedMotion, side, visible]);

  // Arthur: NarIyirm
  // 中文：页面连续无输入十八秒后只表演一次短互动；任意新触摸会取消表演并从头计算等待时间。
  // EN: After eighteen seconds without page input, one short interaction plays; any new touch cancels it and restarts the wait.
  const playIdleDelight = useCallback(() => {
    if (!visible || reducedMotion || openingRef.current || isDockingRef.current || draggingRef.current) return;
    stopMotion();
    delightingRef.current = true;
    isDockingRef.current = true;
    const anchor = anchorFor(side, currentPositionRef.current);
    const activeTarget = activePointFor(side, anchor);
    const dockTarget = dockPointFor(side, anchor);

    interactionAnimationRef.current = Animated.sequence([
      Animated.parallel([
        Animated.spring(position, { toValue: activeTarget, damping: 15, stiffness: 205, mass: 0.84, useNativeDriver: true }),
        Animated.timing(depth, { toValue: 1, duration: 190, easing: EASE_OUT, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(spin, { toValue: 1, duration: 560, easing: EASE_IN_OUT, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(jump, { toValue: -10, duration: 180, easing: EASE_OUT, useNativeDriver: true }),
          Animated.spring(jump, { toValue: 0, damping: 12, stiffness: 230, mass: 0.64, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.07, duration: 170, easing: EASE_OUT, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, damping: 13, stiffness: 220, mass: 0.68, useNativeDriver: true }),
        ]),
      ]),
      Animated.delay(180),
      Animated.parallel([
        Animated.spring(position, { toValue: dockTarget, damping: 18, stiffness: 180, mass: 0.92, useNativeDriver: true }),
        Animated.timing(depth, { toValue: 0, duration: 240, easing: EASE_OUT, useNativeDriver: true }),
      ]),
    ]);
    interactionAnimationRef.current.start(() => {
      spin.setValue(0);
      delightingRef.current = false;
      isDockingRef.current = false;
    });
  }, [activePointFor, anchorFor, depth, dockPointFor, jump, position, reducedMotion, scale, side, spin, stopMotion, visible]);

  useEffect(() => {
    if (delightingRef.current) {
      stopMotion();
      const anchor = anchorFor(side, currentPositionRef.current);
      position.setValue(dockPointFor(side, anchor));
      depth.setValue(0);
      jump.setValue(0);
      scale.setValue(1);
      spin.setValue(0);
      delightingRef.current = false;
      isDockingRef.current = false;
    }
    if (!visible || reducedMotion) return undefined;
    const timer = setTimeout(playIdleDelight, IDLE_DELIGHT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [activitySignal, anchorFor, depth, dockPointFor, jump, playIdleDelight, position, reducedMotion, scale, side, spin, stopMotion, visible]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3,
    onPanResponderGrant: () => {
      stopMotion();
      draggingRef.current = true;
      hasMovedRef.current = false;
      const activeStart = activePointFor(side, anchorFor(side, currentPositionRef.current));
      dragStartRef.current = activeStart;
      Animated.parallel([
        Animated.spring(position, { toValue: activeStart, damping: 16, stiffness: 220, mass: 0.78, useNativeDriver: true }),
        Animated.timing(depth, { toValue: 1, duration: 160, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.06, duration: 120, easing: EASE_OUT, useNativeDriver: true }),
      ]).start();
    },
    onPanResponderMove: (_event, gestureState) => {
      if (!hasMovedRef.current) {
        hasMovedRef.current = true;
        position.stopAnimation();
      }
      position.setValue({
        x: clamp(dragStartRef.current.x + gestureState.dx, leftDockX, rightDockX),
        y: clamp(dragStartRef.current.y + gestureState.dy, topDockY, maxY),
      });
      tilt.setValue(clamp(gestureState.dx / 14, -11, 11));
    },
    onPanResponderRelease: (_event, gestureState) => {
      draggingRef.current = false;
      const moved = Math.hypot(gestureState.dx, gestureState.dy) > 8;
      if (!moved) {
        openAfterGreeting();
        return;
      }
      const releasedX = clamp(dragStartRef.current.x + gestureState.dx, leftDockX, rightDockX);
      const releasedY = clamp(dragStartRef.current.y + gestureState.dy, topDockY, maxY);
      const centreX = releasedX + PET_SIZE / 2;
      const centreY = releasedY + PET_HEIGHT / 2;
      // Arthur: NarIyirm
      // 中文：松手点按角色中心到三条可用边缘的距离选择停靠方向，底部因导航栏占用而不参与。
      // EN: Release selects the nearest of three available edges from the character centre; the tab bar reserves the bottom edge.
      const distances: Array<[PetDock, number]> = [
        ['left', centreX],
        ['right', width - centreX],
        ['top', Math.abs(centreY - insets.top)],
      ];
      const nextSide = distances.reduce((nearest, candidate) => candidate[1] < nearest[1] ? candidate : nearest)[0];
      const anchor = nextSide === 'top' ? clamp(releasedX, minTopX, maxTopX) : clamp(releasedY, minY, maxY);
      persistPosition(nextSide, anchor);
      returnToDock(nextSide, anchor);
      playDockHaptic();
    },
    onPanResponderTerminate: () => {
      draggingRef.current = false;
      returnToDock(side, anchorFor(side, currentPositionRef.current));
    },
    onPanResponderTerminationRequest: () => true,
  }), [activePointFor, anchorFor, depth, insets.top, leftDockX, maxTopX, maxY, minTopX, minY, openAfterGreeting, persistPosition, position, returnToDock, rightDockX, scale, side, stopMotion, tilt, topDockY, width]);

  const rotateZ = tilt.interpolate({ inputRange: [-11, 11], outputRange: ['-11deg', '11deg'] });
  const spinRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateY = depth.interpolate({
    inputRange: [0, 1],
    outputRange: side === 'top' ? ['0deg', '0deg'] : side === 'right' ? ['-13deg', '5deg'] : ['13deg', '-5deg'],
  });
  const rotateX = depth.interpolate({
    inputRange: [0, 1],
    outputRange: side === 'top' ? ['13deg', '-5deg'] : ['0deg', '0deg'],
  });
  const inwardBreathX = edgeBreath.interpolate({
    inputRange: [0, 1],
    outputRange: side === 'top' ? [0, 0] : side === 'right' ? [0, -5] : [0, 5],
  });
  const inwardBreathY = edgeBreath.interpolate({
    inputRange: [0, 1],
    outputRange: side === 'top' ? [0, 5] : [0, 0],
  });
  // Arthur: NarIyirm
  // 中文：深度值同时驱动探头与举手素材的交叉淡化，让姿势切换隐藏在转身和出场位移中。
  // EN: One depth value crossfades the peek and raised-hand sprites, hiding the pose swap inside the turn-and-emerge motion.
  const idleOpacity = depth.interpolate({ inputRange: [0, 0.58, 1], outputRange: [1, 0, 0] });
  const activeOpacity = depth.interpolate({ inputRange: [0, 0.42, 1], outputRange: [0, 1, 1] });
  const idleImageOffsetX = depth.interpolate({
    inputRange: [0, 1],
    outputRange: side === 'top' ? [0, 0] : side === 'right' ? [-IDLE_EDGE_OFFSET, 0] : [IDLE_EDGE_OFFSET, 0],
  });
  const shadowOpacity = depth.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] });
  const shadowScale = depth.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.08] });

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {showGreeting ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={[
            styles.greetingBubble,
            { left: side === 'top' ? -(BUBBLE_WIDTH - PET_SIZE) / 2 : side === 'right' ? -BUBBLE_WIDTH + PET_SIZE - 18 : PET_SIZE - 18 },
            side === 'top' && styles.greetingBubbleTop,
            { transform: [{ translateX: position.x }, { translateY: position.y }] },
          ]}
        >
          <Text style={styles.greetingText}>{t.fridge.assistant.petGreeting}</Text>
        </Animated.View>
      ) : null}
      <Animated.View
        {...panResponder.panHandlers}
        accessibilityActions={[{ name: 'activate' }]}
        accessibilityLabel={t.fridge.assistant.petA11y}
        accessibilityRole="button"
        accessible
        onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'activate') openAfterGreeting(); }}
        style={[
          styles.pet,
          {
            transform: [
              { translateX: position.x },
              { translateY: Animated.add(position.y, Animated.add(bob, jump)) },
              { translateX: inwardBreathX },
              { translateY: inwardBreathY },
              { perspective: 700 },
              { rotateX },
              { rotateY },
              { rotateZ },
              { rotateZ: spinRotate },
              { scale },
            ],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.groundShadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]}
        />
        <View pointerEvents="none" style={styles.rimLight} />
        <Animated.View
          pointerEvents="none"
          style={[styles.spriteLayer, { opacity: idleOpacity, transform: [{ translateX: idleImageOffsetX }] }]}
        >
          <Image
            cachePolicy="memory-disk"
            contentFit="contain"
            contentPosition={side === 'top' ? 'center' : 'right'}
            source={side === 'top'
              ? require('../../../assets/kitchmemo-assistant-top-peek-final.png')
              : require('../../../assets/kitchmemo-assistant-peek-tight.png')}
            style={[styles.image, side === 'left' && styles.imageLeft]}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.spriteLayer, { opacity: activeOpacity }]}>
          <Image
            cachePolicy="memory-disk"
            contentFit="contain"
            source={require('../../../assets/kitchmemo-assistant.png')}
            style={[styles.image, side === 'left' && styles.imageLeft]}
          />
        </Animated.View>
        <View
          pointerEvents="none"
          style={side === 'top'
            ? [styles.edgeGlint, styles.edgeGlintTop]
            : [styles.edgeGlint, side === 'left' ? styles.edgeGlintLeft : styles.edgeGlintRight]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', zIndex: 12 },
  pet: { position: 'absolute', top: 0, left: 0, width: PET_SIZE, height: PET_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  spriteLayer: { position: 'absolute', width: PET_SIZE, height: PET_SIZE, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  image: { width: PET_SIZE, height: PET_SIZE },
  imageLeft: { transform: [{ scaleX: -1 }] },
  groundShadow: {
    position: 'absolute', bottom: 2, width: 58, height: 13, borderRadius: 999,
    backgroundColor: '#173E32', zIndex: 0,
  },
  rimLight: {
    position: 'absolute', top: 8, left: 10, width: 74, height: 74, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.2)', shadowColor: '#A7F6D7', shadowOpacity: 0.42,
    shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 2, zIndex: 1,
  },
  edgeGlint: {
    position: 'absolute', top: 16, bottom: 16, width: 3, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.76)', opacity: 0.55, zIndex: 3,
  },
  edgeGlintLeft: { left: 4 },
  edgeGlintRight: { right: 4 },
  edgeGlintTop: { top: PET_HEIGHT - TOP_PEEK_VISIBLE, right: 14, left: 14, width: undefined, height: 3 },
  greetingBubble: {
    position: 'absolute', top: 7, width: BUBBLE_WIDTH, minHeight: 58, justifyContent: 'center', paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(90, 126, 103, 0.16)', borderRadius: 20, backgroundColor: '#FFFDF8',
    shadowColor: '#29473D', shadowOpacity: 0.13, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7,
  },
  greetingText: { color: '#294A3F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  greetingBubbleTop: { top: PET_HEIGHT - 4 },
});
