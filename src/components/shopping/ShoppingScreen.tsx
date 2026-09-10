// src/components/shopping/ShoppingScreen.tsx
// Shopping Mode (Epic E5). Two tabs:
//   - 'restock': suggested buys (需补货), derived from restock rules + stock
//   - 'cart':    the editable shopping cart (shopping_cart_items)
// Cart items support quantity edit (−/＋ and tap-to-type), delete, and a
// checkbox to CONFIRM the purchase (US5.2). Only confirmed (checked) items go
// to checkout review (US5.4) and become inventory (US5.5) -- this matches the
// "confirmed cart" wording in the acceptance criteria.
// NOTE: this file lives in components/shopping/, so imports reach up two levels.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useI18n } from '../../i18n';
import {
  fetchCart,
  addCartItem,
  updateCartQuantity,
  toggleCartItem,
  deleteCartItem,
  fetchRestock,
  CartItem,
  RestockSuggestion,
} from '../../services/cartApi';
import { getInventorySnapshot, type InventoryBatch } from '../../services/inventoryApi';
import { subscribeToSync } from '../../services/realtimeSync';
import { ShoppingAddSheet } from './ShoppingAddSheet';
import { ShoppingCheckoutReview } from './ShoppingCheckoutReview';
import { ShoppingInventoryPeek } from './ShoppingInventoryPeek';

type Tab = 'restock' | 'cart';

// Shared hook: load current inventory for duplicate detection (US5.3).
// Returns a name Set (fast "is duplicate" check) and a name→batches map
// (all matching batches, for showing per-batch details in US5.3.2).
function useInventoryNames() {
  const [names, setNames] = useState<Set<string>>(new Set());
  const [byName, setByName] = useState<Map<string, InventoryBatch[]>>(new Map());
  const reload = useCallback(async () => {
    try {
      const snap = await getInventorySnapshot();
      const nameSet = new Set<string>();
      const map = new Map<string, InventoryBatch[]>();
      for (const b of snap.batches) {
        const key = b.name.trim().toLowerCase();
        nameSet.add(key);
        const arr = map.get(key) ?? [];
        arr.push(b);
        map.set(key, arr);
      }
      setNames(nameSet);
      setByName(map);
    } catch {
      setNames(new Set());
      setByName(new Map());
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => subscribeToSync(['inventory', 'fridge'], () => {
    void reload();
  }), [reload]);
  return { names, byName, reload };
}

export function ShoppingScreen() {
  const { t } = useI18n();
  const screen = t.screens.shopping;
  const [tab, setTab] = useState<Tab>('restock');

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{screen.eyebrow}</Text>
      <Text style={styles.title}>{screen.title}</Text>

      <View style={styles.toggle}>
        {(['restock', 'cart'] as Tab[]).map((v) => (
          <Pressable
            key={v}
            style={[styles.toggleBtn, tab === v && styles.toggleActive]}
            onPress={() => setTab(v)}
          >
            <Text style={[styles.toggleText, tab === v && styles.toggleTextActive]}>
              {v === 'restock' ? t.shopping.restockTab : t.shopping.cartTab}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'restock' ? <RestockView onAdded={() => setTab('cart')} /> : <CartView />}
    </View>
  );
}

// ---- 建议购物 / 需补货 (derived, read-only + "add to cart") ----
function RestockView({ onAdded }: { onAdded: () => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<RestockSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      setItems(await fetchRestock());
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);
  useEffect(() => subscribeToSync(['inventory', 'restock', 'fridge'], () => {
    void load().catch(() => undefined);
  }), [load]);

  const add = async (s: RestockSuggestion) => {
    // 中文：补货差值 = 目标量 − 当前量；至少补 1，避免出现 0 或负数。
    // EN: Restock delta = target − current; clamp to at least 1 so it is never 0 or negative.
    const delta = Math.max(Math.round(s.target_quantity - s.current_quantity), 1);
    try {
      // 服务端对已在清单里的补货项做 upsert，这里不再因重复而报错。
      // The server upserts restock items already on the list, so a repeat no longer errors.
      await addCartItem({ name: s.name, unit: s.unit, quantity: delta, source: 'restock' });
      onAdded();
    } catch {
      // 忽略：realtime 同步或下次刷新会兜底。
      // Ignore: realtime sync or the next refresh reconciles.
    }
  };

  if (loading) return <ActivityIndicator style={styles.spinner} />;
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.rule_uid}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl colors={['#168ACB']} onRefresh={() => { void load(true).catch(() => undefined); }} refreshing={refreshing} tintColor="#168ACB" />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.grow}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sub}>
              {t.shopping.remaining(item.current_quantity, item.minimum_quantity, item.unit)}
            </Text>
          </View>
          <Pressable style={styles.smallBtn} onPress={() => add(item)}>
            <Text style={styles.smallBtnText}>{t.shopping.addToCart}</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{t.shopping.restockEmpty}</Text>}
    />
  );
}

// ---- 购物车 (editable list: add, quantity edit, confirm, delete, checkout) ----
function CartView() {
  const { t } = useI18n();
  const { names: inventoryNames, byName: inventoryByName } = useInventoryNames();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [peekVisible, setPeekVisible] = useState(false);
  // 中文：待确认删除的购物项；非空时显示确认卡片，避免误删共享清单里的东西。
  // EN: Cart item awaiting delete confirmation; while set, a confirm card is shown so shared-list items aren't removed by accident.
  const [pendingDelete, setPendingDelete] = useState<CartItem | null>(null);

  // 中文：把单位代码转成当前语言的短标签，未知代码就原样显示。
  // EN: Turn a unit code into a short localized label, falling back to the raw code.
  const unitLabel = (u: string | null) =>
    u ? ((t.fridge.manualEntry.units as Record<string, string>)[u] ?? u) : '';

  // confirmed cart = the checked items (US5.4/US5.5 operate on these only)
  const checkedItems = useMemo(() => items.filter((i) => i.is_checked), [items]);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      setItems(await fetchCart());
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);
  useEffect(() => subscribeToSync(['cart', 'fridge'], () => {
    void load().catch(() => undefined);
  }), [load]);

  const handleAdd = async (item: { name: string; quantity: number; unit: string }) => {
    // merge into an existing same-name item instead of adding a duplicate row
    const existing = items.find(
      (i) => i.name.trim().toLowerCase() === item.name.trim().toLowerCase(),
    );
    if (existing) {
      const next = (existing.quantity ?? 1) + item.quantity;
      setItems((prev) =>
        prev.map((i) => (i.item_uid === existing.item_uid ? { ...i, quantity: next } : i)),
      );
      try {
        await updateCartQuantity(existing.item_uid, next);
      } catch {
        void load().catch(() => undefined);
      }
      return;
    }
    const created = await addCartItem({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      source: 'manual',
    });
    setItems((prev) => [created, ...prev]);
  };

  const changeQty = async (item: CartItem, delta: number) => {
    const next = Math.max((item.quantity ?? 1) + delta, 1);
    setItems((prev) =>
      prev.map((i) => (i.item_uid === item.item_uid ? { ...i, quantity: next } : i)),
    );
    try {
      await updateCartQuantity(item.item_uid, next);
    } catch {
      void load().catch(() => undefined);
    }
  };

  const setQty = async (item: CartItem, raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next) || next <= 0) return;
    setItems((prev) =>
      prev.map((i) => (i.item_uid === item.item_uid ? { ...i, quantity: next } : i)),
    );
    try {
      await updateCartQuantity(item.item_uid, next);
    } catch {
      void load().catch(() => undefined);
    }
  };

  const onToggle = async (item: CartItem) => {
    const next = !item.is_checked;
    setItems((prev) =>
      prev.map((i) => (i.item_uid === item.item_uid ? { ...i, is_checked: next } : i)),
    );
    try {
      await toggleCartItem(item.item_uid, next);
    } catch {
      void load().catch(() => undefined);
    }
  };

  const onDelete = async (item: CartItem) => {
    setItems((prev) => prev.filter((i) => i.item_uid !== item.item_uid));
    try {
      await deleteCartItem(item.item_uid);
    } catch {
      void load().catch(() => undefined);
    }
  };

  // after checkout stocks some items, drop them from the cart
  const handleStocked = async (stockedUids: string[]) => {
    for (const uid of stockedUids) {
      try {
        await deleteCartItem(uid);
      } catch {
        // ignore; next load() reconciles
      }
    }
    setItems((prev) => prev.filter((i) => !stockedUids.includes(i.item_uid)));
  };

  if (loading) return <ActivityIndicator style={styles.spinner} />;
  return (
    <View style={styles.grow}>
      <View style={styles.cartActions}>
        <Pressable style={styles.peekBtn} onPress={() => setPeekVisible(true)}>
          <Text style={styles.peekText}>{t.shopping.peek.open}</Text>
        </Pressable>
        <Pressable style={styles.addBtn} onPress={() => setAddVisible(true)}>
          <Text style={styles.addBtnText}>+ {t.shopping.add}</Text>
        </Pressable>
        {/* checkout only appears once the user has confirmed (checked) items */}
        {checkedItems.length > 0 ? (
          <Pressable style={styles.checkoutBtn} onPress={() => setCheckoutVisible(true)}>
            <Text style={styles.checkoutText}>
              {t.shopping.checkout.open} ({checkedItems.length})
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.item_uid}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl colors={['#168ACB']} onRefresh={() => { void load(true).catch(() => undefined); }} refreshing={refreshing} tintColor="#168ACB" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable style={styles.check} onPress={() => onToggle(item)}>
              <Text style={styles.checkMark}>{item.is_checked ? '☑' : '☐'}</Text>
            </Pressable>
            <Text style={[styles.name, styles.grow, item.is_checked && styles.done]}>
              {item.name}
            </Text>
            {/* quantity stepper: −  [input]  ＋  unit */}
            <View style={styles.qtyBox}>
              <Pressable hitSlop={6} onPress={() => changeQty(item, -1)}>
                <Text style={styles.qtyBtn}>−</Text>
              </Pressable>
              <TextInput
                style={styles.qtyInput}
                value={String(item.quantity ?? 1)}
                onChangeText={(v) => setQty(item, v)}
                inputMode="numeric"
              />
              <Pressable hitSlop={6} onPress={() => changeQty(item, 1)}>
                <Text style={styles.qtyBtn}>＋</Text>
              </Pressable>
            </View>
            <Text style={styles.unitText} numberOfLines={1}>{unitLabel(item.unit)}</Text>
            <Pressable hitSlop={8} onPress={() => setPendingDelete(item)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t.shopping.cartEmpty}</Text>}
      />

      <ShoppingAddSheet
        visible={addVisible}
        inventoryNames={inventoryNames}
        inventoryByName={inventoryByName}
        onClose={() => setAddVisible(false)}
        onAdd={handleAdd}
      />
      {/* checkout only receives the confirmed (checked) items */}
      <ShoppingCheckoutReview
        visible={checkoutVisible}
        items={checkedItems}
        inventoryNames={inventoryNames}
        onClose={() => setCheckoutVisible(false)}
        onAllStocked={handleStocked}
      />
      <ShoppingInventoryPeek
        visible={peekVisible}
        onClose={() => setPeekVisible(false)}
      />

      {/* 中文：删除前的可视化确认，避免误删共享购物清单。 */}
      {/* EN: Visual confirm before deleting so shared cart items aren't removed by mistake. */}
      {pendingDelete ? (
        <View style={styles.confirmLayer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPendingDelete(null)} />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{t.shopping.deleteTitle}</Text>
            <Text style={styles.confirmBody}>{t.shopping.deleteBody(pendingDelete.name)}</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setPendingDelete(null)}>
                <Text style={styles.cancelText}>{t.shopping.deleteCancel}</Text>
              </Pressable>
              <Pressable
                style={styles.confirmDeleteBtn}
                onPress={() => { const it = pendingDelete; setPendingDelete(null); void onDelete(it); }}
              >
                <Text style={styles.confirmDeleteText}>{t.shopping.deleteConfirm}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  spinner: { marginTop: 24 },
  grow: { flex: 1 },
  eyebrow: { color: '#D47B21', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: {
    marginTop: 12,
    marginBottom: 20,
    color: '#183D32',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(70,91,81,0.10)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  toggleActive: { backgroundColor: '#FFFFFF' },
  toggleText: { color: '#6b7c76', fontWeight: '700', fontSize: 14 },
  toggleTextActive: { color: '#2e7d32' },
  listContent: { paddingBottom: 120 },
  cartActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  addBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    borderRadius: 10,
  },
  addBtnText: {width:'100%', textAlign:'center', color: '#fff', fontWeight: '700' },
  checkoutBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF812B',
    borderRadius: 10,
  },
  checkoutText: {width:'100%', textAlign:'center', color: '#fff', fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(70,91,81,0.15)',
  },
  check: { marginRight: 10 },
  checkMark: { fontSize: 20 },
  name: { fontSize: 16, color: '#244A3E' },
  sub: { fontSize: 13, color: '#718078', marginTop: 3 },
  done: { textDecorationLine: 'line-through', color: '#9aa8a1' },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
  },
  qtyBtn: { fontSize: 20, color: '#2e7d32', fontWeight: '800', width: 22, textAlign: 'center' },
  // 中文：固定宽度，数字位数变化时 ＋ 按钮和单位列不再错位。
  // EN: Fixed width so the ＋ button and unit column stay aligned as the digit count changes.
  qtyInput: {
    width: 40,
    textAlign: 'center',
    fontSize: 15,
    color: '#244A3E',
    fontWeight: '700',
    paddingVertical: 2,
  },
  unitText: { width: 44, marginRight: 4, fontSize: 13, color: '#718078', fontWeight: '600' },
  remove: { color: '#c62828', fontSize: 16, paddingHorizontal: 6 },
  confirmLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(23,32,29,0.4)',
  },
  confirmCard: { width: '100%', borderRadius: 22, backgroundColor: '#FBFCFA', padding: 22, gap: 10 },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: '#173D31' },
  confirmBody: { fontSize: 14, color: '#5A6E66', lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EDF1EF',
  },
  cancelText: { color: '#315C51', fontSize: 15, fontWeight: '800' },
  confirmDeleteBtn: {
    flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#C62828',
  },
  confirmDeleteText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#2e7d32',
    borderRadius: 8,
  },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#718078', marginTop: 40 },
  peekBtn: {
    flex: 1, height: 44, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#168ACB', borderRadius: 10,
  },
  peekText: {width:'100%', textAlign:'center', color: '#fff', fontWeight: '700', fontSize: 13 },
});