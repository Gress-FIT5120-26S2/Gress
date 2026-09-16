// src/components/shopping/ShoppingScreen.tsx
// Shopping Mode (Epic E5). Two tabs, swipeable horizontally:
//   - 'restock': suggested buys (需补货), derived from restock rules + stock
//   - 'cart':    the editable shopping cart (shopping_cart_items)
// Tap the segmented control or swipe the pager to switch; both panes stay mounted.
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
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  ScrollView,
} from 'react-native';

// 中文：安卓的旧架构默认不开 LayoutAnimation；这行只在支持的平台生效，包一层 try 防止某些安卓版本报错。
// EN: Android's old architecture has LayoutAnimation off by default; this only takes effect where supported, guarded in case a given Android build rejects it.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // ignore -- rows just won't animate their add/remove on this device
  }
}
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

// 中文：给"建议购物"页用的购物车名称集合，跟 useInventoryNames 是同一个思路：
//       实时订阅购物车变化，这样某个建议是否"已加入购物车"永远反映真实状态——
//       用户在购物车页删掉它或改了数量，回到建议页按钮会自动变回 "加入购物车"，
//       不会因为按钮只认自己点没点过而跟真实购物车不同步（误删/数量不对也不会被掩盖）。
// EN: Cart-name lookup for the Suggested page, mirroring useInventoryNames: it subscribes to cart
//     changes in real time so whether a suggestion is "already in the cart" always reflects the
//     actual cart -- if the user deletes it (or changes its quantity) from the cart tab, coming
//     back here flips the button back to "Add to cart" instead of it only remembering "I was
//     clicked once", which could silently disagree with an accidental delete or a quantity edit.
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

  // Arthur: NarIyirm
  // 中文：Suggested / Cart 用横向分页滑动切换；顶部分段仍可点按，滑块跟手移动。
  // EN: Suggested and Cart switch by horizontal paging; the segmented control stays tappable and the pill tracks the finger.
  const [toggleWidth, setToggleWidth] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const pageWidthRef = useRef(0);

  const pillWidth = toggleWidth > 8 ? (toggleWidth - 8) / 2 : 0;
  const pageWidth = pageSize.width;

  const selectTab = useCallback((next: Tab) => {
    setTab(next);
    const width = pageWidthRef.current;
    if (width <= 0) return;
    pagerRef.current?.scrollTo({ x: next === 'restock' ? 0 : width, animated: true });
  }, []);

  const handlePagerLayout = useCallback((width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    const widthChanged = Math.abs(width - pageWidthRef.current) >= 1;
    pageWidthRef.current = width;
    setPageSize((current) => (
      Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
        ? current
        : { width, height }
    ));
    // Arthur: NarIyirm
    // 中文：宽度变化（旋转/安全区）后按当前 tab 重新对齐页，避免停在两页中间。
    // EN: After a width change from rotation or safe-area shifts, re-align to the active tab so the pager does not stop between pages.
    if (widthChanged) {
      requestAnimationFrame(() => {
        pagerRef.current?.scrollTo({ x: tab === 'restock' ? 0 : width, animated: false });
      });
    }
  }, [tab]);

  const handlePagerScrollEnd = useCallback((offsetX: number) => {
    const width = pageWidthRef.current;
    if (width <= 0) return;
    const next: Tab = Math.round(offsetX / width) >= 1 ? 'cart' : 'restock';
    setTab((current) => (current === next ? current : next));
  }, []);

  return (
    <View style={styles.container}>
      {/* 中文：大标语（"Shop with the kitchen in mind" 之类）删掉了，太占地方；小标签留着当页面标识。 */}
      {/* EN: The big tagline ("Shop with the kitchen in mind" etc.) was dropped for taking up too much space; the small eyebrow label stays as the page's identifier. */}
      <Text style={styles.eyebrow}>{screen.eyebrow}</Text>

      <View style={[styles.toggle, styles.toggleNoTitle]} onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width)}>
        {pillWidth > 0 && pageWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toggleIndicator,
              {
                width: pillWidth,
                transform: [{
                  translateX: scrollX.interpolate({
                    inputRange: [0, pageWidth],
                    outputRange: [0, pillWidth],
                    extrapolate: 'clamp',
                  }),
                }],
              },
            ]}
          />
        ) : pillWidth > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.toggleIndicator,
              { width: pillWidth, transform: [{ translateX: tab === 'cart' ? pillWidth : 0 }] },
            ]}
          />
        ) : null}
        {(['restock', 'cart'] as Tab[]).map((v) => (
          <Pressable
            key={v}
            style={({ pressed }) => [styles.toggleBtn, pressed && styles.pressedDim]}
            onPress={() => selectTab(v)}
          >
            <Text style={[styles.toggleText, tab === v && styles.toggleTextActive]}>
              {v === 'restock' ? t.shopping.restockTab : t.shopping.cartTab}
            </Text>
          </Pressable>
        ))}
      </View>

      <View
        style={styles.grow}
        onLayout={(e) => handlePagerLayout(e.nativeEvent.layout.width, e.nativeEvent.layout.height)}
      >
        {pageSize.width > 0 && pageSize.height > 0 ? (
          <Animated.ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            bounces={false}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            style={styles.pager}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true },
            )}
            onMomentumScrollEnd={(event) => handlePagerScrollEnd(event.nativeEvent.contentOffset.x)}
          >
            <View style={{ width: pageSize.width, height: pageSize.height }}>
              <RestockView />
            </View>
            <View style={{ width: pageSize.width, height: pageSize.height }}>
              <CartView />
            </View>
          </Animated.ScrollView>
        ) : null}
      </View>
    </View>
  );
}

// ---- 建议购物 / 需补货 (derived, read-only + "add to cart") ----
function RestockView() {
  const { t } = useI18n();
  const [items, setItems] = useState<RestockSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // 中文：某条建议是否已经在购物车里，实时订阅得来，不是"我点没点过"这种本地记忆。
  // EN: Whether a suggestion is already in the cart, from a live subscription -- not local "did I click it" memory.
  const cartNames = useCartNames();

  // 中文：待补货清单是派生数据，列表内容变化时用 LayoutAnimation 让行的增减/位移过渡一下，而不是硬跳。
  // EN: The restock list is derived data; LayoutAnimation smooths rows appearing/disappearing/reordering instead of a hard jump.
  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const next = await fetchRestock();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  // 中文：点击后立刻标"已添加"（不等 realtime 订阅那一轮往返），realtime 回来之后
  //       cartNames 也会认可同一个结论，两者衔接上不会闪烁；失败了才退回原按钮。
  //       不再自动跳转购物车 tab——建议页现在自己维护"是否已加入"的状态，用户可以
  //       连着点好几条建议都留在这页，不用每次都被强制切走。原来是单个 uid，现在改成
  //       一个集合，因为批量加入时会同时有好几条处于"正在提交"的状态。
  // EN: Tapping marks it "added" immediately (without waiting for the realtime round trip);
  //     once that subscription catches up, cartNames agrees with the same conclusion so there's
  //     no flicker between the two. A failure reverts the button. No more auto-jumping to the
  //     cart tab -- the Suggested page now tracks "already added" itself, so the user can add
  //     several suggestions in a row without being bounced away each time. This used to be a
  //     single uid; it's a set now because a bulk add has several rows "in flight" at once.
  const [addingUids, setAddingUids] = useState<Set<string>>(new Set());
  // 中文：用户勾选出来准备批量加入购物车的建议。
  // EN: Suggestions the user has checked off to add to the cart in one batch.
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());

  const isAlreadyInCart = useCallback(
    (item: RestockSuggestion) => cartNames.has(item.name.trim().toLowerCase()) || addingUids.has(item.rule_uid),
    [cartNames, addingUids],
  );

  const addOne = useCallback(async (s: RestockSuggestion) => {
    // 中文：补货差值 = 目标量 − 当前量；至少补 1，避免出现 0 或负数。
    // EN: Restock delta = target − current; clamp to at least 1 so it is never 0 or negative.
    const delta = Math.max(Math.round(s.target_quantity - s.current_quantity), 1);
    setAddingUids((prev) => new Set(prev).add(s.rule_uid));
    try {
      // 服务端对已在清单里的补货项做 upsert，这里不再因重复而报错。
      // The server upserts restock items already on the list, so a repeat no longer errors.
      await addCartItem({ name: s.name, unit: s.unit, quantity: delta, source: 'restock' });
    } catch {
      // 忽略：realtime 同步或下次刷新会兜底。
      // Ignore: realtime sync or the next refresh reconciles.
      setAddingUids((prev) => {
        const next = new Set(prev);
        next.delete(s.rule_uid);
        return next;
      });
    }
  }, []);

  // 中文：批量加入所有勾选项（跳过已经在购物车里的），并行发出请求，清空勾选。
  // EN: Add every checked item (skipping ones already in the cart) in parallel, then clear the selection.
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

  // 中文：一旦 cartNames（真实来源）也确认某条已经在购物车里，就把它从"正在提交"里摘掉；
  //       不摘的话，之后用户真的从购物车删掉它，这里会因为还记着它而继续显示"已添加"。
  // EN: Once cartNames (the source of truth) agrees an item is in the cart, drop it from "in
  //     flight" -- otherwise, if the user later actually deletes it from the cart, this would
  //     keep showing "Added" because it's still being remembered here.
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
      {/* 批量加入按钮复用购物车结账用的同一个动画组件——有勾选时弹入，勾选清空时弹出 */}
      {/* Reuses the same animated button the cart's checkout uses -- pops in once something is checked, pops out once the selection is cleared */}
      <AnimatedCheckoutButton count={selectedUids.size} label={t.shopping.addSelected} onPress={() => void addSelected()} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.rule_uid}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl colors={['#168ACB']} onRefresh={() => { void load(true).catch(() => undefined); }} refreshing={refreshing} tintColor="#168ACB" />}
        renderItem={({ item }) => {
          // 中文：已在购物车 = 真实购物车里有同名项(cartNames)，或者刚点了还没等到 realtime 确认(addingUids)。
          // EN: "Already in cart" = the real cart has a matching name (cartNames), or it was just tapped and realtime hasn't confirmed yet (addingUids).
          const alreadyInCart = isAlreadyInCart(item);
          const selected = selectedUids.has(item.rule_uid);
          return (
            <View style={styles.row}>
              {/* 已经在购物车里的没什么好勾的，禁用掉 */}
              {/* Nothing to check for something already in the cart, so this is disabled */}
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
  // 中文：待确认删除的购物项；非空时显示确认卡片，避免误删共享清单里的东西。
  // EN: Cart item awaiting delete confirmation; while set, a confirm card is shown so shared-list items aren't removed by accident.
  const [pendingDelete, setPendingDelete] = useState<CartItem | null>(null);
  // 中文：正在编辑的购物项；点一行就打开跟"加入购物车"同一张表单，预填当前值。
  // EN: Cart item currently being edited; tapping a row reopens the same add-to-cart form, pre-filled with its current values.
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  // 中文：把单位代码转成当前语言的短标签，未知代码就原样显示。
  // EN: Turn a unit code into a short localized label, falling back to the raw code.
  const unitLabel = (u: string | null) =>
    u ? ((t.fridge.manualEntry.units as Record<string, string>)[u] ?? u) : '';

  // 中文：数量输入框正在打的字，跟 item.quantity 分开存。之前直接把输入框绑定到 item.quantity，
  //       清空框（空字符串）会被 setQty 判定为非法而拒绝更新，输入框却已经清空了——
  //       下一次渲染又把它强制拉回旧数字，看起来就像"打不进去/失控"。现在允许框里先自由打字，
  //       失焦时才校验并提交，非法就把草稿丢掉、回退显示原数值。
  // EN: What's currently typed in the quantity box, kept separate from item.quantity. It used to
  //     bind straight to item.quantity, so clearing the box (empty string) was rejected by setQty
  //     as invalid while the box itself was already empty -- the next render then snapped it back
  //     to the old number, which read as "can't type / out of control". Now the box can be typed
  //     into freely and only validates + commits on blur, discarding the draft and reverting the
  //     display if what was typed turns out invalid.
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  // 中文：+/- 或输入触达上下限时，短暂显示一句提示，用 setTimeout 自动收起。
  // EN: A brief hint shown when +/-, or typing, hits the floor/ceiling; auto-dismissed with setTimeout.
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

  // 中文：不能在 JSX 里现写 `{ name: ..., quantity: ... }`——那样每次 CartView 重渲染
  //       （比如 realtime 同步刷新了 items）都会生成一个新对象，即使 editingItem 本身没变，
  //       传给 ShoppingManualEntry 的 initialValues 引用也会变。用 useMemo 钉住引用：
  //       只要 editingItem 这个对象没换，引用就不变，编辑框不会被意外重填打断打字。
  // EN: This can't be written inline as `{ name: ..., quantity: ... }` in the JSX -- that would
  //     construct a brand-new object on every CartView re-render (e.g. a realtime sync refreshing
  //     items), even when editingItem itself hasn't changed, so ShoppingManualEntry's
  //     initialValues reference would keep changing too. useMemo pins the reference: as long as
  //     editingItem is the same object, the reference stays stable and the edit form won't be
  //     reset mid-keystroke.
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((prev) => [created, ...prev]);
  };

  // 中文：+/- 和直接输入两条路径都要挡住异常数量，跟 ShoppingManualEntry 用同一套按单位缩放的上限；
  //       碰到上下限时给一句提示，而不是悄悄地不做事。
  // EN: Both the +/- stepper and typing a value directly need the same guard against abnormal
  //     quantities, sharing ShoppingManualEntry's unit-aware ceiling; hitting a bound now shows a
  //     hint instead of silently doing nothing.
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

  // 中文：每次按键都只更新草稿，不校验、不提交，保证输入框永远反映刚打的字。
  // EN: Every keystroke only updates the draft -- no validation, no commit -- so the box always reflects exactly what was just typed.
  const draftQty = (item: CartItem, raw: string) => {
    setQtyDrafts((prev) => ({ ...prev, [item.item_uid]: raw }));
  };

  // 中文：失焦时才真正校验+提交；不合法就丢弃草稿，让显示回退到服务器上的原值，并给出提示。
  // EN: Validation and commit only happen on blur; an invalid draft is discarded (the display reverts to the server's value) with a hint explaining why.
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
      return; // empty or invalid -- silently revert to the last good value, no network call
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

  // 中文：点开某一行编辑后保存，一次性提交名称/数量/单位，乐观更新，失败回滚刷新。
  // EN: Saving a row's edit submits name/quantity/unit together, optimistically updates the row, and reloads if the write fails.
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

      {/* checkbox/"confirm" step removed -- every item in the cart is checkout-eligible now,
          so this button just reflects whether the cart has anything in it. */}
      <AnimatedCheckoutButton count={items.length} label={t.shopping.checkout.open} onPress={() => setCheckoutVisible(true)} />

      <FlatList
        data={items}
        keyExtractor={(i) => i.item_uid}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl colors={['#168ACB']} onRefresh={() => { void load(true).catch(() => undefined); }} refreshing={refreshing} tintColor="#168ACB" />}
        renderItem={({ item }) => {
          // 中文：显示草稿（正在打的字）优先于服务器上的值；数量输入框原来是固定宽度，
          //       5 位数（比如 10000ml）会被裁切只显示一部分，改成按位数动态给宽度。
          // EN: The draft (whatever is currently being typed) takes priority over the server
          //     value for display; the box used to have a fixed width so a 5-digit value (e.g.
          //     10000ml) got visually clipped -- width now scales with digit count instead.
          const displayQty = qtyDrafts[item.item_uid] ?? String(item.quantity ?? 1);
          const qtyInputWidth = Math.max(32, displayQty.length * 12 + 12);
          const showHint = qtyHint?.uid === item.item_uid;
          return (
            <View>
              {/* 中文：点击整行（数量/删除各自的按钮除外）重新打开加入购物车表单来编辑这一项；按下有轻微变暗+缩小的反馈。 */}
              {/* EN: Tapping the row (outside its own quantity/delete controls) reopens the add-to-cart form; pressing it dims and shrinks slightly for feedback. */}
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
              {/* 中文：碰到数量上下限时的即时提示，几秒后自动消失。 */}
              {/* EN: An immediate hint when a quantity bound is hit, auto-dismissing after a couple seconds. */}
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
      {/* the checkbox/"confirm" gate is gone -- checkout now works on the whole cart */}
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

      {/* 中文：删除前的可视化确认，避免误删共享购物清单；卡片带弹入动效。 */}
      {/* EN: Visual confirm before deleting so shared cart items aren't removed by mistake; the card springs in. */}
      {pendingDelete ? (
        <DeleteConfirmCard
          itemName={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { const it = pendingDelete; setPendingDelete(null); void onDelete(it); }}
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

// ---- 结账按钮：购物车有东西时才出现，出现/消失做缩放+淡入淡出，按下有轻微回弹 ----
// ---- Checkout button: only shown while the cart has items; it scales+fades in/out
//      as that flips, and gives a little spring on press. ----
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
  // 中文：淡出动画播完之前必须保留渲染，不能一变 count=0 就立刻卸载，否则看不到消失过程。
  // EN: Keep it mounted until the fade-out finishes -- unmounting the moment count hits 0 would skip the exit animation entirely.
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

// ---- 删除确认卡片：每次挂载都从缩小+透明弹到正常大小，取消/确认按钮按下有反馈 ----
// ---- Delete confirm card: springs in from smaller+transparent on every mount;
//      its Cancel/Confirm buttons give press feedback. ----
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
    // 中文：之前遮罩只是 CartView 内部一个绝对定位的 View，只能盖住列表区域，盖不到上面的
    //       标题和 tab 切换条，看起来不像"全屏"。换成 RN 的 Modal（transparent + statusBarTranslucent）
    //       后，它是原生层面盖在整个屏幕上的，标题、tab、状态栏这些都会被一起压暗。
    //       背景遮罩交给 Modal 自带的 animationType="fade" 负责显隐——这个是原生动画，
    //       不依赖 JS 端的 Animated 值，一定会显示。卡片自己的"弹入"缩放仍然用 Animated 做，
    //       但特意不再让卡片的透明度绑定同一个值：万一这个动画因为某些机型/时序没跑起来，
    //       卡片最多是尺寸差一点（0.88 倍），而不是彻底不透明度 0、整个看不见。
    // EN: The overlay used to be just an absolutely-positioned View inside CartView, so it could
    //     only cover the list area -- not the title or tab switcher above it, which didn't read as
    //     "full screen". Wrapping it in RN's Modal (transparent + statusBarTranslucent) makes it a
    //     native layer over the entire screen, dimming the title, tabs, and status bar along with
    //     everything else. The backdrop's show/hide is now the Modal's own animationType="fade" --
    //     a native animation that doesn't depend on a JS Animated value, so it's guaranteed to show.
    //     The card still gets its own "pop in" scale via Animated, but its opacity is deliberately
    //     NOT tied to that same value anymore: if that animation somehow never ran on some device/
    //     timing, the card would at worst be slightly undersized (0.88x), never invisible at opacity 0.
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
  pager: { flex: 1 },
  eyebrow: { color: '#D47B21', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(70,91,81,0.10)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  // 中文：标语删掉后，eyebrow 和 tab 切换条之间原来靠标语的 marginTop 撑开距离，得补回来。
  // EN: With the tagline gone, the gap between the eyebrow and the tab toggle used to come from the tagline's own marginTop -- add it back here.
  toggleNoTitle: { marginTop: 14 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  // 中文：原来靠 toggleActive 的背景色标出当前 tab，现在换成会滑动的 toggleIndicator，这个样式不再用但留着别的地方也许会用。
  // EN: The active tab used to be marked with this flat background; that's now the sliding toggleIndicator below, kept here in case it's useful elsewhere.
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
  // 中文：结账按钮现在单独一行、通栏展示，用渐变+图标+徽章代替原来纯色按钮，更醒目。
  // EN: The checkout button now sits on its own full-width row, using a gradient + icon + badge instead of the old flat-color button, for more visual weight.
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
  // 中文：建议购物页的多选框（购物车页那个勾选功能已经删了，这是不同的东西——批量勾选，不是"确认购买"）。
  // EN: The Suggested page's multi-select checkbox (unrelated to the cart's old confirm checkbox, which was removed -- this is bulk selection, not "confirm purchase").
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
  qtyHintText: { paddingBottom: 8, paddingLeft: 4, color: '#C96E1A', fontSize: 12, fontWeight: '700' },
  removeHit: { borderRadius: 8 },
  remove: { color: '#c62828', fontSize: 16, paddingHorizontal: 6 },
  // 中文：全局的"按下"反馈样式，配合 Pressable 的 pressed 回调用在购物车页所有可点元素上。
  // EN: A shared "pressed" feedback style, applied via Pressable's pressed callback across every tappable element on the cart page.
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
  // 中文：已加入购物车的视觉状态——浅绿底+绿字，跟绿色系的"加入"按钮区分开，一眼看出是完成态而不是可再点的按钮。
  // EN: The "already in cart" look -- pale green fill with green text, visually distinct from the solid green "add" button so it reads as a done state, not another clickable action.
  smallBtnAdded: { backgroundColor: '#E3F1E4' },
  smallBtnTextAdded: { color: '#2e7d32' },
  empty: { textAlign: 'center', color: '#718078', marginTop: 40 },
  peekBtn: {
    flex: 1, height: 44, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#168ACB', borderRadius: 10,
  },
  peekText: {width:'100%', textAlign:'center', color: '#fff', fontWeight: '700', fontSize: 13 },
});