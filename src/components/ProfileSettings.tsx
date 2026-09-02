import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type AppLanguage, useI18n } from '../i18n';

function LanguageOption({ language, label, detail }: { language: AppLanguage; label: string; detail: string }) {
  const { language: selectedLanguage, setLanguage, t } = useI18n();
  const selected = language === selectedLanguage;

  return (
    <Pressable
      accessibilityLabel={`${label}, ${selected ? t.settings.selected : detail}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => setLanguage(language)}
      style={({ pressed }) => [styles.languageOption, selected && styles.languageOptionSelected, pressed && styles.optionPressed]}
    >
      <View style={styles.languageCopy}>
        <Text style={[styles.languageLabel, selected && styles.languageLabelSelected]}>{label}</Text>
        <Text style={styles.languageDetail}>{detail}</Text>
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

export function LanguageSettingsModal({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const { t } = useI18n();

  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel={t.settings.close} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{t.settings.title}</Text>
                <Text style={styles.subtitle}>{t.settings.subtitle}</Text>
              </View>
              <Pressable accessibilityLabel={t.settings.close} accessibilityRole="button" hitSlop={8} onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}>
                <Ionicons name="close" size={22} color="#365048" />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>{t.settings.language}</Text>
            <Text style={styles.sectionDescription}>{t.settings.languageDescription}</Text>
            {/* Arthur: NarIyirm
                中文：两个选项直接更新全局语言状态，同一渲染帧内所有已接入文案都会同步切换。
                EN: Both options update global language state so every connected string switches within the same render frame. */}
            <View accessibilityRole="radiogroup" style={styles.languageGroup}>
              <LanguageOption language="zh" label={t.settings.chinese} detail={t.settings.chineseDetail} />
              <LanguageOption language="en" label={t.settings.english} detail={t.settings.englishDetail} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,38,32,0.32)' },
  sheet: { maxHeight: '92%', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#F8F7F1', shadowColor: '#183D32', shadowOpacity: 0.2, shadowRadius: 26, shadowOffset: { width: 0, height: -8 }, elevation: 18 },
  scrollContent: { paddingBottom: 24 },
  handle: { width: 38, height: 5, alignSelf: 'center', borderRadius: 3, backgroundColor: '#CDD5D0' },
  header: { marginTop: 20, flexDirection: 'row', alignItems: 'flex-start' },
  headerCopy: { flex: 1, paddingRight: 16 },
  title: { color: '#183D32', fontSize: 28, fontWeight: '700', letterSpacing: -0.7 },
  subtitle: { marginTop: 6, color: '#6C7B73', fontSize: 14, lineHeight: 20 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#E8ECE8' },
  sectionLabel: { marginTop: 30, color: '#294E42', fontSize: 15, fontWeight: '800' },
  sectionDescription: { marginTop: 6, color: '#718078', fontSize: 13, lineHeight: 19 },
  languageGroup: { marginTop: 15, gap: 10 },
  languageOption: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, borderRadius: 20, borderWidth: 1, borderColor: '#DCE2DE', backgroundColor: '#FFFFFF' },
  languageOptionSelected: { borderColor: '#DC8A37', backgroundColor: '#FFF6E8' },
  optionPressed: { opacity: 0.82 },
  languageCopy: { flex: 1 },
  languageLabel: { color: '#344D44', fontSize: 15, fontWeight: '700' },
  languageLabelSelected: { color: '#B85F17' },
  languageDetail: { marginTop: 3, color: '#7A8780', fontSize: 12 },
  radioOuter: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1.5, borderColor: '#AAB5AE' },
  radioOuterSelected: { borderColor: '#D77A1B' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D77A1B' },
});
