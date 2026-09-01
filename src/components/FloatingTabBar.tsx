import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';

export type AppTab = 'home' | 'shopping' | 'fridge' | 'achievements' | 'profile' | 'notifications';

type FloatingTabBarProps = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  blurTarget: RefObject<View | null>;
};

// Arthur: NarIyirm
// 中文：MVP 底部导航只暴露已完成的核心流程；成就和个人页保留代码，但不向用户提供入口。
// EN: The MVP tab bar exposes only completed core flows; achievements and profile remain implemented but have no user-facing entry.
type BottomTab = Exclude<AppTab, 'notifications' | 'achievements' | 'profile'>;

const tabs: Array<{ key: BottomTab; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', icon: 'home-outline' },
  { key: 'shopping', icon: 'cart-outline' },
  { key: 'fridge', icon: 'cube-outline' },
];

export function FloatingTabBar({ activeTab, onChange, blurTarget }: FloatingTabBarProps) {
  const { t } = useI18n();

  return (
    <BlurView blurMethod="dimezisBlurViewSdk31Plus" blurTarget={blurTarget} intensity={76} tint="systemUltraThinMaterialLight" style={styles.glass}>
      {/* Arthur: NarIyirm
          中文：选中状态只改变本地 tab state；之后会在这里连接 Expo Router 的页面导航。
          EN: Selection changes local tab state; Expo Router navigation can plug in here later. */}
      {tabs.map((tab) => {
        const selected = tab.key === activeTab;
        const label = t.tabs[tab.key];
        return <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => onChange(tab.key)} style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.tabPressed]}>
          {tab.key === 'fridge' ? (
            <MaterialCommunityIcons name="fridge-outline" size={23} color={selected ? '#D77A1B' : '#506057'} />
          ) : (
            <Ionicons name={tab.icon} size={23} color={selected ? '#D77A1B' : '#506057'} />
          )}
          <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        </Pressable>;
      })}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  glass: { position: 'absolute', right: 16, bottom: 26, left: 16, flexDirection: 'row', minHeight: 76, padding: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.74)', borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.34)', shadowColor: '#29473D', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 },
  tab: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, tabSelected: { backgroundColor: 'rgba(255,255,255,0.55)' }, tabPressed: { transform: [{ scale: 0.97 }], opacity: 0.84 }, label: { marginTop: 4, color: '#506057', fontSize: 10, fontWeight: '700' }, labelSelected: { color: '#BD6514' },
});
