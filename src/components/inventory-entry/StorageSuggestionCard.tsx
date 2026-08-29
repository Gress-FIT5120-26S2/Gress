import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import { WavePhysicsLoader } from './WavePhysicsLoader';

export type StorageSuggestion = {
  category: 'meat' | 'vegetables' | 'fruit' | 'staples' | 'condiments' | 'drinks' | 'other';
  canonicalName: string;
  shelfLifeDays: number;
  storageZone: 'chilled' | 'frozen' | 'pantry';
};

type StorageSuggestionCardProps = {
  applied: boolean;
  onApply: () => void;
  onSearchOnline: () => void;
  query: string;
  isLoading: boolean;
  lookupFinished: boolean;
  suggestion: StorageSuggestion | null;
};

export const StorageSuggestionCard = memo(function StorageSuggestionCard({
  applied,
  onApply,
  onSearchOnline,
  query,
  isLoading,
  lookupFinished,
  suggestion,
}: StorageSuggestionCardProps) {
  const { t } = useI18n();
  const copy = t.fridge.manualEntry.suggestion;

  if (!query || (!isLoading && !lookupFinished && !suggestion)) return null;

  if (isLoading) {
    return (
      <View style={[styles.card, styles.statusCard]}>
        <WavePhysicsLoader />
        <Text style={styles.statusText}>{copy.loading}</Text>
      </View>
    );
  }

  if (!suggestion) {
    return (
      <View style={[styles.card, styles.statusCard]}>
        <View style={styles.iconBox}>
          <Ionicons name="search-outline" size={16} color="#1595A5" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.description}>{copy.unavailable}</Text>
        </View>
        <Pressable accessibilityRole="link" onPress={onSearchOnline} style={({ pressed }) => [styles.searchButton, pressed ? styles.pressed : null]}>
          <Text style={styles.searchText}>{copy.searchOnline}</Text>
          <Ionicons name="open-outline" size={12} color="#147B89" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          <Ionicons name="sparkles" size={16} color="#1595A5" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.description}>
            {copy.summary(
              t.fridge.manualEntry.storage[suggestion.storageZone],
              t.fridge.categories[suggestion.category],
              suggestion.shelfLifeDays,
            )}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: applied }}
        onPress={onApply}
        style={({ pressed }) => [styles.applyButton, applied ? styles.appliedButton : null, pressed ? styles.pressed : null]}
      >
        <Text style={[styles.applyText, applied ? styles.appliedText : null]}>{applied ? copy.applied : copy.apply}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { gap: 10, marginTop: 12, paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, borderColor: '#CBE8E7', borderRadius: 12, borderCurve: 'continuous', backgroundColor: 'rgba(237, 250, 249, 0.78)' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  statusCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderCurve: 'continuous', backgroundColor: '#DDF5F3' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: '#147B89', fontSize: 12, fontWeight: '800' },
  description: { color: '#258B89', fontSize: 11.5, fontWeight: '700', lineHeight: 17 },
  applyButton: { minHeight: 32, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11, borderWidth: 1, borderColor: '#F1A167', borderRadius: 9, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.68)' },
  appliedButton: { borderColor: '#1595A5', backgroundColor: '#1595A5' },
  applyText: { color: '#D97020', fontSize: 11, fontWeight: '800' },
  appliedText: { color: '#FFFFFF' },
  statusText: { flex: 1, color: '#147B89', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  searchButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, borderWidth: 1, borderColor: '#9FDAD7', borderRadius: 9, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.7)' },
  searchText: { color: '#147B89', fontSize: 10.5, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
