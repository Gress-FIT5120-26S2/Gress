import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

export type AddItemMethod = 'manual' | 'camera';

export type AddItemMethodSheetCopy = {
  cameraA11y: string;
  cameraDescription: string;
  cameraDetails: string;
  cameraTitle: string;
  close: string;
  dragHint: string;
  manualA11y: string;
  manualDescription: string;
  manualDetails: string;
  manualTitle: string;
  recommended: string;
  subtitle: string;
  title: string;
};

type AddItemMethodSheetProps = {
  copy: AddItemMethodSheetCopy;
  onClose: () => void;
  onSelect: (method: AddItemMethod) => void;
  visible: boolean;
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);
const MAX_HEIGHT_RATIO = 0.56;
const COLLAPSED_HEIGHT_RATIO = 0.44;
const MIN_COLLAPSED_HEIGHT = 360;
const MIN_EXPANSION_DISTANCE = 52;
const SHEET_EDGE_GAP = 12;
const SNAP_VELOCITY = 0.28;

// Arthur: NarIyirm
// 中文：弹层只负责选择录入方式和两档展开状态，冰箱或购物车决定选择后的业务流程。
// EN: The sheet owns method selection and two snap states; fridge and cart screens decide the following workflow.
export function AddItemMethodSheet({ copy, onClose, onSelect, visible }: AddItemMethodSheetProps) {
  const { height } = useWindowDimensions();
  const expandedHeight = Math.round(height * MAX_HEIGHT_RATIO) - SHEET_EDGE_GAP;
  const collapsedHeight = Math.min(
    expandedHeight - MIN_EXPANSION_DISTANCE,
    Math.max(MIN_COLLAPSED_HEIGHT, Math.round(height * COLLAPSED_HEIGHT_RATIO)),
  );
  const [reduceMotion, setReduceMotion] = useState(false);
  const [rendered, setRendered] = useState(visible);
  const [isExpanded, setIsExpanded] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(height)).current;
  const sheetHeight = useRef(new Animated.Value(collapsedHeight)).current;
  const gestureStartRef = useRef(collapsedHeight);
  const heightRef = useRef(collapsedHeight);
  const pendingMethodRef = useRef<AddItemMethod | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) setRendered(true);
  }, [visible]);

  const snapTo = useCallback((target: number, velocity = 0) => {
    heightRef.current = target;
    setIsExpanded(target === expandedHeight);

    if (reduceMotion) {
      Animated.timing(sheetHeight, {
        toValue: target,
        duration: 100,
        easing: EASE_OUT,
        useNativeDriver: false,
      }).start();
      return;
    }

    Animated.spring(sheetHeight, {
      toValue: target,
      velocity: -velocity,
      stiffness: 320,
      damping: 34,
      mass: 1,
      overshootClamping: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
      useNativeDriver: false,
    }).start();
  }, [expandedHeight, reduceMotion, sheetHeight]);

  useEffect(() => {
    if (!rendered) return;

    backdropOpacity.stopAnimation();
    sheetHeight.stopAnimation();
    sheetOpacity.stopAnimation();
    sheetTranslateY.stopAnimation();

    if (visible) {
      pendingMethodRef.current = null;
      heightRef.current = collapsedHeight;
      setIsExpanded(false);
      backdropOpacity.setValue(0);
      sheetHeight.setValue(collapsedHeight);
      sheetOpacity.setValue(0);
      sheetTranslateY.setValue(reduceMotion ? 0 : collapsedHeight + SHEET_EDGE_GAP);

      const frame = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 0.46,
            duration: reduceMotion ? 120 : 190,
            easing: EASE_OUT,
            useNativeDriver: true,
          }),
          Animated.timing(sheetOpacity, {
            toValue: 1,
            duration: reduceMotion ? 120 : 160,
            easing: EASE_OUT,
            useNativeDriver: true,
          }),
          reduceMotion
            ? Animated.timing(sheetTranslateY, {
              toValue: 0,
              duration: 1,
              useNativeDriver: true,
            })
            : Animated.spring(sheetTranslateY, {
              toValue: 0,
              stiffness: 300,
              damping: 32,
              mass: 1,
              overshootClamping: true,
              useNativeDriver: true,
            }),
        ]).start();
      });

      return () => {
        cancelAnimationFrame(frame);
        backdropOpacity.stopAnimation();
        sheetHeight.stopAnimation();
        sheetOpacity.stopAnimation();
        sheetTranslateY.stopAnimation();
      };
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: reduceMotion ? 100 : 170,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacity, {
        toValue: 0,
        duration: reduceMotion ? 100 : 150,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: reduceMotion ? 0 : expandedHeight + SHEET_EDGE_GAP,
        duration: reduceMotion ? 1 : 210,
        easing: EASE_SHEET,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setRendered(false);
      const pendingMethod = pendingMethodRef.current;
      pendingMethodRef.current = null;

      if (pendingMethod) {
        // Arthur: NarIyirm
        // 中文：下一种录入模式必须等当前原生 Modal 卸载后一帧再打开，避免透明旧层继续拦截触摸。
        // EN: Open the next entry mode one frame after this native Modal unmounts so an invisible old layer cannot intercept touches.
        requestAnimationFrame(() => onSelect(pendingMethod));
      }
    });

    return () => {
      backdropOpacity.stopAnimation();
      sheetHeight.stopAnimation();
      sheetOpacity.stopAnimation();
      sheetTranslateY.stopAnimation();
    };
  }, [backdropOpacity, collapsedHeight, expandedHeight, onSelect, reduceMotion, rendered, sheetHeight, sheetOpacity, sheetTranslateY, visible]);

  // Arthur: NarIyirm
  // 中文：拖动时固定弹窗底边并改变可见高度，四周间距和底部圆角因此不会被推出屏幕。
  // EN: Dragging keeps the lower edge fixed and changes the visible height, preserving the outer gap and bottom corners.
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
    onPanResponderGrant: () => {
      sheetHeight.stopAnimation((value) => {
        gestureStartRef.current = value;
        heightRef.current = value;
      });
    },
    onPanResponderMove: (_, gesture) => {
      const next = Math.max(
        collapsedHeight,
        Math.min(expandedHeight, gestureStartRef.current - gesture.dy),
      );
      heightRef.current = next;
      sheetHeight.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => {
      const expand = gesture.vy < -SNAP_VELOCITY
        || (gesture.vy <= SNAP_VELOCITY && heightRef.current > (collapsedHeight + expandedHeight) / 2);
      snapTo(expand ? expandedHeight : collapsedHeight, gesture.vy);
    },
    onPanResponderTerminate: () => snapTo(isExpanded ? expandedHeight : collapsedHeight),
    onShouldBlockNativeResponder: () => true,
  }), [collapsedHeight, expandedHeight, isExpanded, sheetHeight, snapTo]);

  const handleAccessibilityAction = useCallback((event: { nativeEvent: { actionName: string } }) => {
    if (event.nativeEvent.actionName === 'increment') snapTo(expandedHeight);
    if (event.nativeEvent.actionName === 'decrement') snapTo(collapsedHeight);
  }, [collapsedHeight, expandedHeight, snapTo]);

  const revealDistance = expandedHeight - collapsedHeight;
  const detailsOpacity = sheetHeight.interpolate({
    inputRange: [collapsedHeight, collapsedHeight + revealDistance * 0.48, expandedHeight],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  const detailsTranslateY = sheetHeight.interpolate({
    inputRange: [collapsedHeight, expandedHeight],
    outputRange: [10, 0],
    extrapolate: 'clamp',
  });
  const closeWithoutSelection = useCallback(() => {
    pendingMethodRef.current = null;
    onClose();
  }, [onClose]);

  const selectMethod = useCallback((method: AddItemMethod) => {
    if (!visible) return;
    pendingMethodRef.current = method;
    onClose();
  }, [onClose, visible]);

  const selectManual = useCallback(() => selectMethod('manual'), [selectMethod]);
  const selectCamera = useCallback(() => selectMethod('camera'), [selectMethod]);

  if (!rendered) return null;

  return (
    <Modal
      animationType="none"
      onRequestClose={closeWithoutSelection}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable accessibilityLabel={copy.close} accessibilityRole="button" onPress={closeWithoutSelection} style={StyleSheet.absoluteFill} />
        </Animated.View>

        {/* Arthur: NarIyirm
            中文：外层仅由 JS 驱动高度，内层仅由原生驱动位移和透明度，避免同一动画节点混用驱动器。
            EN: The outer layer owns JS-driven height while the inner layer owns native translation and opacity, preventing mixed drivers on one node. */}
        <Animated.View style={[styles.sheetFrame, { height: sheetHeight }]}>
          <Animated.View
            accessibilityViewIsModal
            style={[styles.sheet, { opacity: sheetOpacity, transform: [{ translateY: sheetTranslateY }] }]}
          >
            <View
              accessible
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              accessibilityHint={copy.dragHint}
              accessibilityRole="adjustable"
              onAccessibilityAction={handleAccessibilityAction}
              style={styles.dragArea}
              {...panResponder.panHandlers}
            >
              <View style={styles.grabber} />
            </View>

            <View style={styles.header}>
              <View style={styles.addIcon}>
                <Ionicons name="add" size={29} color="#FFFFFF" />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{copy.title}</Text>
                <Text style={styles.subtitle}>{copy.subtitle}</Text>
              </View>
              <Pressable
                accessibilityLabel={copy.close}
                accessibilityRole="button"
                hitSlop={8}
                onPress={closeWithoutSelection}
                style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
              >
                <Ionicons name="close" size={22} color="#65766F" />
              </Pressable>
            </View>

            <View style={styles.methodRow}>
              <MethodCard
                accessibilityLabel={copy.manualA11y}
                description={copy.manualDescription}
                details={copy.manualDetails}
                detailsOpacity={detailsOpacity}
                detailsTranslateY={detailsTranslateY}
                icon="create-outline"
                onPress={selectManual}
                title={copy.manualTitle}
                tone="#F08224"
                tint="#FFF1E7"
              />
              <MethodCard
                accessibilityLabel={copy.cameraA11y}
                badge={copy.recommended}
                description={copy.cameraDescription}
                details={copy.cameraDetails}
                detailsOpacity={detailsOpacity}
                detailsTranslateY={detailsTranslateY}
                icon="scan-outline"
                onPress={selectCamera}
                title={copy.cameraTitle}
                tone="#0AAFC3"
                tint="#E7F9FC"
              />
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

type MethodCardProps = {
  accessibilityLabel: string;
  badge?: string;
  description: string;
  details: string;
  detailsOpacity: Animated.AnimatedInterpolation<number>;
  detailsTranslateY: Animated.AnimatedInterpolation<number>;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tint: string;
  title: string;
  tone: string;
};

const MethodCard = memo(function MethodCard({
  accessibilityLabel,
  badge,
  description,
  details,
  detailsOpacity,
  detailsTranslateY,
  icon,
  onPress,
  tint,
  title,
  tone,
}: MethodCardProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.methodCard, { borderColor: `${tone}26` }, pressed ? styles.methodCardPressed : null]}
    >
      <View style={styles.recommendedRow}>
        {badge ? (
          <View style={styles.recommendedBadge}>
            <Ionicons name="sparkles" size={11} color="#C96E1A" />
            <Text style={styles.recommendedText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.methodIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={26} color={tone} />
      </View>
      <View style={styles.methodCopy}>
        <Text numberOfLines={2} style={styles.methodTitle}>{title}</Text>
        <Text numberOfLines={3} style={styles.methodDescription}>{description}</Text>
      </View>
      <Animated.View style={[styles.methodDetails, { opacity: detailsOpacity, transform: [{ translateY: detailsTranslateY }] }]}>
        <View style={[styles.detailMarker, { backgroundColor: tone }]} />
        <Text style={styles.methodDetailsText}>{details}</Text>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: SHEET_EDGE_GAP,
    paddingBottom: SHEET_EDGE_GAP,
  },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#1E2925' },
  sheetFrame: {
    width: '100%',
    flexShrink: 0,
  },
  sheet: {
    flex: 1,
    overflow: 'hidden',
    paddingRight: 22,
    paddingBottom: 24,
    paddingLeft: 22,
    borderRadius: 30,
    borderCurve: 'continuous',
    backgroundColor: '#FBFCFA',
    boxShadow: '0 10px 32px rgba(38, 51, 46, 0.18)',
  },
  dragArea: { height: 40, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 42, height: 5, borderRadius: 3, borderCurve: 'continuous', backgroundColor: '#DDE3E0' },
  header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16 },
  addIcon: { width: 49, height: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FF7A35', boxShadow: '0 6px 16px rgba(255, 122, 53, 0.20)' },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: '#173D31', fontSize: 21, fontWeight: '900', letterSpacing: -0.45 },
  subtitle: { color: '#718079', fontSize: 13, fontWeight: '600' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  methodRow: { flex: 1, flexDirection: 'row', gap: 14, paddingTop: 6 },
  methodCard: { flex: 1, minWidth: 0, paddingTop: 12, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, borderWidth: 1, borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#FFFFFF', boxShadow: '0 6px 18px rgba(54, 74, 66, 0.07)' },
  methodCardPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  recommendedRow: { minHeight: 24, marginBottom: 10, justifyContent: 'center' },
  methodIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderCurve: 'continuous' },
  methodCopy: { gap: 6, marginTop: 14 },
  methodTitle: { minHeight: 42, color: '#193C31', fontSize: 16, fontWeight: '900', letterSpacing: -0.2, lineHeight: 21 },
  methodDescription: { color: '#718079', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  methodDetails: { flexDirection: 'row', gap: 7, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF1EF' },
  detailMarker: { width: 3, minHeight: 30, borderRadius: 2, borderCurve: 'continuous', opacity: 0.75 },
  methodDetailsText: { flex: 1, color: '#63736C', fontSize: 12, fontWeight: '600', lineHeight: 17 },
  recommendedBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#FFF3E3' },
  recommendedText: { color: '#C96E1A', fontSize: 10.5, fontWeight: '900' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
