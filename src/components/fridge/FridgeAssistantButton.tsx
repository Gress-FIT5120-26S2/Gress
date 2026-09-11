import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useI18n } from '../../i18n';

type FridgeAssistantButtonProps = {
  onPress: () => void;
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Arthur: NarIyirm
// 中文：冰箱页保持原固定入口，只加入低频两像素呼吸动作；提醒状态和主动吸引注意仍与入口分离。
// EN: The fridge keeps its fixed entry with only a low-frequency two-pixel breath; reminders and attention-seeking motion remain separate.
export function FridgeAssistantButton({ onPress }: FridgeAssistantButtonProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const idleY = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(idleY);
    idleY.set(0);
    if (reducedMotion) return;
    idleY.set(withRepeat(withSequence(
      withDelay(5200, withTiming(-2, { duration: 480, easing: EASE_OUT })),
      withTiming(0, { duration: 560, easing: EASE_OUT }),
    ), -1, false));
    return () => cancelAnimation(idleY);
  }, [idleY, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: idleY.get() }, { scale: pressScale.get() }],
  }));

  return (
    <Animated.View style={[styles.mascotButton, animatedStyle]}>
      <Pressable
        accessibilityLabel={t.fridge.assistant.buttonA11y}
        accessibilityRole="button"
        hitSlop={6}
        onPress={onPress}
        onPressIn={() => pressScale.set(withTiming(0.97, { duration: 100, easing: EASE_OUT }))}
        onPressOut={() => pressScale.set(withTiming(1, { duration: 120, easing: EASE_OUT }))}
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
