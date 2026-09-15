import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AchievementDashboard } from '../../services/achievementApi';
import { EdgeSwipeBackView } from '../navigation/EdgeSwipeBackView';
import { Medal, MedalRevealDetail, type BadgeCopy } from './AchievementJourneyModal';

type WallThemeCode = 'cloudStone' | 'cedarRidge' | 'nightSummit';
type AchievementItem = AchievementDashboard['achievements'][number];
type WallTheme = {
  ambient: readonly [string, string, string];
  board: readonly [string, string];
  edge: string;
  ink: string;
  muted: string;
  contour: string;
};

const WALL_THEME_STORAGE_KEY = 'kitchmemo:medal-wall-theme:v1';
const WALL_THEME_CODES: WallThemeCode[] = ['cloudStone', 'cedarRidge', 'nightSummit'];
const WALL_THEMES: Record<WallThemeCode, WallTheme> = {
  cloudStone: { ambient: ['#DDECF0', '#EEF3EC', '#D6E2D7'], board: ['#F7F7F2', '#E5EBE4'], edge: '#C7D2CA', ink: '#24483B', muted: '#60766D', contour: 'rgba(91,122,107,.12)' },
  cedarRidge: { ambient: ['#D8E3D5', '#BBCDBA', '#829C88'], board: ['#315747', '#183D33'], edge: '#789180', ink: '#F8F5EA', muted: '#C8D7CF', contour: 'rgba(235,223,190,.12)' },
  nightSummit: { ambient: ['#5E7180', '#344956', '#172D36'], board: ['#31434B', '#172B33'], edge: '#71818A', ink: '#F8F1DF', muted: '#C7D0D2', contour: 'rgba(221,205,161,.13)' },
};

type Props = { visible: boolean; onClose: () => void; dashboard: AchievementDashboard; badgeCopy: BadgeCopy };

// Arthur: NarIyirm
// 中文：奖章墙只读取服务端已解锁状态；当前背景是设备级陈列偏好，布置模式提供大幅横向预览后再确认使用。
// EN: The wall reads only server-owned unlocks; its device-level display preference is confirmed after a large horizontal arrangement preview.
export function AchievementMedalWall({ visible, onClose, dashboard, badgeCopy }: Props) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const previewRef = useRef<ScrollView>(null);
  const blurTargetRef = useRef<View | null>(null);
  const [themeCode, setThemeCode] = useState<WallThemeCode>('cloudStone');
  const [themeReady, setThemeReady] = useState(false);
  const [previewThemeCode, setPreviewThemeCode] = useState<WallThemeCode>('cloudStone');
  const [arranging, setArranging] = useState(false);
  const [focused, setFocused] = useState<AchievementItem | null>(null);
  const earned = useMemo(() => dashboard.achievements.filter((item) => item.status === 'unlocked' || item.unlocked), [dashboard.achievements]);
  const visibleTotal = dashboard.achievements.filter((item) => item.status !== 'unavailable').length;
  const theme = WALL_THEMES[themeCode];
  const previewTheme = WALL_THEMES[previewThemeCode];

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(WALL_THEME_STORAGE_KEY).then((saved) => {
      if (active && saved && WALL_THEME_CODES.includes(saved as WallThemeCode)) {
        setThemeCode(saved as WallThemeCode);
        setPreviewThemeCode(saved as WallThemeCode);
      }
    }).catch(() => undefined).finally(() => {
      if (active) setThemeReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!arranging) return;
    const index = WALL_THEME_CODES.indexOf(themeCode);
    requestAnimationFrame(() => previewRef.current?.scrollTo({ x: index * width, animated: false }));
  }, [arranging, themeCode, width]);

  const openArrange = () => {
    setPreviewThemeCode(themeCode);
    setArranging(true);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const chooseTheme = () => {
    setThemeCode(previewThemeCode);
    setArranging(false);
    void AsyncStorage.setItem(WALL_THEME_STORAGE_KEY, previewThemeCode).catch(() => undefined);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const handlePreviewEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(0, Math.min(WALL_THEME_CODES.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
    setPreviewThemeCode(WALL_THEME_CODES[index]);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const requestClose = focused ? () => setFocused(null) : arranging ? () => setArranging(false) : onClose;

  return (
    <Modal animationType="slide" onRequestClose={requestClose} presentationStyle="fullScreen" visible={visible}>
      <EdgeSwipeBackView enabled={!arranging && !focused} onBack={onClose}>
        <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
          <StatusBar style={arranging && previewThemeCode === 'nightSummit' ? 'light' : 'dark'} />
          <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
          {!themeReady ? (
            <View style={styles.loadingState}><ActivityIndicator color="#2F7055" /></View>
          ) : arranging ? (
            <LinearGradient colors={previewTheme.ambient} end={{ x: 0.8, y: 1 }} start={{ x: 0.15, y: 0 }} style={styles.previewRoot}>
              <View style={styles.previewNav}>
                <Pressable accessibilityRole="button" hitSlop={12} onPress={() => setArranging(false)} style={styles.previewNavButton}>
                  <Ionicons color={previewTheme.ink} name="close" size={25} />
                </Pressable>
                <View style={styles.previewTitleBlock}>
                  <Text style={[styles.previewEyebrow, { color: previewTheme.muted }]}>{badgeCopy.wall.chooseBoard}</Text>
                  <Text style={[styles.previewTitle, { color: previewTheme.ink }]}>{badgeCopy.wall.themes[previewThemeCode]}</Text>
                </View>
                <View style={styles.previewNavButton} />
              </View>

              {/* Arthur: NarIyirm */}
              {/* 中文：每个背景板占据完整视口宽度，左右滑动时始终展示真实已获得奖章，而不是缩略图占位。 */}
              {/* EN: Each board owns one viewport width, and horizontal swiping always previews the user's real earned medals instead of thumbnails. */}
              <ScrollView decelerationRate="fast" horizontal onMomentumScrollEnd={handlePreviewEnd} pagingEnabled ref={previewRef} showsHorizontalScrollIndicator={false} style={styles.previewCarousel}>
                {WALL_THEME_CODES.map((code) => (
                  <View key={code} style={[styles.previewPage, { width }]}>
                    <WallBoard badgeCopy={badgeCopy} compact earned={earned} height={Math.max(420, Math.min(570, height - insets.top - insets.bottom - 250))} theme={WALL_THEMES[code]} total={visibleTotal} />
                  </View>
                ))}
              </ScrollView>

              <View style={[styles.previewFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <View style={styles.dots}>{WALL_THEME_CODES.map((code) => <View key={code} style={[styles.dot, { backgroundColor: previewTheme.ink }, code === previewThemeCode && styles.dotActive]} />)}</View>
                <Pressable accessibilityRole="button" onPress={chooseTheme} style={({ pressed }) => [styles.useButton, { backgroundColor: previewTheme.ink }, pressed && styles.pressed]}>
                  <Ionicons color={previewTheme.board[0]} name={previewThemeCode === themeCode ? 'checkmark' : 'sparkles-outline'} size={18} />
                  <Text style={[styles.useButtonText, { color: previewTheme.board[0] }]}>{previewThemeCode === themeCode ? badgeCopy.wall.selected : badgeCopy.wall.useBoard}</Text>
                </Pressable>
              </View>
            </LinearGradient>
          ) : (
            <>
              <View style={styles.nav}>
                <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose} style={styles.navButton}><Ionicons color="#294A40" name="chevron-back" size={23} /></Pressable>
                <Text style={styles.navTitle}>{badgeCopy.wall.title}</Text>
                <View style={styles.navButton} />
              </View>
              <LinearGradient colors={theme.ambient} end={{ x: 0.8, y: 1 }} locations={[0, 0.52, 1]} start={{ x: 0.15, y: 0 }} style={styles.ambient}>
                <View pointerEvents="none" style={styles.ambientOrbOne} />
                <View pointerEvents="none" style={styles.ambientOrbTwo} />
                <ScrollView contentContainerStyle={[styles.wallScroll, { paddingBottom: Math.max(insets.bottom, 18) + 92 }]} showsVerticalScrollIndicator={false}>
                  <WallBoard badgeCopy={badgeCopy} earned={earned} onMedalPress={(item) => {
                    setFocused(item);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  }} theme={theme} total={visibleTotal} />
                  <Text style={styles.themeCaptionText}>{badgeCopy.wall.themes[themeCode]} · {badgeCopy.wall.selected}</Text>
                </ScrollView>
                <View style={[styles.arrangeDock, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                  <Pressable accessibilityRole="button" onPress={openArrange} style={({ pressed }) => [styles.arrangeButton, pressed && styles.pressed]}>
                    <Ionicons color="#FFFFFF" name="options-outline" size={19} />
                    <Text style={styles.arrangeButtonText}>{badgeCopy.wall.settings}</Text>
                  </Pressable>
                </View>
              </LinearGradient>
            </>
          )}
          </BlurTargetView>
          {focused ? <MedalRevealDetail achievement={focused} badgeCopy={badgeCopy} blurTarget={blurTargetRef} onClose={() => setFocused(null)} /> : null}
        </View>
      </EdgeSwipeBackView>
    </Modal>
  );
}

function WallBoard({ badgeCopy, compact = false, earned, height, onMedalPress, theme, total }: {
  badgeCopy: BadgeCopy;
  compact?: boolean;
  earned: AchievementItem[];
  height?: number;
  onMedalPress?: (item: AchievementItem) => void;
  theme: WallTheme;
  total: number;
}) {
  const medalSize = compact ? 80 : 116;
  return (
    <LinearGradient colors={theme.board} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={[styles.board, compact && styles.previewBoard, height ? { height } : null, { borderColor: theme.edge }]}>
      <View pointerEvents="none" style={[styles.contourLarge, { borderColor: theme.contour }]} />
      <View pointerEvents="none" style={[styles.contourSmall, { borderColor: theme.contour }]} />
      <View style={styles.boardHeading}>
        <Text style={[styles.boardTitle, compact && styles.previewBoardTitle, { color: theme.ink }]}>{badgeCopy.wall.collection}</Text>
        <Text style={[styles.boardCount, { color: theme.muted }]}>{badgeCopy.wall.count(earned.length, total)}</Text>
      </View>
      {earned.length > 0 ? (
        <View style={[styles.medalGrid, compact && styles.previewMedalGrid]}>
          {earned.map((item) => (
            <Pressable accessibilityRole={onMedalPress ? 'button' : undefined} disabled={!onMedalPress} key={item.code} onPress={() => onMedalPress?.(item)} style={({ pressed }) => [styles.medalSpot, compact && styles.previewMedalSpot, pressed && styles.medalPressed]}>
              <Medal code={item.code} earned size={medalSize} />
              <Text numberOfLines={2} style={[styles.medalName, compact && styles.previewMedalName, { color: theme.ink }]}>{badgeCopy.items[item.code]}</Text>
              <View style={[styles.medalPin, { backgroundColor: theme.edge }]} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.empty}><Ionicons color={theme.muted} name="medal-outline" size={42} /><Text style={[styles.emptyTitle, { color: theme.ink }]}>{badgeCopy.wall.emptyTitle}</Text><Text style={[styles.emptyBody, { color: theme.muted }]}>{badgeCopy.wall.emptyBody}</Text></View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7FAF8' },
  blurTarget: { flex: 1 },
  nav: { height: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7FAF8', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE6E1' },
  navButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: '#173D31', fontSize: 17, fontWeight: '900' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F7FAF8' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  ambient: { flex: 1, overflow: 'hidden' },
  ambientOrbOne: { position: 'absolute', top: -80, right: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,.22)' },
  ambientOrbTwo: { position: 'absolute', bottom: -110, left: -90, width: 290, height: 290, borderRadius: 145, backgroundColor: 'rgba(255,255,255,.13)' },
  wallScroll: { padding: 18, paddingTop: 22 },
  board: { minHeight: 590, padding: 18, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  previewBoard: { width: '100%', minHeight: 0, padding: 16, borderRadius: 14 },
  contourLarge: { position: 'absolute', top: 30, right: -90, width: 260, height: 260, borderRadius: 130, borderWidth: 1 },
  contourSmall: { position: 'absolute', bottom: 50, left: -55, width: 180, height: 180, borderRadius: 90, borderWidth: 1 },
  boardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  boardTitle: { fontSize: 16, fontWeight: '900' },
  previewBoardTitle: { fontSize: 14 },
  boardCount: { fontSize: 11, fontWeight: '800' },
  medalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 },
  previewMedalGrid: { rowGap: 4 },
  medalSpot: { position: 'relative', width: '48%', alignItems: 'center', paddingTop: 8, paddingBottom: 12 },
  previewMedalSpot: { paddingTop: 3, paddingBottom: 4 },
  medalPressed: { opacity: 0.84, transform: [{ scale: 0.97 }] },
  medalName: { minHeight: 32, marginTop: 2, fontSize: 12, fontWeight: '800', lineHeight: 16, textAlign: 'center' },
  previewMedalName: { minHeight: 24, marginTop: -2, fontSize: 9.5, lineHeight: 12 },
  medalPin: { position: 'absolute', top: 1, width: 5, height: 5, borderRadius: 3 },
  empty: { flex: 1, minHeight: 390, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyTitle: { marginTop: 15, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody: { marginTop: 8, fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  themeCaptionText: { alignSelf: 'center', marginTop: 14, color: '#35564A', fontSize: 10.5, fontWeight: '800' },
  arrangeDock: { position: 'absolute', right: 0, bottom: 0, left: 0, alignItems: 'center', paddingTop: 24, backgroundColor: 'rgba(231,239,235,.82)' },
  arrangeButton: { minWidth: 154, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, borderRadius: 25, backgroundColor: '#204F3F' },
  arrangeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  previewRoot: { flex: 1 },
  previewNav: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  previewNavButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  previewTitleBlock: { flex: 1, alignItems: 'center' },
  previewEyebrow: { fontSize: 10, fontWeight: '800' },
  previewTitle: { marginTop: 2, fontSize: 17, fontWeight: '900' },
  previewCarousel: { flex: 1 },
  previewPage: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 2, paddingBottom: 110 },
  previewFooter: { position: 'absolute', right: 0, bottom: 0, left: 0, alignItems: 'center', paddingTop: 14, paddingHorizontal: 28 },
  dots: { height: 18, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  dot: { width: 5, height: 5, borderRadius: 3, opacity: 0.28 },
  dotActive: { width: 18, opacity: 0.86 },
  useButton: { minWidth: 210, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22, borderRadius: 25 },
  useButtonText: { fontSize: 13, fontWeight: '900' },
});
