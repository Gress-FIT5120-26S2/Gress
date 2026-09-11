import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';

type PetSide = 'left' | 'right';

type StoredPetPosition = {
  side: PetSide;
  yRatio: number;
};

type SpooniePetEntryProps = {
  onOpen: () => void;
  visible: boolean;
};

const POSITION_KEY = 'kitchmemo.spoonie.pet-position.v1';
const PET_SIZE = 78;
const EDGE_PEEK = 13;
const BUBBLE_WIDTH = 214;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function playDockHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

// Arthur: NarIyirm
// 中文：为避开部分 Expo Go 在初始化 Worklets 时的原生闪退，宠物改用 RN 内置动画；拖动坐标仅在松手后持久化。
// EN: To avoid native Worklets startup crashes seen in some Expo Go builds, the pet uses built-in RN animation and persists coordinates only on release.
export function SpooniePetEntry({ onOpen, visible }: SpooniePetEntryProps) {
  const { t } = useI18n();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [side, setSide] = useState<PetSide>('right');
  const [showGreeting, setShowGreeting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const openingRef = useRef(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const position = useRef(new Animated.ValueXY({ x: width - PET_SIZE + EDGE_PEEK, y: height * 0.43 })).current;
  const currentPositionRef = useRef({ x: width - PET_SIZE + EDGE_PEEK, y: height * 0.43 });
  const dragStartRef = useRef(currentPositionRef.current);
  const bob = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const minY = insets.top + 70;
  const maxY = Math.max(minY, height - insets.bottom - 116 - PET_SIZE);
  const leftX = -EDGE_PEEK;
  const rightX = width - PET_SIZE + EDGE_PEEK;

  const persistPosition = useCallback((nextSide: PetSide, nextY: number) => {
    setSide(nextSide);
    const yRatio = maxY === minY ? 0.5 : (nextY - minY) / (maxY - minY);
    const value: StoredPetPosition = { side: nextSide, yRatio: clamp(yRatio, 0, 1) };
    void AsyncStorage.setItem(POSITION_KEY, JSON.stringify(value)).catch(() => undefined);
  }, [maxY, minY]);

  const openAfterGreeting = useCallback(() => {
    if (openingRef.current) return;
    openingRef.current = true;
    setShowGreeting(true);
    Animated.sequence([
      Animated.timing(tilt, { toValue: side === 'right' ? -7 : 7, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tilt, { toValue: side === 'right' ? 5 : -5, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tilt, { toValue: 0, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    playDockHaptic();
    openTimerRef.current = setTimeout(() => {
      setShowGreeting(false);
      openingRef.current = false;
      openTimerRef.current = null;
      onOpen();
    }, reducedMotion ? 180 : 620);
  }, [onOpen, reducedMotion, side, tilt]);

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
    setShowGreeting(false);
  }, [visible]);

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    idleAnimationRef.current?.stop();
  }, []);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(POSITION_KEY).then((raw) => {
      if (!mounted || !raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredPetPosition>;
      if ((parsed.side !== 'left' && parsed.side !== 'right') || typeof parsed.yRatio !== 'number') return;
      const restoredY = minY + clamp(parsed.yRatio, 0, 1) * (maxY - minY);
      const restored = { x: parsed.side === 'left' ? leftX : rightX, y: restoredY };
      setSide(parsed.side);
      currentPositionRef.current = restored;
      position.setValue(restored);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, [leftX, maxY, minY, position, rightX]);

  useEffect(() => {
    const bounded = {
      x: side === 'left' ? leftX : rightX,
      y: clamp(currentPositionRef.current.y, minY, maxY),
    };
    currentPositionRef.current = bounded;
    position.setValue(bounded);
  }, [leftX, maxY, minY, position, rightX, side]);

  useEffect(() => {
    idleAnimationRef.current?.stop();
    bob.setValue(0);
    if (!visible || reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(3600),
      Animated.timing(bob, { toValue: -3, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]));
    idleAnimationRef.current = animation;
    animation.start();
    return () => animation.stop();
  }, [bob, reducedMotion, visible]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3,
    onPanResponderGrant: () => {
      position.stopAnimation();
      dragStartRef.current = { ...currentPositionRef.current };
      Animated.timing(scale, { toValue: 1.04, duration: 120, useNativeDriver: true }).start();
    },
    onPanResponderMove: (_event, gestureState) => {
      position.setValue({
        x: clamp(dragStartRef.current.x + gestureState.dx, leftX, rightX),
        y: clamp(dragStartRef.current.y + gestureState.dy, minY, maxY),
      });
      tilt.setValue(clamp(gestureState.dx / 18, -8, 8));
    },
    onPanResponderRelease: (_event, gestureState) => {
      const moved = Math.hypot(gestureState.dx, gestureState.dy) > 8;
      if (!moved) {
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
        openAfterGreeting();
        return;
      }
      const releasedX = clamp(dragStartRef.current.x + gestureState.dx, leftX, rightX);
      const targetY = clamp(dragStartRef.current.y + gestureState.dy, minY, maxY);
      const nextSide: PetSide = releasedX + PET_SIZE / 2 < width / 2 ? 'left' : 'right';
      const target = { x: nextSide === 'left' ? leftX : rightX, y: targetY };
      Animated.parallel([
        Animated.spring(position, { toValue: target, damping: 18, stiffness: 180, mass: 1, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
      persistPosition(nextSide, targetY);
      playDockHaptic();
    },
    onPanResponderTerminate: () => {
      Animated.parallel([
        Animated.timing(tilt, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
    },
    onPanResponderTerminationRequest: () => true,
  }), [leftX, maxY, minY, openAfterGreeting, persistPosition, position, rightX, scale, tilt, width]);

  const rotate = tilt.interpolate({ inputRange: [-8, 8], outputRange: ['-8deg', '8deg'] });
  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {showGreeting ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={[
            styles.greetingBubble,
            { left: side === 'right' ? -BUBBLE_WIDTH + 18 : PET_SIZE - 18 },
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
          { transform: [{ translateX: position.x }, { translateY: Animated.add(position.y, bob) }, { rotate }, { scale }] },
        ]}
      >
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          source={require('../../../assets/kitchmemo-assistant.png')}
          style={[styles.image, side === 'left' && styles.imageLeft]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', zIndex: 12 },
  pet: { position: 'absolute', top: 0, left: 0, width: PET_SIZE, height: PET_SIZE, alignItems: 'center', justifyContent: 'center' },
  image: { width: PET_SIZE, height: PET_SIZE },
  imageLeft: { transform: [{ scaleX: -1 }] },
  greetingBubble: {
    position: 'absolute', top: 7, width: BUBBLE_WIDTH, minHeight: 58, justifyContent: 'center', paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(90, 126, 103, 0.16)', borderRadius: 20, backgroundColor: '#FFFDF8',
    shadowColor: '#29473D', shadowOpacity: 0.13, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7,
  },
  greetingText: { color: '#294A3F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
});
