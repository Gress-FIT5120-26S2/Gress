import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type FridgeFilterChipProps = {
  badgeColor?: string | null;
  badgeCount?: number;
  count: number;
  expanded?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected: boolean;
  showExpandCue?: boolean;
  tint: string;
  tone: string;
};

// 中文：顶部标签统一图标、计数和选中视觉；可选状态徽标与展开箭头由冰箱页控制。
// EN: The chip owns icon, count, and selected styling; optional status badges and expand cues stay driven by the fridge screen.
export const FridgeFilterChip = memo(function FridgeFilterChip({
  badgeColor = null,
  badgeCount = 0,
  count,
  expanded = false,
  icon,
  label,
  onPress,
  selected,
  showExpandCue = false,
  tint,
  tone,
}: FridgeFilterChipProps) {
  const foreground = selected ? '#FFFFFF' : tone;
  const showBadge = Boolean(badgeColor) && badgeCount > 0;
  const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);

  return (
    <Pressable
      accessibilityLabel={showBadge ? `${label}, ${badgeCount}` : label}
      accessibilityRole="button"
      accessibilityState={showExpandCue ? { selected, expanded } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? tone : tint, backgroundColor: selected ? tone : '#FFFFFF' },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={17} color={foreground} />
        {showBadge ? (
          <View style={[styles.statusBadge, { backgroundColor: badgeColor!, borderColor: selected ? tone : '#FFFFFF' }]}>
            <Text style={styles.statusBadgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
      <View style={[styles.countBubble, { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : tint }]}>
        <Text style={[styles.count, { color: foreground }]}>{count}</Text>
      </View>
      {showExpandCue ? (
        <Ionicons color={foreground} name={expanded ? 'chevron-back' : 'chevron-forward'} size={14} />
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderRadius: 18, borderCurve: 'continuous' },
  iconWrap: { position: 'relative', width: 17, height: 17, alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    position: 'absolute',
    top: -7,
    right: -10,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  statusBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', lineHeight: 10 },
  label: { fontSize: 13, fontWeight: '800' },
  countBubble: { minWidth: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderCurve: 'continuous' },
  count: { fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
