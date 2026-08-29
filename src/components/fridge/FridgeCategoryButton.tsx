import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type FridgeCategoryButtonProps = {
  count: number;
  label: string;
  onPress: () => void;
  selected: boolean;
  tint: string;
  tone: string;
};

// Arthur: NarIyirm
// 中文：分类按钮封装重复的选中样式，选中哪个分类仍由冰箱页面控制。
// EN: The category button owns repeated selected styling while the fridge screen controls selection state.
export const FridgeCategoryButton = memo(function FridgeCategoryButton({ count, label, onPress, selected, tint, tone }: FridgeCategoryButtonProps) {
  const foreground = selected ? '#FFFFFF' : tone;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, { backgroundColor: selected ? tone : tint }, pressed ? styles.pressed : null]}
    >
      <View style={[styles.accent, { backgroundColor: selected ? '#FFFFFF' : tone }]} />
      <Text numberOfLines={2} style={[styles.label, { color: foreground }]}>{label}</Text>
      <Text style={[styles.count, { color: foreground }]}>{count}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  item: { position: 'relative', width: 78, minHeight: 72, alignItems: 'flex-start', justifyContent: 'center', gap: 3, overflow: 'hidden', paddingVertical: 10, paddingRight: 7, paddingLeft: 20, borderRadius: 14, borderCurve: 'continuous' },
  accent: { position: 'absolute', top: 13, bottom: 13, left: 9, width: 4, borderRadius: 2, borderCurve: 'continuous' },
  label: { width: '100%', fontSize: 12, fontWeight: '800', lineHeight: 15 },
  count: { fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
