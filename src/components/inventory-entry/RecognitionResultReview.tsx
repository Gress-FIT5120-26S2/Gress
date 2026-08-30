import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useI18n } from '../../i18n';
import type { FoodPresetSuggestion } from '../../services/inventoryApi';
import type { RecognitionFreshness, RecognisedFood } from '../../services/recognitionApi';
import type { InventoryEntryInitialValues, InventoryUnit } from './InventoryEntryFlow';

export type RecognitionDraft = {
  categoryCode: FoodPresetSuggestion['categoryCode'];
  confidence: number;
  expiryDays: number;
  food: RecognisedFood;
  freshness: RecognitionFreshness;
  initialValues: InventoryEntryInitialValues;
  photoUri: string;
  storageZone: FoodPresetSuggestion['storageZone'];
  unit: InventoryUnit;
};

type RecognitionResultReviewProps = {
  draft: RecognitionDraft | null;
  onClose: () => void;
  onContinue: (draft: RecognitionDraft) => void;
  onRetake: () => void;
  visible: boolean;
};

const FRESHNESS_TONES: Record<RecognitionFreshness, { accent: string; text: string; tint: string }> = {
  fresh: { accent: '#3EA96B', text: '#247348', tint: '#E4F6EA' },
  semi_fresh: { accent: '#E4A348', text: '#985A14', tint: '#FFF0D8' },
  rotten: { accent: '#D06A5F', text: '#933E37', tint: '#FCE8E5' },
};

export function getEstimatedShelfLifeDays(freshness: RecognitionFreshness, baselineDays: number) {
  if (freshness === 'rotten') return 0;
  if (freshness === 'semi_fresh') return Math.max(1, Math.ceil(baselineDays * 0.4));
  return baselineDays;
}

export function buildRecognitionInitialValues(
  foodName: string,
  suggestion: FoodPresetSuggestion,
  freshness: RecognitionFreshness,
): { expiryDays: number; initialValues: InventoryEntryInitialValues } {
  const now = new Date();
  const expiryDays = getEstimatedShelfLifeDays(freshness, suggestion.shelfLifeDays);
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + expiryDays);
  if (expiryDays === 0) expiry.setHours(expiry.getHours() + 1);

  // Arthur: NarIyirm
  // 中文：视觉新鲜度只缩短常见保质期并形成可编辑草稿；即使模型判断腐坏，也不会在此处提交或阻止用户核对。
  // EN: Visual freshness only shortens the common shelf life into an editable draft; even a rotten result is neither submitted nor blocked here.
  return {
    expiryDays,
    initialValues: {
      categoryCode: suggestion.categoryCode,
      expiryDate: formatDate(expiry),
      expiryEnabled: true,
      expiryTime: formatTime(expiry),
      name: foodName,
      quantity: '1',
      storageZone: suggestion.storageZone,
      unit: 'item',
    },
  };
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function RecognitionResultReview({ draft, onClose, onContinue, onRetake, visible }: RecognitionResultReviewProps) {
  const { t } = useI18n();
  const copy = t.fridge.photoRecognition;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);

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

  useEffect(() => {
    if (visible) setWhyExpanded(false);
  }, [visible]);

  if (!draft) return null;
  const tone = FRESHNESS_TONES[draft.freshness];
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50;
  const foodName = copy.foodNames[draft.food];
  const quantity = `${draft.initialValues.quantity ?? '1'} ${t.fridge.manualEntry.units[draft.unit]}`;
  const summaryRows: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = [
    {
      icon: draft.storageZone === 'chilled' ? 'water-outline' : draft.storageZone === 'frozen' ? 'snow-outline' : 'cube-outline',
      label: copy.storage,
      value: t.fridge.manualEntry.storage[draft.storageZone],
    },
    { icon: 'grid-outline', label: copy.category, value: t.fridge.categories[draft.categoryCode] },
    { icon: 'scale-outline', label: copy.quantity, value: quantity },
    { icon: 'calendar-outline', label: copy.expiry, value: copy.expiresIn(draft.expiryDays) },
  ];

  return (
    <Modal animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F6F8F6" />
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset + 6 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable accessibilityLabel={copy.closeReview} accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}>
              <Ionicons color="#315C51" name="close" size={22} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{copy.reviewTitle}</Text>
              <Text style={styles.confidence}>{copy.confidence(Math.round(draft.confidence * 100))}</Text>
            </View>
            <View style={styles.closePlaceholder} />
          </View>

          <View accessibilityLabel={`${foodName}, ${copy.freshnessValues[draft.freshness]}`} style={styles.photoHero}>
            <Image contentFit="cover" source={draft.photoUri} style={StyleSheet.absoluteFill} transition={reduceMotion ? 0 : 180} />
            <View style={styles.photoScrim} />
            <View style={styles.photoMeta}>
              <View>
                <Text style={styles.photoEyebrow}>{copy.detectedIngredient}</Text>
                <Text style={styles.foodName}>{foodName}</Text>
              </View>
              <View style={[styles.freshnessBadge, { backgroundColor: tone.tint }]}>
                <View style={[styles.freshnessDot, { backgroundColor: tone.accent }]} />
                <Text style={[styles.freshnessText, { color: tone.text }]}>{copy.freshnessValues[draft.freshness]}</Text>
              </View>
            </View>
          </View>

          <View style={styles.qualitySection}>
            <Text style={styles.sectionEyebrow}>{copy.bestQualityWindow}</Text>
            <Text style={styles.qualityTitle}>{copy.useWithin(draft.expiryDays)}</Text>
            <Text style={styles.qualityDescription}>{copy.estimatedHint}</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineRail} />
              <View style={styles.timelineProgress} />
              <TimelinePoint active label={copy.timelineToday} />
              <TimelinePoint active middle label={copy.timelineUseSoon} />
              <TimelinePoint active end label={copy.timelineEnd(draft.expiryDays)} />
            </View>
          </View>

          <View style={styles.estimateNote}>
            <Ionicons color="#147E8C" name="sparkles-outline" size={18} />
            <Text style={styles.estimateNoteText}>{copy.estimateBasis}</Text>
          </View>

          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryTitle}>{copy.fieldsTitle}</Text>
              <Text style={styles.summarySubtitle}>{copy.editableHint}</Text>
            </View>
            <Ionicons color="#9AA9A3" name="create-outline" size={18} />
          </View>
          <View style={styles.summaryGrid}>
            {summaryRows.map((row) => (
              <Pressable
                accessibilityHint={copy.reviewDetails}
                accessibilityRole="button"
                key={row.label}
                onPress={() => onContinue(draft)}
                style={({ pressed }) => [styles.summaryCell, pressed ? styles.cellPressed : null]}
              >
                <View style={styles.summaryIcon}><Ionicons color="#147E8C" name={row.icon} size={19} /></View>
                <Text style={styles.summaryLabel}>{row.label}</Text>
                <View style={styles.summaryValueRow}>
                  <Text numberOfLines={1} style={styles.summaryValue}>{row.value}</Text>
                  <Ionicons color="#A8B3AF" name="chevron-forward" size={14} />
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: whyExpanded }}
            onPress={() => setWhyExpanded((current) => !current)}
            style={({ pressed }) => [styles.whyButton, pressed ? styles.cellPressed : null]}
          >
            <View style={styles.whyTitleRow}>
              <View style={styles.whyIcon}><Ionicons color="#315C51" name="information-circle-outline" size={20} /></View>
              <Text style={styles.whyTitle}>{copy.whyEstimate}</Text>
              <Ionicons color="#6E817A" name={whyExpanded ? 'chevron-up' : 'chevron-down'} size={17} />
            </View>
            {whyExpanded ? <Text style={styles.whyDescription}>{copy.whyEstimateDetail}</Text> : null}
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={onRetake} style={({ pressed }) => [styles.retakeButton, pressed ? styles.pressed : null]}>
            <Ionicons color="#315C51" name="camera-outline" size={18} />
            <Text style={styles.retakeText}>{copy.retake}</Text>
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

function TimelinePoint({ active, end = false, label, middle = false }: { active: boolean; end?: boolean; label: string; middle?: boolean }) {
  return (
    <View style={[styles.timelinePointWrap, middle ? styles.timelinePointMiddle : null, end ? styles.timelinePointEnd : null]}>
      <View style={[styles.timelinePoint, active ? styles.timelinePointActive : null, end ? styles.timelinePointFinal : null]} />
      <Text style={[styles.timelineLabel, end ? styles.timelineLabelEnd : null]}>{label}</Text>
    </View>
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
  confidence: { marginTop: 3, color: '#6B7F77', fontSize: 11.5, fontWeight: '700' },
  photoHero: { height: 270, marginTop: 13, overflow: 'hidden', borderRadius: 26, backgroundColor: '#DCE6E1' },
  photoScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8, 28, 23, 0.10)' },
  photoMeta: { position: 'absolute', right: 16, bottom: 16, left: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  photoEyebrow: { color: 'rgba(255,255,255,0.86)', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 5 },
  foodName: { marginTop: 3, color: '#FFFFFF', fontSize: 31, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 7 },
  freshnessBadge: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 17 },
  freshnessDot: { width: 8, height: 8, borderRadius: 4 },
  freshnessText: { fontSize: 12, fontWeight: '900' },
  qualitySection: { marginTop: 24 },
  sectionEyebrow: { color: '#147E8C', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  qualityTitle: { marginTop: 5, color: '#173D31', fontSize: 30, fontWeight: '900', letterSpacing: -0.7 },
  qualityDescription: { maxWidth: 330, marginTop: 7, color: '#61736C', fontSize: 13, lineHeight: 19 },
  timeline: { height: 66, marginTop: 21, marginHorizontal: 5 },
  timelineRail: { position: 'absolute', top: 8, right: 4, left: 4, height: 3, borderRadius: 2, backgroundColor: '#DCE5E1' },
  timelineProgress: { position: 'absolute', top: 8, right: 4, left: 4, height: 3, borderRadius: 2, backgroundColor: '#58AFAF' },
  timelinePointWrap: { position: 'absolute', top: 0, left: 0, alignItems: 'flex-start' },
  timelinePointMiddle: { left: '50%', alignItems: 'center', transform: [{ translateX: -10 }] },
  timelinePointEnd: { right: 0, left: undefined, alignItems: 'flex-end' },
  timelinePoint: { width: 19, height: 19, borderRadius: 10, borderWidth: 4, borderColor: '#F6F8F6', backgroundColor: '#C8D5D0' },
  timelinePointActive: { backgroundColor: '#58AFAF' },
  timelinePointFinal: { backgroundColor: '#F58220' },
  timelineLabel: { marginTop: 8, color: '#62766E', fontSize: 10.5, fontWeight: '700' },
  timelineLabelEnd: { color: '#B5631C', fontWeight: '900' },
  estimateNote: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 3, paddingHorizontal: 14, borderRadius: 15, backgroundColor: '#E7F3F2' },
  estimateNoteText: { flex: 1, color: '#315E5B', fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 11 },
  summaryTitle: { color: '#173D31', fontSize: 17, fontWeight: '900' },
  summarySubtitle: { marginTop: 3, color: '#71827C', fontSize: 11.5 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#E0E7E3', backgroundColor: '#FFFFFF' },
  summaryCell: { width: '50%', minHeight: 116, padding: 15, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#E8EDEB' },
  cellPressed: { backgroundColor: '#F0F5F2' },
  summaryIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#E5F3F3' },
  summaryLabel: { marginTop: 10, color: '#70817A', fontSize: 10.5, fontWeight: '800' },
  summaryValueRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  summaryValue: { flex: 1, color: '#183E33', fontSize: 14, fontWeight: '900' },
  whyButton: { marginTop: 15, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: '#E0E7E3', backgroundColor: '#FFFFFF' },
  whyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  whyIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#ECF1EE' },
  whyTitle: { flex: 1, color: '#315C51', fontSize: 13, fontWeight: '900' },
  whyDescription: { marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#E8EDEA', color: '#60736B', fontSize: 12, lineHeight: 18 },
  footer: { position: 'absolute', right: 0, bottom: 0, left: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 13, paddingBottom: Platform.OS === 'ios' ? 29 : 18, borderTopWidth: 1, borderTopColor: '#E5EBE8', backgroundColor: 'rgba(248,250,248,0.98)' },
  retakeButton: { minHeight: 54, flex: 0.82, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 17, backgroundColor: '#E6EDEA' },
  retakeText: { color: '#315C51', fontSize: 13, fontWeight: '900' },
  continueButton: { minHeight: 54, flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 17, backgroundColor: '#F58220' },
  continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
