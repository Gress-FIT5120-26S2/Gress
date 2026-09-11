import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type FridgeFilterChipProps = {
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected: boolean;
  tint: string;
  tone: string;
};

// Arthur: NarIyirm
// 中文：顶部标签统一图标、计数和选中视觉，筛选判断继续保留在主页面。
// EN: The top chip unifies icon, count, and selected visuals while filtering rules remain in the screen.
export const FridgeFilterChip = memo(function FridgeFilterChip({ count, icon, label, onPress, selected, tint, tone }: FridgeFilterChipProps) {
  const foreground = selected ? '#FFFFFF' : tone;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? tone : tint, backgroundColor: selected ? tone : '#FFFFFF' },
        pressed ? styles.pressed : null,
      ]}
    >
      <Ionicons name={icon} size={17} color={foreground} />
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
      <View style={[styles.countBubble, { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : tint }]}>
        <Text style={[styles.count, { color: foreground }]}>{count}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderRadius: 18, borderCurve: 'continuous' },
  label: { fontSize: 13, fontWeight: '800' },
  countBubble: { minWidth: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderCurve: 'continuous' },
  count: { fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
