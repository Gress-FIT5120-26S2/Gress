import { useRef, type PropsWithChildren } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

const EDGE_WIDTH = 24;
const DISTANCE_THRESHOLD = 72;
const VELOCITY_THRESHOLD = 0.55;

type EdgeSwipeBackViewProps = PropsWithChildren<{
  enabled?: boolean;
  onBack: () => void;
  resetKey?: unknown;
}>;

// Arthur: NarIyirm
// 中文：左缘返回只在窄透明热区记录触摸坐标，不逐帧更新 React 状态，也不依赖 Reanimated 原生模块。
// EN: Edge-back tracks touch coordinates only inside a narrow transparent strip, without per-frame React state or Reanimated native modules.
export function EdgeSwipeBackView({ children, enabled = true, onBack }: EdgeSwipeBackViewProps) {
  const gesture = useRef({ startX: 0, lastX: 0, startedAt: 0, lastAt: 0 });

  const capturePoint = (event: GestureResponderEvent) => {
    const { pageX, timestamp } = event.nativeEvent;
    gesture.current = { startX: pageX, lastX: pageX, startedAt: timestamp, lastAt: timestamp };
  };

  const updatePoint = (event: GestureResponderEvent) => {
    gesture.current.lastX = event.nativeEvent.pageX;
    gesture.current.lastAt = event.nativeEvent.timestamp;
  };

  const finishGesture = (event: GestureResponderEvent) => {
    updatePoint(event);
    const distance = gesture.current.lastX - gesture.current.startX;
    const elapsed = Math.max(1, gesture.current.lastAt - gesture.current.startedAt);
    if (distance >= DISTANCE_THRESHOLD || distance / elapsed >= VELOCITY_THRESHOLD) onBack();
  };

  return <View style={styles.root}>
    {children}
    {enabled ? (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onMoveShouldSetResponder={() => true}
        onResponderGrant={capturePoint}
        onResponderMove={updatePoint}
        onResponderRelease={finishGesture}
        onResponderTerminationRequest={() => true}
        onStartShouldSetResponder={() => true}
        style={styles.edge}
      />
    ) : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  edge: { position: 'absolute', top: 0, bottom: 0, left: 0, width: EDGE_WIDTH },
});
