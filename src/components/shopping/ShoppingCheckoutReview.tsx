// src/components/shopping/ShoppingCheckoutReview.tsx
// US5.4 checkout review + US5.5 add purchases to inventory (B1 draft flow).
// Shows all cart items, highlights unresolved duplicate warnings, then lets the
// user turn them into inventory one at a time: each draft opens the shared
// InventoryEntryFlow (prefilled with name/quantity/unit; the user completes
// category/storage/expiry), and confirmed drafts are written via
// createInventoryBatch. Batching = looping createInventoryBatch (no batch API).
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useI18n } from '../../i18n';
import { InventoryEntryFlow, type InventoryEntrySubmission } from '../inventory-entry/InventoryEntryFlow';
import { createInventoryBatch } from '../../services/inventoryApi';
import type { CartItem } from '../../services/cartApi';

type DraftStatus = 'pending' | 'done';

type ShoppingCheckoutReviewProps = {
  visible: boolean;
  items: CartItem[];
  inventoryNames: Set<string>;
  onClose: () => void;
  // called after all drafts are saved; parent clears those cart items
  onAllStocked: (stockedItemUids: string[]) => void | Promise<void>;
};

// Arthur: NarIyirm
// 中文：结账复核把选中的购物项逐条调用 createInventoryBatch 转为库存；当前是多次请求，不是单个批量事务。
// EN: Checkout review converts selected cart items through repeated createInventoryBatch calls; it is multiple requests rather than one batch transaction.
export function ShoppingCheckoutReview({
  visible,
  items,
  inventoryNames,
  onClose,
  onAllStocked,
}: ShoppingCheckoutReviewProps) {
  const { t } = useI18n();
  const copy = t.shopping.checkout;

  // local per-item draft status; starts fresh each time the review opens
  const [status, setStatus] = useState<Record<string, DraftStatus>>({});
  const [editing, setEditing] = useState<CartItem | null>(null);
  const [busy, setBusy] = useState(false);

  const remaining = useMemo(
    () => items.filter((i) => status[i.item_uid] !== 'done'),
    [items, status],
  );
  const stockedUids = useMemo(
    () => items.filter((i) => status[i.item_uid] === 'done').map((i) => i.item_uid),
    [items, status],
  );

  const isDuplicate = (item: CartItem) => inventoryNames.has(item.name.trim().toLowerCase());

  // Save one confirmed draft to inventory, then mark it done.
  const handleDraftSubmit = async (item: CartItem, submission: InventoryEntrySubmission) => {
    setBusy(true);
    try {
      await createInventoryBatch({
        name: submission.batch.name,
        initialQuantity: submission.batch.initialQuantity,
        unit: submission.batch.unit,
        categoryCode: submission.batch.categoryCode,
        storageZone: submission.batch.storageZone,
        expiresAt: submission.batch.expiresAt,
        purchasePrice: submission.batch.purchasePrice,
        restockRule: submission.restockRule,
      });
      setStatus((prev) => ({ ...prev, [item.item_uid]: 'done' }));
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    // remove the successfully-stocked items from the cart via the parent
    await onAllStocked(stockedUids);
    setStatus({});
    onClose();
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

        {busy ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}

        <FlatList
          data={items}
          keyExtractor={(i) => i.item_uid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const done = status[item.item_uid] === 'done';
            return (
              <Pressable
                style={[styles.row, done && styles.rowDone]}
                disabled={done}
                onPress={() => setEditing(item)}
              >
                <View style={styles.grow}>
                  <Text style={[styles.name, done && styles.nameDone]}>
                    {item.name}
                    {item.quantity ? ` ×${item.quantity}${item.unit ?? ''}` : ''}
                  </Text>
                  {isDuplicate(item) && !done ? (
                    <Text style={styles.dup}>⚠️ {copy.duplicate}</Text>
                  ) : null}
                </View>
                <Text style={styles.action}>{done ? copy.stocked : copy.addToInventory}</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>{copy.empty}</Text>}
        />

        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            {copy.progress(stockedUids.length, items.length)}
          </Text>
          <Pressable style={styles.doneBtn} onPress={finish}>
            <Text style={styles.doneText}>
              {remaining.length === 0 ? copy.finishAll : copy.finishSome}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* B1: each draft opens the shared inventory form, prefilled from the cart item */}
      {editing ? (
        <InventoryEntryFlow
          visible
          source="recognition"
          initialValues={{
            name: editing.name,
            quantity: editing.quantity ? String(editing.quantity) : '1',
            // unit from the cart may not map 1:1 to inventory units; the form
            // defaults it and the user can adjust before saving
          }}
          onClose={() => setEditing(null)}
          onSubmit={(submission) => handleDraftSubmit(editing, submission)}
        />
      ) : null}
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
    paddingBottom: 12,
  },
  headerBtn: { color: '#2e7d32', fontSize: 15, fontWeight: '700', width: 44 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#173D31' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(70,91,81,0.15)',
  },
  rowDone: { opacity: 0.5 },
  grow: { flex: 1 },
  name: { fontSize: 16, color: '#244A3E', fontWeight: '600' },
  nameDone: { textDecorationLine: 'line-through' },
  dup: { marginTop: 3, color: '#C96E1A', fontSize: 12.5, fontWeight: '700' },
  action: { color: '#2e7d32', fontSize: 13, fontWeight: '800' },
  empty: { textAlign: 'center', color: '#718078', marginTop: 40 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(70,91,81,0.15)',
    gap: 10,
  },
  footerHint: { color: '#718078', fontSize: 13, textAlign: 'center' },
  doneBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FF812B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
