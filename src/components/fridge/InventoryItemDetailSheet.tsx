import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useI18n } from '../../i18n';
import {
  archiveInventoryBatch,
  getInventoryBatchDetail,
  setInventoryRestockRule,
  updateInventoryBatchQuantity,
  type InventoryBatchDetail,
  type InventoryCategoryCode,
} from '../../services/inventoryApi';
import { PresetFoodIcon } from './PresetFoodIcon';

type InventoryItemDetailSheetProps = {
  batchUid: string | null;
  blurTarget?: RefObject<View | null>;
  onChanged: () => void | Promise<void>;
  onClose: () => void;
  onEdit: (batchUid: string) => void;
  visible: boolean;
};

const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);
const CATEGORY_EMOJI: Record<InventoryCategoryCode, string> = {
  meat: '🥚',
  vegetables: '🥬',
  fruit: '🍎',
  staples: '🍚',
  condiments: '🫙',
  drinks: '🥛',
  other: '📦',
};

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function quantityStep(unit: string) {
  return unit === 'kg' || unit === 'L' ? 0.1 : 1;
}

function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : String(roundQuantity(value));
}

// Arthur: NarIyirm
// 中文：库存卡片的详情与快捷 mutation 入口；上游由 FridgeScreen 传 batchUid，下游调用 inventoryApi 的详情、数量、补货和归档接口。
// EN: This is the inventory card's detail and quick-mutation surface; FridgeScreen supplies batchUid and inventoryApi handles detail, quantity, restock, and archive calls.
export function InventoryItemDetailSheet({
  batchUid,
  onChanged,
  onClose,
  onEdit,
  visible,
}: InventoryItemDetailSheetProps) {
  const { height, width } = useWindowDimensions();
  const { language, t } = useI18n();
  const copy = t.fridge.itemDetail;
  const expandedTopInset = Platform.OS === 'ios' ? 58 : Math.max(StatusBar.currentHeight ?? 24, 24) + 10;
  const sheetBottomInset = Platform.OS === 'ios' ? 12 : 10;
  const footerHeight = Platform.OS === 'ios' ? 103 : 88;
  const sheetHeight = Math.max(440, height - expandedTopInset - sheetBottomInset);
  // Arthur: NarIyirm
  // 中文：半屏停靠点保留约 63% 的可视高度，让库存卡和固定操作栏在打开时完整可用，同时仍露出背景库存页。
  // EN: The preview detent keeps about 63% visible so the stock card and fixed actions are usable on open while the inventory page remains visible behind it.
  const previewVisibleHeight = Math.min(sheetHeight - 48, Math.max(430, height * 0.63));
  const previewOffset = Math.max(150, sheetHeight - previewVisibleHeight);
  const previewScaleX = Math.max(0.9, (width - 24) / width);
  const dismissedOffset = sheetHeight + sheetBottomInset + 40;
  const translateY = useRef(new Animated.Value(dismissedOffset)).current;
  const dragStart = useRef(previewOffset);
  const currentTranslate = useRef(dismissedOffset);
  const hasAutoExpandedAtContentEnd = useRef(false);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [batch, setBatch] = useState<InventoryBatchDetail | null>(null);
  const [draftQuantity, setDraftQuantity] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [restockEnabled, setRestockEnabled] = useState(false);
  const [minimumQuantity, setMinimumQuantity] = useState(1);
  const [targetQuantity, setTargetQuantity] = useState(2);
  const [isSavingRestock, setIsSavingRestock] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const applyLoadedBatch = useCallback((nextBatch: InventoryBatchDetail) => {
    setBatch(nextBatch);
    setDraftQuantity(nextBatch.remainingQuantity);
    setRestockEnabled(Boolean(nextBatch.restockRule?.enabled));
    setMinimumQuantity(nextBatch.restockRule?.minimumQuantity ?? Math.min(1, nextBatch.initialQuantity));
    setTargetQuantity(nextBatch.restockRule?.targetQuantity ?? Math.max(2, Math.min(nextBatch.initialQuantity, 2)));
  }, []);

  // Arthur: NarIyirm
  // 中文：弹窗打开时按 batchUid 延迟加载完整批次和 version；列表快照因此可以保持轻量。
  // EN: Opening the sheet lazily loads the full batch and version by batchUid, keeping the list snapshot lightweight.
  const loadBatch = useCallback(async () => {
    if (!batchUid) return;
    setIsLoading(true);
    setLoadError(false);
    try {
      const result = await getInventoryBatchDetail(batchUid);
      applyLoadedBatch(result.batch);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [applyLoadedBatch, batchUid]);

  useEffect(() => {
    if (!visible || !batchUid) return;
    setBatch(null);
    setQuantityError(null);
    setRestockError(null);
    setRemoveError(null);
    setShowRemoveConfirm(false);
    setIsClosing(false);
    hasAutoExpandedAtContentEnd.current = false;
    afterCloseRef.current = null;
    translateY.stopAnimation();
    currentTranslate.current = reducedMotion ? previewOffset : dismissedOffset;
    translateY.setValue(currentTranslate.current);
    const frame = requestAnimationFrame(() => {
      // Arthur: NarIyirm
      // 中文：该弹窗所有动画与拖拽都固定使用同一个 JS 驱动 Animated.Value，避免在 Expo Go 中把节点先交给 native 后又从 JS 修改而崩溃。
      // EN: Every animation and drag in this sheet uses one JS-driven Animated.Value, avoiding Expo Go crashes caused by moving a node to native and later mutating it from JS.
      Animated.timing(translateY, {
        toValue: previewOffset,
        duration: reducedMotion ? 80 : 300,
        easing: EASE_SHEET,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) currentTranslate.current = previewOffset;
      });
    });
    void loadBatch();
    return () => cancelAnimationFrame(frame);
  }, [batchUid, dismissedOffset, loadBatch, previewOffset, reducedMotion, translateY, visible]);

  const finishClose = useCallback(() => {
    const afterClose = afterCloseRef.current;
    afterCloseRef.current = null;
    onClose();
    afterClose?.();
  }, [onClose]);

  const animateToDetent = useCallback((destination: number, velocity = 0) => {
    translateY.stopAnimation();
    if (destination !== 0) hasAutoExpandedAtContentEnd.current = false;
    if (reducedMotion) {
      Animated.timing(translateY, {
        toValue: destination,
        duration: 80,
        easing: EASE_SHEET,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          currentTranslate.current = destination;
        }
      });
      return;
    }

    Animated.spring(translateY, {
      toValue: destination,
      stiffness: destination === 0 ? 300 : 320,
      damping: destination === 0 ? 31 : 33,
      mass: 0.78,
      velocity,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        currentTranslate.current = destination;
      }
    });
  }, [reducedMotion, translateY]);

  const animateClosed = useCallback((velocity = 0) => new Promise<void>((resolve) => {
    translateY.stopAnimation();
    const finishAnimation = () => {
      currentTranslate.current = dismissedOffset;
      resolve();
    };

    if (reducedMotion) {
      Animated.timing(translateY, {
        toValue: dismissedOffset,
        duration: 80,
        easing: EASE_SHEET,
        useNativeDriver: false,
      }).start(finishAnimation);
      return;
    }

    Animated.spring(translateY, {
      toValue: dismissedOffset,
      stiffness: 340,
      damping: 36,
      mass: 0.75,
      velocity: Math.max(0, velocity),
      overshootClamping: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
      useNativeDriver: false,
    }).start(finishAnimation);
  }), [dismissedOffset, reducedMotion, translateY]);

  // Arthur: NarIyirm
  // 中文：关闭动画与数量保存并行执行；仅在草稿变化时提交一次 expectedVersion，失败则弹窗回到可操作位置。
  // EN: Closing animation and quantity persistence run together; a changed draft submits expectedVersion once, and failures return the sheet to an interactive position.
  const requestClose = useCallback(async (afterClose?: () => void, releaseVelocity = 0) => {
    if (isClosing) return;
    setIsClosing(true);
    setQuantityError(null);
    afterCloseRef.current = afterClose ?? null;

    try {
      // Arthur: NarIyirm
      // 中文：关闭动画立即跟随手指离场，同时并行保存数量；两者都完成后才卸载弹窗，避免网络延迟让拖拽在松手处停住。
      // EN: The sheet leaves with the finger while quantity persistence runs in parallel; it unmounts only after both finish so network latency never freezes the release point.
      const closingAnimation = animateClosed(releaseVelocity);
      if (batch && draftQuantity !== batch.remainingQuantity) {
        // Arthur: NarIyirm
        // 中文：拖动期间只更新本地草稿；关闭前一次性提交并携带版本号，避免每一帧都请求后端或覆盖共享成员的新修改。
        // EN: Dragging changes only a local draft; closing commits once with a version so frames never trigger requests or overwrite a shared member's newer edit.
        const result = await updateInventoryBatchQuantity(batch.id, draftQuantity, batch.version);
        setBatch((current) => current ? {
          ...current,
          lifecycleState: result.batch.lifecycleState,
          remainingQuantity: result.batch.remainingQuantity,
          version: result.batch.version,
        } : current);
        await onChanged();
      }
      await closingAnimation;
      finishClose();
    } catch {
      afterCloseRef.current = null;
      setQuantityError(copy.quantitySaveError);
      setIsClosing(false);
      animateToDetent(previewOffset);
    }
  }, [animateClosed, animateToDetent, batch, copy.quantitySaveError, draftQuantity, finishClose, isClosing, onChanged, previewOffset]);

  const panResponder = useMemo(() => PanResponder.create({
      // Arthur: NarIyirm
      // 中文：手指在横条落下时立即由抽屉接管，避免首次移动前被系统或相邻控件截走。
      // EN: The sheet claims the touch as it lands on the grabber, preventing the first movement from being intercepted by the system or nearby controls.
      onStartShouldSetPanResponder: () => !isClosing,
      onMoveShouldSetPanResponder: (_event, gesture) => !isClosing && Math.abs(gesture.dy) > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onMoveShouldSetPanResponderCapture: (_event, gesture) => !isClosing && Math.abs(gesture.dy) > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateY.stopAnimation((value) => {
          dragStart.current = value;
          currentTranslate.current = value;
        });
      },
      onPanResponderMove: (_event, gesture) => {
        const next = dragStart.current + gesture.dy;
        const resisted = next < 0
          ? rubberband(next, sheetHeight)
          : next > dismissedOffset
            ? dismissedOffset + rubberband(next - dismissedOffset, sheetHeight)
            : next;
        currentTranslate.current = resisted;
        translateY.setValue(resisted);
      },
      onPanResponderRelease: (_event, gesture) => {
        // Arthur: NarIyirm
        // 中文：用松手速度预测去向而不只看拖动距离；短促下甩也能关闭，轻拖则吸附到最近的预览或全屏停靠点。
        // EN: Release velocity projects the intended destination instead of relying on distance alone; a short flick can dismiss while a gentle drag settles at the nearest preview or expanded detent.
        const projected = currentTranslate.current + gesture.vy * 210;
        const closeDistance = Math.max(84, sheetHeight * 0.09);
        const hasDismissIntent = projected > previewOffset + closeDistance
          || (gesture.vy > 1.18 && currentTranslate.current > previewOffset * 0.45);

        if (hasDismissIntent) {
          void requestClose(undefined, gesture.vy);
          return;
        }

        const destination = projected < previewOffset * 0.52 || gesture.vy < -0.82 ? 0 : previewOffset;
        animateToDetent(destination, gesture.vy);
      },
      onPanResponderTerminate: () => {
        const destination = currentTranslate.current < previewOffset * 0.52 ? 0 : previewOffset;
        animateToDetent(destination);
      },
    }), [animateToDetent, dismissedOffset, isClosing, previewOffset, requestClose, sheetHeight, translateY]);

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, previewOffset, dismissedOffset],
    outputRange: [1, 0.92, 0],
    extrapolate: 'clamp',
  });
  const sheetOpacity = translateY.interpolate({
    inputRange: [dismissedOffset - 140, dismissedOffset],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const sheetScaleX = translateY.interpolate({
    inputRange: [0, previewOffset, dismissedOffset],
    outputRange: [1, previewScaleX, previewScaleX],
    extrapolate: 'clamp',
  });
  // Arthur: NarIyirm
  // 中文：同一个抽屉容器通过可视高度切换停靠点，因此内容和底部操作栏始终一起出现、移动和裁切。
  // EN: One sheet container changes its visible height between detents, so content and bottom actions always appear, move, and clip together.
  const visibleSheetHeight = translateY.interpolate({
    inputRange: [0, previewOffset, dismissedOffset],
    outputRange: [sheetHeight, previewVisibleHeight, 0],
    extrapolate: 'clamp',
  });

  const updateDraftQuantity = useCallback((value: number) => {
    if (!batch || isClosing) return;
    const next = Math.max(0, Math.min(batch.initialQuantity, roundQuantity(value)));
    setDraftQuantity(next);
    setQuantityError(null);
  }, [batch, isClosing]);

  const changeQuantity = useCallback((direction: -1 | 1) => {
    if (!batch) return;
    updateDraftQuantity(draftQuantity + direction * quantityStep(batch.unit));
  }, [batch, draftQuantity, updateDraftQuantity]);

  const changeRestockValue = useCallback((field: 'minimum' | 'target', direction: -1 | 1) => {
    if (!batch) return;
    const step = quantityStep(batch.unit);
    if (field === 'minimum') {
      setMinimumQuantity((current) => {
        const next = Math.max(0, roundQuantity(current + direction * step));
        setTargetQuantity((target) => Math.max(target, roundQuantity(next + step)));
        return next;
      });
    } else {
      setTargetQuantity((current) => Math.max(roundQuantity(minimumQuantity + step), roundQuantity(current + direction * step)));
    }
    setRestockError(null);
  }, [batch, minimumQuantity]);

  // Arthur: NarIyirm
  // 中文：把弹窗内阈值保存到名称和单位级补货规则；完成后通过 onChanged 让 FridgeScreen 重拉快照。
  // EN: This saves sheet thresholds to a name-and-unit restock rule, then asks FridgeScreen through onChanged to reload its snapshot.
  const saveRestock = useCallback(async () => {
    if (!batch || isSavingRestock) return;
    setIsSavingRestock(true);
    setRestockError(null);
    try {
      const result = await setInventoryRestockRule(batch.id, restockEnabled ? {
        enabled: true,
        minimumQuantity,
        targetQuantity,
      } : null);
      setBatch((current) => current ? { ...current, restockRule: result.restockRule } : current);
      await onChanged();
    } catch {
      setRestockError(copy.restock.error);
    } finally {
      setIsSavingRestock(false);
    }
  }, [batch, copy.restock.error, isSavingRestock, minimumQuantity, onChanged, restockEnabled, targetQuantity]);

  // Arthur: NarIyirm
  // 中文：确认移除后调用 archiveInventoryBatch；后端软归档并保留历史，成功后再通知父页面刷新。
  // EN: Confirmed removal calls archiveInventoryBatch; the backend soft-archives history and the parent refreshes after success.
  const removeBatch = useCallback(async () => {
    if (!batch || isRemoving) return;
    setIsRemoving(true);
    setRemoveError(null);
    try {
      await archiveInventoryBatch(batch.id, batch.version);
      await onChanged();
      setShowRemoveConfirm(false);
      await animateClosed();
      finishClose();
    } catch {
      setRemoveError(copy.removeError);
    } finally {
      setIsRemoving(false);
    }
  }, [animateClosed, batch, copy.removeError, finishClose, isRemoving, onChanged]);

  const openEditor = useCallback(() => {
    if (!batch) return;
    // Arthur: NarIyirm
    // 中文：详情窗完全关闭后按 ID 重新读取最新批次再打开编辑器，确保共享成员刚保存的版本和数量不会被旧快照覆盖。
    // EN: After the sheet fully closes, reload the batch by ID before opening the editor so a shared member's newer version and quantity are never overwritten by a stale snapshot.
    void requestClose(() => onEdit(batch.id));
  }, [batch, onEdit, requestClose]);

  const unitLabel = batch ? (t.fridge.manualEntry.units[batch.unit as keyof typeof t.fridge.manualEntry.units] ?? batch.unit) : '';
  const categoryLabel = batch
    ? t.fridge.categories[batch.categoryCode as keyof typeof t.fridge.categories] ?? batch.categoryName
    : '';
  const storageLabel = batch ? t.fridge.manualEntry.storage[batch.storageZone] : '';
  const emoji = batch ? batch.iconEmoji ?? CATEGORY_EMOJI[batch.categoryCode] ?? CATEGORY_EMOJI.other : '📦';
  const locale = language === 'zh' ? 'zh-CN' : 'en-AU';
  const formatDateTime = useCallback((value: string | null) => {
    if (!value) return copy.noExpiry;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }, [copy.noExpiry, locale]);
  const expiryStatus = batch?.expiresAt ? (() => {
    const milliseconds = new Date(batch.expiresAt).getTime() - Date.now();
    if (milliseconds < 0) return t.fridge.freshness.expired;
    const days = Math.ceil(milliseconds / 86_400_000);
    return days === 0 ? t.fridge.freshness.today : t.fridge.freshness.daysLeft(days);
  })() : null;

  return (
    <Modal
      animationType="none"
      onRequestClose={() => void requestClose()}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Animated.View pointerEvents="none" style={[styles.backdropTint, { opacity: backdropOpacity }]} />
        <Pressable accessibilityLabel={copy.close} accessibilityRole="button" onPress={() => void requestClose()} style={StyleSheet.absoluteFill} />

        <Animated.View
            style={[
              styles.sheet,
              {
                bottom: sheetBottomInset,
                height: visibleSheetHeight,
                opacity: sheetOpacity,
                transform: [{ scaleX: sheetScaleX }],
              },
            ]}
        >
          <View accessibilityHint={t.fridge.addItem.dragHint} style={styles.dragArea}>
            {/* Arthur: NarIyirm
                中文：只有顶部横条注册抽屉手势，内容区始终保留给滚动，避免阅读详情时误触改变弹窗高度。
                EN: Only the top grabber registers sheet gestures, leaving the content area to scroll without accidental detent changes. */}
            <View {...panResponder.panHandlers} style={styles.grabberTouchTarget}>
              <View style={styles.grabber} />
            </View>
            <Pressable accessibilityRole="button" disabled={isClosing} onPress={() => void requestClose()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Text style={styles.closeText}>{copy.close}</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#1599D2" />
              <Text style={styles.stateText}>{copy.loading}</Text>
            </View>
          ) : loadError || !batch ? (
            <View style={styles.centerState}>
              <Ionicons name="cloud-offline-outline" size={34} color="#7B8B85" />
              <Text style={styles.stateText}>{copy.loadError}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadBatch()} style={styles.retryButton}>
                <Text style={styles.retryText}>{copy.retry}</Text>
              </Pressable>
            </View>
          ) : (
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: footerHeight + 18 }]}
                alwaysBounceVertical
                bounces
                onScroll={({ nativeEvent }) => {
                  const reachedContentEnd = nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height
                    >= nativeEvent.contentSize.height - 20;
                  if (!reachedContentEnd || currentTranslate.current <= 4 || hasAutoExpandedAtContentEnd.current || isClosing) return;

                  // Arthur: NarIyirm
                  // 中文：半屏阅读到内容末尾时自动切到全屏，确保库存提醒和补货设置不被固定操作栏截断。
                  // EN: Reaching the end while in preview expands the sheet so restock reminders and settings are never cut off by the fixed actions.
                  hasAutoExpandedAtContentEnd.current = true;
                  animateToDetent(0);
                }}
                overScrollMode="always"
                scrollEnabled
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.stockCard}>
                  <View style={styles.itemHeader}>
                    <View style={styles.emojiTile}><PresetFoodIcon emoji={emoji} iconUrl={batch.iconUrl} size="detail" /></View>
                    <View style={styles.itemTitleWrap}>
                      <Text numberOfLines={2} style={styles.itemName}>{batch.name}</Text>
                      <View style={styles.badgeRow}>
                        <View style={styles.storageBadge}>
                          <Ionicons name={batch.storageZone === 'frozen' ? 'snow-outline' : batch.storageZone === 'chilled' ? 'water-outline' : 'cube-outline'} size={14} color="#148AC6" />
                          <Text style={styles.storageBadgeText}>{storageLabel}</Text>
                        </View>
                        {expiryStatus ? <View style={styles.expiryBadge}><Text style={styles.expiryBadgeText}>{expiryStatus}</Text></View> : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.quantityRow}>
                    <RoundButton icon="remove" onPress={() => changeQuantity(-1)} />
                    <View style={styles.quantityCopy}>
                      <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.quantityValue}>
                        {formatQuantity(draftQuantity)} <Text style={styles.quantityUnit}>{unitLabel}</Text>
                      </Text>
                      <Text style={styles.quantityLabel}>{copy.currentStock}</Text>
                    </View>
                    <RoundButton icon="add" onPress={() => changeQuantity(1)} />
                  </View>
                  <Slider
                    maximumTrackTintColor="#E2E6E4"
                    maximumValue={batch.initialQuantity}
                    minimumTrackTintColor="#169BDB"
                    minimumValue={0}
                    onValueChange={updateDraftQuantity}
                    step={quantityStep(batch.unit)}
                    thumbTintColor="#FFFFFF"
                    value={draftQuantity}
                  />
                  <View style={styles.saveHint}>
                    <Ionicons name="checkmark-circle" size={17} color="#149ADA" />
                    <Text style={styles.saveHintText}>{copy.quantityHint}</Text>
                  </View>
                  {quantityError ? <Text style={styles.errorText}>{quantityError}</Text> : null}
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.sectionTitle}>{copy.infoTitle}</Text>
                  <InfoRow icon="water" label={copy.storage} tone="#148FCB" tint="#E7F7FE" value={storageLabel} />
                  <InfoRow icon="grid" label={copy.category} tone="#20A761" tint="#E9F8EF" value={categoryLabel} />
                  <View style={styles.divider} />
                  <InfoRow icon="calendar" label={copy.expiry} tone="#E38222" tint="#FFF3E8" value={formatDateTime(batch.expiresAt)} />
                  <InfoRow icon="time" label={copy.stockedAt} tone="#18A8C2" tint="#E8F9FB" value={formatDateTime(batch.stockedAt)} />
                  {batch.openedAt ? <InfoRow icon="lock-open" label={copy.openedAt} tone="#8F68C7" tint="#F2EDFA" value={formatDateTime(batch.openedAt)} /> : null}
                  {batch.purchasePrice !== null ? <InfoRow icon="wallet" label={copy.price} tone="#9A7448" tint="#F8F0E5" value={`${batch.currency} ${batch.purchasePrice.toFixed(2)}`} /> : null}
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.restockHeader}>
                    <View style={styles.restockTitleRow}>
                      <View style={[styles.rowIcon, { backgroundColor: '#E8F9FC' }]}><Ionicons name="bag-handle" size={20} color="#12A7C2" /></View>
                      <View style={styles.restockCopy}>
                        <Text style={styles.restockTitle}>{copy.restock.title}</Text>
                        <Text style={styles.restockDescription}>
                          {restockEnabled ? copy.restock.enabled(minimumQuantity, unitLabel) : copy.restock.disabled}
                        </Text>
                      </View>
                    </View>
                    <Switch onValueChange={(value) => { setRestockEnabled(value); setRestockError(null); }} trackColor={{ false: '#C9CECC', true: '#18BCD2' }} value={restockEnabled} />
                  </View>

                  {restockEnabled ? (
                    <View style={styles.restockControls}>
                      <RestockStepper label={copy.restock.minimum} onDecrease={() => changeRestockValue('minimum', -1)} onIncrease={() => changeRestockValue('minimum', 1)} unit={unitLabel} value={minimumQuantity} />
                      <RestockStepper label={copy.restock.target} onDecrease={() => changeRestockValue('target', -1)} onIncrease={() => changeRestockValue('target', 1)} unit={unitLabel} value={targetQuantity} />
                      <Text style={styles.restockHint}>{copy.restock.sharedHint}</Text>
                    </View>
                  ) : null}
                  {restockError ? <Text style={styles.errorText}>{restockError}</Text> : null}
                  <Pressable accessibilityRole="button" disabled={isSavingRestock} onPress={() => void saveRestock()} style={({ pressed }) => [styles.restockSaveButton, pressed && styles.pressed, isSavingRestock && styles.disabled]}>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.restockSaveText}>{isSavingRestock ? copy.restock.saving : copy.restock.save}</Text>
                  </Pressable>
                </View>
              </ScrollView>
          )}
          {batch && !isLoading && !loadError ? (
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" disabled={isClosing} onPress={openEditor} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
              <Ionicons name="pencil" size={20} color="#FFFFFF" />
              <Text style={styles.editButtonText}>{copy.edit}</Text>
            </Pressable>
            <Pressable accessibilityLabel={copy.remove} accessibilityRole="button" onPress={() => setShowRemoveConfirm(true)} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={24} color="#F2384A" />
            </Pressable>
          </View>
          ) : null}
        </Animated.View>

        {showRemoveConfirm && batch ? (
          <View style={styles.confirmLayer}>
            <Pressable accessibilityLabel={copy.keep} onPress={() => setShowRemoveConfirm(false)} style={StyleSheet.absoluteFill} />
            <View style={styles.confirmCard}>
              <View style={styles.confirmHeader}>
                <View style={styles.dangerIcon}><Ionicons name="trash" size={25} color="#FF3047" /></View>
                <View style={styles.confirmTitleWrap}>
                  <Text style={styles.confirmTitle}>{copy.removeTitle}</Text>
                  <Text style={styles.confirmDescription}>{copy.removeDescription}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setShowRemoveConfirm(false)} style={styles.confirmClose}><Ionicons name="close" size={23} color="#75807D" /></Pressable>
              </View>
              <View style={styles.confirmItem}>
                <View style={styles.emojiTile}><PresetFoodIcon emoji={emoji} iconUrl={batch.iconUrl} size="detail" /></View>
                <View style={styles.confirmItemCopy}>
                  <Text style={styles.confirmItemName}>{batch.name}</Text>
                  <Text style={styles.confirmItemQuantity}>{formatQuantity(batch.remainingQuantity)} {unitLabel}</Text>
                </View>
              </View>
              <View style={styles.warningBox}><Ionicons name="alert-circle" size={18} color="#F2384A" /><Text style={styles.warningText}>{copy.removeWarning}</Text></View>
              {removeError ? <Text style={styles.errorText}>{removeError}</Text> : null}
              <View style={styles.confirmActions}>
                <Pressable accessibilityRole="button" disabled={isRemoving} onPress={() => setShowRemoveConfirm(false)} style={styles.keepButton}><Text style={styles.keepText}>{copy.keep}</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={isRemoving} onPress={() => void removeBatch()} style={[styles.confirmRemoveButton, isRemoving && styles.disabled]}>
                  <Ionicons name="trash" size={19} color="#FFFFFF" />
                  <Text style={styles.confirmRemoveText}>{isRemoving ? copy.removing : copy.confirmRemove}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function RoundButton({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={29} color="#139BD8" />
    </Pressable>
  );
}

function InfoRow({ icon, label, tone, tint, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; tone: string; tint: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}><Ionicons name={icon} size={20} color={tone} /></View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function RestockStepper({ label, onDecrease, onIncrease, unit, value }: { label: string; onDecrease: () => void; onIncrease: () => void; unit: string; value: number }) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable accessibilityRole="button" onPress={onDecrease} style={styles.smallStepButton}><Ionicons name="remove" size={20} color="#14AFC7" /></Pressable>
        <Text style={styles.stepperValue}>{formatQuantity(value)} <Text style={styles.stepperUnit}>{unit}</Text></Text>
        <Pressable accessibilityRole="button" onPress={onIncrease} style={styles.smallStepButton}><Ionicons name="add" size={20} color="#14AFC7" /></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdropTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(112, 118, 116, 0.22)' },
  sheet: { position: 'absolute', right: 0, left: 0, overflow: 'hidden', borderWidth: 1, borderColor: '#D5DEDA', borderRadius: 34, borderCurve: 'continuous', backgroundColor: '#F7F9F8', shadowColor: '#10271F', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 18 },
  dragArea: { height: 66, justifyContent: 'center', paddingHorizontal: 22, paddingTop: 8 },
  grabberTouchTarget: { position: 'absolute', zIndex: 5, top: 0, right: 0, left: 0, height: 42, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 52, height: 5, borderRadius: 3, backgroundColor: '#929998' },
  closeButton: { width: 82, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.72)' },
  closeText: { color: '#172720', fontSize: 17, fontWeight: '700' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 30 },
  stateText: { color: '#63726C', fontSize: 14, textAlign: 'center' },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 22, backgroundColor: '#E9F7FB' },
  retryText: { color: '#148EAF', fontSize: 14, fontWeight: '800' },
  scrollView: { flex: 1 },
  scrollContent: { gap: 14, paddingHorizontal: 18, paddingBottom: 122 },
  stockCard: { padding: 20, borderWidth: 1, borderColor: 'rgba(139, 205, 220, 0.42)', borderRadius: 25, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.82)' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  emojiTile: { width: 72, height: 72, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderCurve: 'continuous', backgroundColor: 'rgba(241,246,249,0.9)' },
  itemTitleWrap: { flex: 1, gap: 9 },
  itemName: { color: '#102C23', fontSize: 25, fontWeight: '800', lineHeight: 30 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  storageBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: '#E9F7FD' },
  storageBadgeText: { color: '#168AC3', fontSize: 12, fontWeight: '800' },
  expiryBadge: { justifyContent: 'center', paddingHorizontal: 9, borderRadius: 10, backgroundColor: '#FFF2E6' },
  expiryBadgeText: { color: '#D97A1C', fontSize: 12, fontWeight: '800' },
  quantityRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  roundButton: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: '#E8F8FE' },
  quantityCopy: { flex: 1, alignItems: 'center' },
  quantityValue: { maxWidth: '100%', color: '#07110D', fontSize: 43, fontWeight: '800', letterSpacing: -1.2 },
  quantityUnit: { color: '#6E7774', fontSize: 18, fontWeight: '700' },
  quantityLabel: { marginTop: 1, color: '#7B8581', fontSize: 13, fontWeight: '600' },
  saveHint: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 13, backgroundColor: '#E9F6FE' },
  saveHintText: { flex: 1, color: '#71817C', fontSize: 12.5, lineHeight: 18 },
  errorText: { marginTop: 8, color: '#C83D4C', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  infoCard: { padding: 20, borderWidth: 1, borderColor: 'rgba(220,226,223,0.8)', borderRadius: 25, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.82)' },
  sectionTitle: { marginBottom: 10, color: '#10261E', fontSize: 20, fontWeight: '800' },
  infoRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 43, height: 43, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderCurve: 'continuous' },
  infoLabel: { flex: 1, color: '#7A8581', fontSize: 14.5, fontWeight: '600' },
  infoValue: { maxWidth: '48%', color: '#172720', fontSize: 14.5, fontWeight: '800', lineHeight: 19, textAlign: 'right' },
  divider: { height: 1, marginVertical: 4, backgroundColor: '#E6E9E7' },
  restockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  restockTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  restockCopy: { flex: 1 },
  restockTitle: { color: '#132A22', fontSize: 17, fontWeight: '800' },
  restockDescription: { marginTop: 3, color: '#7A8581', fontSize: 12, lineHeight: 17 },
  restockControls: { marginTop: 18, gap: 12 },
  restockHint: { color: '#7A8581', fontSize: 11.5, lineHeight: 17 },
  stepperRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepperLabel: { color: '#53655E', fontSize: 13.5, fontWeight: '700' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  smallStepButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#E9F9FB' },
  stepperValue: { minWidth: 82, color: '#172720', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  stepperUnit: { color: '#71807B', fontSize: 12, fontWeight: '700' },
  restockSaveButton: { minHeight: 50, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, backgroundColor: '#12B5CD' },
  restockSaveText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '800' },
  footer: { position: 'absolute', zIndex: 8, right: 0, bottom: 0, left: 0, minHeight: Platform.OS === 'ios' ? 103 : 88, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 25 : 14, borderTopWidth: 1, borderTopColor: '#D5DEDA', backgroundColor: '#F7F9F8' },
  editButton: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 19, borderCurve: 'continuous', backgroundColor: '#FF851D' },
  editButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  removeButton: { width: 66, minHeight: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderCurve: 'continuous', backgroundColor: '#FFECEF' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.58 },
  confirmLayer: { ...StyleSheet.absoluteFill, zIndex: 20, justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: Platform.OS === 'ios' ? 28 : 18, backgroundColor: 'rgba(23,32,29,0.34)' },
  confirmCard: { gap: 17, padding: 20, borderRadius: 28, borderCurve: 'continuous', backgroundColor: '#FBFCFB', shadowColor: '#17201D', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 24 },
  confirmHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dangerIcon: { width: 51, height: 51, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#FFE8EC' },
  confirmTitleWrap: { flex: 1 },
  confirmTitle: { color: '#17231F', fontSize: 20, fontWeight: '800' },
  confirmDescription: { marginTop: 3, color: '#7A8581', fontSize: 12.5, lineHeight: 18 },
  confirmClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#F0F2F1' },
  confirmItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderWidth: 1, borderColor: '#E2E9E6', borderRadius: 20, backgroundColor: '#FFFFFF' },
  confirmItemCopy: { flex: 1 },
  confirmItemName: { color: '#162720', fontSize: 19, fontWeight: '800' },
  confirmItemQuantity: { marginTop: 5, color: '#64756E', fontSize: 14, fontWeight: '700' },
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 14, backgroundColor: '#FFF0F2' },
  warningText: { flex: 1, color: '#9C5A61', fontSize: 12.5, lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  keepButton: { flex: 1, minHeight: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#F0F1F3' },
  keepText: { color: '#6F7477', fontSize: 15, fontWeight: '800' },
  confirmRemoveButton: { flex: 1.15, minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, backgroundColor: '#FF3047' },
  confirmRemoveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
