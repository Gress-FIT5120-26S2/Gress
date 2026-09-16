// src/components/shopping/ShoppingScreen.tsx
// Shopping Mode (Epic E5). Two tabs:
//   - 'restock': suggested buys (需补货), derived from restock rules + stock
//   - 'cart':    the editable shopping cart (shopping_cart_items)
// Cart items support quantity edit (−/＋ and tap-to-type), delete, and tap-to-edit
// (reopens the add-to-cart form). The old checkbox "confirm" step (US5.2) was
// removed by request -- the whole cart goes to checkout review (US5.4) and
// becomes inventory (US5.5), with no separate confirmed/unconfirmed split.
// NOTE: this file lives in components/shopping/, so imports reach up two levels.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '../../i18n';
import {
  fetchCart,
  addCartItem,
  updateCartQuantity,
  updateCartItem,
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
import { ShoppingManualEntry } from './ShoppingManualEntry';
import { getMaxInventoryQuantity } from '../../utils/inventoryValidation';

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

// 中文：建议购物页用的购物车名称集合；实时订阅，"已加入" 状态永远反映真实购物车。
// EN: Cart-name lookup for the Suggested page, kept live so "already added" always matches the real cart.
function useCartNames() {
  const [names, setNames] = useState<Set<string>>(new Set());
  const reload = useCallback(async () => {
    try {
      const cart = await fetchCart();
      setNames(new Set(cart.map((i) => i.name.trim().toLowerCase())));
    } catch {
      setNames(new Set());
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => subscribeToSync(['cart', 'fridge'], () => {
    void reload();
  }), [reload]);
  return names;
}

export function ShoppingScreen() {
  const { t } = useI18n();
  const screen = t.screens.shopping;
  const [tab, setTab] = useState<Tab>('restock');

  // 中文：分段控件的滑块在两个 tab 位置间做动画，宽度等 onLayout 量出来再渲染。
  // EN: The segmented control's pill animates between the two tab positions; width comes from onLayout.
  const [toggleWidth, setToggleWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(indicatorX, {
      toValue: tab === 'restock' ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, indicatorX]);

  // 中文：切换 tab 时内容淡入，不是硬切。
  // EN: Content fades in on tab switch instead of a hard cut.
  const contentOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [tab, contentOpacity]);

  const pillWidth = toggleWidth > 8 ? (toggleWidth - 8) / 2 : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{screen.eyebrow}</Text>

      <View style={[styles.toggle, styles.toggleNoTitle]} onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width)}>
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toggleIndicator,
              {
                width: pillWidth,
                transform: [{ translateX: indicatorX.interpolate({ inputRange: [0, 1], outputRange: [0, pillWidth] }) }],
              },
            ]}
          />
        ) : null}
        {(['restock', 'cart'] as Tab[]).map((v) => (
          <Pressable
            key={v}
            style={({ pressed }) => [styles.toggleBtn, pressed && styles.pressedDim]}
            onPress={() => setTab(v)}
          >
            <Text style={[styles.toggleText, tab === v && styles.toggleTextActive]}>
              {v === 'restock' ? t.shopping.restockTab : t.shopping.cartTab}
            </Text>
          </Pressable>
        ))}
      </View>

      <Animated.View style={[styles.grow, { opacity: contentOpacity }]}>
        {tab === 'restock' ? <RestockView /> : <CartView />}
      </Animated.View>
    </View>
  );
}

// ---- 建议购物 / 需补货 (derived, read-only + "add to cart") ----
function RestockView() {
  const { t } = useI18n();
  const [items, setItems] = useState<RestockSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const cartNames = useCartNames();

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const next = await fetchRestock();
      setItems(next);
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

  // 中文：正在提交的建议（点单个或批量加都会进来），realtime 确认后再从这里摘掉。
  // EN: Suggestions currently being submitted (single tap or bulk); dropped once realtime confirms them.
  const [addingUids, setAddingUids] = useState<Set<string>>(new Set());
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());

  const isAlreadyInCart = useCallback(
    (item: RestockSuggestion) => cartNames.has(item.name.trim().toLowerCase()) || addingUids.has(item.rule_uid),
    [cartNames, addingUids],
  );

  const addOne = useCallback(async (s: RestockSuggestion) => {
    // 补货差值 = 目标量 − 当前量，至少补 1
    const delta = Math.max(Math.round(s.target_quantity - s.current_quantity), 1);
    setAddingUids((prev) => new Set(prev).add(s.rule_uid));
    try {
      // 服务端对重复的补货项做 upsert，不会报错
      await addCartItem({ name: s.name, unit: s.unit, quantity: delta, source: 'restock' });
    } catch {
      setAddingUids((prev) => {
        const next = new Set(prev);
        next.delete(s.rule_uid);
        return next;
      });
    }
  }, []);

  const addSelected = useCallback(async () => {
    const targets = items.filter((i) => selectedUids.has(i.rule_uid) && !isAlreadyInCart(i));
    setSelectedUids(new Set());
    await Promise.all(targets.map((i) => addOne(i)));
  }, [items, selectedUids, isAlreadyInCart, addOne]);

  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  // 中文：cartNames 确认某条已在购物车后，从 addingUids 里摘掉，避免删了还显示"已添加"。
  // EN: Drop an item from addingUids once cartNames confirms it, so a later delete isn't stuck showing "Added".
  useEffect(() => {
    if (addingUids.size === 0) return;
    let changed = false;
    const next = new Set(addingUids);
    for (const uid of addingUids) {
      const target = items.find((i) => i.rule_uid === uid);
      if (target && cartNames.has(target.name.trim().toLowerCase())) {
        next.delete(uid);
        changed = true;
      }
    }
    if (changed) setAddingUids(next);
  }, [cartNames, addingUids, items]);

  if (loading) return <ActivityIndicator style={styles.spinner} />;
  return (
    <View style={styles.grow}>
      {/* 批量加入按钮复用购物车结账用的动画组件 */}
      <AnimatedCheckoutButton count={selectedUids.size} label={t.shopping.addSelected} onPress={() => void addSelected()} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.rule_uid}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl colors={['#168ACB']} onRefresh={() => { void load(true).catch(() => undefined); }} refreshing={refreshing} tintColor="#168ACB" />}
        renderItem={({ item }) => {
          const alreadyInCart = isAlreadyInCart(item);
          const selected = selectedUids.has(item.rule_uid);
          return (
            <View style={styles.row}>
              <Pressable
                hitSlop={8}
                disabled={alreadyInCart}
                onPress={() => toggleSelect(item.rule_uid)}
                style={({ pressed }) => [styles.check, pressed && !alreadyInCart && styles.pressedDim]}
              >
                <Text style={[styles.checkMark, alreadyInCart && styles.checkMarkDisabled]}>
                  {alreadyInCart || selected ? '☑' : '☐'}
                </Text>
              </Pressable>
              <View style={styles.grow}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>
                  {t.shopping.remaining(item.current_quantity, item.minimum_quantity, item.unit)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.smallBtn,
                  alreadyInCart && styles.smallBtnAdded,
                  pressed && !alreadyInCart && styles.pressedDim,
                ]}
                onPress={() => void addOne(item)}
                disabled={alreadyInCart}
              >
                <Text style={[styles.smallBtnText, alreadyInCart && styles.smallBtnTextAdded]}>
                  {alreadyInCart ? t.shopping.added : t.shopping.addToCart}
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{t.shopping.restockEmpty}</Text>}
      />
    </View>
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
  const [pendingDelete, setPendingDelete] = useState<CartItem | null>(null);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  // 中文：确认删除时不在关掉确认 Modal 的同一帧里改 items，等它关完再改，避免跟 Modal
  //       拆除的原生过渡撞在一起（这类撞车在 iOS 上出现过 EXC_BAD_ACCESS 崩溃）。
  // EN: Delay mutating items until after the confirm Modal has actually closed, instead of
  //     doing it in the same frame -- overlapping with the Modal's native teardown has caused
  //     an EXC_BAD_ACCESS crash on iOS.
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current); }, []);

  const unitLabel = (u: string | null) =>
    u ? ((t.fridge.manualEntry.units as Record<string, string>)[u] ?? u) : '';

  // 中文：输入框里正在打的字，跟 item.quantity 分开存，失焦才校验提交，避免清空后打不进去。
  // EN: What's typed kept separate from item.quantity; validated on blur so clearing the box doesn't get stuck.
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  // 中文：碰到数量上下限时的短暂提示，自动收起。
  // EN: A brief hint when a quantity bound is hit, auto-dismissed.
  const [qtyHint, setQtyHint] = useState<{ uid: string; message: string } | null>(null);
  const qtyHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (qtyHintTimer.current) clearTimeout(qtyHintTimer.current); }, []);
  const showQtyHint = useCallback((uid: string, message: string) => {
    if (qtyHintTimer.current) clearTimeout(qtyHintTimer.current);
    setQtyHint({ uid, message });
    qtyHintTimer.current = setTimeout(() => setQtyHint(null), 1800);
  }, []);
  const qtyBounds = (unit: string | null) => {
    const max = getMaxInventoryQuantity(unit ?? 'item');
    return { max, label: t.shopping.qtyHint.max(max - 1, unitLabel(unit)) };
  };

  // 中文：用 useMemo 钉住引用，避免每次重渲染都传一个新对象给编辑表单，打字打到一半被重填。
  // EN: useMemo pins the reference so the edit form isn't reset mid-keystroke by a fresh object on every re-render.
  const editingInitialValues = useMemo(
    () => (editingItem ? { name: editingItem.name, quantity: editingItem.quantity ?? 1, unit: editingItem.unit ?? 'item' } : null),
    [editingItem],
  );

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
    const { max } = qtyBounds(item.unit);
    const current = item.quantity ?? 1;
    const desired = current + delta;
    const next = Math.min(Math.max(desired, 1), max - 1);
    if (next === current) {
      showQtyHint(item.item_uid, desired < 1 ? t.shopping.qtyHint.min : qtyBounds(item.unit).label);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.item_uid === item.item_uid ? { ...i, quantity: next } : i)),
    );
    try {
      await updateCartQuantity(item.item_uid, next);
    } catch {
      void load().catch(() => undefined);
    }
  };

  const draftQty = (item: CartItem, raw: string) => {
    setQtyDrafts((prev) => ({ ...prev, [item.item_uid]: raw }));
  };

  const commitQty = (item: CartItem) => {
    const raw = qtyDrafts[item.item_uid];
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[item.item_uid];
      return next;
    });
    if (raw === undefined) return; // stepper-only change, nothing typed
    const next = Number(raw);
    const { max, label } = qtyBounds(item.unit);
    if (!raw.trim() || !Number.isFinite(next) || next <= 0) {
      if (raw.trim()) showQtyHint(item.item_uid, t.shopping.qtyHint.min);
      return; // empty or invalid -- silently revert, no network call
    }
    if (next >= max) {
      showQtyHint(item.item_uid, label);
      return;
    }
    if (next === item.quantity) return;
    setItems((prev) =>
      prev.map((i) => (i.item_uid === item.item_uid ? { ...i, quantity: next } : i)),
    );
    updateCartQuantity(item.item_uid, next).catch(() => { void load().catch(() => undefined); });
  };

  const saveEdit = async (item: CartItem, values: { name: string; quantity: number; unit: string }) => {
    setItems((prev) =>
      prev.map((i) => (i.item_uid === item.item_uid ? { ...i, ...values } : i)),
    );
    try {
      await updateCartItem(item.item_uid, values);
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
        <Pressable
          style={({ pressed }) => [styles.peekBtn, pressed && styles.pressedDim]}
          onPress={() => setPeekVisible(true)}
        >
          <Text style={styles.peekText}>{t.shopping.peek.open}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressedDim]}
          onPress={() => setAddVisible(true)}
        >
          <Text style={styles.addBtnText}>+ {t.shopping.add}</Text>
        </Pressable>
      </View>

      {/* 每个购物车项都能结账，按钮只反映购物车是否为空 */}
      <AnimatedCheckoutButton count={items.length} label={t.shopping.checkout.open} onPress={() => setCheckoutVisible(true)} />

      <FlatList
        data={items}
        keyExtractor={(i) => i.item_uid}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl colors={['#168ACB']} onRefresh={() => { void load(true).catch(() => undefined); }} refreshing={refreshing} tintColor="#168ACB" />}
        renderItem={({ item }) => {
          // 中文：草稿优先于服务器值显示；宽度按位数动态给，避免大数字被裁切。
          // EN: The draft takes priority over the server value; width scales with digit count so large numbers aren't clipped.
          const displayQty = qtyDrafts[item.item_uid] ?? String(item.quantity ?? 1);
          const qtyInputWidth = Math.max(32, displayQty.length * 12 + 12);
          const showHint = qtyHint?.uid === item.item_uid;
          return (
            <View>
              {/* 点整行（数量/删除按钮除外）重新打开编辑表单 */}
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressedDim]}
                onPress={() => setEditingItem(item)}
              >
                <Text style={[styles.name, styles.grow]}>
                  {item.name}
                </Text>
                {/* quantity stepper: −  [input]  ＋  unit */}
                <View style={styles.qtyBox}>
                  <Pressable
                    hitSlop={6}
                    style={({ pressed }) => [styles.qtyBtnHit, pressed && styles.pressedDim]}
                    onPress={() => changeQty(item, -1)}
                  >
                    <Text style={styles.qtyBtn}>−</Text>
                  </Pressable>
                  <TextInput
                    style={[styles.qtyInput, { width: qtyInputWidth }]}
                    value={displayQty}
                    onChangeText={(v) => draftQty(item, v)}
                    onBlur={() => commitQty(item)}
                    maxLength={7}
                    inputMode="numeric"
                  />
                  <Pressable
                    hitSlop={6}
                    style={({ pressed }) => [styles.qtyBtnHit, pressed && styles.pressedDim]}
                    onPress={() => changeQty(item, 1)}
                  >
                    <Text style={styles.qtyBtn}>＋</Text>
                  </Pressable>
                </View>
                <Text style={styles.unitText} numberOfLines={1}>{unitLabel(item.unit)}</Text>
                <Pressable
                  hitSlop={8}
                  style={({ pressed }) => [styles.removeHit, pressed && styles.pressedDim]}
                  onPress={() => setPendingDelete(item)}
                >
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              </Pressable>
              {showHint ? <Text style={styles.qtyHintText}>{qtyHint.message}</Text> : null}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{t.shopping.cartEmpty}</Text>}
      />

      <ShoppingAddSheet
        visible={addVisible}
        inventoryNames={inventoryNames}
        inventoryByName={inventoryByName}
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
      <ShoppingInventoryPeek
        visible={peekVisible}
        onClose={() => setPeekVisible(false)}
      />

      {pendingDelete ? (
        <DeleteConfirmCard
          itemName={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const it = pendingDelete;
            setPendingDelete(null);
            if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
            pendingDeleteTimer.current = setTimeout(() => { void onDelete(it); }, 350);
          }}
        />
      ) : null}

      {/* tapping a cart row reopens this same "add to cart" form, pre-filled, to edit it */}
      <ShoppingManualEntry
        visible={editingItem !== null}
        inventoryNames={inventoryNames}
        inventoryByName={inventoryByName}
        initialValues={editingInitialValues}
        onClose={() => setEditingItem(null)}
        onSubmit={(values) => { if (editingItem) return saveEdit(editingItem, values); }}
      />
    </View>
  );
}

// ---- 结账按钮：购物车有东西才出现，出现/消失做缩放+淡入淡出，按下有回弹 ----
function AnimatedCheckoutButton({
  count,
  label,
  onPress,
}: {
  count: number;
  label: string;
  onPress: () => void;
}) {
  const visible = count > 0;
  // 中文：淡出动画播完前保持渲染，不然看不到消失过程。
  // EN: Stay mounted until the fade-out finishes, or the exit animation gets skipped.
  const [rendered, setRendered] = useState(visible);
  const presence = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) setRendered(true);
    Animated.timing(presence, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: visible ? Easing.out(Easing.back(1.4)) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setRendered(false);
    });
  }, [visible, presence]);

  if (!rendered) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        opacity: presence,
        transform: [{ scale: presence.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(press, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
      >
        <Animated.View style={{ transform: [{ scale: press }] }}>
          <LinearGradient
            colors={['#FF9A44', '#FF6B1A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.checkoutBtn}
          >
            <Ionicons name="bag-check-outline" size={19} color="#FFFFFF" />
            <Text style={styles.checkoutText}>{label}</Text>
            <View style={styles.checkoutBadge}>
              <Text style={styles.checkoutBadgeText}>{count}</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ---- 删除确认卡片：全屏 Modal，遮罩用原生 fade，卡片自己弹一下缩放 ----
function DeleteConfirmCard({
  itemName,
  onCancel,
  onConfirm,
}: {
  itemName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 9 }).start();
  }, [entrance]);

  return (
    // 中文：用原生 Modal 才能盖住整个屏幕（含标题栏和 tab）；卡片缩放不跟遮罩淡入绑同一个值，
    //       就算动画没跑起来卡片也不会整个看不见。
    // EN: A native Modal covers the whole screen (title + tabs included); the card's scale isn't
    //     tied to the backdrop's fade so it stays visible even if that animation never runs.
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel} visible>
      <View style={styles.confirmLayer}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View
          style={[
            styles.confirmCard,
            { transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] },
          ]}
        >
          <Text style={styles.confirmTitle}>{t.shopping.deleteTitle}</Text>
          <Text style={styles.confirmBody}>{t.shopping.deleteBody(itemName)}</Text>
          <View style={styles.confirmActions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressedDim]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{t.shopping.deleteCancel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.confirmDeleteBtn, pressed && styles.pressedDim]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmDeleteText}>{t.shopping.deleteConfirm}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  spinner: { marginTop: 24 },
  grow: { flex: 1 },
  eyebrow: { color: '#D47B21', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(70,91,81,0.10)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleNoTitle: { marginTop: 14 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  toggleActive: { backgroundColor: '#FFFFFF' },
  toggleIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    shadowColor: '#173D31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    marginBottom: 12,
    borderRadius: 14,
    shadowColor: '#C9550A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  checkoutBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  checkoutBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(70,91,81,0.15)',
  },
  name: { fontSize: 16, color: '#244A3E' },
  sub: { fontSize: 13, color: '#718078', marginTop: 3 },
  check: { marginRight: 10 },
  checkMark: { fontSize: 20, color: '#2e7d32' },
  checkMarkDisabled: { color: '#B7C2BC' },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
  },
  qtyBtnHit: { borderRadius: 8 },
  qtyBtn: { fontSize: 20, color: '#2e7d32', fontWeight: '800', width: 22, textAlign: 'center' },
  qtyInput: {
    width: 40,
    textAlign: 'center',
    fontSize: 15,
    color: '#244A3E',
    fontWeight: '700',
    paddingVertical: 2,
  },
  unitText: { width: 44, marginRight: 4, fontSize: 13, color: '#718078', fontWeight: '600' },
  qtyHintText: { paddingBottom: 8, paddingLeft: 4, color: '#C96E1A', fontSize: 12, fontWeight: '700' },
  removeHit: { borderRadius: 8 },
  remove: { color: '#c62828', fontSize: 16, paddingHorizontal: 6 },
  pressedDim: { opacity: 0.68, transform: [{ scale: 0.97 }] },
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
    shadowColor: '#173D31',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
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
  smallBtnAdded: { backgroundColor: '#E3F1E4' },
  smallBtnTextAdded: { color: '#2e7d32' },
  empty: { textAlign: 'center', color: '#718078', marginTop: 40 },
  peekBtn: {
    flex: 1, height: 44, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#168ACB', borderRadius: 10,
  },
  peekText: {width:'100%', textAlign:'center', color: '#fff', fontWeight: '700', fontSize: 13 },
});
