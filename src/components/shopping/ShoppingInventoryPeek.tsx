import { TabModal as Modal } from '../RetainedTab';
// src/components/shopping/ShoppingInventoryPeek.tsx
// US5.1 "Pre-Shop Review": a read-only look at what's already at home, shown
// inside Shopping Mode so the user can review stock before deciding to buy.
// Shows name, quantity, storage, relevant date, and a "Use First" priority tag
// for items expiring soon. Read-only -- never mutates inventory.
// "Use First" uses the same threshold as the fridge's "expiring" filter:
// not expired AND <= 3 days left.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../i18n';
import { PresetFoodIcon } from '../fridge/PresetFoodIcon';
import { getInventorySnapshot, type InventoryBatch } from '../../services/inventoryApi';

const USE_FIRST_DAYS = 3; // matches the fridge "expiring" threshold

type ShoppingInventoryPeekProps = {
  visible: boolean;
  onClose: () => void;
};

// 中文：跟冰箱卡片同一套：左侧食材图标（预设图/emoji），储存位置用 Ionicons 小徽章。
// EN: Same as the fridge card: a food icon (preset image/emoji) on the left, storage shown as an Ionicons badge.
const STORAGE_ICON: Record<InventoryBatch['storageZone'], keyof typeof Ionicons.glyphMap> = {
  chilled: 'water-outline',
  frozen: 'snow-outline',
  pantry: 'cube-outline',
};
// Same fallback emojis as FridgeScreen's CATEGORY_EMOJI.
const CATEGORY_EMOJI: Record<InventoryBatch['categoryCode'], string> = {
  meat: '🥚',
  vegetables: '🥬',
  fruit: '🍎',
  staples: '🍚',
  condiments: '🫙',
  drinks: '🥛',
  other: '📦',
};

// days left until expiry (null if no expiry set); mirrors FridgeScreen.getDaysLeft
function getDaysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / 86_400_000);
}

export function ShoppingInventoryPeek({ visible, onClose }: ShoppingInventoryPeekProps) {
  const { t } = useI18n();
  const copy = t.shopping.peek;
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getInventorySnapshot();
      setBatches(snap.batches);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const expiryLabel = (iso: string | null) => {
    if (!iso) return copy.noExpiry;
    const days = getDaysLeft(iso);
    if (days === null) return copy.noExpiry;
    if (days < 0) return copy.expired;
    return copy.daysLeft(days);
  };

  // priority status (US5.1.2 "Use First"): not expired and expiring within N days
  const isUseFirst = (iso: string | null) => {
    const days = getDaysLeft(iso);
    return days !== null && days >= 0 && days <= USE_FIRST_DAYS;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={onClose}>
            <Text style={styles.headerBtn}>{copy.close}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{copy.title}</Text>
          <View style={{ width: 44 }} />
        </View>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={batches}
            keyExtractor={(b) => b.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const useFirst = isUseFirst(item.expiresAt);
              return (
                <View style={styles.row}>
                  <View style={styles.emojiTile}>
                    <PresetFoodIcon
                      emoji={item.iconEmoji ?? CATEGORY_EMOJI[item.categoryCode] ?? '📦'}
                      iconUrl={item.iconUrl ?? null}
                      size="card"
                    />
                  </View>
                  <View style={styles.grow}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{item.name}</Text>
                      {useFirst ? (
                        <View style={styles.useFirstTag}>
                          <Text style={styles.useFirstText}>{copy.useFirst}</Text>
                        </View>
                      ) : null}
                      {item.needsRestock ? (
                        <Text style={styles.lowTag}>· {copy.low}</Text>
                      ) : null}
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.sub}>{item.remainingQuantity} {item.unit}</Text>
                      <View style={styles.storageBadge}>
                        <Ionicons name={STORAGE_ICON[item.storageZone]} size={13} color="#287A8B" />
                        <Text numberOfLines={1} style={styles.storageText}>{t.fridge.filters[item.storageZone]}</Text>
                      </View>
                      <Text style={styles.sub}>{expiryLabel(item.expiresAt)}</Text>
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>{copy.empty}</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  headerBtn: { color: '#C95F14', fontSize: 15, fontWeight: '800', width: 44 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#173D31' },
  subtitle: { paddingHorizontal: 18, paddingBottom: 12, color: '#5E756D', fontSize: 13 },
  list: { gap: 10, paddingHorizontal: 18, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 15,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
  },
  emojiTile: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderCurve: 'continuous', backgroundColor: '#EEF6F4' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 4 },
  storageBadge: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, borderCurve: 'continuous', backgroundColor: '#E7F4F7' },
  storageText: { maxWidth: 70, color: '#287A8B', fontSize: 10, fontWeight: '800' },
  grow: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 15, color: '#183B30', fontWeight: '800' },
  useFirstTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#FFF1E3',
  },
  useFirstText: { color: '#BE701B', fontSize: 11, fontWeight: '800' },
  lowTag: { color: '#C96E1A', fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 12, color: '#61766D', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#718078', marginTop: 40 },
});