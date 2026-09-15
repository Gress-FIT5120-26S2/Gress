// src/components/shopping/ShoppingManualEntry.tsx
// Lightweight "add to cart" form (US5.2.1). Name + quantity + unit only.
// US5.3.1/5.3.2/5.3.3: shows a possible-duplicate warning when the typed name
// matches inventory, and lets the user tap it open to see EVERY matching batch
// (each with its own quantity, storage, and expiry -- these can differ per
// batch), without blocking the purchase.
// Also doubles as the cart row EDIT form: tapping a cart item reopens this same
// sheet pre-filled with its current name/quantity/unit (initialValues), with the
// title/button copy swapped to "edit" instead of "add".
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  InputAccessoryView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { useI18n } from '../../i18n';
import type { InventoryBatch } from '../../services/inventoryApi';
import { getApiErrorCode } from '../../services/apiClient';
import { MAX_INVENTORY_NAME_LENGTH, getMaxInventoryQuantity } from '../../utils/inventoryValidation';

const UNIT_OPTIONS = ['item', 'g', 'kg', 'ml', 'L', 'bag', 'bottle', 'box'] as const;
const QTY_ACCESSORY_ID = 'shoppingQtyDone';
// 中文：数量输入框的字符上限，防止贴入超长数字字符串（跟真正的数量上限是两道独立的防线）。
// EN: A character cap on the quantity field so an absurdly long pasted digit string can't even be typed; a separate line of defense from the numeric ceiling below.
const MAX_QUANTITY_DIGITS = 9;

type ShoppingManualEntryProps = {
  visible: boolean;
  inventoryNames: Set<string>;
  inventoryByName: Map<string, InventoryBatch[]>;
  onClose: () => void;
  onSubmit: (item: { name: string; quantity: number; unit: string }) => void | Promise<void>;
  // 中文：非空即编辑模式——打开时按这份值预填，标题/按钮换成"编辑/保存"文案。
  // EN: Non-null puts the sheet in edit mode -- it prefills from this on open and swaps the title/button copy to "edit/save".
  initialValues?: { name: string; quantity: number; unit: string } | null;
};

export function ShoppingManualEntry({
  visible,
  inventoryNames,
  inventoryByName,
  onClose,
  onSubmit,
  initialValues = null,
}: ShoppingManualEntryProps) {
  const { t } = useI18n();
  const copy = t.shopping.manual;
  const isEditing = initialValues !== null;
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<string>('item');
  const [saving, setSaving] = useState(false);
  const [dupExpanded, setDupExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 中文：只在"关闭→打开"这一刻重新填表，而不是只要 initialValues 引用变了就填。
  //       调用方（ShoppingScreen）每次自己重新渲染都会 new 出一个新的 initialValues 对象，
  //       如果这里把它放进依赖数组里、每次引用变化都重置，就会在用户打字打到一半时被
  //       悄悄拉回最初的值——正好跟"清空后打不进去/输入被打断"的现象对上。
  //       用 justOpened 记录上一次的 visible，只有从 false 变 true 那一刻才重填。
  // EN: Only re-seed at the closed→open transition, not whenever the initialValues reference
  //     changes. The caller (ShoppingScreen) creates a new initialValues object literal on every
  //     one of its own re-renders, so keying this effect on that reference and resetting every
  //     time would silently snap the field back to its original value mid-keystroke -- exactly
  //     matching the "can't type after clearing / input gets interrupted" symptom. justOpened
  //     tracks the previous visible so the reset only fires on the actual false-to-true edge.
  const justOpened = useRef(false);
  useEffect(() => {
    if (visible && !justOpened.current) {
      setName(initialValues?.name ?? '');
      setQuantity(initialValues ? String(initialValues.quantity) : '1');
      setUnit(initialValues?.unit ?? 'item');
      setSaving(false);
      setDupExpanded(false);
      setErrorMessage(null);
    }
    justOpened.current = visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately NOT keying on initialValues; see comment above
  }, [visible]);

  const key = name.trim().toLowerCase();
  const isDuplicate = useMemo(
    () => key.length > 0 && inventoryNames.has(key),
    [key, inventoryNames],
  );
  // all matching batches (a food can have several batches with different
  // storage / expiry, so we show each one rather than a single summary)
  const matches = isDuplicate ? inventoryByName.get(key) ?? [] : [];

  const storageLabel = (zone: InventoryBatch['storageZone']) =>
    t.fridge.manualEntry.storage[zone];

  const expiryLabel = (iso: string | null) => {
    if (!iso) return copy.dupNoExpiry;
    const ms = new Date(iso).getTime() - Date.now();
    if (ms < 0) return copy.dupExpired;
    const days = Math.ceil(ms / 86_400_000);
    return copy.dupDaysLeft(days);
  };

  // 中文：跟服务端 cart.js 的护栏对齐（名称长度、按单位缩放的数量上限），先在本地拦一次，
  //       输入异常时马上给出提示，而不是等一次网络往返才报错。
  // EN: Mirrors server-side cart.js guardrails (name length, unit-aware quantity ceiling) so
  //     abnormal input is caught locally with an immediate message instead of waiting on a round trip.
  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage(copy.errors.nameRequired);
      return;
    }
    if (trimmed.length > MAX_INVENTORY_NAME_LENGTH) {
      setErrorMessage(copy.errors.nameTooLong(MAX_INVENTORY_NAME_LENGTH));
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMessage(copy.errors.invalidQuantity);
      return;
    }
    const maxQuantity = getMaxInventoryQuantity(unit);
    if (qty >= maxQuantity) {
      setErrorMessage(copy.errors.quantityTooLarge(maxQuantity, t.fridge.manualEntry.units[unit as keyof typeof t.fridge.manualEntry.units]));
      return;
    }
    setErrorMessage(null);
    setSaving(true);
    try {
      await onSubmit({ name: trimmed, quantity: qty, unit });
      onClose();
    } catch (err) {
      setSaving(false);
      const code = getApiErrorCode(err);
      setErrorMessage(
        code && code in copy.errors.byCode
          ? copy.errors.byCode[code as keyof typeof copy.errors.byCode]
          : copy.errors.generic,
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop} pointerEvents="none" />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEditing ? copy.editTitle : copy.title}</Text>
            <Pressable hitSlop={8} onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <Text style={styles.label}>{copy.nameLabel}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(v) => { setName(v); setDupExpanded(false); setErrorMessage(null); }}
              placeholder={copy.namePlaceholder}
              returnKeyType="next"
              maxLength={MAX_INVENTORY_NAME_LENGTH}
            />

            {/* US5.3.2: tap the warning to reveal every matching batch */}
            {matches.length > 0 ? (
              <Pressable style={styles.dupCard} onPress={() => setDupExpanded((e) => !e)}>
                <Text style={styles.dupWarning}>
                  ⚠️ {copy.duplicate}  ({matches.length})  {dupExpanded ? '▲' : '▼'}
                </Text>
                {dupExpanded ? (
                  <View style={styles.dupDetails}>
                    {matches.map((m, idx) => (
                      <Text
                        key={m.id}
                        style={[styles.dupRow, idx > 0 && styles.dupBatchGap]}
                      >
                        {m.remainingQuantity} {m.unit} · {storageLabel(m.storageZone)} · {expiryLabel(m.expiresAt)}
                        {m.needsRestock ? <Text style={styles.dupLow}>  {copy.dupLow}</Text> : null}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            ) : null}

            <Text style={styles.label}>{copy.quantityLabel}</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={(v) => { setQuantity(v); setErrorMessage(null); }}
              inputMode="decimal"
              placeholder="1"
              inputAccessoryViewID={QTY_ACCESSORY_ID}
              maxLength={MAX_QUANTITY_DIGITS}
            />

            <Text style={styles.label}>{copy.unitLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {UNIT_OPTIONS.map((u) => (
                <Pressable
                  key={u}
                  style={[styles.chip, unit === u && styles.chipActive]}
                  onPress={() => { setUnit(u); setErrorMessage(null); }}
                >
                  <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>
                    {t.fridge.manualEntry.units[u]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              style={[styles.submit, saving && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Text style={styles.submitText}>{saving ? copy.saving : isEditing ? copy.save : copy.add}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={QTY_ACCESSORY_ID}>
          <View style={styles.kbBar}>
            <Pressable hitSlop={8} onPress={() => Keyboard.dismiss()}>
              <Text style={styles.kbDone}>{t.fridge.manualEntry.expiry.pickerDone}</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(30,41,37,0.4)' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: '#FBFCFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: '#173D31' },
  close: { fontSize: 18, color: '#65766F' },
  scroll: { paddingBottom: 20 },
  label: { marginTop: 14, marginBottom: 6, fontSize: 13, fontWeight: '700', color: '#5E7068' },
  input: {
    borderWidth: 1,
    borderColor: '#DDE5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    backgroundColor: '#F8FAF9',
    color: '#173D31',
  },
  dupCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF3E3',
  },
  dupWarning: { color: '#C96E1A', fontSize: 13, fontWeight: '700' },
  dupDetails: { marginTop: 8 },
  dupRow: { color: '#8A5A22', fontSize: 12.5, fontWeight: '600' },
  dupBatchGap: { marginTop: 5 },
  dupLow: { color: '#C62828', fontWeight: '800' },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FFF2E8',
  },
  chipActive: { backgroundColor: '#FF812B' },
  chipText: { color: '#C96B1D', fontWeight: '800', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF' },
  errorText: { marginTop: 12, color: '#C62828', fontSize: 13, fontWeight: '700' },
  submit: {
    marginTop: 22,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#2e7d32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  kbBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F2',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CCC',
  },
  kbDone: { color: '#2e7d32', fontSize: 16, fontWeight: '700' },
});