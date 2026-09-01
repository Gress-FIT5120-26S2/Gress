// src/components/shopping/ShoppingInventoryPeek.tsx
// US5.1: a read-only look at what's already at home, shown inside Shopping Mode
// so the user can plan before buying. Reuses the inventory snapshot (name,
// quantity, storage, expiry). Read-only -- never mutates inventory.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useI18n } from '../../i18n';
import { getInventorySnapshot, type InventoryBatch } from '../../services/inventoryApi';

type ShoppingInventoryPeekProps = {
  visible: boolean;
  onClose: () => void;
};

const STORAGE_ICON: Record<InventoryBatch['storageZone'], string> = {
  chilled: '💧',
  frozen: '❄️',
  pantry: '📦',
};

export function ShoppingInventoryPeek({ visible, onClose }: ShoppingInventoryPeekProps) {
  const { t, language } = useI18n();
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

  const locale = language === 'zh' ? 'zh-CN' : 'en-AU';
  const expiryLabel = (iso: string | null) => {
    if (!iso) return copy.noExpiry;
    const ms = new Date(iso).getTime() - Date.now();
    if (ms < 0) return copy.expired;
    const days = Math.ceil(ms / 86_400_000);
    return copy.daysLeft(days);
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
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.storageIcon}>{STORAGE_ICON[item.storageZone]}</Text>
                <View style={styles.grow}>
                  <Text style={styles.name}>
                    {item.name}
                    {item.needsRestock ? <Text style={styles.lowTag}>  · {copy.low}</Text> : null}
                  </Text>
                  <Text style={styles.sub}>
                    {item.remainingQuantity} {item.unit} · {expiryLabel(item.expiresAt)}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>{copy.empty}</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4EE' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  headerBtn: { color: '#2e7d32', fontSize: 15, fontWeight: '700', width: 44 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#173D31' },
  subtitle: { paddingHorizontal: 16, paddingBottom: 12, color: '#718078', fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(70,91,81,0.15)',
  },
  storageIcon: { fontSize: 22 },
  grow: { flex: 1 },
  name: { fontSize: 16, color: '#244A3E', fontWeight: '600' },
  lowTag: { color: '#C96E1A', fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 13, color: '#718078', marginTop: 3 },
  empty: { textAlign: 'center', color: '#718078', marginTop: 40 },
});