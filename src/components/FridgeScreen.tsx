import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ListRenderItemInfo } from 'react-native';
import {
  createInventoryBatch,
  getFoodPresetSuggestion,
  getInventoryBatchDetail,
  getInventorySnapshot,
  setInventoryRestockRule,
  updateInventoryBatch,
  type InventoryBatchDetail,
  type InventorySnapshot,
} from '../services/inventoryApi';
import type { PhotoRecognitionResult } from '../services/recognitionApi';
import { useI18n } from '../i18n';
import { AddItemMethodSheet, type AddItemMethod } from './AddItemMethodSheet';
import { FridgeCategoryButton } from './fridge/FridgeCategoryButton';
import { FridgeFilterChip } from './fridge/FridgeFilterChip';
import { FridgeFoodCard, type FridgeStorageZone } from './fridge/FridgeFoodCard';
import { InventoryItemDetailSheet } from './fridge/InventoryItemDetailSheet';
import {
  InventoryEntryFlow,
  type InventoryEntrySource,
  type InventoryEntryInitialValues,
  type InventoryEntrySubmission,
  type InventoryUnit,
} from './inventory-entry/InventoryEntryFlow';
import { PhotoRecognitionCamera } from './inventory-entry/PhotoRecognitionCamera';
import {
  buildRecognitionInitialValues,
  RecognitionResultReview,
  type RecognitionDraft,
} from './inventory-entry/RecognitionResultReview';

type StorageZone = FridgeStorageZone;
type FridgeFilter = StorageZone | 'expired' | 'expiring' | 'restock';
type FoodCategory = 'meat' | 'vegetables' | 'fruit' | 'staples' | 'condiments' | 'drinks' | 'other';

type InventoryItem = {
  id: string;
  category: FoodCategory;
  storage: StorageZone;
  emoji: string;
  daysLeft: number | null;
  isExpired: boolean;
  amount: string;
  name: string;
  needsRestock: boolean;
};

type FilterOption = {
  key: FridgeFilter;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  tint: string;
};

const FILTERS: FilterOption[] = [
  { key: 'chilled', icon: 'water-outline', tone: '#168ACB', tint: '#E8F8FF' },
  { key: 'frozen', icon: 'snow-outline', tone: '#228FBA', tint: '#E9F8FC' },
  { key: 'pantry', icon: 'cube-outline', tone: '#9A7448', tint: '#F8F0E5' },
  { key: 'expired', icon: 'warning-outline', tone: '#D94B51', tint: '#FFF0F1' },
  { key: 'expiring', icon: 'time-outline', tone: '#D27619', tint: '#FFF2E3' },
  { key: 'restock', icon: 'bag-handle-outline', tone: '#168FA8', tint: '#E8F9FA' },
];

const CATEGORIES: FoodCategory[] = ['meat', 'vegetables', 'fruit', 'staples', 'condiments', 'drinks', 'other'];

const CATEGORY_STYLE: Record<FoodCategory, { tone: string; tint: string }> = {
  meat: { tone: '#D94B51', tint: '#FFF0F1' },
  vegetables: { tone: '#32915C', tint: '#EAF8EF' },
  fruit: { tone: '#D94C8B', tint: '#FFF0F7' },
  staples: { tone: '#A8732D', tint: '#F8F1E5' },
  condiments: { tone: '#D46A1C', tint: '#FFF1E9' },
  drinks: { tone: '#148AA0', tint: '#E8F8FA' },
  other: { tone: '#697784', tint: '#F0F3F5' },
};

const isStatusMatch = (item: InventoryItem, filter: FridgeFilter | null) => {
  if (!filter) return true;
  if (filter === 'expired') return item.isExpired;
  if (filter === 'expiring') return !item.isExpired && item.daysLeft !== null && item.daysLeft <= 3;
  if (filter === 'restock') return Boolean(item.needsRestock);
  return item.storage === filter;
};

const inventoryKeyExtractor = (item: InventoryItem) => item.id;

const CATEGORY_EMOJI: Record<FoodCategory, string> = {
  meat: '🥚',
  vegetables: '🥬',
  fruit: '🍎',
  staples: '🍚',
  condiments: '🫙',
  drinks: '🥛',
  other: '📦',
};

function isFoodCategory(value: string): value is FoodCategory {
  return CATEGORIES.includes(value as FoodCategory);
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatEntryDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatEntryTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getDaysLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const remainingMilliseconds = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(remainingMilliseconds)) return null;
  return Math.max(0, Math.ceil(remainingMilliseconds / 86_400_000));
}

function isExpiredAt(expiresAt: string | null) {
  if (!expiresAt) return false;
  const expiryMilliseconds = new Date(expiresAt).getTime();
  // Arthur: NarIyirm
  // 中文：过期状态直接比较精确时间戳；剩余“天数”只用于展示，不能决定分钟级的过期边界。
  // EN: Expiry compares exact timestamps; remaining "days" is display-only and must not decide a minute-level expiry boundary.
  return !Number.isNaN(expiryMilliseconds) && expiryMilliseconds < Date.now();
}

// Arthur: NarIyirm
// 中文：主页面继续集中管理数据、筛选状态和整体布局，只把重复且视觉独立的组件放到 fridge 子目录。
// EN: The screen keeps data, filter state, and page layout together; only repeated visual components live in the fridge subfolder.
type FridgeScreenProps = {
  blurTarget?: RefObject<View | null>;
};

export function FridgeScreen({ blurTarget }: FridgeScreenProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FridgeFilter | null>(null);
  const [activeCategory, setActiveCategory] = useState<FoodCategory | null>(null);
  const [isAddSheetVisible, setIsAddSheetVisible] = useState(false);
  const [isManualEntryVisible, setIsManualEntryVisible] = useState(false);
  const [isRecognitionCameraVisible, setIsRecognitionCameraVisible] = useState(false);
  const [recognitionDraft, setRecognitionDraft] = useState<RecognitionDraft | null>(null);
  const [recognitionInitialValues, setRecognitionInitialValues] = useState<InventoryEntryInitialValues | undefined>();
  const [entrySource, setEntrySource] = useState<InventoryEntrySource>('manual');
  const [selectedBatchUid, setSelectedBatchUid] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] = useState<InventoryBatchDetail | null>(null);
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [hasInventoryLoadError, setHasInventoryLoadError] = useState(false);

  const loadInventory = useCallback(async () => {
    setIsLoadingInventory(true);
    try {
      const nextSnapshot = await getInventorySnapshot();
      setSnapshot(nextSnapshot);
      setHasInventoryLoadError(false);
    } catch (error) {
      setHasInventoryLoadError(true);
      throw error;
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    // Arthur: NarIyirm
    // 中文：进入冰箱页后用当前设备对应的真实冰箱替换演示数据；失败时保留空状态，不显示过期缓存数据。
    // EN: Opening the fridge loads the real fridge for this device; failures keep an empty state instead of showing stale mock data.
    void loadInventory().catch(() => undefined);
  }, [loadInventory]);

  const inventory = useMemo<InventoryItem[]>(() => (snapshot?.batches ?? []).map((batch) => {
    const category = isFoodCategory(batch.categoryCode) ? batch.categoryCode : 'other';
    return {
      amount: `${formatQuantity(batch.remainingQuantity)} ${t.fridge.manualEntry.units[batch.unit as keyof typeof t.fridge.manualEntry.units] ?? batch.unit}`,
      category,
      daysLeft: getDaysLeft(batch.expiresAt),
      emoji: CATEGORY_EMOJI[category],
      id: batch.id,
      isExpired: isExpiredAt(batch.expiresAt),
      name: batch.name,
      needsRestock: batch.needsRestock,
      storage: batch.storageZone,
    };
  }), [snapshot, t.fridge.manualEntry.units]);
  const currentScopeLabel = snapshot?.fridge.name ?? t.fridge.scopes.personal;

  // Arthur: NarIyirm
  // 中文：界面语言只改变展示文案，筛选始终使用稳定的内部键，避免切换语言时丢失当前条件。
  // EN: Language changes presentation copy only; stable internal keys preserve active filters when the language switches.
  const visibleItems = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLocaleLowerCase();
    return inventory.filter((item) => {
      const localizedName = item.name.toLocaleLowerCase();
      const matchesName = normalizedQuery.length === 0 || localizedName.includes(normalizedQuery);
      return matchesName && isStatusMatch(item, activeFilter) && (!activeCategory || item.category === activeCategory);
    });
  }, [activeCategory, activeFilter, inventory, searchTerm, t]);

  const filterCounts = useMemo(
    () => Object.fromEntries(FILTERS.map(({ key }) => [key, inventory.filter((item) => isStatusMatch(item, key)).length])) as Record<FridgeFilter, number>,
    [inventory],
  );
  const categoryCounts = useMemo(
    () => Object.fromEntries(CATEGORIES.map((category) => [category, inventory.filter((item) => item.category === category).length])) as Record<FoodCategory, number>,
    [inventory],
  );
  const hasActiveConditions = activeFilter !== null || activeCategory !== null || searchTerm.trim().length > 0;
  const sectionTitle = searchTerm.trim().length > 0
    ? t.fridge.titles.search
    : activeFilter
      ? t.fridge.titleFor(t.fridge.filters[activeFilter])
      : activeCategory
        ? t.fridge.titleFor(t.fridge.categories[activeCategory])
        : t.fridge.titles.all;

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setActiveFilter(null);
    setActiveCategory(null);
  }, []);

  const openAddSheet = useCallback(() => setIsAddSheetVisible(true), []);
  const closeAddSheet = useCallback(() => setIsAddSheetVisible(false), []);
  const selectAddMethod = useCallback((method: AddItemMethod) => {
    // Arthur: NarIyirm
    // 中文：这个回调只会在选择窗完全卸载后触发，因此不会与手动录入的原生 Modal 重叠。
    // EN: This callback fires only after the chooser unmounts, preventing overlap with the manual entry native Modal.
    if (method === 'manual') {
      setEditingBatch(null);
      setRecognitionInitialValues(undefined);
      setEntrySource('manual');
      setIsManualEntryVisible(true);
    }
    if (method === 'camera') {
      setEditingBatch(null);
      setRecognitionDraft(null);
      setRecognitionInitialValues(undefined);
      setIsRecognitionCameraVisible(true);
    }
  }, []);

  const openManualFallback = useCallback(() => {
    setIsRecognitionCameraVisible(false);
    setRecognitionDraft(null);
    setRecognitionInitialValues(undefined);
    setEntrySource('manual');
    setIsManualEntryVisible(true);
  }, []);

  const handlePhotoRecognised = useCallback(async (result: PhotoRecognitionResult) => {
    if (result.food === 'unknown' || result.freshness === 'unknown') return;
    const foodName = t.fridge.photoRecognition.foodNames[result.food];
    const { suggestion } = await getFoodPresetSuggestion(result.food);

    if (!suggestion) {
      // Arthur: NarIyirm
      // 中文：模型已认出名称但参考库尚未迁移时，保留名称并直接进入同一手动表单，其余字段由用户确认。
      // EN: If the model knows the name but the reference migration is missing, preserve the name and fall back to the same manual form for the remaining fields.
      setRecognitionInitialValues({ name: foodName, quantity: '1', unit: 'item' });
      setEntrySource('recognition');
      setIsRecognitionCameraVisible(false);
      setIsManualEntryVisible(true);
      return;
    }

    const { expiryDays, initialValues } = buildRecognitionInitialValues(foodName, suggestion, result.freshness);
    setRecognitionDraft({
      categoryCode: suggestion.categoryCode,
      confidence: result.confidence,
      expiryDays,
      food: result.food,
      freshness: result.freshness,
      initialValues,
      storageZone: suggestion.storageZone,
      unit: 'item',
    });
    setIsRecognitionCameraVisible(false);
  }, [t.fridge.photoRecognition.foodNames]);

  const continueRecognitionEntry = useCallback((draft: RecognitionDraft) => {
    setRecognitionInitialValues(draft.initialValues);
    setRecognitionDraft(null);
    setEntrySource('recognition');
    setIsManualEntryVisible(true);
  }, []);

  const retakeRecognitionPhoto = useCallback(() => {
    setRecognitionDraft(null);
    setIsRecognitionCameraVisible(true);
  }, []);

  const closeManualEntry = useCallback(() => {
    setIsManualEntryVisible(false);
    setEditingBatch(null);
    setRecognitionInitialValues(undefined);
    setEntrySource('manual');
  }, []);
  const saveInventoryEntry = useCallback(async (submission: InventoryEntrySubmission) => {
    // Arthur: NarIyirm
    // 中文：手动录入和识别录入共用同一提交对象；后端根据 Device-ID 决定写入的冰箱。
    // EN: Manual and recognition entry share this submission contract; the server chooses the target fridge from Device-ID.
    await createInventoryBatch({
      categoryCode: submission.batch.categoryCode,
      expiresAt: submission.batch.expiresAt,
      initialQuantity: submission.batch.initialQuantity,
      name: submission.batch.name,
      purchasePrice: submission.batch.purchasePrice,
      restockRule: submission.restockRule
        ? {
          enabled: true,
          minimumQuantity: submission.restockRule.minimumQuantity,
          targetQuantity: submission.restockRule.targetQuantity,
        }
        : null,
      storageZone: submission.batch.storageZone,
      unit: submission.batch.unit,
    });
    await loadInventory();
  }, [loadInventory]);

  const openBatchEditor = useCallback(async (batchUid: string) => {
    // Arthur: NarIyirm
    // 中文：详情窗关闭后重新获取最新版本再编辑，避免共享冰箱中用旧 version 覆盖其他设备刚完成的修改。
    // EN: Reload the latest version after closing the detail sheet so editing cannot overwrite a change just made by another shared-fridge device.
    try {
      const result = await getInventoryBatchDetail(batchUid);
      setEditingBatch(result.batch);
      setIsManualEntryVisible(true);
    } catch {
      setSelectedBatchUid(batchUid);
    }
  }, []);

  const saveEditedInventoryEntry = useCallback(async (submission: InventoryEntrySubmission) => {
    if (!editingBatch) return;
    await updateInventoryBatch(editingBatch.id, {
      categoryCode: submission.batch.categoryCode,
      expectedVersion: editingBatch.version,
      expiresAt: submission.batch.expiresAt,
      name: submission.batch.name,
      purchasePrice: submission.batch.purchasePrice,
      remainingQuantity: submission.batch.remainingQuantity,
      storageZone: submission.batch.storageZone,
      unit: submission.batch.unit,
    });
    await setInventoryRestockRule(editingBatch.id, submission.restockRule ? {
      enabled: true,
      minimumQuantity: submission.restockRule.minimumQuantity,
      targetQuantity: submission.restockRule.targetQuantity,
    } : null);
    await loadInventory();
  }, [editingBatch, loadInventory]);

  const editInitialValues = useMemo<InventoryEntryInitialValues | undefined>(() => {
    if (!editingBatch) return undefined;
    const expiry = editingBatch.expiresAt ? new Date(editingBatch.expiresAt) : null;
    return {
      categoryCode: editingBatch.categoryCode,
      expiryDate: expiry ? formatEntryDate(expiry) : undefined,
      expiryEnabled: Boolean(expiry),
      expiryTime: expiry ? formatEntryTime(expiry) : undefined,
      name: editingBatch.name,
      price: editingBatch.purchasePrice === null ? '' : String(editingBatch.purchasePrice),
      quantity: formatQuantity(editingBatch.remainingQuantity),
      restockEnabled: Boolean(editingBatch.restockRule?.enabled),
      restockMinimumQuantity: editingBatch.restockRule?.minimumQuantity,
      restockTargetQuantity: editingBatch.restockRule?.targetQuantity,
      storageZone: editingBatch.storageZone,
      unit: editingBatch.unit as InventoryUnit,
    };
  }, [editingBatch]);

  const renderInventoryItem = useCallback(({ item }: ListRenderItemInfo<InventoryItem>) => {
    const categoryStyle = CATEGORY_STYLE[item.category];
    const freshnessText = item.daysLeft === null
      ? null
      : item.isExpired
        ? t.fridge.freshness.expired
        : item.daysLeft === 0
          ? t.fridge.freshness.today
          : t.fridge.freshness.daysLeft(item.daysLeft);

    return (
      <FridgeFoodCard
        amount={item.amount}
        categoryTint={categoryStyle.tint}
        categoryTone={categoryStyle.tone}
        daysLeft={item.daysLeft}
        emoji={item.emoji}
        freshnessText={freshnessText}
        isExpired={item.isExpired}
        name={item.name}
        needsRestock={Boolean(item.needsRestock)}
        onPress={() => setSelectedBatchUid(item.id)}
        storage={item.storage}
        storageLabel={t.fridge.filters[item.storage]}
      />
    );
  }, [t]);

  return (
    <View style={styles.screen}>
      <View style={styles.topArea}>
        <View style={styles.toolbar}>
          <View accessibilityLabel={currentScopeLabel} style={styles.fridgeSwitcher}>
            <MaterialCommunityIcons name="fridge-outline" size={20} color="#496A61" />
            <Text numberOfLines={1} style={styles.fridgeSwitcherText}>{currentScopeLabel}</Text>
          </View>
          <View style={styles.searchField}>
            <Ionicons name="search-outline" size={21} color="#6E817A" />
            <TextInput
              accessibilityLabel={t.fridge.searchA11y}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder={t.fridge.searchPlaceholder}
              placeholderTextColor="#6F817A"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {searchTerm.length > 0 ? (
              <Pressable accessibilityLabel={t.fridge.clearSearch} accessibilityRole="button" onPress={() => setSearchTerm('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#80918B" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((filter) => (
            <FridgeFilterChip
              key={filter.key}
              count={filterCounts[filter.key]}
              icon={filter.icon}
              label={t.fridge.filters[filter.key]}
              onPress={() => setActiveFilter((current) => current === filter.key ? null : filter.key)}
              selected={activeFilter === filter.key}
              tint={filter.tint}
              tone={filter.tone}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.content}>
        <View style={styles.categoryRail}>
          <Text numberOfLines={1} style={styles.categoryHeading}>{t.fridge.categoryHeading}</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            <FridgeCategoryButton
              count={inventory.length}
              label={t.fridge.categories.all}
              onPress={() => setActiveCategory(null)}
              selected={activeCategory === null}
              tint="#EEEFFD"
              tone="#6255D9"
            />
            {CATEGORIES.map((category) => (
              <FridgeCategoryButton
                key={category}
                count={categoryCounts[category]}
                label={t.fridge.categories[category]}
                onPress={() => setActiveCategory((current) => current === category ? null : category)}
                selected={activeCategory === category}
                tint={CATEGORY_STYLE[category].tint}
                tone={CATEGORY_STYLE[category].tone}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.inventoryArea}>
          <View style={styles.sectionHeading}>
            <View style={styles.headingCopy}>
              <Text numberOfLines={1} style={styles.heading}>{sectionTitle}</Text>
              <Text numberOfLines={1} style={styles.subheading}>{t.fridge.itemCount(visibleItems.length, hasActiveConditions)}</Text>
            </View>
            <View style={styles.headingActions}>
              {hasActiveConditions ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t.fridge.clearFilters} onPress={clearFilters} style={({ pressed }) => [styles.clearButton, pressed ? styles.pressed : null]}>
                  <Ionicons name="refresh-outline" size={17} color="#C96E1A" />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel={t.fridge.addItem.open}
                accessibilityRole="button"
                onPress={openAddSheet}
                style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]}
              >
                <Ionicons name="add" size={29} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <FlatList
            data={visibleItems}
            numColumns={2}
            keyExtractor={inventoryKeyExtractor}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.cardRow}
            contentContainerStyle={visibleItems.length > 0 ? styles.cardGrid : styles.emptyList}
            renderItem={renderInventoryItem}
            ListEmptyComponent={isLoadingInventory ? (
              <View style={styles.loadingState}><ActivityIndicator color="#168ACB" /></View>
            ) : (
              <EmptyInventory
                buttonLabel={hasInventoryLoadError ? t.fridge.reloadInventory : t.fridge.clearFilters}
                description={hasInventoryLoadError ? t.status.disconnected : t.fridge.emptyDescription}
                onClear={hasInventoryLoadError ? () => { void loadInventory().catch(() => undefined); } : clearFilters}
                title={t.fridge.emptyTitle(sectionTitle)}
              />
            )}
          />
        </View>
      </View>
      <AddItemMethodSheet
        copy={t.fridge.addItem}
        onClose={closeAddSheet}
        onSelect={selectAddMethod}
        visible={isAddSheetVisible}
      />
      <InventoryEntryFlow
        blurTarget={blurTarget}
        initialValues={editingBatch ? editInitialValues : recognitionInitialValues}
        mode={editingBatch ? 'edit' : 'create'}
        onClose={closeManualEntry}
        onSubmit={editingBatch ? saveEditedInventoryEntry : saveInventoryEntry}
        source={editingBatch ? 'manual' : entrySource}
        visible={isManualEntryVisible}
      />
      <PhotoRecognitionCamera
        onClose={() => setIsRecognitionCameraVisible(false)}
        onManualFallback={openManualFallback}
        onRecognised={handlePhotoRecognised}
        visible={isRecognitionCameraVisible}
      />
      <RecognitionResultReview
        draft={recognitionDraft}
        onClose={() => setRecognitionDraft(null)}
        onContinue={continueRecognitionEntry}
        onRetake={retakeRecognitionPhoto}
        visible={recognitionDraft !== null}
      />
      <InventoryItemDetailSheet
        batchUid={selectedBatchUid}
        blurTarget={blurTarget}
        onChanged={loadInventory}
        onClose={() => setSelectedBatchUid(null)}
        onEdit={(batchUid) => { setSelectedBatchUid(null); void openBatchEditor(batchUid); }}
        visible={selectedBatchUid !== null}
      />
    </View>
  );
}

function EmptyInventory({ buttonLabel, description, onClear, title }: { buttonLabel: string; description: string; onClear: () => void; title: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><MaterialCommunityIcons name="fridge-outline" size={38} color="#7C9289" /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      <Pressable accessibilityLabel={buttonLabel} accessibilityRole="button" onPress={onClear} style={({ pressed }) => [styles.emptyButton, pressed ? styles.pressed : null]}>
        <Ionicons name="filter-outline" size={17} color="#C96E1A" />
        <Text style={styles.emptyButtonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7FBFA' },
  topArea: { paddingTop: 64, paddingBottom: 12, backgroundColor: '#F3F8F7' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16 },
  fridgeSwitcher: { width: 132, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: '#D8E5E0', borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#EAF2EF' },
  fridgeSwitcherText: { flex: 1, color: '#305D51', fontSize: 13, fontWeight: '800' },
  searchField: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: '#203C33', fontSize: 14, fontWeight: '600' },
  filterRow: { gap: 8, paddingTop: 13, paddingHorizontal: 16, paddingRight: 30 },
  content: { flex: 1, flexDirection: 'row', paddingBottom: 106 },
  categoryRail: { width: 102, flexGrow: 0, flexShrink: 0, paddingTop: 16, backgroundColor: '#FBFDFC' },
  categoryHeading: { paddingHorizontal: 13, color: '#6A7B74', fontSize: 12, fontWeight: '800' },
  categoryList: { gap: 9, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 18 },
  inventoryArea: { flex: 1, minWidth: 0, paddingTop: 18, paddingRight: 14, paddingLeft: 8 },
  sectionHeading: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 },
  headingCopy: { flex: 1, minWidth: 0, gap: 3 },
  heading: { color: '#173D31', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subheading: { color: '#61766D', fontSize: 12, fontWeight: '600' },
  headingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFF1E3' },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#F58220', boxShadow: '0 7px 16px rgba(245, 130, 32, 0.28)' },
  cardGrid: { gap: 10, paddingBottom: 24 },
  cardRow: { justifyContent: 'space-between', gap: 10 },
  emptyList: { flexGrow: 1, paddingBottom: 16 },
  loadingState: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  emptyIcon: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, borderCurve: 'continuous', backgroundColor: '#EDF6F2' },
  emptyTitle: { marginTop: 17, color: '#1B3D33', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { marginTop: 7, color: '#61766D', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  emptyButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, paddingHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#FFF1E3' },
  emptyButtonText: { color: '#C96E1A', fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
