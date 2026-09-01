import { Image } from 'expo-image';
import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useI18n } from '../../i18n';

type FridgeAssistantButtonProps = {
  onPress: () => void;
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Arthur: NarIyirm
// 中文：提醒状态已从助手入口移出；按钮只保留轻微按压反馈，不再显示未读数或主动跳动。
// EN: Reminder state is separated from this entry; the button keeps only subtle press feedback with no unread badge or attention animation.
export function FridgeAssistantButton({ onPress }: FridgeAssistantButtonProps) {
  const { t } = useI18n();
  const pressScale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={[styles.mascotButton, { transform: [{ scale: pressScale }] }]}>
      <Pressable
        accessibilityLabel={t.fridge.assistant.buttonA11y}
        accessibilityRole="button"
        hitSlop={6}
        onPress={onPress}
        onPressIn={() => Animated.timing(pressScale, { toValue: 0.97, duration: 100, easing: EASE_OUT, useNativeDriver: true }).start()}
        onPressOut={() => Animated.timing(pressScale, { toValue: 1, duration: 120, easing: EASE_OUT, useNativeDriver: true }).start()}
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
