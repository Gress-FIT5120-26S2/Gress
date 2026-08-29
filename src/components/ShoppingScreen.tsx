// src/components/ShoppingScreen.tsx
// The screen shown on the 'shopping' tab (reached by tapping the 3D cart or
// the tab bar). A toggle switches between:
//   - 'restock': suggested buys (需补货), derived from restock rules + stock
//   - 'cart':    the editable shopping cart (shopping_cart_items)
// All copy comes from i18n (t.shopping / t.screens.shopping) so it follows the
// language switch. Mounted inside App's standardContent wrapper, which already
// applies top + horizontal padding.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useI18n } from '../i18n';
import {
  fetchCart,
  addCartItem,
  toggleCartItem,
  deleteCartItem,
  fetchRestock,
  CartItem,
  RestockSuggestion,
} from '../services/cartApi';

type Tab = 'restock' | 'cart';

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchRestock());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async (s: RestockSuggestion) => {
    // buy up to the target quantity; fall back to undefined if that's <= 0
    const qty = Math.max(s.target_quantity - s.current_quantity, 0) || undefined;
    await addCartItem({ name: s.name, unit: s.unit, quantity: qty, source: 'restock' });
    onAdded(); // jump to the cart so the user sees it landed
  };

  if (loading) return <ActivityIndicator style={styles.spinner} />;
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.rule_uid}
      contentContainerStyle={styles.listContent}
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

// ---- 购物车 (editable list) ----
function CartView() {
  const { t } = useI18n();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchCart());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const onAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName('');
    try {
      const created = await addCartItem({ name: trimmed });
      setItems((prev) => [created, ...prev]);
    } catch {
      load();
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
      load();
    }
  };

  const onDelete = async (item: CartItem) => {
    setItems((prev) => prev.filter((i) => i.item_uid !== item.item_uid));
    try {
      await deleteCartItem(item.item_uid);
    } catch {
      load();
    }
  };

  if (loading) return <ActivityIndicator style={styles.spinner} />;
  return (
    <>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t.shopping.placeholder}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <Pressable style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>{t.shopping.add}</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.item_uid}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable style={styles.check} onPress={() => onToggle(item)}>
              <Text style={styles.checkMark}>{item.is_checked ? '☑' : '☐'}</Text>
            </Pressable>
            <Text style={[styles.name, styles.grow, item.is_checked && styles.done]}>
              {item.name}
              {item.quantity ? ` ×${item.quantity}${item.unit ?? ''}` : ''}
            </Text>
            <Pressable hitSlop={8} onPress={() => onDelete(item)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t.shopping.cartEmpty}</Text>}
      />
    </>
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
  listContent: { paddingBottom: 120 }, // clear the floating tab bar
  inputRow: { flexDirection: 'row', marginBottom: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(70,91,81,0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  addBtn: {
    marginLeft: 8,
    paddingHorizontal: 18,
    height: 44,
    justifyContent: 'center',
    backgroundColor: '#2e7d32',
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700' },
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