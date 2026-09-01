import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PresetFoodIcon } from './PresetFoodIcon';

export type FridgeStorageZone = 'chilled' | 'frozen' | 'pantry';

type FridgeFoodCardProps = {
  amount: string;
  categoryTint: string;
  categoryTone: string;
  daysLeft: number | null;
  emoji: string;
  iconUrl: string | null;
  freshnessText: string | null;
  isExpired: boolean;
  name: string;
  needsRestock: boolean;
  onPress: () => void;
  storage: FridgeStorageZone;
  storageLabel: string;
};

// Arthur: NarIyirm
// 中文：食材卡片只接收已经准备好的展示值，页面仍负责库存与筛选业务逻辑。
// EN: The food card receives presentation-ready values while the screen keeps inventory and filtering logic.
export const FridgeFoodCard = memo(function FridgeFoodCard({
  amount,
  categoryTint,
  categoryTone,
  daysLeft,
  emoji,
  iconUrl,
  freshnessText,
  isExpired,
  name,
  needsRestock,
  onPress,
  storage,
  storageLabel,
}: FridgeFoodCardProps) {
  const isSoon = !isExpired && daysLeft !== null && daysLeft <= 3;
  const freshnessColor = isExpired ? '#C7494C' : isSoon ? '#BE701B' : '#2E9460';
  const freshnessTint = isExpired ? '#FFF0F1' : isSoon ? '#FFF3E7' : '#EAF8F0';
  const storageIcon: keyof typeof Ionicons.glyphMap = storage === 'frozen'
    ? 'snow-outline'
    : storage === 'chilled'
      ? 'water-outline'
      : 'cube-outline';

  return (
    <Pressable
      accessibilityLabel={name}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: categoryTint, borderColor: `${categoryTone}20` }, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.emojiTile}>
          <PresetFoodIcon emoji={emoji} iconUrl={iconUrl} size="card" />
        </View>
        <Text numberOfLines={2} style={styles.name}>{name}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.amount}>{amount}</Text>
      <View style={styles.meta}>
        <View style={styles.storageBadge}>
          <Ionicons name={storageIcon} size={13} color="#287A8B" />
          <Text numberOfLines={1} style={styles.storageText}>{storageLabel}</Text>
        </View>
        {freshnessText ? (
          <View style={[styles.freshnessBadge, { backgroundColor: freshnessTint }]}>
            <Text numberOfLines={1} style={[styles.freshnessText, { color: freshnessColor }]}>{freshnessText}</Text>
          </View>
        ) : null}
      </View>
      {needsRestock ? <View style={styles.restockDot} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { position: 'relative', width: '48%', minHeight: 145, padding: 11, borderWidth: 1, borderRadius: 15, borderCurve: 'continuous' },
  top: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emojiTile: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.68)' },
  name: { flex: 1, minWidth: 0, color: '#183B30', fontSize: 15, fontWeight: '800', lineHeight: 18 },
  amount: { marginTop: 9, color: '#24483B', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  storageBadge: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  storageText: { maxWidth: 54, color: '#287A8B', fontSize: 10, fontWeight: '800' },
  freshnessBadge: { minHeight: 24, justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, borderCurve: 'continuous' },
  freshnessText: { fontSize: 10, fontWeight: '800' },
  restockDot: { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 4, borderCurve: 'continuous', backgroundColor: '#1593A9' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
