import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { memo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import { ReminderPickerModal } from './ReminderPickerModal';

type ReminderSettingsSectionProps = {
  expiryDate: string;
  expiryEnabled: boolean;
  expiryError: string | null;
  expiryTime: string;
  minimumQuantity: number;
  onExpiryDateChange: (value: string) => void;
  onExpiryEnabledChange: (value: boolean) => void;
  onExpiryTimeChange: (value: string) => void;
  onMinimumQuantityChange: (value: number) => void;
  onRestockEnabledChange: (value: boolean) => void;
  onTargetQuantityChange: (value: number) => void;
  onWarningDaysChange: (value: number) => void;
  restockEnabled: boolean;
  restockError: string | null;
  reduceMotion: boolean;
  targetQuantity: number;
  unitLabel: string;
  warningDays: number;
};

export const ReminderSettingsSection = memo(function ReminderSettingsSection({
  expiryDate,
  expiryEnabled,
  expiryError,
  expiryTime,
  minimumQuantity,
  onExpiryDateChange,
  onExpiryEnabledChange,
  onExpiryTimeChange,
  onMinimumQuantityChange,
  onRestockEnabledChange,
  onTargetQuantityChange,
  onWarningDaysChange,
  restockEnabled,
  restockError,
  reduceMotion,
  targetQuantity,
  unitLabel,
  warningDays,
}: ReminderSettingsSectionProps) {
  const { language, t } = useI18n();
  const copy = t.fridge.manualEntry;
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const formattedExpiryDate = formatExpiryDate(expiryDate, language);

  return (
    <View style={styles.panel}>
      <View style={styles.toggleRow}>
        <View style={[styles.sectionIcon, styles.expiryIcon]}>
          <Ionicons name="calendar-outline" size={20} color="#E65366" />
        </View>
        <View style={styles.toggleCopy}>
          <Text style={styles.sectionTitle}>{copy.expiry.title}</Text>
          <Text style={styles.sectionDescription}>{expiryEnabled ? copy.expiry.enabled : copy.expiry.disabled}</Text>
        </View>
        <Switch
          accessibilityLabel={copy.expiry.title}
          onValueChange={onExpiryEnabledChange}
          thumbColor="#FFFFFF"
          trackColor={{ false: '#CFD6D2', true: '#FF812B' }}
          value={expiryEnabled}
        />
      </View>

      {expiryEnabled ? (
        <View style={styles.expandedContent}>
          <View style={styles.expiryValueRow}>
            <View style={styles.expiryValueCopy}>
              <Text style={styles.expiryValueTitle}>{copy.expiry.title}</Text>
              <Text numberOfLines={1} style={styles.expiryValueDescription}>{copy.expiry.enabled}</Text>
            </View>
            <View style={styles.pickerButtonRow}>
              <Pressable accessibilityLabel={copy.expiry.date} accessibilityRole="button" onPress={() => setPickerMode('date')} style={({ pressed }) => [styles.datePickerButton, pressed ? styles.pressed : null]}>
                <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.datePickerText}>{formattedExpiryDate}</Text>
              </Pressable>
              <Pressable accessibilityLabel={copy.expiry.time} accessibilityRole="button" onPress={() => setPickerMode('time')} style={({ pressed }) => [styles.timePickerButton, pressed ? styles.pressed : null]}>
                <Text style={styles.timePickerText}>{expiryTime}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.reminderHeading}>
            <Text style={styles.reminderTitle}>{copy.expiry.warning}</Text>
            <View style={styles.warningBadge}><Text style={styles.warningBadgeText}>{copy.expiry.advance(warningDays)}</Text></View>
          </View>
          <View style={styles.dayRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const selected = warningDays === day;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={day}
                  onPress={() => onWarningDaysChange(day)}
                  style={({ pressed }) => [styles.dayButton, selected ? styles.dayButtonSelected : null, pressed ? styles.pressed : null]}
                >
                  <Text style={[styles.dayButtonText, selected ? styles.dayButtonTextSelected : null]}>{day}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helperText}>{copy.expiry.summary(warningDays)}</Text>
          {expiryError ? <Text style={styles.errorText}>{expiryError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.panelDivider} />

      <View style={styles.toggleRow}>
        <View style={[styles.sectionIcon, styles.restockIcon]}>
          <Ionicons name="basket-outline" size={20} color="#0AAFC3" />
        </View>
        <View style={styles.toggleCopy}>
          <Text style={styles.sectionTitle}>{copy.restock.title}</Text>
          <Text style={styles.sectionDescription}>{restockEnabled ? copy.restock.enabled : copy.restock.disabled}</Text>
        </View>
        <Switch
          accessibilityLabel={copy.restock.title}
          onValueChange={onRestockEnabledChange}
          thumbColor="#FFFFFF"
          trackColor={{ false: '#CFD6D2', true: '#0AAFC3' }}
          value={restockEnabled}
        />
      </View>

      {restockEnabled ? (
        <View style={styles.expandedContent}>
          <RestockThresholdControl
            label={copy.restock.quantity}
            onChange={(value) => {
              onMinimumQuantityChange(value);
              onTargetQuantityChange(Math.max(targetQuantity, value + 1));
            }}
            unitLabel={unitLabel}
            value={minimumQuantity}
          />
          <Text style={styles.helperText}>{copy.restock.helper(minimumQuantity, targetQuantity, unitLabel)}</Text>
          {restockError ? <Text style={styles.errorText}>{restockError}</Text> : null}
        </View>
      ) : null}
      <ReminderPickerModal
        mode={pickerMode}
        onClose={() => setPickerMode(null)}
        onDateChange={onExpiryDateChange}
        onTimeChange={onExpiryTimeChange}
        reduceMotion={reduceMotion}
        value={pickerMode === 'date' ? expiryDate : expiryTime}
      />
    </View>
  );
});

function formatExpiryDate(value: string, language: 'zh' | 'en') {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function RestockThresholdControl({
  label,
  onChange,
  unitLabel,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  unitLabel: string;
  value: number;
}) {
  const maximum = 20;

  return (
    <View style={styles.restockControl}>
      <View style={styles.restockValueRow}>
        <Pressable accessibilityRole="button" disabled={value <= 1} onPress={() => onChange(Math.max(1, value - 1))} style={({ pressed }) => [styles.roundStepper, value <= 1 ? styles.disabled : null, pressed ? styles.pressed : null]}>
          <Ionicons name="remove" size={21} color="#1595A5" />
        </Pressable>
        <View style={styles.restockValueCopy}>
          <Text style={styles.restockValue}>{value} <Text style={styles.restockUnit}>{unitLabel}</Text></Text>
          <Text style={styles.restockLabel}>{label}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => onChange(Math.min(maximum, value + 1))} style={({ pressed }) => [styles.roundStepper, pressed ? styles.pressed : null]}>
          <Ionicons name="add" size={22} color="#1595A5" />
        </Pressable>
      </View>
      {/* Arthur: NarIyirm
          中文：原生滑杆在拖动过程中连续回传整数阈值，中央数值和父级补货目标会同步更新，松手后无需第二次确认。
          EN: The native slider continuously emits integer thresholds so the centre value and parent restock target stay in sync without a second confirmation. */}
      <Slider
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max: maximum, now: value }}
        maximumTrackTintColor="#DFE6E3"
        maximumValue={maximum}
        minimumTrackTintColor="#18BEC8"
        minimumValue={1}
        onSlidingComplete={(nextValue) => onChange(Math.round(nextValue))}
        onValueChange={(nextValue) => onChange(Math.round(nextValue))}
        step={1}
        style={styles.thresholdSlider}
        tapToSeek={Platform.OS === 'ios'}
        thumbTintColor="#FFFFFF"
        value={Math.min(maximum, Math.max(1, value))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16, borderWidth: 1, borderColor: 'rgba(224, 232, 228, 0.88)', borderRadius: 16, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.76)' },
  toggleRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderCurve: 'continuous' },
  expiryIcon: { backgroundColor: '#FFF0F2' },
  restockIcon: { backgroundColor: '#E8F9FC' },
  toggleCopy: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { color: '#173D31', fontSize: 17, fontWeight: '800' },
  sectionDescription: { color: '#6A7972', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  expandedContent: { gap: 13, paddingTop: 15, marginTop: 13, borderTopWidth: 1, borderTopColor: '#EDF0EE' },
  panelDivider: { height: 1, marginVertical: 15, backgroundColor: '#E8EDEA' },
  expiryValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  expiryValueCopy: { flex: 1, minWidth: 0, gap: 1 },
  expiryValueTitle: { color: '#172E26', fontSize: 17, fontWeight: '900' },
  expiryValueDescription: { color: '#75817C', fontSize: 12, fontWeight: '600' },
  pickerButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  datePickerButton: { minWidth: 132, maxWidth: 168, minHeight: 52, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 28, borderCurve: 'continuous', backgroundColor: '#F0F0F2' },
  timePickerButton: { minWidth: 78, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 28, borderCurve: 'continuous', backgroundColor: '#F0F0F2' },
  datePickerText: { color: '#111719', fontSize: 18, fontWeight: '500', letterSpacing: -0.3 },
  timePickerText: { color: '#111719', fontSize: 20, fontWeight: '500', letterSpacing: -0.3 },
  reminderHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reminderTitle: { color: '#263E36', fontSize: 14, fontWeight: '800' },
  warningBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#FFF1E5' },
  warningBadgeText: { color: '#D36F1A', fontSize: 12, fontWeight: '800' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  dayButton: { minWidth: 36, minHeight: 39, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#FFF3E9' },
  dayButtonSelected: { backgroundColor: '#FF812B' },
  dayButtonText: { color: '#D46F1A', fontSize: 14, fontWeight: '800' },
  dayButtonTextSelected: { color: '#FFFFFF' },
  helperText: { color: '#718079', fontSize: 12, fontWeight: '600', lineHeight: 18 },
  errorText: { color: '#C83D4C', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  restockControl: { gap: 15, paddingTop: 3 },
  restockValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 },
  roundStepper: { width: 49, height: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: '#E6F9FB' },
  restockValueCopy: { flex: 1, alignItems: 'center', gap: 2 },
  restockValue: { color: '#172E26', fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  restockUnit: { color: '#53665F', fontSize: 15, fontWeight: '800' },
  restockLabel: { color: '#718079', fontSize: 12, fontWeight: '700' },
  thresholdSlider: { width: '100%', height: 38 },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
