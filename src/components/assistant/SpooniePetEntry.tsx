import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
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
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.min(Math.max(value, minimum), maximum);
}

function playDockHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

// Arthur: NarIyirm
// 中文：Cart、成就和“我的”共用一个设备本地停靠位置；拖动全程留在 UI 线程，结束后才持久化比例坐标。
// EN: Cart, Achievements, and Profile share one device-local dock position; dragging stays on the UI thread and persists a ratio only after release.
export function SpooniePetEntry({ onOpen, visible }: SpooniePetEntryProps) {
  const { t } = useI18n();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [side, setSide] = useState<PetSide>('right');
  const [showGreeting, setShowGreeting] = useState(false);
  const openingRef = useRef(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const x = useSharedValue(width - PET_SIZE + EDGE_PEEK);
  const y = useSharedValue(Math.max(insets.top + 88, height * 0.43));
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const scale = useSharedValue(1);

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
    tilt.set(withSequence(
      withTiming(side === 'right' ? -7 : 7, { duration: 130, easing: EASE_OUT }),
      withTiming(side === 'right' ? 5 : -5, { duration: 150, easing: EASE_OUT }),
      withTiming(0, { duration: 150, easing: EASE_OUT }),
    ));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    openTimerRef.current = setTimeout(() => {
      setShowGreeting(false);
      openingRef.current = false;
      openTimerRef.current = null;
      onOpen();
    }, reducedMotion ? 180 : 620);
  }, [onOpen, reducedMotion, side, tilt]);

  useEffect(() => {
    if (visible) return;
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
    openingRef.current = false;
    setShowGreeting(false);
  }, [visible]);

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
  }, []);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(POSITION_KEY).then((raw) => {
      if (!mounted || !raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredPetPosition>;
      if ((parsed.side !== 'left' && parsed.side !== 'right') || typeof parsed.yRatio !== 'number') return;
      const restoredY = minY + clamp(parsed.yRatio, 0, 1) * (maxY - minY);
      setSide(parsed.side);
      x.set(parsed.side === 'left' ? leftX : rightX);
      y.set(restoredY);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, [leftX, maxY, minY, rightX, x, y]);

  useEffect(() => {
    x.set(withTiming(side === 'left' ? leftX : rightX, { duration: 180, easing: EASE_OUT }));
    y.set(clamp(y.get(), minY, maxY));
  }, [leftX, maxY, minY, rightX, side, width, x, y]);

  useEffect(() => {
    cancelAnimation(bob);
    bob.set(0);
    if (!visible || reducedMotion) return;
    bob.set(withRepeat(withSequence(
      withDelay(3600, withTiming(-3, { duration: 650, easing: EASE_OUT })),
      withTiming(0, { duration: 750, easing: EASE_OUT }),
    ), -1, false));
    return () => cancelAnimation(bob);
  }, [bob, reducedMotion, visible]);

  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      dragStartX.set(x.get());
      dragStartY.set(y.get());
      scale.set(withTiming(1.04, { duration: 120, easing: EASE_OUT }));
    })
    .onUpdate((event) => {
      x.set(clamp(dragStartX.get() + event.translationX, leftX, rightX));
      y.set(clamp(dragStartY.get() + event.translationY, minY, maxY));
      tilt.set(clamp(event.translationX / 18, -8, 8));
    })
    .onEnd((event) => {
      const nextSide: PetSide = x.get() + PET_SIZE / 2 < width / 2 ? 'left' : 'right';
      const targetX = nextSide === 'left' ? leftX : rightX;
      const targetY = clamp(y.get(), minY, maxY);
      x.set(withSpring(targetX, { dampingRatio: 0.8, duration: 400, velocity: event.velocityX }));
      y.set(withSpring(targetY, { dampingRatio: 0.8, duration: 400, velocity: event.velocityY }));
      tilt.set(withTiming(0, { duration: 160, easing: EASE_OUT }));
      scale.set(withTiming(1, { duration: 140, easing: EASE_OUT }));
      scheduleOnRN(persistPosition, nextSide, targetY);
      scheduleOnRN(playDockHaptic);
    })
    .onFinalize(() => {
      scale.set(withTiming(1, { duration: 140, easing: EASE_OUT }));
      tilt.set(withTiming(0, { duration: 160, easing: EASE_OUT }));
    }), [dragStartX, dragStartY, leftX, maxY, minY, persistPosition, rightX, scale, tilt, width, x, y]);

  const tapGesture = useMemo(() => Gesture.Tap()
    .maxDistance(8)
    .onBegin(() => scale.set(withTiming(0.97, { duration: 100, easing: EASE_OUT })))
    .onFinalize(() => scale.set(withTiming(1, { duration: 120, easing: EASE_OUT })))
    .onEnd((_event, success) => {
      if (success) scheduleOnRN(openAfterGreeting);
    }), [openAfterGreeting, scale]);

  const gesture = useMemo(() => Gesture.Race(panGesture, tapGesture), [panGesture, tapGesture]);
  const petStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() + bob.get() },
      { rotate: `${tilt.get()}deg` },
      { scale: scale.get() },
    ],
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() + (side === 'right' ? -BUBBLE_WIDTH + 18 : PET_SIZE - 18) },
      { translateY: y.get() + 7 },
    ],
  }));

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {showGreeting ? (
        <Animated.View accessibilityLiveRegion="polite" pointerEvents="none" style={[styles.greetingBubble, bubbleStyle]}>
          <Text style={styles.greetingText}>{t.fridge.assistant.petGreeting}</Text>
        </Animated.View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessibilityActions={[{ name: 'activate' }]}
          accessibilityLabel={t.fridge.assistant.petA11y}
          accessibilityRole="button"
          accessible
          onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'activate') openAfterGreeting(); }}
          style={[styles.pet, petStyle]}
        >
          <Image
            cachePolicy="memory-disk"
            contentFit="contain"
            source={require('../../../assets/kitchmemo-assistant.png')}
            style={[styles.image, side === 'left' && styles.imageLeft]}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', zIndex: 12 },
  pet: { position: 'absolute', top: 0, left: 0, width: PET_SIZE, height: PET_SIZE, alignItems: 'center', justifyContent: 'center' },
  image: { width: PET_SIZE, height: PET_SIZE },
  imageLeft: { transform: [{ scaleX: -1 }] },
  greetingBubble: {
    position: 'absolute', top: 0, left: 0, width: BUBBLE_WIDTH, minHeight: 58, justifyContent: 'center', paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(90, 126, 103, 0.16)', borderRadius: 20, backgroundColor: '#FFFDF8',
    shadowColor: '#29473D', shadowOpacity: 0.13, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7,
  },
  greetingText: { color: '#294A3F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
});
