import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import { BlurTargetView } from 'expo-blur';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from '../../../i18n';
import { LearningRoomFlow } from '../LearningRoomFlow';
import { APP_TAB_DOCK_HEIGHT, FloatingTabBar, type AppTab } from '../../FloatingTabBar';
import { learningColors as c } from '../learningTheme';
import { createLearningPreview, previewScenarios, type LearningPreviewScenario } from './learningFixtures';
import { LearningTutorPreview, tutorPreviewScreens, type TutorPreviewScreen } from './LearningTutorPreview';
import { LearningWidthContext } from '../learningViewport';

function Preview() {
  const { language, setLanguage, t } = useI18n();
  const params = Platform.OS === 'web' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initial = params.get('screen');
  const tutorScreen = params.get('tutor') as TutorPreviewScreen;
  const [scenario, setScenario] = useState<LearningPreviewScenario | null>(previewScenarios.includes(initial as LearningPreviewScenario) ? initial as LearningPreviewScenario : 'hub');
  const [revision, setRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<AppTab>('learn');
  const blurTarget = useRef<View>(null);
  const tabPreview = params.get('nav') === '1';
  const showChrome = params.get('chrome') !== '0';
  const preview = useMemo(() => scenario ? createLearningPreview(scenario) : null, [scenario, revision]);
  const width = params.get('width') === '320' ? 320 : 390;
  const height = params.get('height') === '667' ? 667 : 844;
  const origin = tabPreview ? 'tab' : params.get('origin') === 'profile' ? 'profile' : 'home';
  const content = tutorPreviewScreens.includes(tutorScreen) ? <LearningTutorPreview key={tutorScreen} screen={tutorScreen} />
    : preview && (!tabPreview || activeTab === 'learn') ? <LearningRoomFlow key={`${scenario}:${revision}`} {...preview} origin={origin} embedded onClose={() => setScenario(null)} />
    : <ScrollView contentContainerStyle={styles.menu}><Text style={styles.menuTitle}>{t.learning.choosePreview}</Text>
      {previewScenarios.map((item) => <Pressable key={item} accessibilityRole="button" onPress={() => { setActiveTab('learn'); setRevision((n) => n + 1); setScenario(item); }} style={styles.menuRow}><Text style={styles.menuText}>{item}</Text></Pressable>)}
    </ScrollView>;
  // Arthur: NarIyirm
  // 中文：明确 nav=1 才展示真实导航组件的开发画布；其他 Tab 显示预览选择器，不模拟业务数据或绕过原生身份。
  // EN: Only explicit nav=1 shows the real dock in this development canvas; other tabs show the preview picker without faking business data or bypassing native identity.
  const canvas = tabPreview ? <View style={{ flex: 1 }}>
    <BlurTargetView ref={blurTarget} style={{ flex: 1 }}><View style={{ flex: 1, paddingBottom: APP_TAB_DOCK_HEIGHT }}>{content}</View></BlurTargetView>
    <FloatingTabBar activeTab={activeTab} blurTarget={blurTarget} onChange={tab => { setActiveTab(tab); if (tab === 'learn') setScenario('hub'); }} />
  </View> : content;
  const chrome = <View style={styles.toolbar}><Text style={styles.label}>{t.learning.preview}</Text>
    <View style={styles.toolbarButtons}><Pressable accessibilityRole="button" onPress={() => setScenario(null)} style={styles.toolbarHit}><Text style={styles.label}>{t.learning.backPreview}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="English" accessibilityState={{ selected: language === 'en' }} onPress={() => setLanguage('en')} style={styles.toolbarHit}><Text style={styles.label}>EN</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="中文" accessibilityState={{ selected: language === 'zh' }} onPress={() => setLanguage('zh')} style={styles.toolbarHit}><Text style={styles.label}>中文</Text></Pressable></View>
  </View>;
  // Arthur: NarIyirm
  // 中文：Web 画布仅模拟 iPhone 内容区域 inset；原生使用真实安全区。开发提示在画布外，不画手机框或系统状态栏。
  // EN: The web canvas simulates content insets only; native uses real safe areas. The development label sits outside the canvas, with no drawn phone frame or status bar.
  if (Platform.OS === 'web') return <ScrollView style={styles.desktop} contentContainerStyle={[styles.desktopContent, !showChrome ? { paddingBottom: 0 } : null]}>
    {showChrome ? chrome : null}<View testID="learning-preview-canvas" style={{ width, height, maxWidth: '100%', backgroundColor: c.background }}>
      <LearningWidthContext.Provider value={width}><SafeAreaInsetsContext.Provider value={{ top: 44, bottom: 24, left: 0, right: 0 }}>{canvas}</SafeAreaInsetsContext.Provider></LearningWidthContext.Provider>
    </View>
  </ScrollView>;
  return <View style={{ flex: 1, backgroundColor: c.background }}>{chrome}{canvas}</View>;
}

export default function LearningPreviewApp() {
  if (!__DEV__) return null;
  const language = Platform.OS === 'web' && new URLSearchParams(window.location.search).get('lang') === 'zh' ? 'zh' : 'en';
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><I18nProvider initialLanguage={language} persist={false}><StatusBar style="dark" /><Preview /></I18nProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  desktop: { flex: 1, backgroundColor: '#EDF3F0' }, desktopContent: { alignItems: 'center', paddingBottom: 24 },
  toolbar: { width: '100%', paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', backgroundColor: '#EDF3F0' },
  toolbarButtons: { flexDirection: 'row', alignItems: 'center' }, toolbarHit: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: c.textSecondaryReadable }, menu: { padding: 24, gap: 12 },
  menuTitle: { fontSize: 25, fontWeight: '800', color: c.textPrimary }, menuRow: { padding: 14, minHeight: 48, borderRadius: 12, backgroundColor: c.mintSurface },
  menuText: { fontSize: 17, color: c.textPrimary },
});
