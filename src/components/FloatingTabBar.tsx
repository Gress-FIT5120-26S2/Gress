import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';

export type AppTab = 'home' | 'shopping' | 'fridge' | 'achievements' | 'profile' | 'notifications';

type FloatingTabBarProps = {
  activeTab: AppTab;
  bottomMaskColor?: string;
  onChange: (tab: AppTab) => void;
  blurTarget: RefObject<View | null>;
};

// Arthur: NarIyirm
// 中文：通知保留为二级页面；成就与报告从这里重新进入主导航，方便后续持续开发与验收。
// EN: Notifications remains a secondary screen; Wins and reports return to the primary navigation for ongoing development and review.
type BottomTab = Exclude<AppTab, 'notifications'>;

const tabs: Array<{ key: BottomTab; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', icon: 'home-outline' },
  { key: 'shopping', icon: 'cart-outline' },
  { key: 'fridge', icon: 'cube-outline' },
  { key: 'achievements', icon: 'trophy-outline' },
  { key: 'profile', icon: 'person-outline' },
];

export function FloatingTabBar({ activeTab, bottomMaskColor = '#F7FBFA', onChange, blurTarget }: FloatingTabBarProps) {
  const { t } = useI18n();
  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);
  const activeTabRef = useRef(activeTab);
  const onChangeRef = useRef(onChange);
  const gestureStartIndexRef = useRef(Math.max(activeIndex, 0));
  const tabWidthRef = useRef(0);
  const indicatorPosition = useRef(new Animated.Value(Math.max(activeIndex, 0))).current;
  const [tabWidth, setTabWidth] = useState(0);
  activeTabRef.current = activeTab;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (activeIndex < 0) return;
    Animated.spring(indicatorPosition, {
      toValue: activeIndex,
      damping: 22,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, indicatorPosition]);

  // Arthur: NarIyirm
  // 中文：手势只接管导航胶囊内明确的横向滑动；白色选框按手指位移连续移动，松手后吸附到相邻页面。
  // EN: The dock claims only clear horizontal swipes; its white indicator follows the finger continuously and snaps to the adjacent page on release.
  const swipeResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderGrant: () => {
      const currentIndex = tabs.findIndex((tab) => tab.key === activeTabRef.current);
      gestureStartIndexRef.current = Math.max(currentIndex, 0);
      indicatorPosition.stopAnimation();
    },
    onPanResponderMove: (_, gesture) => {
      if (tabWidthRef.current <= 0) return;
      const nextPosition = gestureStartIndexRef.current + gesture.dx / tabWidthRef.current;
      indicatorPosition.setValue(Math.max(0, Math.min(tabs.length - 1, nextPosition)));
    },
    onPanResponderRelease: (_, gesture) => {
      const startIndex = gestureStartIndexRef.current;
      const shouldChange = Math.abs(gesture.dx) >= 42 || Math.abs(gesture.vx) >= 0.35;
      const targetIndex = shouldChange
        ? Math.max(0, Math.min(tabs.length - 1, startIndex + (gesture.dx > 0 ? 1 : -1)))
        : startIndex;
      const targetTab = tabs[targetIndex];
      Animated.spring(indicatorPosition, {
        toValue: targetIndex,
        damping: 22,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      if (targetTab && targetIndex !== startIndex) onChangeRef.current(targetTab.key);
    },
    onPanResponderTerminate: () => {
      Animated.spring(indicatorPosition, {
        toValue: gestureStartIndexRef.current,
        damping: 22,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    },
  })).current;

  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <View pointerEvents="none" style={[styles.bottomMask, { backgroundColor: bottomMaskColor }]} />
      <BlurView
        {...swipeResponder.panHandlers}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget}
        intensity={76}
        tint="systemUltraThinMaterialLight"
        style={styles.glass}
        onLayout={({ nativeEvent }) => {
          const nextTabWidth = (nativeEvent.layout.width - 12) / tabs.length;
          tabWidthRef.current = nextTabWidth;
          setTabWidth(nextTabWidth);
        }}
      >
        {activeIndex >= 0 && tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.selectionIndicator,
              {
                width: tabWidth,
                transform: [{ translateX: Animated.multiply(indicatorPosition, tabWidth) }],
              },
            ]}
          />
        ) : null}
        {/* Arthur: NarIyirm
            中文：选中状态只改变本地 tab state；之后会在这里连接 Expo Router 的页面导航。
            EN: Selection changes local tab state; Expo Router navigation can plug in here later. */}
        {tabs.map((tab) => {
          const selected = tab.key === activeTab;
          const label = t.tabs[tab.key];
          return <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => onChange(tab.key)} style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}>
            {tab.key === 'fridge' ? (
              <MaterialCommunityIcons name="fridge-outline" size={23} color={selected ? '#D77A1B' : '#506057'} />
            ) : (
              <Ionicons name={tab.icon} size={23} color={selected ? '#D77A1B' : '#506057'} />
            )}
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>;
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Arthur: NarIyirm
  // 中文：只遮住毛玻璃胶囊下方的安全区间隙，胶囊仍直接模糊页面并保留原来的悬浮边距、圆角和阴影。
  // EN: Only the safe-area gap below the glass pill is masked, so the pill still blurs the page directly and keeps its original inset, corners, and shadow.
  dock: { position: 'absolute', right: 0, bottom: 0, left: 0, height: Platform.OS === 'ios' ? 118 : 104 },
  bottomMask: { position: 'absolute', right: 0, bottom: 0, left: 0, height: Platform.OS === 'ios' ? 32 : 20 },
  glass: { position: 'absolute', right: 16, bottom: Platform.OS === 'ios' ? 26 : 14, left: 16, flexDirection: 'row', minHeight: 76, padding: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.74)', borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.34)', shadowColor: '#29473D', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 },
  selectionIndicator: { position: 'absolute', top: 6, left: 6, height: 62, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.55)' },
  tab: { zIndex: 1, flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, tabPressed: { transform: [{ scale: 0.97 }], opacity: 0.84 }, label: { marginTop: 4, color: '#506057', fontSize: 10, fontWeight: '700' }, labelSelected: { color: '#BD6514' },
});
