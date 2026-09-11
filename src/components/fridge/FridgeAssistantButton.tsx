import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useI18n } from '../../i18n';

type FridgeAssistantButtonProps = {
  onPress: () => void;
};

// Arthur: NarIyirm
// 中文：冰箱页入口使用 RN 内置原生驱动，保留低频两像素呼吸动作，同时避免启动时加载 Worklets。
// EN: The fridge entry uses RN's built-in native driver to keep its subtle two-pixel breath without loading Worklets at startup.
export function FridgeAssistantButton({ onPress }: FridgeAssistantButtonProps) {
  const { t } = useI18n();
  const [reducedMotion, setReducedMotion] = useState(false);
  const idleY = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    idleY.stopAnimation();
    idleY.setValue(0);
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(5200),
      Animated.timing(idleY, { toValue: -2, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(idleY, { toValue: 0, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [idleY, reducedMotion]);

  return (
    <Animated.View style={[styles.mascotButton, { transform: [{ translateY: idleY }, { scale: pressScale }] }]}>
      <Pressable
        accessibilityLabel={t.fridge.assistant.buttonA11y}
        accessibilityRole="button"
        hitSlop={6}
        onPress={onPress}
        onPressIn={() => Animated.timing(pressScale, { toValue: 0.97, duration: 100, useNativeDriver: true }).start()}
        onPressOut={() => Animated.timing(pressScale, { toValue: 1, duration: 120, useNativeDriver: true }).start()}
        pressRetentionOffset={12}
        style={styles.mascotPressable}
      >
        <Image contentFit="contain" source={require('../../../assets/kitchmemo-assistant.png')} style={styles.mascotImage} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mascotButton: { width: 58, height: 58 },
  mascotPressable: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  mascotImage: { width: 52, height: 52 },
});
