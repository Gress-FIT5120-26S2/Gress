import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { BarcodeProduct } from '../../services/barcodeApi';
import type { FoodPresetSuggestion } from '../../services/inventoryApi';
import type { InventoryEntryInitialValues } from './InventoryEntryFlow';

export type BarcodeDraft = {
  enrichmentSource: 'preset' | 'ai' | null;
  initialValues: InventoryEntryInitialValues;
  product: BarcodeProduct;
  suggestion: FoodPresetSuggestion | null;
};

type BarcodeResultReviewProps = {
  draft: BarcodeDraft | null;
  onClose: () => void;
  onContinue: (draft: BarcodeDraft) => void;
  onRescan: () => void;
  visible: boolean;
};

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildBarcodeInitialValues(product: BarcodeProduct, suggestion: FoodPresetSuggestion | null): InventoryEntryInitialValues {
  const estimatedExpiry = suggestion ? new Date(Date.now() + suggestion.shelfLifeDays * 86_400_000) : null;
  return {
    categoryCode: suggestion?.categoryCode ?? product.categoryCode,
    expiryDate: estimatedExpiry ? formatLocalDate(estimatedExpiry) : undefined,
    expiryEnabled: Boolean(estimatedExpiry),
    expiryTime: estimatedExpiry ? '23:59' : undefined,
    expiryWarningDays: estimatedExpiry ? Math.min(3, suggestion?.shelfLifeDays ?? 3) : undefined,
    name: product.name,
    quantity: product.packageQuantity ? String(product.packageQuantity) : '1',
    storageZone: suggestion?.storageZone ?? product.storageZone,
    unit: product.packageUnit ?? 'item',
  };
}

// Arthur: NarIyirm
// 中文：条码查询成功后沿用图片识别的“结果核对→共用表单”节奏；包装资料只用于预填，价格与日期继续由用户确认。
// EN: A successful barcode lookup follows the photo flow's review-to-shared-form rhythm; packaging data only prefills while price and dates remain user-confirmed.
export function BarcodeResultReview({ draft, onClose, onContinue, onRescan, visible }: BarcodeResultReviewProps) {
  const { t } = useI18n();
  const copy = t.fridge.barcodeRecognition;
  if (!draft) return null;
  const { enrichmentSource, product, suggestion } = draft;
  const displayImage = product.imageUrl ?? suggestion?.iconUrl ?? null;
  const categoryCode = suggestion?.categoryCode ?? product.categoryCode;
  const storageZone = suggestion?.storageZone ?? product.storageZone;
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50;
  const rows: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = [
    { icon: 'barcode-outline', label: copy.barcode, value: product.barcode },
    { icon: 'cube-outline', label: copy.packageSize, value: product.packageLabel ?? copy.notProvided },
    { icon: 'grid-outline', label: copy.category, value: t.fridge.categories[categoryCode] },
    { icon: 'archive-outline', label: copy.storage, value: t.fridge.manualEntry.storage[storageZone] },
    ...(suggestion ? [{ icon: 'calendar-outline' as const, label: copy.referenceShelfLife, value: copy.daysValue(suggestion.shelfLifeDays) }] : []),
    ...(enrichmentSource ? [{ icon: 'sparkles-outline' as const, label: copy.completionSource, value: enrichmentSource === 'ai' ? copy.aiGenerated : copy.presetMatched }] : []),
  ];

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F6F8F6" />
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset + 6 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable accessibilityLabel={copy.closeReview} accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}>
              <Ionicons color="#315C51" name="close" size={22} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{copy.reviewTitle}</Text>
              <Text style={styles.source}>{copy.source}</Text>
            </View>
            <View style={styles.closePlaceholder} />
          </View>

          <View style={styles.productHero}>
            {displayImage ? (
              <Image cachePolicy="memory-disk" contentFit="contain" source={displayImage} style={styles.productImage} transition={180} />
            ) : suggestion?.iconEmoji ? (
              <View style={styles.imageFallback}><Text style={styles.fallbackEmoji}>{suggestion.iconEmoji}</Text></View>
            ) : (
              <View style={styles.imageFallback}><Ionicons color="#147E8C" name="fast-food-outline" size={58} /></View>
            )}
          </View>

          <View accessibilityLiveRegion="polite" style={styles.successRow}>
            <View style={styles.successIcon}><Ionicons color="#FFFFFF" name="checkmark" size={18} /></View>
            <Text style={styles.successText}>{copy.found}</Text>
          </View>
          <Text style={styles.productName}>{product.name}</Text>
          {product.brand ? <Text style={styles.brand}>{product.brand}</Text> : null}

          <View style={styles.notice}>
            <Ionicons color="#A66818" name="information-circle-outline" size={20} />
            <Text style={styles.noticeText}>
              {suggestion
                ? enrichmentSource === 'ai'
                  ? copy.confirmAiEstimate(suggestion.shelfLifeDays)
                  : copy.confirmPresetEstimate(suggestion.shelfLifeDays)
                : copy.confirmMissing}
            </Text>
          </View>

          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryTitle}>{copy.fieldsTitle}</Text>
              <Text style={styles.summarySubtitle}>{copy.editableHint}</Text>
            </View>
            <Ionicons color="#9AA9A3" name="create-outline" size={18} />
          </View>
          <View style={styles.summaryGrid}>
            {rows.map((row) => (
              <Pressable key={row.label} accessibilityRole="button" onPress={() => onContinue(draft)} style={({ pressed }) => [styles.summaryCell, pressed ? styles.cellPressed : null]}>
                <View style={styles.summaryIcon}><Ionicons color="#147E8C" name={row.icon} size={19} /></View>
                <Text style={styles.summaryLabel}>{row.label}</Text>
                <View style={styles.summaryValueRow}>
                  <Text numberOfLines={1} style={styles.summaryValue}>{row.value}</Text>
                  <Ionicons color="#A8B3AF" name="chevron-forward" size={14} />
                </View>
              </Pressable>
            ))}
          </View>

          {product.conservationConditions ? (
            <View style={styles.storageNote}>
              <Ionicons color="#315C51" name="leaf-outline" size={20} />
              <View style={styles.storageNoteCopy}>
                <Text style={styles.storageNoteTitle}>{copy.storageAdvice}</Text>
                <Text style={styles.storageNoteText}>{product.conservationConditions}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={onRescan} style={({ pressed }) => [styles.rescanButton, pressed ? styles.pressed : null]}>
            <Ionicons color="#315C51" name="barcode-outline" size={18} />
            <Text style={styles.rescanText}>{copy.rescan}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onContinue(draft)} style={({ pressed }) => [styles.continueButton, pressed ? styles.pressed : null]}>
            <Text style={styles.continueText}>{copy.reviewDetails}</Text>
            <Ionicons color="#FFFFFF" name="arrow-forward" size={20} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F8F6' },
  content: { paddingHorizontal: 20, paddingBottom: 132 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#E9EFEC' },
  closePlaceholder: { width: 42, height: 42 },
  headerCopy: { alignItems: 'center' },
  title: { color: '#173D31', fontSize: 18, fontWeight: '900' },
  source: { marginTop: 3, color: '#5E756D', fontSize: 11.5, fontWeight: '700' },
  productHero: { height: 246, alignItems: 'center', justifyContent: 'center', marginTop: 13, overflow: 'hidden', borderRadius: 16, backgroundColor: '#FFFFFF' },
  productImage: { width: '88%', height: '88%' },
  imageFallback: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 56, backgroundColor: '#E0F4F5' },
  fallbackEmoji: { fontSize: 54 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  successIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#32915C' },
  successText: { color: '#247348', fontSize: 13, fontWeight: '900' },
  productName: { marginTop: 10, color: '#173D31', fontSize: 27, fontWeight: '900' },
  brand: { marginTop: 4, color: '#5E756D', fontSize: 14, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#FFF0D8' },
  noticeText: { flex: 1, color: '#7C511B', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  summaryTitle: { color: '#173D31', fontSize: 17, fontWeight: '900' },
  summarySubtitle: { marginTop: 3, color: '#5E756D', fontSize: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCell: { width: '48.5%', minHeight: 104, padding: 13, borderRadius: 14, backgroundColor: '#FFFFFF' },
  summaryIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#E8F8FA' },
  summaryLabel: { marginTop: 8, color: '#60766E', fontSize: 11.5, fontWeight: '700' },
  summaryValueRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  summaryValue: { flex: 1, color: '#173D31', fontSize: 13, fontWeight: '800' },
  storageNote: { flexDirection: 'row', gap: 11, marginTop: 14, padding: 15, borderRadius: 14, backgroundColor: '#E9EFEC' },
  storageNoteCopy: { flex: 1 },
  storageNoteTitle: { color: '#315C51', fontSize: 13, fontWeight: '900' },
  storageNoteText: { marginTop: 4, color: '#506A61', fontSize: 12.5, lineHeight: 18 },
  footer: { position: 'absolute', right: 0, bottom: 0, left: 0, minHeight: Platform.OS === 'ios' ? 112 : 94, flexDirection: 'row', gap: 11, alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, backgroundColor: '#F6F8F6' },
  rescanButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#E9EFEC' },
  rescanText: { color: '#315C51', fontSize: 13, fontWeight: '800' },
  continueButton: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, backgroundColor: '#F58220' },
  continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  cellPressed: { opacity: 0.72 },
});
