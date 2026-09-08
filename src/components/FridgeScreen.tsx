import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type ListRenderItemInfo } from 'react-native';
import {
  createInventoryBatch,
  generateFoodPreset,
  getFoodPresetSuggestion,
  getInventorySnapshot,
  setInventoryRestockRule,
  updateInventoryBatch,
  type InventoryBatchDetail,
  type InventoryCategory,
  type InventorySnapshot,
} from '../services/inventoryApi';
import type { PhotoRecognitionResult } from '../services/recognitionApi';
import type { BarcodeProduct } from '../services/barcodeApi';
import { getFridgeAccessContext, type FridgeAccessContext } from '../services/sharingApi';
import { requestImmediateSyncProbe, subscribeToSync } from '../services/realtimeSync';
import { useI18n } from '../i18n';
import { AddItemMethodSheet, type AddItemMethod } from './AddItemMethodSheet';
import { FridgeCategoryButton } from './fridge/FridgeCategoryButton';
import { CreateCategoryModal } from './fridge/CreateCategoryModal';
import { FridgeFilterChip } from './fridge/FridgeFilterChip';
import { FridgeFoodCard, type FridgeStorageZone } from './fridge/FridgeFoodCard';
import { FridgeAssistantButton } from './fridge/FridgeAssistantButton';
import { FridgeAssistantScreen } from './fridge/FridgeAssistantScreen';
import { InventoryItemDetailSheet } from './fridge/InventoryItemDetailSheet';
import {
  InventoryEntryFlow,
  type InventoryEntrySource,
  type InventoryEntryInitialValues,
  type InventoryEntrySubmission,
} from './inventory-entry/InventoryEntryFlow';
import { PhotoRecognitionCamera } from './inventory-entry/PhotoRecognitionCamera';
import {
  BarcodeResultReview,
  buildBarcodeInitialValues,
  type BarcodeDraft,
} from './inventory-entry/BarcodeResultReview';
import {
  buildRecognitionInitialValues,
  RecognitionResultReview,
  type RecognitionDraft,
} from './inventory-entry/RecognitionResultReview';
import { FridgeSpaceMenu } from './sharing/FridgeSpaceMenu';
import { SharedFridgeFlowModal, type SharedFridgeFlowScreen } from './sharing/SharedFridgeFlowModal';

type StorageZone = FridgeStorageZone;
export type FridgeFilter = StorageZone | 'expired' | 'expiring' | 'restock';
type FoodCategory = 'meat' | 'vegetables' | 'fruit' | 'staples' | 'condiments' | 'drinks' | 'other';
type InventoryLoadMode = 'background' | 'initial' | 'manual';

type InventoryItem = {
  categoryId: string;
  id: string;
  category: FoodCategory;
  storage: StorageZone;
  emoji: string;
  iconUrl: string | null;
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

const FILTER_SWIPE_HINT_KEY = 'kitchmemo.fridge.filter-swipe-hint.v1';
const CATEGORY_RAIL_COLLAPSED_KEY = 'kitchmemo.fridge.category-rail-collapsed.v1';

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

const CATEGORY_ICONS: Record<FoodCategory, keyof typeof Ionicons.glyphMap> = {
  meat: 'restaurant-outline', vegetables: 'leaf-outline', fruit: 'nutrition-outline', staples: 'fast-food-outline',
  condiments: 'flask-outline', drinks: 'water-outline', other: 'cube-outline',
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
  initialFilter?: FridgeFilter | null;
};

// Arthur: NarIyirm
// 中文：冰箱功能的页面编排入口；上游由 App.tsx 的 fridge Tab 挂载，下游通过 inventoryApi、sharingApi 和同步订阅读写权威数据。
// EN: This orchestrates the fridge feature; App.tsx mounts it for the fridge tab and it reaches authoritative data through inventoryApi, sharingApi, and sync subscriptions.
export function FridgeScreen({ blurTarget, initialFilter = null }: FridgeScreenProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FridgeFilter | null>(initialFilter);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryRailCollapsed, setCategoryRailCollapsed] = useState(false);
  const [isCreateCategoryVisible, setIsCreateCategoryVisible] = useState(false);
  const [isAddSheetVisible, setIsAddSheetVisible] = useState(false);
  const [isManualEntryVisible, setIsManualEntryVisible] = useState(false);
  const [isRecognitionCameraVisible, setIsRecognitionCameraVisible] = useState(false);
  const [recognitionDraft, setRecognitionDraft] = useState<RecognitionDraft | null>(null);
  const [barcodeDraft, setBarcodeDraft] = useState<BarcodeDraft | null>(null);
  const [recognitionInitialValues, setRecognitionInitialValues] = useState<InventoryEntryInitialValues | undefined>();
  const [entrySource, setEntrySource] = useState<InventoryEntrySource>('manual');
  const [selectedBatchUid, setSelectedBatchUid] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [isRefreshingInventory, setIsRefreshingInventory] = useState(false);
  const [isSyncingInventory, setIsSyncingInventory] = useState(false);
  const inventoryLoadRef = useRef<Promise<void> | null>(null);
  const [hasInventoryLoadError, setHasInventoryLoadError] = useState(false);
  const [isSpaceMenuVisible, setIsSpaceMenuVisible] = useState(false);
  const [sharingContext, setSharingContext] = useState<FridgeAccessContext | null>(null);
  const [isSharingContextLoading, setIsSharingContextLoading] = useState(false);
  const [hasSharingContextError, setHasSharingContextError] = useState(false);
  const [sharingFlow, setSharingFlow] = useState<SharedFridgeFlowScreen | null>(null);
  const [isAssistantVisible, setIsAssistantVisible] = useState(false);
  const [saveConfirmationVisible, setSaveConfirmationVisible] = useState(false);
  const [showFilterSwipeHint, setShowFilterSwipeHint] = useState(false);
  const filterSwipeHintDismissedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    // Arthur: NarIyirm
    // 中文：滑动提示只对尚未发现横向筛选栏的设备显示一次，读取失败时保持界面安静，不阻塞库存加载。
    // EN: The swipe hint appears once for devices that have not discovered the horizontal filter rail; storage failures stay quiet and never block inventory loading.
    void AsyncStorage.getItem(FILTER_SWIPE_HINT_KEY).then((value) => {
      if (mounted && !filterSwipeHintDismissedRef.current && value !== 'seen') setShowFilterSwipeHint(true);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(CATEGORY_RAIL_COLLAPSED_KEY).then((value) => {
      if (value === 'true') setCategoryRailCollapsed(true);
    }).catch(() => undefined);
  }, []);

  // Arthur: NarIyirm
  // 中文：初次进入、下拉刷新和后台同步共用此加载器；最终调用 inventoryApi.getInventorySnapshot 并替换页面 snapshot。
  // EN: Initial entry, pull-to-refresh, and background sync share this loader, which calls inventoryApi.getInventorySnapshot and replaces the screen snapshot.
  const loadInventory = useCallback(async (mode: InventoryLoadMode = 'background') => {
    if (mode === 'initial') setIsLoadingInventory(true);
    if (mode === 'manual') setIsRefreshingInventory(true);
    if (mode === 'background') setIsSyncingInventory(true);
    try {
      // Arthur: NarIyirm
      // 中文：Realtime、保存后对账和手动刷新共用同一个在途请求，避免同一次库存变更重复下载完整快照。
      // EN: Realtime, post-save reconciliation, and manual refresh share one in-flight request so one inventory mutation cannot download the full snapshot repeatedly.
      if (!inventoryLoadRef.current) {
        inventoryLoadRef.current = getInventorySnapshot()
          .then((nextSnapshot) => {
            setSnapshot(nextSnapshot);
            setHasInventoryLoadError(false);
          })
          .finally(() => {
            inventoryLoadRef.current = null;
          });
      }
      await inventoryLoadRef.current;
    } catch (error) {
      setHasInventoryLoadError(true);
      throw error;
    } finally {
      if (mode === 'initial') setIsLoadingInventory(false);
      if (mode === 'manual') setIsRefreshingInventory(false);
      if (mode === 'background') setIsSyncingInventory(false);
    }
  }, []);

  useEffect(() => {
    // Arthur: NarIyirm
    // 中文：进入冰箱页后用当前设备对应的真实冰箱替换演示数据；失败时保留空状态，不显示过期缓存数据。
    // EN: Opening the fridge loads the real fridge for this device; failures keep an empty state instead of showing stale mock data.
    void loadInventory('initial').catch(() => undefined);
  }, [loadInventory]);

  useEffect(() => subscribeToSync(['inventory', 'restock', 'fridge'], () => {
    // Arthur: NarIyirm
    // 中文：实时事件只触发静默对账，保留当前筛选和滚动状态，不用全屏加载态打断用户操作。
    // EN: Realtime events trigger silent reconciliation, preserving filters and scroll state without interrupting the user with a full-screen loader.
    void loadInventory('background').catch(() => undefined);
  }), [loadInventory]);

  const loadSharingContext = useCallback(async () => {
    setIsSharingContextLoading(true);
    setHasSharingContextError(false);
    try {
      setSharingContext(await getFridgeAccessContext());
    } catch {
      setHasSharingContextError(true);
    } finally {
      setIsSharingContextLoading(false);
    }
  }, []);

  useEffect(() => subscribeToSync(['fridge', 'members'], () => {
    void loadSharingContext();
  }), [loadSharingContext]);

  const openSpaceMenu = useCallback(() => {
    setIsSpaceMenuVisible(true);
    void loadSharingContext();
  }, [loadSharingContext]);

  const openSharingFlow = useCallback((screen: SharedFridgeFlowScreen) => {
    setIsSpaceMenuVisible(false);
    setSharingFlow(screen);
  }, []);

  const handleSharingContextChanged = useCallback(async (nextContext: FridgeAccessContext) => {
    // Arthur: NarIyirm
    // 中文：共享操作成功后同时更新入口状态与库存快照，名称、模式和数据合并结果会在同一页面周期内可见。
    // EN: After sharing succeeds, refresh both access state and inventory so name, mode, and merged data become visible in the same screen cycle.
    setSharingContext(nextContext);
    requestImmediateSyncProbe();
    void loadInventory('background').catch(() => undefined);
  }, [loadInventory]);

  const inventory = useMemo<InventoryItem[]>(() => (snapshot?.batches ?? []).map((batch) => {
    const category = isFoodCategory(batch.categoryCode) ? batch.categoryCode : 'other';
    return {
      amount: `${formatQuantity(batch.remainingQuantity)} ${t.fridge.manualEntry.units[batch.unit as keyof typeof t.fridge.manualEntry.units] ?? batch.unit}`,
      category,
      categoryId: batch.categoryId,
      daysLeft: getDaysLeft(batch.expiresAt),
      emoji: batch.iconEmoji ?? CATEGORY_EMOJI[category],
      id: batch.id,
      iconUrl: batch.iconUrl ?? null,
      isExpired: isExpiredAt(batch.expiresAt),
      name: batch.name,
      needsRestock: batch.needsRestock,
      storage: batch.storageZone,
    };
  }), [snapshot, t.fridge.manualEntry.units]);
  const categories = useMemo<InventoryCategory[]>(() => snapshot?.categories ?? CATEGORIES.map((code) => ({
    code,
    colour: CATEGORY_STYLE[code].tone,
    icon: CATEGORY_ICONS[code],
    iconUrl: null,
    id: `default:${code}`,
    isDefault: true,
    name: t.fridge.categories[code],
  })), [snapshot?.categories, t.fridge.categories]);
  const currentScopeLabel = snapshot?.fridge.mode === 'shared'
    ? snapshot.fridge.name
    : t.fridge.scopes.personal;
  const selectedBatch = selectedBatchUid
    ? snapshot?.batches.find((batch) => batch.id === selectedBatchUid) ?? null
    : null;

  useEffect(() => {
    if (!saveConfirmationVisible) return;
    const timer = setTimeout(() => setSaveConfirmationVisible(false), 2200);
    return () => clearTimeout(timer);
  }, [saveConfirmationVisible]);

  // Arthur: NarIyirm
  // 中文：界面语言只改变展示文案，筛选始终使用稳定的内部键，避免切换语言时丢失当前条件。
  // EN: Language changes presentation copy only; stable internal keys preserve active filters when the language switches.
  const visibleItems = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLocaleLowerCase();
    return inventory.filter((item) => {
      const localizedName = item.name.toLocaleLowerCase();
      const matchesName = normalizedQuery.length === 0 || localizedName.includes(normalizedQuery);
      return matchesName && isStatusMatch(item, activeFilter) && (!activeCategory || item.categoryId === activeCategory);
    });
  }, [activeCategory, activeFilter, inventory, searchTerm, t]);

  const filterCounts = useMemo(
    () => Object.fromEntries(FILTERS.map(({ key }) => [key, inventory.filter((item) => isStatusMatch(item, key)).length])) as Record<FridgeFilter, number>,
    [inventory],
  );
  const categoryCounts = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, inventory.filter((item) => item.categoryId === category.id).length])) as Record<string, number>, [categories, inventory]);
  const activeCategoryRecord = activeCategory ? categories.find((category) => category.id === activeCategory) ?? null : null;
  const railCategoryCode = activeCategoryRecord?.code && isFoodCategory(activeCategoryRecord.code) ? activeCategoryRecord.code : null;
  const hasActiveConditions = activeFilter !== null || activeCategory !== null || searchTerm.trim().length > 0;
  const sectionTitle = searchTerm.trim().length > 0
    ? t.fridge.titles.search
    : activeFilter
      ? t.fridge.titleFor(t.fridge.filters[activeFilter])
      : activeCategory
        ? t.fridge.titleFor(activeCategoryRecord?.code && isFoodCategory(activeCategoryRecord.code) ? t.fridge.categories[activeCategoryRecord.code] : activeCategoryRecord?.name ?? '')
        : t.fridge.titles.all;

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setActiveFilter(null);
    setActiveCategory(null);
  }, []);

  const toggleCategoryRail = useCallback(() => {
    setCategoryRailCollapsed((current) => {
      const next = !current;
      void AsyncStorage.setItem(CATEGORY_RAIL_COLLAPSED_KEY, String(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const handleCategoryCreated = useCallback((category: InventoryCategory) => {
    setSnapshot((current) => current ? { ...current, categories: [...current.categories, category] } : current);
    setActiveCategory(category.id);
    setIsCreateCategoryVisible(false);
  }, []);

  const dismissFilterSwipeHint = useCallback(() => {
    filterSwipeHintDismissedRef.current = true;
    setShowFilterSwipeHint(false);
    void AsyncStorage.setItem(FILTER_SWIPE_HINT_KEY, 'seen').catch(() => undefined);
  }, []);

  const openAddSheet = useCallback(() => setIsAddSheetVisible(true), []);
  const closeAddSheet = useCallback(() => setIsAddSheetVisible(false), []);
  const selectAddMethod = useCallback((method: AddItemMethod) => {
    // Arthur: NarIyirm
    // 中文：这个回调只会在选择窗完全卸载后触发，因此不会与手动录入的原生 Modal 重叠。
    // EN: This callback fires only after the chooser unmounts, preventing overlap with the manual entry native Modal.
    if (method === 'manual') {
      setRecognitionInitialValues(undefined);
      setEntrySource('manual');
      setIsManualEntryVisible(true);
    }
    if (method === 'camera') {
      setRecognitionDraft(null);
      setBarcodeDraft(null);
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

  // Arthur: NarIyirm
  // 中文：识别相机成功后在此补查 food preset，并把模型结果转换为 RecognitionResultReview 或共用手动表单的初值。
  // EN: After camera recognition, this enriches the model result with a food preset and builds either RecognitionResultReview or shared manual-form values.
  const handlePhotoRecognised = useCallback(async (result: PhotoRecognitionResult, photoUri: string) => {
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
      photoUri,
      storageZone: suggestion.storageZone,
      unit: 'item',
    });
    setIsRecognitionCameraVisible(false);
  }, [t.fridge.photoRecognition.foodNames]);

  const handleBarcodeProduct = useCallback(async (product: BarcodeProduct) => {
    let suggestion = null;
    let enrichmentSource: BarcodeDraft['enrichmentSource'] = null;
    try {
      const presetResult = await getFoodPresetSuggestion(product.name);
      suggestion = presetResult.suggestion;
      if (suggestion) {
        enrichmentSource = 'preset';
      } else {
        const generatedResult = await generateFoodPreset(product.name);
        suggestion = generatedResult.suggestion;
        enrichmentSource = generatedResult.generated ? 'ai' : 'preset';
      }
    } catch {
      // Arthur: NarIyirm
      // 中文：AI 补全失败不应覆盖已经成功的条码查询；用户仍可在共用表单中补齐图标之外的库存字段。
      // EN: AI enrichment failure must not replace a successful barcode lookup; users can still complete inventory fields in the shared form.
      suggestion = null;
    }
    setBarcodeDraft({ enrichmentSource, initialValues: buildBarcodeInitialValues(product, suggestion), product, suggestion });
    setIsRecognitionCameraVisible(false);
  }, []);

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

  const continueBarcodeEntry = useCallback((draft: BarcodeDraft) => {
    setRecognitionInitialValues(draft.initialValues);
    setBarcodeDraft(null);
    setEntrySource('barcode');
    setIsManualEntryVisible(true);
  }, []);

  const rescanBarcode = useCallback(() => {
    setBarcodeDraft(null);
    setIsRecognitionCameraVisible(true);
  }, []);

  const closeManualEntry = useCallback(() => {
    setIsManualEntryVisible(false);
    setRecognitionInitialValues(undefined);
    setEntrySource('manual');
  }, []);
  // Arthur: NarIyirm
  // 中文：新增表单只等待权威写入，成功后立即关闭保存态，完整快照在后台静默对账。
  // EN: The create form waits only for the authoritative write, then leaves the save state immediately while the full snapshot reconciles silently.
  const saveInventoryEntry = useCallback(async (submission: InventoryEntrySubmission) => {
    // Arthur: NarIyirm
    // 中文：手动录入和识别录入共用同一提交对象；后端根据 Device-ID 决定写入的冰箱。
    // EN: Manual and recognition entry share this submission contract; the server chooses the target fridge from Device-ID.
    await createInventoryBatch({
      categoryCode: submission.batch.categoryCode,
      expiresAt: submission.batch.expiresAt,
      expiryWarningDays: submission.expiryWarningDays,
      initialQuantity: submission.batch.initialQuantity,
      name: submission.batch.name,
      presetUid: submission.batch.matchedPresetUid,
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
    void loadInventory('background').catch(() => undefined);
  }, [loadInventory]);

  // Arthur: NarIyirm
  // 中文：详情编辑仍依次保存批次和补货规则，但列表对账不再延长表单的“正在保存”状态。
  // EN: Detail edits still save the batch and restock rule in order, but list reconciliation no longer extends the form's saving state.
  const saveEditedInventoryEntry = useCallback(async (editingBatch: InventoryBatchDetail, submission: InventoryEntrySubmission) => {
    const updated = await updateInventoryBatch(editingBatch.id, {
      categoryCode: submission.batch.categoryCode,
      expectedVersion: editingBatch.version,
      expiresAt: submission.batch.expiresAt,
      expiryWarningDays: submission.expiryWarningDays,
      name: submission.batch.name,
      purchasePrice: submission.batch.purchasePrice,
      remainingQuantity: submission.batch.remainingQuantity,
      storageZone: submission.batch.storageZone,
      unit: submission.batch.unit,
    });
    const nextRestockRule = submission.restockRule ? {
      enabled: true,
      minimumQuantity: submission.restockRule.minimumQuantity,
      targetQuantity: submission.restockRule.targetQuantity,
    } : null;
    const currentRestockRule = editingBatch.restockRule;
    const restockUnchanged = nextRestockRule?.enabled === currentRestockRule?.enabled
      && nextRestockRule?.minimumQuantity === currentRestockRule?.minimumQuantity
      && nextRestockRule?.targetQuantity === currentRestockRule?.targetQuantity;
    // Arthur: NarIyirm
    // 中文：补货阈值没有变化时不再发送第二个 mutation，录屏中只修改有效期的保存因此只需一次网络往返。
    // EN: Skip the second mutation when restock thresholds are unchanged, so expiry-only edits in the recording need a single network round trip.
    const restockRule = restockUnchanged
      ? currentRestockRule
      : (await setInventoryRestockRule(editingBatch.id, nextRestockRule, submission.batch.unit)).restockRule;
    void loadInventory('background').catch(() => undefined);
    setSaveConfirmationVisible(true);
    return { ...updated.batch, restockRule };
  }, [loadInventory]);

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
        iconUrl={item.iconUrl}
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
          <Pressable accessibilityLabel={t.fridge.switchA11y(currentScopeLabel)} accessibilityRole="button" onPress={openSpaceMenu} style={({ pressed }) => [styles.fridgeSwitcher, pressed ? styles.pressed : null]}>
            <MaterialCommunityIcons name="fridge-outline" size={20} color="#168ACB" />
            <Text numberOfLines={1} style={styles.fridgeSwitcherText}>{currentScopeLabel}</Text>
            <Ionicons name="chevron-down" size={15} color="#168ACB" />
          </Pressable>
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
          <FridgeAssistantButton onPress={() => setIsAssistantVisible(true)} />
        </View>

        <View style={styles.filterBar}>
          <FridgeFilterChip
            count={inventory.length}
            icon="apps-outline"
            label={t.fridge.filters.all}
            onPress={clearFilters}
            selected={!hasActiveConditions}
            tint="#EEEFFD"
            tone="#6255D9"
          />
          <View style={styles.scrollableFilters}>
            <ScrollView
              contentContainerStyle={styles.filterRow}
              horizontal
              onScrollBeginDrag={dismissFilterSwipeHint}
              showsHorizontalScrollIndicator={false}
            >
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
            {showFilterSwipeHint ? (
              <View accessibilityLabel={t.fridge.filterSwipeHint} pointerEvents="none" style={styles.filterSwipeHint}>
                <Text style={styles.filterSwipeHintText}>{t.fridge.filterSwipeHint}</Text>
                <Ionicons name="arrow-forward" size={14} color="#276D70" />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.categoryRail, categoryRailCollapsed ? styles.categoryRailCollapsed : null]}>
          <View style={[styles.categoryRailActions, categoryRailCollapsed ? styles.categoryRailActionsCollapsed : null]}>
            <Pressable accessibilityLabel={categoryRailCollapsed ? t.fridge.categoryRail.expand : t.fridge.categoryRail.collapse} accessibilityRole="button" onPress={toggleCategoryRail} style={styles.categoryRailIconButton}>
              <Ionicons color="#315C51" name={categoryRailCollapsed ? 'chevron-forward' : 'chevron-back'} size={19} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.categoryList, categoryRailCollapsed ? styles.categoryListCollapsed : null]}>
            <FridgeCategoryButton
              collapsed={categoryRailCollapsed}
              count={activeCategoryRecord ? categoryCounts[activeCategoryRecord.id] ?? 0 : inventory.length}
              icon={railCategoryCode ? CATEGORY_ICONS[railCategoryCode] : activeCategoryRecord ? 'sparkles-outline' : 'grid-outline'}
              iconUrl={activeCategoryRecord?.iconUrl}
              label={railCategoryCode ? t.fridge.categories[railCategoryCode] : activeCategoryRecord?.name ?? t.fridge.categories.all}
              onPress={categoryRailCollapsed ? toggleCategoryRail : () => setActiveCategory(null)}
              selected={categoryRailCollapsed || activeCategory === null}
              tint={railCategoryCode ? CATEGORY_STYLE[railCategoryCode].tint : '#EEEFFD'}
              tone={activeCategoryRecord?.colour ?? '#6255D9'}
            />
            {!categoryRailCollapsed ? categories.map((category) => {
              const code = category.code && isFoodCategory(category.code) ? category.code : 'other';
              const tone = category.colour ?? CATEGORY_STYLE[code].tone;
              return (
              <FridgeCategoryButton
                key={category.id}
                count={categoryCounts[category.id] ?? 0}
                icon={CATEGORY_ICONS[code]}
                iconUrl={category.iconUrl}
                label={category.code && isFoodCategory(category.code) ? t.fridge.categories[category.code] : category.name}
                onPress={() => setActiveCategory((current) => current === category.id ? null : category.id)}
                selected={activeCategory === category.id}
                tint={CATEGORY_STYLE[code].tint}
                tone={tone}
              />
              );
            }) : null}
            <Pressable accessibilityLabel={t.fridge.categoryRail.add} accessibilityRole="button" onPress={() => setIsCreateCategoryVisible(true)} style={({ pressed }) => [styles.categoryAddListButton, categoryRailCollapsed ? styles.categoryAddListButtonCollapsed : null, pressed ? styles.pressed : null]}>
              <Ionicons color="#FFFFFF" name="add" size={21} />
              {!categoryRailCollapsed ? <Text numberOfLines={1} style={styles.categoryAddListText}>{t.fridge.categoryRail.addShort}</Text> : null}
            </Pressable>
          </ScrollView>
        </View>

        <View style={styles.inventoryArea}>
          <View style={styles.sectionHeading}>
            <View style={styles.headingCopy}>
              <Text numberOfLines={1} style={styles.heading}>{sectionTitle}</Text>
              <View style={styles.inventoryStatusRow}>
                <Text numberOfLines={1} style={styles.subheading}>{t.fridge.itemCount(visibleItems.length, hasActiveConditions)}</Text>
                {isSyncingInventory ? (
                  <ActivityIndicator accessibilityLabel={t.status.connecting} color="#168ACB" size="small" />
                ) : null}
              </View>
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
            refreshControl={(
              <RefreshControl
                colors={['#168ACB']}
                onRefresh={() => { void loadInventory('manual').catch(() => undefined); }}
                refreshing={isRefreshingInventory}
                tintColor="#168ACB"
              />
            )}
            ListEmptyComponent={isLoadingInventory ? (
              <View style={styles.loadingState}><ActivityIndicator color="#168ACB" /></View>
            ) : (
              <EmptyInventory
                buttonLabel={hasInventoryLoadError ? t.fridge.reloadInventory : t.fridge.clearFilters}
                description={hasInventoryLoadError ? t.status.disconnected : t.fridge.emptyDescription}
                onClear={hasInventoryLoadError ? () => { void loadInventory('initial').catch(() => undefined); } : clearFilters}
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
        initialValues={recognitionInitialValues}
        mode="create"
        onClose={closeManualEntry}
        onSubmit={saveInventoryEntry}
        source={entrySource}
        visible={isManualEntryVisible}
      />
      <PhotoRecognitionCamera
        barcodeEnabled
        onClose={() => setIsRecognitionCameraVisible(false)}
        onBarcodeProduct={handleBarcodeProduct}
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
        initialBatch={selectedBatch}
        onChanged={loadInventory}
        onClose={() => setSelectedBatchUid(null)}
        onSaveEdit={saveEditedInventoryEntry}
        visible={selectedBatchUid !== null}
      />
      <CreateCategoryModal copy={t.fridge.customCategory} onClose={() => setIsCreateCategoryVisible(false)} onCreated={handleCategoryCreated} visible={isCreateCategoryVisible} />
      <BarcodeResultReview
        draft={barcodeDraft}
        onClose={() => setBarcodeDraft(null)}
        onContinue={continueBarcodeEntry}
        onRescan={rescanBarcode}
        visible={barcodeDraft !== null}
      />
      {saveConfirmationVisible ? (
        <View accessibilityLiveRegion="polite" style={styles.saveConfirmation}>
          <Ionicons color="#FFFFFF" name="checkmark-circle" size={20} />
          <Text style={styles.saveConfirmationText}>{t.fridge.itemDetail.saveSuccess}</Text>
        </View>
      ) : null}
      <FridgeSpaceMenu
        context={sharingContext}
        failed={hasSharingContextError}
        loading={isSharingContextLoading}
        onClose={() => setIsSpaceMenuVisible(false)}
        onCreate={() => openSharingFlow('create')}
        onJoin={() => openSharingFlow('join')}
        onManage={() => openSharingFlow('manage')}
        onRetry={() => { void loadSharingContext(); }}
        visible={isSpaceMenuVisible}
      />
      <SharedFridgeFlowModal
        context={sharingContext}
        initialScreen={sharingFlow ?? 'create'}
        onClose={() => setSharingFlow(null)}
        onContextChanged={handleSharingContextChanged}
        visible={sharingFlow !== null}
      />
      <FridgeAssistantScreen
        batches={snapshot?.batches ?? []}
        onAddItem={openAddSheet}
        onClose={() => setIsAssistantVisible(false)}
        onOpenItem={setSelectedBatchUid}
        visible={isAssistantVisible}
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
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16 },
  fridgeSwitcher: { width: 142, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: '#BFE3F3', borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#EAF7FD' },
  fridgeSwitcherText: { flex: 1, color: '#24566E', fontSize: 13, fontWeight: '800' },
  searchField: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: '#203C33', fontSize: 14, fontWeight: '600' },
  filterBar: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 13, paddingLeft: 16 },
  scrollableFilters: { flex: 1, minWidth: 0 },
  filterRow: { gap: 8, paddingRight: 30 },
  filterSwipeHint: { position: 'absolute', right: 8, top: 3, minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, borderRadius: 15, backgroundColor: '#E5F5F3' },
  filterSwipeHintText: { color: '#276D70', fontSize: 11.5, fontWeight: '800' },
  content: { flex: 1, flexDirection: 'row', paddingBottom: 106 },
  categoryRail: { width: 82, flexGrow: 0, flexShrink: 0, paddingTop: 10, backgroundColor: '#FBFDFC' },
  categoryRailCollapsed: { width: 52 },
  categoryRailActions: { minHeight: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7 },
  categoryRailActionsCollapsed: { justifyContent: 'flex-start', paddingHorizontal: 9 },
  categoryRailIconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#EAF0ED' },
  categoryAddListButton: { width: 68, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 3, borderRadius: 13, backgroundColor: '#F58220' },
  categoryAddListButtonCollapsed: { width: 44 },
  categoryAddListText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  categoryList: { gap: 5, paddingHorizontal: 7, paddingTop: 6, paddingBottom: 18 },
  categoryListCollapsed: { alignItems: 'center', paddingHorizontal: 4 },
  inventoryArea: { flex: 1, minWidth: 0, paddingTop: 18, paddingRight: 14, paddingLeft: 8 },
  sectionHeading: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 },
  headingCopy: { flex: 1, minWidth: 0, gap: 3 },
  heading: { color: '#173D31', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  inventoryStatusRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 7 },
  subheading: { color: '#61766D', fontSize: 12, fontWeight: '600' },
  headingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFF1E3' },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#F58220', boxShadow: '0 7px 16px rgba(245, 130, 32, 0.28)' },
  cardGrid: { gap: 10, paddingBottom: 24 },
  cardRow: { justifyContent: 'space-between', gap: 10 },
  emptyList: { flexGrow: 1, paddingBottom: 16 },
  loadingState: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  saveConfirmation: { position: 'absolute', zIndex: 30, right: 18, bottom: 112, left: 120, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#168A6B', boxShadow: '0 3px 8px rgba(22, 90, 75, 0.2)' },
  saveConfirmationText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  emptyState: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  emptyIcon: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, borderCurve: 'continuous', backgroundColor: '#EDF6F2' },
  emptyTitle: { marginTop: 17, color: '#1B3D33', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { marginTop: 7, color: '#61766D', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  emptyButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, paddingHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#FFF1E3' },
  emptyButtonText: { color: '#C96E1A', fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
