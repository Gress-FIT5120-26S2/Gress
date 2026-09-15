import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type AppLanguage, useI18n } from '../i18n';
import { ProfileBottomSheet } from './ProfileBottomSheet';

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
  const { language, t } = useI18n();

  return (
    <ProfileBottomSheet contentKey={language} onClose={onClose} title={t.settings.title} visible={visible}>
      {({ onContentScroll }) => (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" onScroll={onContentScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>{t.settings.subtitle}</Text>
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
      )}
    </ProfileBottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34 },
  subtitle: { color: '#6C7B73', fontSize: 14, lineHeight: 20 },
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
