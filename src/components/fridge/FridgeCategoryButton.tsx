import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type FridgeCategoryButtonProps = {
  collapsed?: boolean;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  iconUrl?: string | null;
  label: string;
  onPress: () => void;
  selected: boolean;
  tint: string;
  tone: string;
};

// Arthur: NarIyirm
// 中文：分类按钮封装重复的选中样式，选中哪个分类仍由冰箱页面控制。
// EN: The category button owns repeated selected styling while the fridge screen controls selection state.
export const FridgeCategoryButton = memo(function FridgeCategoryButton({ collapsed = false, count, icon, iconUrl, label, onPress, selected, tint, tone }: FridgeCategoryButtonProps) {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${count}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, collapsed ? styles.itemCollapsed : null, { backgroundColor: selected ? tint : '#FBFDFC' }, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconWrap}>
        <Ionicons color={tone} name={icon} size={collapsed ? 22 : 21} />
        {iconUrl ? <Image cachePolicy="memory-disk" contentFit="contain" source={iconUrl} style={styles.image} transition={120} /> : null}
      </View>
      {!collapsed ? (
        <Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={[styles.label, { color: selected ? tone : '#435D54' }]}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.countBadge, collapsed ? styles.countBadgeCollapsed : null, { backgroundColor: selected ? tone : '#E8EEEB' }]}>
        <Text style={[styles.count, { color: selected ? '#FFFFFF' : '#526A61' }]}>{count}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  item: { position: 'relative', width: 68, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 7, paddingHorizontal: 3, paddingBottom: 4, borderRadius: 13, borderCurve: 'continuous' },
  itemCollapsed: { width: 44, height: 48, justifyContent: 'center', paddingHorizontal: 0 },
  iconWrap: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center' },
  image: { position: 'absolute', width: 23, height: 23 },
  label: { width: '100%', color: '#435D54', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  countBadge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderRadius: 8 },
  countBadgeCollapsed: { top: 3, right: 2, minWidth: 15, height: 15 },
  count: { fontSize: 9, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
