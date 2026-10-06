import type { PanResponderCallbacks } from 'react-native';

// Arthur: NarIyirm
// 中文：捕获阶段的 x0 尚为 0，不是触摸起点；记录真实 pageX，并只让已接管的单指边缘滑动触发返回。
// EN: x0 is still zero during capture, not the touch origin; retain actual pageX and allow Back only for an owned single-finger edge swipe.
export function createLearningBackGesture({ isEnabled, onBack }: {
  isEnabled: () => boolean; onBack: () => void;
}): PanResponderCallbacks {
  let startX: number | null = null;
  let owned = false;
  const reset = () => { startX = null; owned = false; };
  const startsAtEdge = () => startX !== null && Number.isFinite(startX) && startX >= 0 && startX <= 24;
  return {
    onStartShouldSetPanResponderCapture: event => {
      reset();
      if (event.nativeEvent.touches.length === 1) startX = event.nativeEvent.touches[0].pageX;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gesture) => isEnabled() && startsAtEdge()
      && gesture.numberActiveTouches === 1 && gesture.dx > 18 && Math.abs(gesture.dy) < 12,
    onPanResponderGrant: () => { owned = isEnabled() && startsAtEdge(); },
    onPanResponderStart: event => { if (event.nativeEvent.touches.length !== 1) reset(); },
    onPanResponderRelease: (_, gesture) => {
      const shouldGoBack = owned && isEnabled() && startsAtEdge() && gesture.dx > 65 && Math.abs(gesture.dy) < 35;
      reset();
      if (shouldGoBack) onBack();
    },
    onPanResponderTerminate: reset,
    onPanResponderReject: reset,
  };
}
