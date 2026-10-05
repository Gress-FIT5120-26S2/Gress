import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

export const LearningWidthContext = createContext<number | null>(null);

// Arthur: NarIyirm
// 中文：导航页由主 dock 占用底部安全区，独立 Modal／预览仍由学习页处理，避免 CTA 重复留白。
// EN: The primary dock owns the tab's bottom safe area; standalone modals/previews retain page insets without double-padding actions.
export const LearningBottomSafeAreaContext = createContext(true);

// Arthur: NarIyirm
// 中文：窄屏判断使用容器实测宽度，同时保留系统 fontScale；平板／预览容器不会误用整个窗口宽度。
// EN: Breakpoints use measured container width while retaining system fontScale, so tablet/preview containers do not inherit the whole window width.
export function useLearningViewport() {
  const viewport = useWindowDimensions();
  const width = useContext(LearningWidthContext);
  return { ...viewport, width: width ?? viewport.width };
}
