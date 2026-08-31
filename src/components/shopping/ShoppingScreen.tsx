// src/components/shopping/ShoppingScreen.tsx
// Shopping Mode (Epic E5). Two tabs:
//   - 'restock': suggested buys (需补货), derived from restock rules + stock
//   - 'cart':    the editable shopping cart (shopping_cart_items)
// Cart items support quantity edit (−/＋ and tap-to-type) and delete (US5.2).
// Adding goes through ShoppingAddSheet (US5.2.1) with a duplicate warning
// against current inventory (US5.3). A checkout review (US5.4) converts the
// cart into inventory drafts (US5.5).
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
import { getInventorySnapshot } from '../../services/inventoryApi';
import { subscribeToSync } from '../../services/realtimeSync';
import { ShoppingAddSheet } from './ShoppingAddSheet';
import { ShoppingCheckoutReview } from './ShoppingCheckoutReview';

type Tab = 'restock' | 'cart';

// Shared hook: load current inventory names once, for duplicate detection (US5.3).
// Arthur: NarIyirm
// 中文：购物手动录入复用库存快照中的名称做“可能已有”提示；只读 inventoryApi，不改变库存。
// EN: Manual cart entry reuses inventory snapshot names for possible-duplicate hints and never mutates inventory here.
function useInventoryNames() {
  const [names, setNames] = useState<Set<string>>(new Set());
  const reload = useCallback(async () => {
    try {
      const snap = await getInventorySnapshot();
      setNames(new Set(snap.batches.map((b) => b.name.trim().toLowerCase())));
    } catch {
      setNames(new Set()); // inventory unavailable -> no warnings, cart still works
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => subscribeToSync(['inventory', 'fridge'], () => {
    void reload();
  }), [reload]);
  return { names, reload };
}

// Arthur: NarIyirm
// 中文：购物功能的页面入口；在派生补货建议与 fridgeUid 共享购物车两个视图之间切换。
// EN: This is the shopping feature entry, switching between derived restock suggestions and the fridgeUid-shared cart.
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
// Arthur: NarIyirm
// 中文：补货视图读取 get_restock_suggestions 的派生结果，加入购物车后通知父级切换或刷新。
// EN: The restock view reads derived get_restock_suggestions results and notifies its parent after adding one to the cart.
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

// ---- 购物车 (editable list: add, quantity edit, delete, checkout) ----
// Arthur: NarIyirm
// 中文：共享购物车视图集中处理列表读取、数量、勾选和删除；每个 mutation 都通过 cartApi 回到 Express。
// EN: The shared cart view handles loading, quantity, checking, and deletion, with every mutation returning to Express through cartApi.
function CartView() {
  const { t } = useI18n();
  const { names: inventoryNames } = useInventoryNames();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

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
        <Pressable style={styles.addBtn} onPress={() => setAddVisible(true)}>
          <Text style={styles.addBtnText}>+ {t.shopping.add}</Text>
        </Pressable>
        {items.length > 0 ? (
          <Pressable style={styles.checkoutBtn} onPress={() => setCheckoutVisible(true)}>
            <Text style={styles.checkoutText}>{t.shopping.checkout.open}</Text>
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
        onClose={() => setAddVisible(false)}
        onAdd={handleAdd}
      />
      <ShoppingCheckoutReview
        visible={checkoutVisible}
        items={items}
        inventoryNames={inventoryNames}
        onClose={() => setCheckoutVisible(false)}
        onAllStocked={handleStocked}
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
  addBtnText: { color: '#fff', fontWeight: '700' },
  checkoutBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF812B',
    borderRadius: 10,
  },
  checkoutText: { color: '#fff', fontWeight: '700' },
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
});
