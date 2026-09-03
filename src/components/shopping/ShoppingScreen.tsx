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
    const qty = Math.max(s.target_quantity - s.current_quantity, 0) || undefined;
    await addCartItem({ name: s.name, unit: s.unit, quantity: qty, source: 'restock' });
    onAdded();
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
            {/* quantity stepper: −  [input]  ＋ */}
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
            <Pressable hitSlop={8} onPress={() => onDelete(item)}>
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
  qtyInput: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: 15,
    color: '#244A3E',
    fontWeight: '700',
    paddingVertical: 2,
  },
  remove: { color: '#c62828', fontSize: 16, paddingHorizontal: 6 },
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