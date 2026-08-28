import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../i18n';

type FridgeScope = 'personal' | 'household';
type StorageZone = 'chilled' | 'frozen' | 'pantry';
type FridgeFilter = StorageZone | 'expired' | 'expiring' | 'restock';
type FoodCategory = 'meat' | 'vegetables' | 'fruit' | 'staples' | 'condiments' | 'drinks' | 'other';
type InventoryItemId = 'milk' | 'tomato' | 'egg' | 'blueberry' | 'rice' | 'peas' | 'soySauce' | 'yogurt' | 'bread';

type InventoryItem = {
  id: InventoryItemId;
  category: FoodCategory;
  storage: StorageZone;
  emoji: string;
  daysLeft: number | null;
  needsRestock?: boolean;
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

const MY_FRIDGE: InventoryItem[] = [
  { id: 'milk', category: 'drinks', storage: 'chilled', emoji: '🥛', daysLeft: 4 },
  { id: 'tomato', category: 'vegetables', storage: 'chilled', emoji: '🍅', daysLeft: 2 },
  { id: 'egg', category: 'meat', storage: 'chilled', emoji: '🥚', daysLeft: 8 },
  { id: 'blueberry', category: 'fruit', storage: 'chilled', emoji: '🫐', daysLeft: 1 },
  { id: 'rice', category: 'staples', storage: 'pantry', emoji: '🍚', daysLeft: null, needsRestock: true },
  { id: 'peas', category: 'vegetables', storage: 'frozen', emoji: '🫛', daysLeft: 35 },
  { id: 'soySauce', category: 'condiments', storage: 'pantry', emoji: '🫙', daysLeft: 122, needsRestock: true },
];

const FAMILY_FRIDGE: InventoryItem[] = [
  ...MY_FRIDGE,
  { id: 'yogurt', category: 'drinks', storage: 'chilled', emoji: '🥣', daysLeft: 6 },
  { id: 'bread', category: 'staples', storage: 'pantry', emoji: '🍞', daysLeft: -1 },
];

const isStatusMatch = (item: InventoryItem, filter: FridgeFilter | null) => {
  if (!filter) return true;
  if (filter === 'expired') return item.daysLeft !== null && item.daysLeft < 0;
  if (filter === 'expiring') return item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 3;
  if (filter === 'restock') return Boolean(item.needsRestock);
  return item.storage === filter;
};

export function FridgeScreen() {
  const { t } = useI18n();
  const [fridgeScope, setFridgeScope] = useState<FridgeScope>('personal');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FridgeFilter | null>(null);
  const [activeCategory, setActiveCategory] = useState<FoodCategory | null>(null);
  const inventory = fridgeScope === 'personal' ? MY_FRIDGE : FAMILY_FRIDGE;
  const currentScopeLabel = t.fridge.scopes[fridgeScope];

  // Arthur: NarIyirm
  // 中文：界面语言只改变展示文案，筛选始终使用稳定的内部键，避免切换语言时丢失当前条件。
  // EN: Language changes presentation copy only; stable internal keys preserve active filters when the language switches.
  const visibleItems = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLocaleLowerCase();
    return inventory.filter((item) => {
      const localizedName = t.fridge.items[item.id].name.toLocaleLowerCase();
      const matchesName = !normalizedQuery || localizedName.includes(normalizedQuery);
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
  const hasActiveConditions = Boolean(activeFilter || activeCategory || searchTerm.trim());
  const sectionTitle = searchTerm.trim()
    ? t.fridge.titles.search
    : activeFilter
      ? t.fridge.titleFor(t.fridge.filters[activeFilter])
      : activeCategory
        ? t.fridge.titleFor(t.fridge.categories[activeCategory])
        : t.fridge.titles.all;

  const clearFilters = () => {
    setSearchTerm('');
    setActiveFilter(null);
    setActiveCategory(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topArea}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.fridge.switchA11y(currentScopeLabel)}
            onPress={() => setFridgeScope((scope) => scope === 'personal' ? 'household' : 'personal')}
            style={({ pressed }) => [styles.fridgeSwitcher, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons name="fridge-outline" size={20} color="#496A61" />
            <Text numberOfLines={1} style={styles.fridgeSwitcherText}>{currentScopeLabel}</Text>
            <Ionicons name="chevron-down" size={16} color="#496A61" />
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
              <Pressable accessibilityLabel={t.fridge.clearSearch} onPress={() => setSearchTerm('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#80918B" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((filter) => {
            const selected = activeFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setActiveFilter((current) => current === filter.key ? null : filter.key)}
                style={({ pressed }) => [
                  styles.filterChip,
                  { borderColor: selected ? filter.tone : filter.tint, backgroundColor: selected ? filter.tone : '#FFFFFF' },
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons name={filter.icon} size={17} color={selected ? '#FFFFFF' : filter.tone} />
                <Text style={[styles.filterText, { color: selected ? '#FFFFFF' : filter.tone }]}>{t.fridge.filters[filter.key]}</Text>
                <View style={[styles.countBubble, { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : filter.tint }]}>
                  <Text style={[styles.countText, { color: selected ? '#FFFFFF' : filter.tone }]}>{filterCounts[filter.key]}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.content}>
        <View style={styles.categoryRail}>
          <Text numberOfLines={1} style={styles.categoryHeading}>{t.fridge.categoryHeading}</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            <CategoryButton count={inventory.length} label={t.fridge.categories.all} onPress={() => setActiveCategory(null)} selected={!activeCategory} tint="#EEEFFD" tone="#6255D9" />
            {CATEGORIES.map((category) => (
              <CategoryButton
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
            {hasActiveConditions ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t.fridge.clearFilters} onPress={clearFilters} style={({ pressed }) => [styles.clearButton, pressed ? styles.pressed : null]}>
                <Ionicons name="refresh-outline" size={17} color="#C96E1A" />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={visibleItems}
            numColumns={2}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.cardRow}
            contentContainerStyle={visibleItems.length > 0 ? styles.cardGrid : styles.emptyList}
            renderItem={({ item }) => (
              <FoodCard
                amount={t.fridge.items[item.id].amount}
                freshnessText={item.daysLeft === null ? null : item.daysLeft < 0 ? t.fridge.freshness.expired : item.daysLeft === 0 ? t.fridge.freshness.today : t.fridge.freshness.daysLeft(item.daysLeft)}
                item={item}
                name={t.fridge.items[item.id].name}
                storageLabel={t.fridge.filters[item.storage]}
              />
            )}
            ListEmptyComponent={<EmptyInventory description={t.fridge.emptyDescription} onClear={clearFilters} title={t.fridge.emptyTitle(sectionTitle)} buttonLabel={t.fridge.clearFilters} />}
          />
        </View>
      </View>
    </View>
  );
}

type CategoryButtonProps = { count: number; label: string; onPress: () => void; selected: boolean; tint: string; tone: string };

function CategoryButton({ count, label, onPress, selected, tint, tone }: CategoryButtonProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.categoryItem, { backgroundColor: selected ? tone : tint }, pressed ? styles.pressed : null]}>
      <View style={[styles.categoryAccent, { backgroundColor: selected ? '#FFFFFF' : tone }]} />
      <Text numberOfLines={2} style={[styles.categoryLabel, { color: selected ? '#FFFFFF' : tone }]}>{label}</Text>
      <Text style={[styles.categoryCount, { color: selected ? '#FFFFFF' : tone }]}>{count}</Text>
    </Pressable>
  );
}

type FoodCardProps = { amount: string; freshnessText: string | null; item: InventoryItem; name: string; storageLabel: string };

function FoodCard({ amount, freshnessText, item, name, storageLabel }: FoodCardProps) {
  const categoryStyle = CATEGORY_STYLE[item.category];
  const isExpired = item.daysLeft !== null && item.daysLeft < 0;
  const isSoon = item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 3;
  const freshnessColor = isExpired ? '#C7494C' : isSoon ? '#BE701B' : '#2E9460';
  const freshnessTint = isExpired ? '#FFF0F1' : isSoon ? '#FFF3E7' : '#EAF8F0';
  const storageIcon: keyof typeof Ionicons.glyphMap = item.storage === 'frozen' ? 'snow-outline' : item.storage === 'chilled' ? 'water-outline' : 'cube-outline';

  return (
    <View style={[styles.foodCard, { backgroundColor: categoryStyle.tint, borderColor: `${categoryStyle.tone}20` }]}>
      <View style={styles.cardTop}>
        <View style={styles.emojiTile}><Text style={styles.emoji}>{item.emoji}</Text></View>
        <Text numberOfLines={2} style={styles.foodName}>{name}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.amount}>{amount}</Text>
      <View style={styles.cardMeta}>
        <View style={styles.storageBadge}>
          <Ionicons name={storageIcon} size={13} color="#287A8B" />
          <Text numberOfLines={1} style={styles.storageText}>{storageLabel}</Text>
        </View>
        {freshnessText ? <View style={[styles.freshnessBadge, { backgroundColor: freshnessTint }]}><Text numberOfLines={1} style={[styles.freshnessText, { color: freshnessColor }]}>{freshnessText}</Text></View> : null}
      </View>
      {item.needsRestock ? <View style={styles.restockDot} /> : null}
    </View>
  );
}

function EmptyInventory({ buttonLabel, description, onClear, title }: { buttonLabel: string; description: string; onClear: () => void; title: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><MaterialCommunityIcons name="fridge-outline" size={38} color="#7C9289" /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      <Pressable accessibilityRole="button" onPress={onClear} style={({ pressed }) => [styles.emptyButton, pressed ? styles.pressed : null]}>
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
  filterChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderRadius: 18, borderCurve: 'continuous' },
  filterText: { fontSize: 13, fontWeight: '800' },
  countBubble: { minWidth: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderCurve: 'continuous' },
  countText: { fontSize: 11, fontWeight: '900' },
  content: { flex: 1, flexDirection: 'row', paddingBottom: 106 },
  categoryRail: { width: 102, flexGrow: 0, flexShrink: 0, paddingTop: 16, backgroundColor: '#FBFDFC' },
  categoryHeading: { paddingHorizontal: 13, color: '#6A7B74', fontSize: 12, fontWeight: '800' },
  categoryList: { gap: 9, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 18 },
  categoryItem: { position: 'relative', width: 78, minHeight: 72, alignItems: 'flex-start', justifyContent: 'center', gap: 3, overflow: 'hidden', paddingVertical: 10, paddingRight: 7, paddingLeft: 20, borderRadius: 14, borderCurve: 'continuous' },
  categoryAccent: { position: 'absolute', top: 13, bottom: 13, left: 9, width: 4, borderRadius: 2, borderCurve: 'continuous' },
  categoryLabel: { width: '100%', fontSize: 12, fontWeight: '800', lineHeight: 15 },
  categoryCount: { fontSize: 12, fontWeight: '800' },
  inventoryArea: { flex: 1, minWidth: 0, paddingTop: 18, paddingRight: 14, paddingLeft: 8 },
  sectionHeading: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 },
  headingCopy: { flex: 1, minWidth: 0, gap: 3 },
  heading: { color: '#173D31', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subheading: { color: '#61766D', fontSize: 12, fontWeight: '600' },
  clearButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFF1E3' },
  cardGrid: { gap: 10, paddingBottom: 24 },
  cardRow: { justifyContent: 'space-between', gap: 10 },
  foodCard: { position: 'relative', width: '48%', minHeight: 145, padding: 11, borderWidth: 1, borderRadius: 15, borderCurve: 'continuous' },
  cardTop: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emojiTile: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.68)' },
  emoji: { fontSize: 24 },
  foodName: { flex: 1, minWidth: 0, color: '#183B30', fontSize: 15, fontWeight: '800', lineHeight: 18 },
  amount: { marginTop: 9, color: '#24483B', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  storageBadge: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  storageText: { maxWidth: 54, color: '#287A8B', fontSize: 10, fontWeight: '800' },
  freshnessBadge: { minHeight: 24, justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, borderCurve: 'continuous' },
  freshnessText: { fontSize: 10, fontWeight: '800' },
  restockDot: { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 4, borderCurve: 'continuous', backgroundColor: '#1593A9' },
  emptyList: { flexGrow: 1, paddingBottom: 16 },
  emptyState: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  emptyIcon: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, borderCurve: 'continuous', backgroundColor: '#EDF6F2' },
  emptyTitle: { marginTop: 17, color: '#1B3D33', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { marginTop: 7, color: '#61766D', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  emptyButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, paddingHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#FFF1E3' },
  emptyButtonText: { color: '#C96E1A', fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
