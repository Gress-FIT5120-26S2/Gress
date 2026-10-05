import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

export const LearningWidthContext = createContext<number | null>(null);

// Arthur: NarIyirm
// 中文：窄屏判断使用容器实测宽度，同时保留系统 fontScale；平板／预览容器不会误用整个窗口宽度。
// EN: Breakpoints use measured container width while retaining system fontScale, so tablet/preview containers do not inherit the whole window width.
export function useLearningViewport() {
  const viewport = useWindowDimensions();
  const width = useContext(LearningWidthContext);
  return { ...viewport, width: width ?? viewport.width };
}
