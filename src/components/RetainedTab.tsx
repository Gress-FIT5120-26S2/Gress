import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Modal as NativeModal, Platform, StyleSheet, View, type ModalProps, type StyleProp, type ViewStyle } from 'react-native';

const TabActiveContext = createContext(true);
export const useTabActive = () => useContext(TabActiveContext);

// Arthur: NarIyirm
// 中文：已访问页保留实例与布局尺寸，隐藏时禁止触摸和无障碍访问，滚动位置不会因零尺寸布局丢失。
// EN: Retain visited instances and their layout size; hidden tabs reject touch/accessibility without zero-size layouts losing scroll offsets.
export function RetainedTab({ active, preload = false, children, style }: {
  active: boolean; preload?: boolean; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const [visited, setVisited] = useState(active || preload);
  const wasActive = useRef(active);
  useEffect(() => { if (active || preload) setVisited(true); }, [active, preload]);
  useEffect(() => {
    if (wasActive.current && !active) Keyboard.dismiss();
    wasActive.current = active;
  }, [active]);
  if (!active && !preload && !visited) return null;
  // Arthur: NarIyirm
  // 中文：Web 用 visibility 阻止键盘聚焦隐藏内容，同时保留布局；原生则用无障碍和触摸门控。
  // EN: Web visibility blocks keyboard focus in hidden content while retaining layout; native tabs use accessibility and touch gates.
  const hiddenStyle = Platform.OS === 'web' ? { opacity: 0, visibility: 'hidden' as const } : { opacity: 0 };
  return <TabActiveContext.Provider value={active}>
    <View aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      pointerEvents={active ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, style, !active && hiddenStyle]}>
      {children}
    </View>
  </TabActiveContext.Provider>;
}

// Arthur: NarIyirm
// 中文：原生弹窗不受父视图透明度影响，跟随所属 Tab 可见性，保留外层详情和输入状态。
// EN: Native modals ignore parent opacity, so follow their tab's visibility while retaining outer detail and input state.
export function TabModal({ visible = true, ...props }: ModalProps) {
  const active = useTabActive();
  return <NativeModal {...props} visible={active && visible} />;
}
