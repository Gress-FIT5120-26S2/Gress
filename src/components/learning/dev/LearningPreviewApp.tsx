import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from '../../../i18n';
import { LearningRoomFlow } from '../LearningRoomFlow';
import { learningColors as c } from '../learningTheme';
import { createLearningPreview, previewScenarios, type LearningPreviewScenario } from './learningFixtures';

function Preview() {
  const { language, setLanguage, t } = useI18n();
  const params = Platform.OS === 'web' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initial = params.get('screen');
  const [scenario, setScenario] = useState<LearningPreviewScenario | null>(previewScenarios.includes(initial as LearningPreviewScenario) ? initial as LearningPreviewScenario : 'hub');
  const [revision, setRevision] = useState(0);
  const preview = useMemo(() => scenario ? createLearningPreview(scenario) : null, [scenario, revision]);
  const width = params.get('width') === '320' ? 320 : 390;
  const height = params.get('height') === '667' ? 667 : 844;
  const origin = params.get('origin') === 'profile' ? 'profile' : 'home';
  const content = preview ? <LearningRoomFlow key={`${scenario}:${revision}`} {...preview} origin={origin} embedded onClose={() => setScenario(null)} />
    : <ScrollView contentContainerStyle={styles.menu}><Text style={styles.menuTitle}>{t.learning.choosePreview}</Text>
      {previewScenarios.map((item) => <Pressable key={item} accessibilityRole="button" onPress={() => { setRevision((n) => n + 1); setScenario(item); }} style={styles.menuRow}><Text style={styles.menuText}>{item}</Text></Pressable>)}
    </ScrollView>;
  const chrome = <View style={styles.toolbar}><Text style={styles.label}>{t.learning.preview}</Text>
    <View style={styles.toolbarButtons}><Pressable accessibilityRole="button" onPress={() => setScenario(null)} style={styles.toolbarHit}><Text style={styles.label}>{t.learning.backPreview}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="English" accessibilityState={{ selected: language === 'en' }} onPress={() => setLanguage('en')} style={styles.toolbarHit}><Text style={styles.label}>EN</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="中文" accessibilityState={{ selected: language === 'zh' }} onPress={() => setLanguage('zh')} style={styles.toolbarHit}><Text style={styles.label}>中文</Text></Pressable></View>
  </View>;
  // Arthur: NarIyirm
  // 中文：Web 画布仅模拟 iPhone 内容区域 inset；原生使用真实安全区。开发提示在画布外，不画手机框或系统状态栏。
  // EN: The web canvas simulates content insets only; native uses real safe areas. The development label sits outside the canvas, with no drawn phone frame or status bar.
  if (Platform.OS === 'web') return <ScrollView style={styles.desktop} contentContainerStyle={styles.desktopContent}>
    {chrome}<View testID="learning-preview-canvas" style={{ width, height, maxWidth: '100%', backgroundColor: c.background }}>
      <SafeAreaInsetsContext.Provider value={{ top: 44, bottom: 24, left: 0, right: 0 }}>{content}</SafeAreaInsetsContext.Provider>
    </View>
  </ScrollView>;
  return <View style={{ flex: 1, backgroundColor: c.background }}>{chrome}{content}</View>;
}

export default function LearningPreviewApp() {
  if (!__DEV__) return null;
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><I18nProvider initialLanguage="en" persist={false}><StatusBar style="dark" /><Preview /></I18nProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  desktop: { flex: 1, backgroundColor: '#EDF3F0' }, desktopContent: { alignItems: 'center', paddingBottom: 24 },
  toolbar: { width: '100%', paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', backgroundColor: '#EDF3F0' },
  toolbarButtons: { flexDirection: 'row', alignItems: 'center' }, toolbarHit: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: c.textSecondaryReadable }, menu: { padding: 24, gap: 12 },
  menuTitle: { fontSize: 25, fontWeight: '800', color: c.textPrimary }, menuRow: { padding: 14, minHeight: 48, borderRadius: 12, backgroundColor: c.mintSurface },
  menuText: { fontSize: 17, color: c.textPrimary },
});
