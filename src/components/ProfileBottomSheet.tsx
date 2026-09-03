import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useI18n } from '../i18n';

export type ProfileSheetControls = {
  expand: () => void;
  onContentScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  requestClose: (afterClose?: () => void) => void;
};

type ProfileBottomSheetProps = {
  children: ReactNode | ((controls: ProfileSheetControls) => ReactNode);
  contentKey?: string;
  onClose: () => void;
  title: string;
  visible: boolean;
};

const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// Arthur: NarIyirm
// 中文：个人页的通知、语言、引导、恢复和隐私设置共用与库存详情一致的底部双停靠抽屉，统一处理拖拽、放大、关闭和内容淡入。
// EN: Profile notification, language, onboarding, recovery, and privacy settings share this inventory-detail-style two-detent sheet for drag, expansion, dismissal, and content transitions.
export function ProfileBottomSheet({ children, contentKey = 'content', onClose, title, visible }: ProfileBottomSheetProps) {
  const { t } = useI18n();
  const [reducedMotion, setReducedMotion] = useState(false);
  const dimensions = useWindowDimensions();
  const topInset = Platform.OS === 'ios' ? 56 : Math.max(StatusBar.currentHeight ?? 24, 24) + 10;
  const bottomInset = Platform.OS === 'ios' ? 10 : 8;
  const sheetHeight = Math.max(420, dimensions.height - topInset - bottomInset);
  const previewVisibleHeight = Math.min(sheetHeight - 34, Math.max(430, dimensions.height * 0.72));
  const previewOffset = Math.max(54, sheetHeight - previewVisibleHeight);
  const dismissedOffset = sheetHeight + bottomInset + 40;
  const previewScaleX = Math.max(0.92, (dimensions.width - 24) / dimensions.width);
  const translateY = useRef(new Animated.Value(dismissedOffset)).current;
  const contentProgress = useRef(new Animated.Value(1)).current;
  const currentTranslate = useRef(dismissedOffset);
  const dragStart = useRef(previewOffset);
  const closingRef = useRef(false);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const autoExpandedRef = useRef(false);

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
    if (!visible) return;
    closingRef.current = false;
    afterCloseRef.current = null;
    autoExpandedRef.current = false;
    translateY.stopAnimation();
    const start = reducedMotion ? previewOffset : dismissedOffset;
    currentTranslate.current = start;
    translateY.setValue(start);
    const frame = requestAnimationFrame(() => {
      Animated.timing(translateY, {
        duration: reducedMotion ? 80 : 300,
        easing: EASE_SHEET,
        toValue: previewOffset,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) currentTranslate.current = previewOffset;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [dismissedOffset, previewOffset, reducedMotion, translateY, visible]);

  useEffect(() => {
    if (!visible) return;
    contentProgress.stopAnimation();
    contentProgress.setValue(reducedMotion ? 1 : 0);
    Animated.timing(contentProgress, {
      duration: reducedMotion ? 80 : 180,
      easing: EASE_SHEET,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [contentKey, contentProgress, reducedMotion, visible]);

  const settle = useCallback((destination: number, velocity = 0) => {
    translateY.stopAnimation();
    if (reducedMotion) {
      Animated.timing(translateY, { duration: 80, easing: EASE_SHEET, toValue: destination, useNativeDriver: false }).start(({ finished }) => {
        if (finished) currentTranslate.current = destination;
      });
      return;
    }
    Animated.spring(translateY, {
      damping: destination === 0 ? 31 : 33,
      mass: 0.78,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
      stiffness: destination === 0 ? 300 : 320,
      toValue: destination,
      useNativeDriver: false,
      velocity,
    }).start(({ finished }) => {
      if (finished) currentTranslate.current = destination;
    });
  }, [reducedMotion, translateY]);

  const requestClose = useCallback((afterClose?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    afterCloseRef.current = afterClose ?? null;
    translateY.stopAnimation();
    const finish = () => {
      currentTranslate.current = dismissedOffset;
      const callback = afterCloseRef.current;
      afterCloseRef.current = null;
      onClose();
      callback?.();
    };
    if (reducedMotion) {
      Animated.timing(translateY, { duration: 80, easing: EASE_SHEET, toValue: dismissedOffset, useNativeDriver: false }).start(finish);
      return;
    }
    Animated.spring(translateY, {
      damping: 36,
      mass: 0.75,
      overshootClamping: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
      stiffness: 340,
      toValue: dismissedOffset,
      useNativeDriver: false,
    }).start(finish);
  }, [dismissedOffset, onClose, reducedMotion, translateY]);

  const expand = useCallback(() => {
    autoExpandedRef.current = true;
    settle(0);
  }, [settle]);

  const onContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const reachedEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 20;
    if (reachedEnd && currentTranslate.current > 4 && !autoExpandedRef.current) expand();
  }, [expand]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => !closingRef.current && Math.abs(gesture.dy) > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => !closingRef.current && Math.abs(gesture.dy) > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      translateY.stopAnimation((value) => {
        dragStart.current = value;
        currentTranslate.current = value;
      });
    },
    onPanResponderMove: (_event, gesture) => {
      const next = dragStart.current + gesture.dy;
      const resisted = next < 0
        ? rubberband(next, sheetHeight)
        : next > dismissedOffset ? dismissedOffset + rubberband(next - dismissedOffset, sheetHeight) : next;
      currentTranslate.current = resisted;
      translateY.setValue(resisted);
    },
    onPanResponderRelease: (_event, gesture) => {
      const projected = currentTranslate.current + gesture.vy * 210;
      if (projected > previewOffset + Math.max(84, sheetHeight * 0.09) || (gesture.vy > 1.18 && currentTranslate.current > previewOffset * 0.45)) {
        requestClose();
        return;
      }
      settle(projected < previewOffset * 0.52 || gesture.vy < -0.82 ? 0 : previewOffset, gesture.vy);
    },
    onPanResponderTerminate: () => settle(currentTranslate.current < previewOffset * 0.52 ? 0 : previewOffset),
    onPanResponderTerminationRequest: () => false,
    onStartShouldSetPanResponder: () => !closingRef.current,
  }), [dismissedOffset, previewOffset, requestClose, settle, sheetHeight, translateY]);

  const backdropOpacity = translateY.interpolate({ inputRange: [0, previewOffset, dismissedOffset], outputRange: [1, 0.92, 0], extrapolate: 'clamp' });
  const sheetOpacity = translateY.interpolate({ inputRange: [dismissedOffset - 140, dismissedOffset], outputRange: [1, 0], extrapolate: 'clamp' });
  const sheetScaleX = translateY.interpolate({ inputRange: [0, previewOffset, dismissedOffset], outputRange: [1, previewScaleX, previewScaleX], extrapolate: 'clamp' });
  const controls = useMemo<ProfileSheetControls>(() => ({ expand, onContentScroll, requestClose }), [expand, onContentScroll, requestClose]);
  const renderedChildren = typeof children === 'function' ? children(controls) : children;

  return (
    <Modal animationType="none" onRequestClose={() => requestClose()} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: backdropOpacity }]} />
        <Pressable accessibilityLabel={t.settings.close} accessibilityRole="button" onPress={() => requestClose()} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.sheet, { bottom: bottomInset, height: sheetHeight, opacity: sheetOpacity, transform: [{ translateY }, { scaleX: sheetScaleX }] }]}>
          <View style={styles.header}>
            <View {...panResponder.panHandlers} accessibilityHint={t.fridge.addItem.dragHint} style={styles.grabberTarget}>
              <View style={styles.grabber} />
            </View>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
            <Pressable accessibilityLabel={t.settings.close} accessibilityRole="button" hitSlop={8} onPress={() => requestClose()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Ionicons color="#365048" name="close" size={22} />
            </Pressable>
          </View>
          <Animated.View style={[styles.content, { opacity: contentProgress, transform: [{ scale: contentProgress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }] }]}>
            {renderedChildren}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(20,38,32,0.38)' },
  sheet: { position: 'absolute', right: 0, left: 0, overflow: 'hidden', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F7FBFA', shadowColor: '#183D32', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.2, shadowRadius: 26, elevation: 18 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE8E4' },
  grabberTarget: { position: 'absolute', top: 0, right: 72, left: 72, height: 30, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#C4D2CD' },
  title: { flex: 1, paddingRight: 12, color: '#173D31', fontSize: 21, fontWeight: '900', letterSpacing: -0.35 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#E8F0ED' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  content: { flex: 1 },
});
