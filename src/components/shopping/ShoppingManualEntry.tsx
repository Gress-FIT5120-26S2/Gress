// src/components/shopping/ShoppingManualEntry.tsx
// Lightweight "add to cart" form (US5.2.1). Name + quantity + unit only.
// Surfaces a possible-duplicate warning (US5.3) against current inventory.
// - Only the ✕ closes the sheet (tapping the dimmed backdrop does nothing),
//   so a half-filled form is never dismissed by accident.
// - KeyboardAvoidingView + ScrollView keep every field reachable when the
//   keyboard is up; the numeric field also gets an iOS "Done" bar.
import React, { useMemo, useState } from 'react';
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

const UNIT_OPTIONS = ['item', 'g', 'kg', 'ml', 'L', 'bag', 'bottle', 'box'] as const;
const QTY_ACCESSORY_ID = 'shoppingQtyDone';

type ShoppingManualEntryProps = {
  visible: boolean;
  inventoryNames: Set<string>;
  onClose: () => void;
  onSubmit: (item: { name: string; quantity: number; unit: string }) => void | Promise<void>;
};

export function ShoppingManualEntry({
  visible,
  inventoryNames,
  onClose,
  onSubmit,
}: ShoppingManualEntryProps) {
  const { t } = useI18n();
  const copy = t.shopping.manual;
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<string>('item');
  const [saving, setSaving] = useState(false);

  const isDuplicate = useMemo(
    () => name.trim().length > 0 && inventoryNames.has(name.trim().toLowerCase()),
    [name, inventoryNames],
  );

  const reset = () => {
    setName('');
    setQuantity('1');
    setUnit('item');
    setSaving(false);
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    const qty = Number(quantity);
    if (!trimmed || !Number.isFinite(qty) || qty <= 0) return;
    setSaving(true);
    try {
      await onSubmit({ name: trimmed, quantity: qty, unit });
      reset();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* dimmed backdrop: blocks touches to the screen behind, but does NOT close */}
        <View style={styles.backdrop} pointerEvents="none" />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{copy.title}</Text>
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
              onChangeText={setName}
              placeholder={copy.namePlaceholder}
              returnKeyType="next"
            />
            {isDuplicate ? (
              <Text style={styles.dupWarning}>⚠️ {copy.duplicate}</Text>
            ) : null}

            <Text style={styles.label}>{copy.quantityLabel}</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              inputMode="decimal"
              placeholder="1"
              inputAccessoryViewID={QTY_ACCESSORY_ID}
            />

            <Text style={styles.label}>{copy.unitLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {UNIT_OPTIONS.map((u) => (
                <Pressable
                  key={u}
                  style={[styles.chip, unit === u && styles.chipActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>
                    {t.fridge.manualEntry.units[u]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={[styles.submit, saving && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Text style={styles.submitText}>{saving ? copy.saving : copy.add}</Text>
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
  dupWarning: { marginTop: 8, color: '#C96E1A', fontSize: 13, fontWeight: '700' },
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