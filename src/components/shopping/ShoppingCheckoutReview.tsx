// src/components/shopping/ShoppingCheckoutReview.tsx
// US5.4 checkout review + US5.5 add purchases to inventory (B1 draft flow).
// Shows all cart items, highlights unresolved duplicate warnings, then lets the
// user turn them into inventory one at a time via the shared InventoryEntryFlow.
// US5.5.3: when leaving with checked-but-not-yet-stocked items, prompt first.
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
  onAllStocked: (stockedItemUids: string[]) => void | Promise<void>;
};

export function ShoppingCheckoutReview({
  visible,
  items,
  inventoryNames,
  onClose,
  onAllStocked,
}: ShoppingCheckoutReviewProps) {
  const { t } = useI18n();
  const copy = t.shopping.checkout;

  const [status, setStatus] = useState<Record<string, DraftStatus>>({});
  const [editing, setEditing] = useState<CartItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const remaining = useMemo(
    () => items.filter((i) => status[i.item_uid] !== 'done'),
    [items, status],
  );
  const stockedUids = useMemo(
    () => items.filter((i) => status[i.item_uid] === 'done').map((i) => i.item_uid),
    [items, status],
  );

  // US5.5.3: checked (confirmed to buy) but not yet added to inventory
  const checkedNotStocked = useMemo(
    () => items.filter((i) => i.is_checked && status[i.item_uid] !== 'done'),
    [items, status],
  );

  const isDuplicate = (item: CartItem) => inventoryNames.has(item.name.trim().toLowerCase());

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
        presetUid: submission.batch.matchedPresetUid ?? item.preset_uid,
        restockRule: submission.restockRule,
      });
      setStatus((prev) => ({ ...prev, [item.item_uid]: 'done' }));
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  // clear stocked items from the cart, reset, and close
  const doClose = async () => {
    await onAllStocked(stockedUids);
    setStatus({});
    setLeaveConfirm(false);
    onClose();
  };

  // US5.5.3: intercept close -- if there are checked items not stocked, ask first
  const requestClose = () => {
    if (checkedNotStocked.length > 0) {
      setLeaveConfirm(true);
      return;
    }
    void doClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={requestClose}>
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
          <Pressable style={styles.doneBtn} onPress={requestClose}>
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
          }}
          onClose={() => setEditing(null)}
          onSubmit={(submission) => handleDraftSubmit(editing, submission)}
        />
      ) : null}

      {/* US5.5.3: leave prompt when checked items are not yet stocked */}
      {leaveConfirm ? (
        <View style={styles.confirmLayer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLeaveConfirm(false)} />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{copy.leaveTitle}</Text>
            <Text style={styles.confirmBody}>
              {copy.leaveBody(checkedNotStocked.length)}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.keepBtn} onPress={() => setLeaveConfirm(false)}>
                <Text style={styles.keepText}>{copy.leaveStay}</Text>
              </Pressable>
              <Pressable style={styles.leaveBtn} onPress={() => void doClose()}>
                <Text style={styles.leaveText}>{copy.leaveAnyway}</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
  confirmLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(23,32,29,0.4)',
  },
  confirmCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: '#FBFCFA',
    padding: 22,
    gap: 10,
  },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: '#173D31' },
  confirmBody: { fontSize: 14, color: '#5A6E66', lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  keepBtn: {
    flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EDF1EF',
  },
  keepText: { color: '#315C51', fontSize: 15, fontWeight: '800' },
  leaveBtn: {
    flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#C62828',
  },
  leaveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});