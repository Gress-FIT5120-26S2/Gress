import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import { ApiRequestError, getApiErrorCode } from '../../services/apiClient';
import { getInventoryBatchDetail, updateInventoryBatchQuantity, type InventoryBatchDetail } from '../../services/inventoryApi';
import { notifyLocalSync } from '../../services/realtimeSync';
import { clampQuickUseQuantity, parseQuickUseQuantity, quickUseStep, remainingAfterQuickUse } from '../../utils/inventoryQuickUse';
import { PresetFoodIcon } from './PresetFoodIcon';

export type QuickUseResult = Awaited<ReturnType<typeof updateInventoryBatchQuantity>>;

type InventoryQuickUseSheetProps = {
  initialBatch: InventoryBatchDetail;
  onClose: () => void;
  onUsed: (result: QuickUseResult) => void;
};

// Arthur: NarIyirm
// 中文：面板由一次卡片点击挂载，固定本次批次版本；只有确认才扣库存，关闭和数量选择都不写数据。
// EN: Each card tap mounts a sheet with a fixed batch version; only confirmation writes stock, while dismissal and quantity selection stay local.
export function InventoryQuickUseSheet({ initialBatch, onClose, onUsed }: InventoryQuickUseSheetProps) {
  const { t } = useI18n();
  const copy = t.fridge.quickUse;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [batch, setBatch] = useState(initialBatch);
  const [quantityText, setQuantityText] = useState(() => String(clampQuickUseQuantity(quickUseStep(initialBatch.unit), initialBatch.remainingQuantity)));
  const [inputFocused, setInputFocused] = useState(false);
  const [sheetSpace, setSheetSpace] = useState(height);
  const compact = sheetSpace < 650;
  const compactFooter = sheetSpace < 450;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const busy = useRef(false);
  const closing = useRef(false);
  const mounted = useRef(true);
  const reducedMotion = useRef(false);
  const contentScroll = useRef<ScrollView>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(36)).current;
  const unitLabel = t.fridge.manualEntry.units[batch.unit as keyof typeof t.fridge.manualEntry.units] ?? batch.unit;
  const quantity = parseQuickUseQuantity(quantityText);
  const quantityError = quantity === null ? copy.invalidQuantity : quantity > batch.remainingQuantity ? copy.exceedsStock(`${batch.remainingQuantity} ${unitLabel}`) : null;
  const hardExpired = batch.useByAt !== null && new Date(batch.useByAt).getTime() <= Date.now();
  const available = !hardExpired && !unavailable && batch.lifecycleState === 'active' && batch.remainingQuantity > 0;
  const canUse = available && quantity !== null && quantityError === null;
  const remaining = canUse && quantity !== null ? remainingAfterQuickUse(batch.remainingQuantity, quantity) : null;
  const decreaseDisabled = saving || !canUse || quantity === null || quantity <= quickUseStep(batch.unit);
  const increaseDisabled = saving || !canUse || quantity === null || quantity >= batch.remainingQuantity;
  const visibleError = hardExpired ? copy.expired : !available ? error ?? copy.unavailable : quantityError ?? error;
  const expiryDays = batch.expiresAt ? Math.ceil((new Date(batch.expiresAt).getTime() - Date.now()) / 86_400_000) : null;
  const freshness = expiryDays === null || Number.isNaN(expiryDays) ? null
    : batch.expiresAt && new Date(batch.expiresAt).getTime() < Date.now() ? t.fridge.freshness.expired
      : expiryDays === 0 ? t.fridge.freshness.today : t.fridge.freshness.daysLeft(expiryDays);
  const storageIcon = batch.storageZone === 'frozen' ? 'snow-outline' : batch.storageZone === 'chilled' ? 'water-outline' : 'cube-outline';

  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted.current) return;
      reducedMotion.current = enabled;
      translateY.setValue(enabled ? 0 : 36);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: enabled ? 80 : 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: enabled ? 0 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
    return () => { mounted.current = false; opacity.stopAnimation(); translateY.stopAnimation(); };
  }, [opacity, translateY]);

  // Arthur: NarIyirm
  // 中文：键盘缩小面板后滚动到数量区域，确保小屏也能看到输入和剩余库存。
  // EN: Scroll to the amount after the keyboard shrinks the sheet so small screens retain the input and remaining-stock preview.
  useEffect(() => {
    if (inputFocused) contentScroll.current?.scrollToEnd({ animated: !reducedMotion.current });
  }, [inputFocused, sheetSpace]);

  // Arthur: NarIyirm
  // 中文：退场完成后才交还页面，后续分类学习不会和当前原生 Modal 抢占显示。
  // EN: Hand control back only after exit finishes so subsequent sorting prompts do not compete with this native modal.
  function dismiss(afterClose = onClose) {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: reducedMotion.current ? 80 : 150, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: reducedMotion.current ? 0 : 36, duration: 150, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished && mounted.current) afterClose(); });
  }

  function requestClose() {
    if (!busy.current) dismiss();
  }

  function changeQuantity(next: number) {
    if (busy.current || closing.current) return;
    setQuantityText(String(clampQuickUseQuantity(next, batch.remainingQuantity)));
    setError(null);
  }

  // Arthur: NarIyirm
  // 中文：键盘草稿不自动截断或替换，非法数量只阻止确认；全部用完仍可恢复有效值。
  // EN: Keep keyboard drafts unchanged and block invalid confirmation; use all can still restore a valid amount.
  function editQuantity(text: string) {
    if (busy.current || closing.current) return;
    setQuantityText(text);
    setError(null);
  }

  async function confirmUsage() {
    if (busy.current || closing.current || !canUse || quantity === null) return;
    if (batch.useByAt && new Date(batch.useByAt).getTime() <= Date.now()) {
      setError(copy.expired);
      return;
    }
    busy.current = true;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const result = await updateInventoryBatchQuantity(batch.id, remainingAfterQuickUse(batch.remainingQuantity, quantity), batch.version, batch.unit);
      notifyLocalSync(['inventory', 'restock', 'notifications', 'home']);
      if (mounted.current) dismiss(() => onUsed(result));
    } catch (failure) {
      if (!mounted.current) return;
      if (getApiErrorCode(failure) === 'inventory_use_by_expired') {
        setUnavailable(true);
        setError(copy.expired);
      } else if (failure instanceof ApiRequestError && failure.status === 409) {
        // Arthur: NarIyirm
        // 中文：共享冲突只重读批次并要求重新确认，不自动重试旧扣减，避免覆盖成员修改或重复使用。
        // EN: A shared conflict reloads the batch and requires fresh confirmation rather than retrying an old deduction over a member's edit.
        try {
          const latest = await getInventoryBatchDetail(batch.id);
          if (!mounted.current) return;
          setBatch(latest.batch);
          setQuantityText(String(clampQuickUseQuantity(quantity, latest.batch.remainingQuantity)));
          setError(latest.batch.lifecycleState === 'active' ? copy.conflict : copy.unavailable);
        } catch {
          if (mounted.current) { setUnavailable(true); setError(copy.unavailable); }
        }
      } else if (failure instanceof ApiRequestError && failure.status === 404) {
        setUnavailable(true);
        setError(copy.unavailable);
      } else {
        setError(copy.saveError);
      }
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal animationType="none" onRequestClose={requestClose} statusBarTranslucent transparent visible>
      <View style={styles.modalRoot}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity }]} />
        <Pressable accessibilityLabel={t.fridge.itemDetail.close} onPress={requestClose} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none" style={styles.keyboardRoot}>
        <View onLayout={({ nativeEvent }) => setSheetSpace(nativeEvent.layout.height)} pointerEvents="box-none" style={styles.root}>
        <Animated.View accessibilityViewIsModal style={[styles.sheet, { maxHeight: Math.max(220, sheetSpace - insets.top - 24), marginBottom: Math.max(insets.bottom, 10), opacity, transform: [{ translateY }] }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
            <Pressable accessibilityRole="button" disabled={saving} onPress={requestClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed, saving && styles.disabled]}>
              <Text style={styles.closeText}>{t.fridge.itemDetail.close}</Text>
            </Pressable>
          </View>
          <ScrollView ref={contentScroll} bounces={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.stockCard, compact && styles.compactCard]}>
              <View style={styles.itemHeader}>
                <View style={[styles.emojiTile, compact && styles.compactEmojiTile]}><PresetFoodIcon emoji={batch.iconEmoji ?? '📦'} iconUrl={batch.iconUrl ?? null} size={compact ? 'card' : 'detail'} /></View>
                <View style={styles.itemCopy}>
                  <Text numberOfLines={2} style={styles.itemName}>{batch.name}</Text>
                  <Text style={styles.currentStock}>{copy.stock(`${batch.remainingQuantity} ${unitLabel}`)}</Text>
                  <View style={styles.badges}>
                    <View style={styles.storageBadge}><Ionicons color="#168AC3" name={storageIcon} size={14} /><Text style={styles.storageText}>{t.fridge.filters[batch.storageZone]}</Text></View>
                    {freshness ? <View style={styles.expiryBadge}><Text style={styles.expiryText}>{freshness}</Text></View> : null}
                  </View>
                </View>
              </View>
              <View style={[styles.divider, compact && styles.compactDivider]} />
              <Text style={styles.quantityLabel}>{copy.quantity}</Text>
              <View style={styles.quantityRow}>
                <Pressable accessibilityLabel={copy.decrease} accessibilityRole="button" disabled={decreaseDisabled} onPress={() => quantity !== null && changeQuantity(quantity - quickUseStep(batch.unit))} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed, decreaseDisabled && styles.disabled]}><Ionicons name="remove" color="#169BDB" size={28} /></Pressable>
                <View style={[styles.quantityField, inputFocused && styles.quantityFieldFocused, quantityError !== null && styles.quantityFieldInvalid]}>
                  <TextInput accessibilityHint={copy.inputHint} accessibilityLabel={`${copy.quantity} (${unitLabel})`} autoCorrect={false} editable={!saving && available} inputMode="decimal" keyboardType="decimal-pad" onBlur={() => setInputFocused(false)} onChangeText={editQuantity} onFocus={() => setInputFocused(true)} onSubmitEditing={() => Keyboard.dismiss()} returnKeyType="done" selectTextOnFocus selectionColor="#169BDB" style={[styles.quantityValue, quantityText.length > 5 && styles.quantityValueSmall]} underlineColorAndroid="transparent" value={quantityText} />
                  <Text style={styles.quantityUnit}>{unitLabel}</Text>
                </View>
                <Pressable accessibilityLabel={copy.increase} accessibilityRole="button" disabled={increaseDisabled} onPress={() => quantity !== null && changeQuantity(quantity + quickUseStep(batch.unit))} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed, increaseDisabled && styles.disabled]}><Ionicons name="add" color="#169BDB" size={28} /></Pressable>
              </View>
              {!compactFooter ? <Text style={styles.inputHint}>{copy.inputHint}</Text> : null}
              <View style={[styles.remainingHint, compactFooter && styles.compactRemainingHint]}><Ionicons color="#149ADA" name={remaining === null ? 'information-circle' : 'checkmark-circle'} size={20} /><Text accessibilityLiveRegion="polite" style={styles.remainingText}>{remaining === null ? copy.remainingPlaceholder : copy.remaining(`${remaining} ${unitLabel}`)}</Text></View>
            </View>
            {visibleError ? <Text accessibilityRole="alert" style={styles.error}>{visibleError}</Text> : null}
          </ScrollView>
          <View style={[styles.footer, compactFooter && styles.compactFooter]}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: quantity === batch.remainingQuantity }} disabled={saving || !available} onPress={() => changeQuantity(batch.remainingQuantity)} style={({ pressed }) => [styles.allButton, compactFooter && styles.compactAllButton, pressed && styles.pressed, (saving || !available) && styles.disabled]}><Text style={styles.allText}>{copy.all}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={saving || !canUse} onPress={() => void confirmUsage()} style={({ pressed }) => [styles.confirmButton, compactFooter && styles.compactConfirmButton, pressed && styles.pressed, (saving || !canUse) && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark" color="#FFFFFF" size={24} />}
              <Text style={styles.confirmText}>{saving ? copy.saving : quantityError !== null ? copy.confirmDefault : copy.confirm(`${quantity} ${unitLabel}`)}</Text>
            </Pressable>
          </View>
        </Animated.View>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  keyboardRoot: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 10 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(112,118,116,0.36)' },
  sheet: { overflow: 'hidden', borderWidth: 1, borderColor: '#D5DEDA', borderRadius: 34, borderCurve: 'continuous', backgroundColor: '#F7F9F8', boxShadow: '0 -8px 24px rgba(16,39,31,0.14)' },
  grabber: { alignSelf: 'center', width: 52, height: 5, marginTop: 13, borderRadius: 3, backgroundColor: '#929998' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12 },
  title: { flex: 1, color: '#172720', fontSize: 22, fontWeight: '800' },
  closeButton: { minWidth: 74, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 24, backgroundColor: '#FFFFFF' },
  closeText: { color: '#172720', fontSize: 16, fontWeight: '700' },
  content: { gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  stockCard: { padding: 18, borderWidth: 1, borderColor: 'rgba(139,205,220,0.42)', borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.82)' },
  compactCard: { padding: 14 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  emojiTile: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#F1F6F9' },
  compactEmojiTile: { width: 56, height: 56, borderRadius: 17 },
  itemCopy: { flex: 1, minWidth: 0, gap: 5 },
  itemName: { color: '#102C23', fontSize: 23, fontWeight: '800' },
  currentStock: { color: '#7A8581', fontSize: 14 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  storageBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: '#E9F7FD' },
  storageText: { color: '#168AC3', fontSize: 12, fontWeight: '700' },
  expiryBadge: { justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FFF2E6' },
  expiryText: { color: '#D97A1C', fontSize: 12, fontWeight: '700' },
  divider: { height: 1, marginTop: 18, marginBottom: 14, backgroundColor: '#EDF0EE' },
  compactDivider: { marginTop: 12, marginBottom: 10 },
  quantityLabel: { color: '#7B8581', fontSize: 14, textAlign: 'center' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  roundButton: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: '#E8F8FE' },
  quantityField: { flex: 1, minWidth: 0, minHeight: 60, paddingHorizontal: 4, borderWidth: 1, borderColor: '#DCECF4', borderRadius: 12, backgroundColor: '#FAFDFE' },
  quantityFieldFocused: { borderColor: '#169BDB', backgroundColor: '#FFFFFF' },
  quantityFieldInvalid: { borderColor: '#C83D4C' },
  quantityValue: { width: '100%', minHeight: 44, paddingVertical: 0, paddingHorizontal: 0, color: '#07110D', fontSize: 34, fontWeight: '800', letterSpacing: -1, textAlign: 'center', outlineWidth: 0, outlineColor: 'transparent' },
  quantityValueSmall: { fontSize: 24 },
  quantityUnit: { color: '#6E7774', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  inputHint: { color: '#7B8581', fontSize: 12, textAlign: 'center', marginTop: 7 },
  remainingHint: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: '#E9F6FE' },
  compactRemainingHint: { marginTop: 7 },
  remainingText: { flexShrink: 1, color: '#71817C', fontSize: 14, lineHeight: 20 },
  error: { color: '#C83D4C', fontSize: 13, lineHeight: 19, paddingHorizontal: 4 },
  footer: { gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 18 : 14 },
  compactFooter: { flexDirection: 'row', alignItems: 'stretch' },
  compactAllButton: { flex: 1, minWidth: 0 },
  compactConfirmButton: { flex: 2, minWidth: 0, gap: 4, paddingHorizontal: 8 },
  allButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#F0F1F3' },
  allText: { color: '#6F7477', fontSize: 16, fontWeight: '800' },
  confirmButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 19, backgroundColor: '#FF812B' },
  confirmText: { flexShrink: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
