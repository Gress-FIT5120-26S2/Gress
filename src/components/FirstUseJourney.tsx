import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useI18n } from '../i18n';

type FirstUseJourneyProps = {
  onComplete: () => void;
  visible: boolean;
};

type JourneyPage = 'language' | 'problem' | 'identity' | 'features' | 'purpose';
type SceneTheme = {
  accentText: TextStyle;
  foreground: TextStyle;
  iconColor: string;
  muted: TextStyle;
  nextButton: ViewStyle;
  nextIconColor: string;
  nextLabel: TextStyle;
  routeLine: ViewStyle;
  routeStop: ViewStyle;
  screen: ViewStyle;
};

const PAGE_ORDER: JourneyPage[] = ['language', 'problem', 'identity', 'features', 'purpose'];
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export function FirstUseJourney({ onComplete, visible }: FirstUseJourneyProps) {
  const { language, setLanguage, t } = useI18n();
  const [pageIndex, setPageIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const reveal = useRef(new Animated.Value(1)).current;
  const page = PAGE_ORDER[pageIndex];
  const copy = t.onboarding.pages[page];
  const isLastPage = pageIndex === PAGE_ORDER.length - 1;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setPageIndex(0);
      return;
    }
    reveal.stopAnimation();
    reveal.setValue(reducedMotion ? 1 : 0);
    if (reducedMotion) return;
    // Arthur: NarIyirm
    // 中文：为避免 Reanimated/Worklets 在目标设备上引发启动崩溃，引导页与现有开场统一使用原生驱动的透明度和位移动画。
    // EN: To avoid Reanimated/Worklets startup crashes on target devices, the journey follows the existing opener and uses only native-driven opacity and translation.
    Animated.timing(reveal, { toValue: 1, duration: 260, easing: EASE_OUT, useNativeDriver: true }).start();
    return () => reveal.stopAnimation();
  }, [pageIndex, reducedMotion, reveal, visible]);

  const pageTranslateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  const goBack = () => setPageIndex((current) => Math.max(0, current - 1));
  const goForward = () => {
    if (isLastPage) {
      onComplete();
      return;
    }
    setPageIndex((current) => Math.min(PAGE_ORDER.length - 1, current + 1));
  };

  return (
    <Modal animationType="fade" onRequestClose={pageIndex > 0 ? goBack : () => undefined} presentationStyle="fullScreen" visible={visible}>
      <View style={[styles.screen, sceneStyles[page].screen]}>
        <View style={styles.topBar}>
          <Text style={[styles.brand, sceneStyles[page].foreground]}>KITCHMEMO</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.progressLabel, sceneStyles[page].muted]}>
            {page === 'language' ? `${pageIndex + 1} / ${PAGE_ORDER.length}` : t.onboarding.progress(pageIndex + 1, PAGE_ORDER.length)}
          </Text>
        </View>

        <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: PAGE_ORDER.length, now: pageIndex + 1 }} style={styles.route}>
          {PAGE_ORDER.map((routePage, index) => (
            <View key={routePage} style={styles.routeSegment}>
              <View style={[styles.routeLine, index <= pageIndex && sceneStyles[page].routeLine]} />
              <View style={[styles.routeStop, index <= pageIndex && styles.routeStopActive, index <= pageIndex && sceneStyles[page].routeStop]} />
            </View>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.page, { opacity: reveal, transform: [{ translateY: pageTranslateY }] }]}>
            {page === 'language' ? <LanguageScene /> : <JourneyScene page={page} />}
            <View style={[styles.copyBlock, page === 'language' && styles.languageCopyBlock]}>
              <Text style={[styles.eyebrow, sceneStyles[page].accentText]}>{copy.eyebrow}</Text>
              <Text style={[styles.title, page === 'language' && styles.languageTitle, sceneStyles[page].foreground]}>{copy.title}</Text>
              <Text style={[styles.body, page === 'language' && styles.languageBody, sceneStyles[page].muted]}>{copy.body}</Text>
            </View>
            {page === 'language' ? <LanguageOptions language={language} onSelect={setLanguage} /> : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {pageIndex > 0 ? (
            <Pressable accessibilityRole="button" onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons color={sceneStyles[page].iconColor} name="arrow-back" size={20} />
              <Text style={[styles.backLabel, sceneStyles[page].foreground]}>{t.onboarding.back}</Text>
            </Pressable>
          ) : <View style={styles.backButton} />}
          <Pressable accessibilityRole="button" onPress={goForward} style={({ pressed }) => [styles.nextButton, sceneStyles[page].nextButton, pressed && styles.pressed]}>
            <Text style={[styles.nextLabel, sceneStyles[page].nextLabel]}>{page === 'language' ? 'Continue  继续' : isLastPage ? t.onboarding.enter : t.onboarding.next}</Text>
            <Ionicons color={sceneStyles[page].nextIconColor} name={isLastPage ? 'home-outline' : 'arrow-forward'} size={20} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function LanguageScene() {
  return (
    <View style={styles.languageArtwork}>
      <View style={styles.globeMark}>
        <MaterialCommunityIcons color="#FFF4DA" name="web" size={82} />
      </View>
      <View style={[styles.speechBubble, styles.chineseBubble]}><Text style={styles.speechText}>你好</Text></View>
      <View style={[styles.speechBubble, styles.englishBubble]}><Text style={styles.speechText}>Hello</Text></View>
    </View>
  );
}

function LanguageOptions({ language, onSelect }: { language: 'zh' | 'en'; onSelect: (language: 'zh' | 'en') => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.languageOptions}>
      {([
        { code: 'zh' as const, primary: '简体中文', secondary: 'Chinese (Simplified)' },
        { code: 'en' as const, primary: 'English', secondary: '英语' },
      ]).map((option) => {
        const selected = option.code === language;
        return (
          <Pressable
            accessibilityLabel={`${option.primary}, ${option.secondary}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.code}
            onPress={() => onSelect(option.code)}
            style={({ pressed }) => [styles.languageOption, selected && styles.languageOptionSelected, pressed && styles.pressed]}
          >
            <View style={styles.languageOptionCopy}>
              <Text style={styles.languagePrimary}>{option.primary}</Text>
              <Text style={styles.languageSecondary}>{option.secondary}</Text>
            </View>
            <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
              {selected ? <View style={styles.radioInner} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function JourneyScene({ page }: { page: JourneyPage }) {
  const { t } = useI18n();
  if (page === 'problem') {
    return (
      <View style={[styles.scene, styles.problemScene]}>
        <View style={styles.personMark}><Ionicons color="#183D32" name="person" size={50} /></View>
        <View style={styles.problemPath} />
        <View style={styles.binMark}>
          <MaterialCommunityIcons color="#FFF4DA" name="food-apple-outline" size={34} />
          <MaterialCommunityIcons color="#FFF4DA" name="trash-can-outline" size={48} />
        </View>
        <Text style={styles.sceneCaption}>{t.onboarding.pages.problem.sceneLabel}</Text>
      </View>
    );
  }

  if (page === 'identity') {
    return (
      <View style={[styles.scene, styles.identityScene]}>
        <View style={styles.phone}>
          <View style={styles.phoneSpeaker} />
          <View style={styles.userPrompt}><Text style={styles.userPromptText}>{t.onboarding.pages.identity.prompt}</Text></View>
          <View style={styles.spoonieRow}>
            <Image contentFit="contain" source={require('../../assets/kitchmemo-assistant.png')} style={styles.spoonieAvatar} />
            <View style={styles.spoonieBubble}><Text style={styles.spoonieBubbleText}>{t.onboarding.pages.identity.reply}</Text></View>
          </View>
        </View>
      </View>
    );
  }

  if (page === 'features') {
    return (
      <View style={[styles.scene, styles.featureScene]}>
        <FeatureStop icon="fridge-outline" label={t.onboarding.features.inventory} />
        <View style={styles.featureRail} />
        <FeatureStop icon="clock-fast" label={t.onboarding.features.useFirst} />
        <View style={styles.featureRail} />
        <FeatureStop icon="cart-outline" label={t.onboarding.features.restock} />
      </View>
    );
  }

  return (
    <View style={[styles.scene, styles.purposeScene]}>
      <View style={styles.purposeSun} />
      <View style={styles.purposeKitchen}>
        <MaterialCommunityIcons color="#173B31" name="fridge-outline" size={70} />
        <View style={styles.purposePerson}><Ionicons color="#173B31" name="person" size={54} /></View>
        <MaterialCommunityIcons color="#D76D24" name="leaf" size={46} />
      </View>
      <View style={styles.purposeGround} />
    </View>
  );
}

function FeatureStop({ icon, label }: { icon: ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }) {
  return (
    <View style={styles.featureStop}>
      <View style={styles.featureIcon}><MaterialCommunityIcons color="#173B31" name={icon} size={34} /></View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const sceneStyles: Record<JourneyPage, SceneTheme> = {
  language: {
    screen: { backgroundColor: '#F2B94B' },
    foreground: { color: '#183D32' }, muted: { color: '#345E51' }, accentText: { color: '#8E3A22' },
    routeLine: { backgroundColor: 'rgba(24,61,50,0.24)' }, routeStop: { backgroundColor: '#183D32' },
    nextButton: { backgroundColor: '#183D32' }, nextLabel: { color: '#FFF8E8' },
    iconColor: '#183D32', nextIconColor: '#FFF8E8',
  },
  problem: {
    screen: { backgroundColor: '#F2B94B' },
    foreground: { color: '#183D32' }, muted: { color: '#345E51' }, accentText: { color: '#8E3A22' },
    routeLine: { backgroundColor: 'rgba(24,61,50,0.24)' }, routeStop: { backgroundColor: '#183D32' },
    nextButton: { backgroundColor: '#183D32' }, nextLabel: { color: '#FFF8E8' },
    iconColor: '#183D32', nextIconColor: '#FFF8E8',
  },
  identity: {
    screen: { backgroundColor: '#E6F1EE' },
    foreground: { color: '#173B31' }, muted: { color: '#536E65' }, accentText: { color: '#C45E1B' },
    routeLine: { backgroundColor: 'rgba(23,59,49,0.22)' }, routeStop: { backgroundColor: '#D76D24' },
    nextButton: { backgroundColor: '#D76D24' }, nextLabel: { color: '#FFFFFF' },
    iconColor: '#173B31', nextIconColor: '#FFFFFF',
  },
  features: {
    screen: { backgroundColor: '#1F5145' },
    foreground: { color: '#FFF7E6' }, muted: { color: '#C9DDD6' }, accentText: { color: '#F4B94E' },
    routeLine: { backgroundColor: 'rgba(255,247,230,0.28)' }, routeStop: { backgroundColor: '#F4B94E' },
    nextButton: { backgroundColor: '#F4B94E' }, nextLabel: { color: '#173B31' },
    iconColor: '#FFF7E6', nextIconColor: '#173B31',
  },
  purpose: {
    screen: { backgroundColor: '#F7EEE0' },
    foreground: { color: '#173B31' }, muted: { color: '#5D7068' }, accentText: { color: '#C45E1B' },
    routeLine: { backgroundColor: 'rgba(23,59,49,0.2)' }, routeStop: { backgroundColor: '#D76D24' },
    nextButton: { backgroundColor: '#D76D24' }, nextLabel: { color: '#FFFFFF' },
    iconColor: '#173B31', nextIconColor: '#FFFFFF',
  },
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 54 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  brand: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  progressLabel: { fontSize: 13, fontWeight: '700' },
  route: { flexDirection: 'row', height: 24, alignItems: 'center', marginTop: 14, paddingHorizontal: 22 },
  routeSegment: { position: 'relative', flex: 1, height: 18, justifyContent: 'center' },
  routeLine: { position: 'absolute', right: 0, left: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.28)' },
  routeStop: { width: 12, height: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.88)', borderRadius: 6, opacity: 0.72 },
  routeStopActive: { width: 16, height: 16, borderRadius: 8, opacity: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 18 },
  page: { flex: 1, justifyContent: 'center' },
  scene: { minHeight: 280, overflow: 'hidden', borderRadius: 16 },
  copyBlock: { paddingTop: 28 },
  eyebrow: { marginBottom: 9, fontSize: 14, fontWeight: '900' },
  title: { maxWidth: 520, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1 },
  body: { maxWidth: 560, marginTop: 14, fontSize: 17, lineHeight: 25, fontWeight: '600' },
  footer: { minHeight: 92, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 22 },
  backButton: { minWidth: 96, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backLabel: { fontSize: 15, fontWeight: '800' },
  nextButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, borderRadius: 16 },
  nextLabel: { fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  problemScene: { backgroundColor: '#E96A2C' },
  personMark: { position: 'absolute', left: 28, bottom: 52, width: 90, height: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 45, backgroundColor: '#FFF3D8' },
  problemPath: { position: 'absolute', right: 96, bottom: 84, left: 108, height: 5, backgroundColor: '#183D32', transform: [{ rotate: '-8deg' }] },
  binMark: { position: 'absolute', right: 28, bottom: 44, alignItems: 'center' },
  sceneCaption: { position: 'absolute', top: 26, right: 28, left: 28, color: '#FFF5DF', fontSize: 23, lineHeight: 29, fontWeight: '900' },
  languageArtwork: { minHeight: 210, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#E96A2C' },
  globeMark: { width: 126, height: 126, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFF4DA', borderRadius: 63 },
  speechBubble: { position: 'absolute', minWidth: 76, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, backgroundColor: '#FFF4DA' },
  chineseBubble: { top: 30, right: 28 },
  englishBubble: { bottom: 28, left: 28 },
  speechText: { color: '#183D32', fontSize: 16, fontWeight: '900' },
  languageCopyBlock: { paddingTop: 20 },
  languageTitle: { fontSize: 31, lineHeight: 36 },
  languageBody: { marginTop: 9, fontSize: 14, lineHeight: 20 },
  languageOptions: { gap: 10, marginTop: 16, marginBottom: 4 },
  languageOption: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderWidth: 2, borderColor: 'rgba(24,61,50,0.16)', borderRadius: 16, backgroundColor: 'rgba(255,248,232,0.78)' },
  languageOptionSelected: { borderColor: '#183D32', backgroundColor: '#FFF8E8' },
  languageOptionCopy: { gap: 2 },
  languagePrimary: { color: '#183D32', fontSize: 18, fontWeight: '900' },
  languageSecondary: { color: '#527064', fontSize: 12, fontWeight: '700' },
  radioOuter: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#83988F', borderRadius: 12 },
  radioOuterSelected: { borderColor: '#183D32' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#183D32' },
  identityScene: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#BFDCD4' },
  phone: { width: '78%', maxWidth: 330, minHeight: 242, padding: 17, borderWidth: 5, borderColor: '#173B31', borderRadius: 28, backgroundColor: '#F8FBFA' },
  phoneSpeaker: { alignSelf: 'center', width: 52, height: 5, marginBottom: 18, borderRadius: 3, backgroundColor: '#173B31' },
  userPrompt: { alignSelf: 'flex-end', maxWidth: '78%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 15, borderBottomRightRadius: 4, backgroundColor: '#D76D24' },
  userPromptText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  spoonieRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 15 },
  spoonieAvatar: { width: 42, height: 42 },
  spoonieBubble: { flex: 1, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 15, borderTopLeftRadius: 4, backgroundColor: '#EAF2EF' },
  spoonieBubbleText: { color: '#173B31', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  featureScene: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#F0C25E' },
  featureStop: { flex: 1, alignItems: 'center', gap: 10 },
  featureIcon: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 35, backgroundColor: '#FFF7E6' },
  featureRail: { width: 24, height: 4, marginTop: -27, backgroundColor: '#173B31' },
  featureLabel: { color: '#173B31', fontSize: 12, lineHeight: 16, fontWeight: '900', textAlign: 'center' },
  purposeScene: { justifyContent: 'flex-end', backgroundColor: '#96C9BB' },
  purposeSun: { position: 'absolute', top: 28, right: 34, width: 74, height: 74, borderRadius: 37, backgroundColor: '#F4B94E' },
  purposeKitchen: { zIndex: 2, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 30, paddingBottom: 32 },
  purposePerson: { width: 84, height: 112, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 42, borderTopRightRadius: 42, backgroundColor: '#F7EEE0' },
  purposeGround: { position: 'absolute', right: 0, bottom: 0, left: 0, height: 48, backgroundColor: '#D76D24' },
});
