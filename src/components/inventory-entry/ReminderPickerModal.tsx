import { useEffect, useMemo, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';

type ReminderPickerModalProps = {
  mode: 'date' | 'time' | null;
  onClose: () => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  reduceMotion: boolean;
  value: string;
};

function parsePickerValue(mode: 'date' | 'time' | null, value: string) {
  const now = new Date();

  if (mode === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  }

  if (mode === 'time') {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (match) now.setHours(Number(match[1]), Number(match[2]), 0, 0);
  }

  return now;
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toTimeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function ReminderPickerModal({ mode, onClose, onDateChange, onTimeChange, reduceMotion, value }: ReminderPickerModalProps) {
  const { language, t } = useI18n();
  const copy = t.fridge.manualEntry;
  const progress = useRef(new Animated.Value(0)).current;
  const pickerValue = useMemo(() => parsePickerValue(mode, value), [mode, value]);

  useEffect(() => {
    if (!mode) return;
    progress.stopAnimation();
    progress.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;

    // Arthur: NarIyirm
    // 中文：只动画原生选择器外层的透明度和缩放，避免干扰系统日期控件自身的触摸与滚动。
    // EN: Animate only the native picker's outer opacity and scale so its system gestures and scrolling remain untouched.
    Animated.timing(progress, {
      duration: 210,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [mode, progress, reduceMotion]);

  if (!mode) return null;

  const pickerTitle = mode === 'date' ? copy.expiry.date : copy.expiry.time;
  const locale = language === 'zh' ? 'zh_CN' : 'en_AU';
  const minimumDate = mode === 'date' ? new Date(new Date().setHours(0, 0, 0, 0)) : undefined;

  const applyValue = (selectedValue: Date) => {
    if (mode === 'date') onDateChange(toDateValue(selectedValue));
    else onTimeChange(toTimeValue(selectedValue));
  };

  if (Platform.OS === 'android') {
    // Arthur: NarIyirm
    // 中文：Android 直接交给系统对话框处理返回键、点按外部区域和确认/取消，避免在 JS Modal 内嵌第二层原生窗口造成闪退。
    // EN: Android delegates back, outside-tap, and confirm/cancel handling to the system dialog, avoiding a second native window inside a JS Modal.
    return (
      <DateTimePicker
        design="default"
        display="default"
        is24Hour
        minimumDate={minimumDate}
        mode={mode}
        negativeButton={{ label: copy.cancel }}
        onDismiss={onClose}
        onValueChange={(_event, selectedValue) => {
          applyValue(selectedValue);
          onClose();
        }}
        positiveButton={{ label: copy.expiry.pickerDone }}
        value={pickerValue}
      />
    );
  }

  return (
    <Modal animationType="none" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible>
      <Pressable accessibilityLabel={copy.expiry.closePicker} accessibilityRole="button" onPress={onClose} style={styles.backdrop}>
        <Animated.View
          style={[
            styles.popover,
            {
              opacity: progress,
              transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
            },
          ]}
        >
          <Pressable accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.touchGuard}>
            <BlurView
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={Platform.OS === 'ios' ? 58 : 26}
              tint="systemUltraThinMaterialLight"
              style={styles.material}
            >
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <Text style={styles.eyebrow}>{copy.expiry.title}</Text>
                  <Text style={styles.title}>{pickerTitle}</Text>
                </View>
                <Pressable
                  accessibilityLabel={copy.expiry.closePicker}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={onClose}
                  style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
                >
                  <Ionicons color="#596A63" name="close" size={22} />
                </Pressable>
              </View>

              {/* Arthur: NarIyirm
                  中文：日期和时间选择统一使用 Expo 57 的原生 SwiftUI/Jetpack Compose 控件，选择结果仍转换为后端现有的日期与时间字符串格式。
                  EN: Both inputs use Expo 57's native SwiftUI/Jetpack Compose picker while values still map to the backend's existing date and time strings. */}
              <View style={[styles.pickerFrame, mode === 'date' ? styles.dateFrame : styles.timeFrame]}>
                <DateTimePicker
                  accentColor="#F5A000"
                  display={mode === 'date' ? 'inline' : 'spinner'}
                  locale={locale}
                  minimumDate={minimumDate}
                  mode={mode}
                  onValueChange={(_event, selectedValue) => {
                    applyValue(selectedValue);
                  }}
                  style={styles.nativePicker}
                  themeVariant="light"
                  value={pickerValue}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [styles.doneButton, pressed ? styles.doneButtonPressed : null]}
              >
                <Text style={styles.doneButtonText}>{copy.expiry.pickerDone}</Text>
                <Ionicons color="#FFFFFF" name="checkmark-circle" size={19} />
              </Pressable>
            </BlurView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 48,
    backgroundColor: 'rgba(23, 49, 41, 0.18)',
  },
  popover: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowColor: '#173D31',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.17,
    shadowRadius: 30,
    elevation: 12,
  },
  touchGuard: { width: '100%' },
  material: {
    gap: 14,
    padding: 16,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.5)' : 'rgba(250,252,251,0.94)',
  },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { color: '#708078', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  title: { color: '#173D31', fontSize: 20, fontWeight: '800', letterSpacing: -0.25 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.76)' },
  pickerFrame: { alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.66)' },
  nativePicker: { width: '100%' },
  dateFrame: { minHeight: Platform.OS === 'ios' ? 322 : 360 },
  timeFrame: { minHeight: Platform.OS === 'ios' ? 216 : 310 },
  doneButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 17, borderCurve: 'continuous', backgroundColor: '#FF812B' },
  doneButtonPressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  doneButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.68, transform: [{ scale: 0.95 }] },
});
