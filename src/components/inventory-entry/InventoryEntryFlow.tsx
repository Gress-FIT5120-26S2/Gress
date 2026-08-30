import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useState, type RefObject } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getFoodPresetSuggestion } from '../../services/inventoryApi';
import { useI18n } from '../../i18n';
import { ReminderSettingsSection } from './ReminderSettingsSection';
import { StorageSuggestionCard, type StorageSuggestion } from './StorageSuggestionCard';

export type InventoryEntrySource = 'manual' | 'recognition';
export type InventoryStorageZone = 'chilled' | 'frozen' | 'pantry';
export type InventoryCategoryCode = 'meat' | 'vegetables' | 'fruit' | 'staples' | 'condiments' | 'drinks' | 'other';
export type InventoryUnit = 'item' | 'g' | 'kg' | 'ml' | 'L' | 'bag' | 'bottle' | 'box';

export type InventoryEntryInitialValues = Partial<{
  categoryCode: InventoryCategoryCode;
  expiryEnabled: boolean;
  expiryDate: string;
  expiryTime: string;
  name: string;
  price: string;
  quantity: string;
  storageZone: InventoryStorageZone;
  unit: InventoryUnit;
  restockEnabled: boolean;
  restockMinimumQuantity: number;
  restockTargetQuantity: number;
}>;

export type InventoryEntrySubmission = {
  batch: {
    categoryCode: InventoryCategoryCode;
    currency: 'AUD';
    expiresAt: string | null;
    initialQuantity: number;
    matchedPresetName: string | null;
    name: string;
    purchasePrice: number | null;
    remainingQuantity: number;
    stockedAt: string;
    storageZone: InventoryStorageZone;
    unit: InventoryUnit;
  };
  expiryWarningDays: number | null;
  restockRule: {
    enabled: true;
    minimumQuantity: number;
    targetQuantity: number;
    unit: InventoryUnit;
  } | null;
  source: InventoryEntrySource;
};

type InventoryEntryFlowProps = {
  blurTarget?: RefObject<View | null>;
  initialValues?: InventoryEntryInitialValues;
  mode?: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (submission: InventoryEntrySubmission) => void | Promise<void>;
  source?: InventoryEntrySource;
  visible: boolean;
};

const STORAGE_OPTIONS: InventoryStorageZone[] = ['pantry', 'chilled', 'frozen'];
const CATEGORY_OPTIONS: InventoryCategoryCode[] = ['meat', 'vegetables', 'fruit', 'staples', 'condiments', 'drinks', 'other'];
const UNIT_OPTIONS: InventoryUnit[] = ['item', 'g', 'kg', 'ml', 'L', 'bag', 'bottle', 'box'];

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseLocalDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function InventoryEntryFlow({
  blurTarget,
  initialValues,
  mode = 'create',
  onClose,
  onSubmit,
  source = 'manual',
  visible,
}: InventoryEntryFlowProps) {
  const { language, t } = useI18n();
  const copy = t.fridge.manualEntry;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('item');
  const [price, setPrice] = useState('');
  const [storageZone, setStorageZone] = useState<InventoryStorageZone>('chilled');
  const [categoryCode, setCategoryCode] = useState<InventoryCategoryCode>('other');
  const [suggestion, setSuggestion] = useState<StorageSuggestion | null>(null);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionLookupFinished, setSuggestionLookupFinished] = useState(false);
  const [expiryEnabled, setExpiryEnabled] = useState(true);
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [warningDays, setWarningDays] = useState(3);
  const [restockEnabled, setRestockEnabled] = useState(false);
  const [minimumQuantity, setMinimumQuantity] = useState(1);
  const [targetQuantity, setTargetQuantity] = useState(2);
  const [nameError, setNameError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [restockError, setRestockError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const now = new Date();
    const defaultExpiry = addDays(now, 7);

    // Arthur: NarIyirm
    // 中文：每次打开都由 initialValues 初始化草稿；新增、编辑和未来的识别录入因此可以复用同一套表单。
    // EN: Each opening initialises its draft from initialValues so create, edit, and future recognition flows can share one form.
    setName(initialValues?.name ?? '');
    setQuantity(initialValues?.quantity ?? '');
    setUnit(initialValues?.unit ?? 'item');
    setPrice(initialValues?.price ?? '');
    setStorageZone(initialValues?.storageZone ?? 'chilled');
    setCategoryCode(initialValues?.categoryCode ?? 'other');
    setSuggestion(null);
    setSuggestionApplied(false);
    setSuggestionLoading(false);
    setSuggestionLookupFinished(false);
    setExpiryEnabled(initialValues?.expiryEnabled ?? true);
    setExpiryDate(initialValues?.expiryDate ?? formatDate(defaultExpiry));
    setExpiryTime(initialValues?.expiryTime ?? formatTime(now));
    setWarningDays(3);
    setRestockEnabled(initialValues?.restockEnabled ?? false);
    setMinimumQuantity(initialValues?.restockMinimumQuantity ?? 1);
    setTargetQuantity(initialValues?.restockTargetQuantity ?? 2);
    setNameError(null);
    setQuantityError(null);
    setPriceError(null);
    setExpiryError(null);
    setRestockError(null);
    setSaveError(null);
    setIsSaving(false);
  }, [initialValues, visible]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    setNameError(null);
    setSuggestion(null);
    setSuggestionApplied(false);
    setSuggestionLoading(false);
    setSuggestionLookupFinished(false);
  }, []);

  useEffect(() => {
    const query = name.trim();
    if (!visible || !query) {
      setSuggestion(null);
      setSuggestionApplied(false);
      setSuggestionLoading(false);
      setSuggestionLookupFinished(false);
      return;
    }

    let active = true;
    const lookupTimer = setTimeout(() => {
      // Arthur: NarIyirm
      // 中文：输入停顿后才查询 Express，并忽略过期响应，避免快速输入时较早的名称覆盖最新建议。
      // EN: Query Express only after typing pauses and ignore stale responses so an earlier name cannot overwrite the latest suggestion.
      setSuggestionLoading(true);
      setSuggestionLookupFinished(false);
      void getFoodPresetSuggestion(query)
        .then(({ suggestion: nextSuggestion }) => {
          if (!active) return;
          setSuggestion(nextSuggestion ? {
            canonicalName: nextSuggestion.canonicalName,
            category: nextSuggestion.categoryCode,
            shelfLifeDays: nextSuggestion.shelfLifeDays,
            storageZone: nextSuggestion.storageZone,
          } : null);
          setSuggestionApplied(false);
          setSuggestionLookupFinished(true);
        })
        .catch(() => {
          if (!active) return;
          setSuggestion(null);
          setSuggestionLookupFinished(true);
        })
        .finally(() => {
          if (active) setSuggestionLoading(false);
        });
    }, 280);

    return () => {
      active = false;
      clearTimeout(lookupTimer);
    };
  }, [name, visible]);

  const searchStorageAdvice = useCallback(() => {
    const query = name.trim();
    if (!query) return;
    const searchTerms = language === 'zh'
      ? `${query} 保存方法 保质期`
      : `${query} storage advice shelf life`;
    // Arthur: NarIyirm
    // 中文：预设库没有命中时，把当前名称带到系统浏览器检索，不把外部网页嵌进应用或把数据误当成官方建议。
    // EN: When no preset matches, pass the current name to the system browser instead of embedding an external page or presenting it as official guidance.
    void Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(searchTerms)}`).catch(() => undefined);
  }, [language, name]);

  const applySuggestion = useCallback(() => {
    if (!suggestion) return;
    const now = new Date();
    setStorageZone(suggestion.storageZone);
    setCategoryCode(suggestion.category);
    setExpiryEnabled(true);
    setExpiryDate(formatDate(addDays(now, suggestion.shelfLifeDays)));
    setExpiryTime(formatTime(now));
    setSuggestionApplied(true);
  }, [suggestion]);

  const validateBasics = useCallback(() => {
    const parsedQuantity = Number(quantity);
    const parsedPrice = price.trim().length > 0 ? Number(price) : null;
    const nextNameError = name.trim().length > 0 ? null : copy.validation.name;
    const nextQuantityError = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? null : copy.validation.quantity;
    const nextPriceError = parsedPrice === null || (Number.isFinite(parsedPrice) && parsedPrice >= 0) ? null : copy.validation.price;
    setNameError(nextNameError);
    setQuantityError(nextQuantityError);
    setPriceError(nextPriceError);
    return !nextNameError && !nextQuantityError && !nextPriceError;
  }, [copy.validation, name, price, quantity]);

  const updateMinimumQuantity = useCallback((value: number) => {
    setMinimumQuantity(value);
    setTargetQuantity((current) => Math.max(current, value + 1));
    setRestockError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const expiry = expiryEnabled ? parseLocalDateTime(expiryDate, expiryTime) : null;
    const nextExpiryError = expiryEnabled && (!expiry || expiry.getTime() < Date.now()) ? copy.validation.expiry : null;
    const nextRestockError = restockEnabled && targetQuantity <= minimumQuantity ? copy.validation.restock : null;
    setExpiryError(nextExpiryError);
    setRestockError(nextRestockError);
    setSaveError(null);
    if (nextExpiryError || nextRestockError || !validateBasics()) return;

    const numericQuantity = Number(quantity);
    const numericPrice = price.trim().length > 0 ? Number(price) : null;
    const submission: InventoryEntrySubmission = {
      source,
      batch: {
        categoryCode,
        currency: 'AUD',
        expiresAt: expiry?.toISOString() ?? null,
        initialQuantity: numericQuantity,
        matchedPresetName: suggestion?.canonicalName ?? null,
        name: name.trim(),
        purchasePrice: numericPrice,
        remainingQuantity: numericQuantity,
        stockedAt: new Date().toISOString(),
        storageZone,
        unit,
      },
      // Arthur: NarIyirm
      // 中文：提醒提前天数先留在提交对象中；后端接入时需用新 migration 增加字段，不能改已部署的初始 migration。
      // EN: Warning days stay in the submission contract; backend integration needs a new migration rather than editing the deployed initial migration.
      expiryWarningDays: expiryEnabled ? warningDays : null,
      restockRule: restockEnabled ? {
        enabled: true,
        minimumQuantity,
        targetQuantity,
        unit,
      } : null,
    };

    setIsSaving(true);
    try {
      await onSubmit(submission);
      onClose();
    } catch (error) {
      const detail = error instanceof Error ? error.message : copy.validation.save;
      console.error('Inventory save failed:', detail);
      setSaveError(detail);
    } finally {
      setIsSaving(false);
    }
  }, [categoryCode, copy.validation, expiryDate, expiryEnabled, expiryTime, minimumQuantity, name, onClose, onSubmit, price, quantity, restockEnabled, source, storageZone, suggestion, targetQuantity, unit, validateBasics, warningDays]);

  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 47;
  const unitLabel = copy.units[unit];

  return (
    <Modal
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      {/* Arthur: NarIyirm
          中文：iOS 显示原生毛玻璃；Android 仅在 Android 12 以上启用真实模糊，旧设备保持相同的半透明材质以避免性能波动。
          EN: iOS uses native glass; Android enables real blur only on Android 12+, while older devices keep the same translucent material to avoid performance swings. */}
      <BlurView
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget}
        intensity={Platform.OS === 'ios' ? 56 : 34}
        tint="systemUltraThinMaterialLight"
        style={styles.frostedBackdrop}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalRoot}>
          <View style={[styles.header, { paddingTop: topInset + 8 }]}>
            <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.headerButton, pressed ? styles.pressed : null]}>
              <Text style={styles.headerButtonText}>{copy.cancel}</Text>
            </Pressable>
            <View pointerEvents="none" style={styles.headerTitleWrap}>
              <Text numberOfLines={1} style={styles.headerTitle}>{mode === 'edit' ? copy.editTitle : copy.title}</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <FieldHeading icon="restaurant-outline" label={copy.name.label} tone="#F07B22" tint="#FFF0E5" />
              <TextInput
                accessibilityLabel={copy.name.label}
                autoCapitalize="sentences"
                autoCorrect={false}
                onChangeText={handleNameChange}
                placeholder={copy.name.placeholder}
                placeholderTextColor="#68776F"
                returnKeyType="next"
                style={[styles.largeInput, nameError ? styles.inputError : null]}
                value={name}
              />
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
              <StorageSuggestionCard
                applied={suggestionApplied}
                isLoading={suggestionLoading}
                lookupFinished={suggestionLookupFinished}
                onApply={applySuggestion}
                onSearchOnline={searchStorageAdvice}
                query={name.trim()}
                suggestion={suggestion}
              />
              <View style={styles.sectionDivider} />
              <FieldHeading icon="calculator-outline" label={copy.quantity.label} tone="#0AAFC3" tint="#E7F9FC" />
              <View style={styles.quantityRow}>
                <TextInput
                  accessibilityLabel={copy.quantity.label}
                  inputMode="decimal"
                  onChangeText={(value) => { setQuantity(value); setQuantityError(null); }}
                  placeholder={copy.quantity.placeholder}
                  placeholderTextColor="#68776F"
                  style={[styles.quantityInput, quantityError ? styles.inputError : null]}
                  value={quantity}
                />
                <View style={styles.currentUnit}><Text style={styles.currentUnitText}>{unitLabel}</Text></View>
              </View>
              {quantityError ? <Text style={styles.errorText}>{quantityError}</Text> : null}
              <Text style={styles.subLabel}>{copy.unitsLabel}</Text>
              <ScrollView horizontal contentContainerStyle={styles.chipRow} showsHorizontalScrollIndicator={false}>
                {UNIT_OPTIONS.map((option) => (
                  <ChoiceChip key={option} label={copy.units[option]} onPress={() => setUnit(option)} selected={unit === option} tone="orange" />
                ))}
              </ScrollView>

              <View style={styles.sectionDivider} />
              <FieldHeading icon="snow-outline" label={copy.storageLabel} tone="#168ACB" tint="#E8F6FD" />
              <View style={styles.threeColumnRow}>
                {STORAGE_OPTIONS.map((option) => (
                  <ChoiceChip
                    fill
                    icon={option === 'chilled' ? 'water-outline' : option === 'frozen' ? 'snow-outline' : 'cube-outline'}
                    key={option}
                    label={copy.storage[option]}
                    onPress={() => { setStorageZone(option); setSuggestionApplied(false); }}
                    selected={storageZone === option}
                    tone="blue"
                  />
                ))}
              </View>

              <View style={styles.sectionDivider} />
              <FieldHeading icon="grid-outline" label={copy.categoryLabel} tone="#159766" tint="#E9F8F0" />
              <ScrollView horizontal contentContainerStyle={styles.chipRow} showsHorizontalScrollIndicator={false}>
                {CATEGORY_OPTIONS.map((option) => (
                  <ChoiceChip key={option} label={t.fridge.categories[option]} onPress={() => { setCategoryCode(option); setSuggestionApplied(false); }} selected={categoryCode === option} tone="green" />
                ))}
              </ScrollView>

              <View style={styles.sectionDivider} />
              <FieldHeading icon="wallet-outline" label={copy.price.label} tone="#9A7448" tint="#F6F0E8" />
              <View style={styles.priceRow}>
                <Text style={styles.currencyText}>AUD</Text>
                <TextInput
                  accessibilityLabel={copy.price.label}
                  inputMode="decimal"
                  onChangeText={(value) => { setPrice(value); setPriceError(null); }}
                  placeholder={copy.price.placeholder}
                  placeholderTextColor="#68776F"
                  style={[styles.priceInput, priceError ? styles.inputError : null]}
                  value={price}
                />
              </View>
              <Text style={styles.helperText}>{copy.price.helper}</Text>
              {priceError ? <Text style={styles.errorText}>{priceError}</Text> : null}
            </View>

            <ReminderSettingsSection
              expiryDate={expiryDate}
              expiryEnabled={expiryEnabled}
              expiryError={expiryError}
              expiryTime={expiryTime}
              minimumQuantity={minimumQuantity}
              onExpiryDateChange={(value) => { setExpiryDate(value); setExpiryError(null); }}
              onExpiryEnabledChange={setExpiryEnabled}
              onExpiryTimeChange={(value) => { setExpiryTime(value); setExpiryError(null); }}
              onMinimumQuantityChange={updateMinimumQuantity}
              onRestockEnabledChange={setRestockEnabled}
              onTargetQuantityChange={(value) => { setTargetQuantity(value); setRestockError(null); }}
              onWarningDaysChange={setWarningDays}
              restockEnabled={restockEnabled}
              restockError={restockError}
              reduceMotion={reduceMotion}
              targetQuantity={targetQuantity}
              unitLabel={unitLabel}
              warningDays={warningDays}
            />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={handleSubmit}
              style={({ pressed }) => [styles.primaryButton, isSaving ? styles.disabledButton : null, pressed ? styles.pressed : null]}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? copy.saving : mode === 'edit' ? copy.saveChanges : copy.save}</Text>
              <Ionicons name="checkmark-circle" size={19} color="#FFFFFF" />
            </Pressable>
            {saveError ? <Text style={styles.footerError}>{saveError}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

function FieldHeading({ icon, label, tint, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; tint: string; tone: string }) {
  return (
    <View style={styles.fieldHeading}>
      <View style={[styles.fieldIcon, { backgroundColor: tint }]}><Ionicons name={icon} size={20} color={tone} /></View>
      <Text style={styles.fieldTitle}>{label}</Text>
    </View>
  );
}

function ChoiceChip({
  fill = false,
  icon,
  label,
  onPress,
  selected,
  tone,
}: {
  fill?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected: boolean;
  tone: 'blue' | 'green' | 'orange';
}) {
  const palette = tone === 'blue'
    ? { active: '#168ACB', inactive: '#EDF8FC', text: '#16789F' }
    : tone === 'green'
      ? { active: '#159766', inactive: '#ECF9F2', text: '#157A56' }
      : { active: '#FF812B', inactive: '#FFF2E8', text: '#C96B1D' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceChip, fill ? styles.choiceChipFill : null, { backgroundColor: selected ? palette.active : palette.inactive }, pressed ? styles.pressed : null]}
    >
      {icon ? <Ionicons name={icon} size={16} color={selected ? '#FFFFFF' : palette.text} /> : null}
      <Text style={[styles.choiceChipText, { color: selected ? '#FFFFFF' : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frostedBackdrop: { flex: 1, backgroundColor: 'rgba(236, 243, 240, 0.54)' },
  modalRoot: { flex: 1 },
  header: { minHeight: 92, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12, backgroundColor: 'rgba(250, 252, 250, 0.46)' },
  headerButton: { minWidth: 74, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  headerButtonText: { color: '#263C34', fontSize: 15, fontWeight: '700' },
  headerTitleWrap: { position: 'absolute', right: 94, bottom: 16, left: 94, alignItems: 'center' },
  headerTitle: { color: '#172E26', fontSize: 18, fontWeight: '900', letterSpacing: -0.25 },
  headerSpacer: { flex: 1 },
  scrollContent: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 24, gap: 12 },
  section: { padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.84)', borderRadius: 16, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.76)' },
  fieldHeading: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 11 },
  fieldIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous' },
  fieldTitle: { flex: 1, color: '#173D31', fontSize: 17, fontWeight: '800' },
  largeInput: { minHeight: 56, marginTop: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DDE5E1', borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F8FAF9', color: '#173D31', fontSize: 18, fontWeight: '700' },
  quantityRow: { flexDirection: 'row', alignItems: 'stretch', gap: 9, marginTop: 12 },
  quantityInput: { minHeight: 56, flex: 1, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DDE5E1', borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F8FAF9', color: '#173D31', fontSize: 22, fontWeight: '800' },
  currentUnit: { minWidth: 76, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#FFF0E5' },
  currentUnitText: { color: '#D46F1A', fontSize: 15, fontWeight: '800' },
  subLabel: { marginTop: 14, marginBottom: 9, color: '#5E7068', fontSize: 12.5, fontWeight: '700' },
  chipRow: { gap: 8, paddingRight: 8 },
  threeColumnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  choiceChip: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 15, borderRadius: 14, borderCurve: 'continuous' },
  choiceChipFill: { flex: 1, paddingHorizontal: 8 },
  choiceChipText: { fontSize: 13, fontWeight: '800' },
  sectionDivider: { height: 1, marginVertical: 17, backgroundColor: '#EDF0EE' },
  priceRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#DDE5E1', borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F8FAF9', overflow: 'hidden' },
  currencyText: { paddingHorizontal: 14, color: '#8A693F', fontSize: 13, fontWeight: '800' },
  priceInput: { flex: 1, minHeight: 52, paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: '#E2E8E4', color: '#173D31', fontSize: 18, fontWeight: '700' },
  helperText: { marginTop: 9, color: '#718079', fontSize: 12, fontWeight: '600', lineHeight: 18 },
  inputError: { borderColor: '#D94B5D', backgroundColor: '#FFF8F8' },
  errorText: { marginTop: 7, color: '#C83D4C', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  footer: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingTop: 11, paddingBottom: Platform.OS === 'ios' ? 25 : 15, borderTopWidth: 1, borderTopColor: 'rgba(223, 231, 227, 0.78)', backgroundColor: 'rgba(250, 252, 250, 0.62)' },
  primaryButton: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FF812B' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
  footerError: { position: 'absolute', right: 16, bottom: 4, left: 16, color: '#C83D4C', fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
