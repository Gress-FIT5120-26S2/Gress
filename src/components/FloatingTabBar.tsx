import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type AppTab = 'home' | 'ingredients' | 'fridge' | 'recipes' | 'profile';

type FloatingTabBarProps = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  blurTarget: RefObject<View | null>;
};

const tabs: Array<{ key: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: '首页', icon: 'home-outline' },
  { key: 'ingredients', label: '食材', icon: 'nutrition-outline' },
  { key: 'fridge', label: '冰箱', icon: 'cube-outline' },
  { key: 'recipes', label: '菜谱', icon: 'book-outline' },
  { key: 'profile', label: '我的', icon: 'person-outline' },
];

export function FloatingTabBar({ activeTab, onChange, blurTarget }: FloatingTabBarProps) {
  return (
    <BlurView blurMethod="dimezisBlurViewSdk31Plus" blurTarget={blurTarget} intensity={76} tint="systemUltraThinMaterialLight" style={styles.glass}>
      {/* Arthur: NarIyirm
          中文：选中状态只改变本地 tab state；之后会在这里连接 Expo Router 的页面导航。
          EN: Selection changes local tab state; Expo Router navigation can plug in here later. */}
      {tabs.map((tab) => {
        const selected = tab.key === activeTab;
        return <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }} onPress={() => onChange(tab.key)} style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.tabPressed]}>
          <Ionicons name={tab.icon} size={23} color={selected ? '#D77A1B' : '#506057'} />
          <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
        </Pressable>;
      })}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  glass: { position: 'absolute', right: 16, bottom: 26, left: 16, flexDirection: 'row', minHeight: 76, padding: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.74)', borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.34)', shadowColor: '#29473D', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 },
  tab: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, tabSelected: { backgroundColor: 'rgba(255,255,255,0.55)' }, tabPressed: { transform: [{ scale: 0.97 }], opacity: 0.84 }, label: { marginTop: 4, color: '#506057', fontSize: 10, fontWeight: '700' }, labelSelected: { color: '#BD6514' },
});
