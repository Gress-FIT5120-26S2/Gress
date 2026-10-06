import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type GestureResponderHandlers, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import type { WasteOpportunity, WasteStream } from '../../services/wasteLearningApi';
const BIN_ART: Record<WasteStream, { closed: number; open: number }> = {
  organics: { closed: require('../../../assets/waste-bins/organics-closed.png'), open: require('../../../assets/waste-bins/organics-open.png') },
  recycling: { closed: require('../../../assets/waste-bins/recycling-closed.png'), open: require('../../../assets/waste-bins/recycling-open.png') },
  general: { closed: require('../../../assets/waste-bins/general-closed.png'), open: require('../../../assets/waste-bins/general-open.png') },
};
const ICONS: Partial<Record<WasteOpportunity['material'], keyof typeof MaterialCommunityIcons.glyphMap>> = {
  eggshell: 'egg-outline',
  aluminium_can: 'cylinder',
  plastic_bottle: 'bottle-soda-outline',
  unknown_bottle: 'bottle-soda-outline',
  unknown_container: 'help-circle-outline',
};
export function BinChoice({ stream, index, hovered, highlighted, label, onPress, disabled, reducedMotion, teaching = false }: {
  stream: WasteStream; index: number; hovered: number; highlighted: boolean; label: string; onPress: () => void; disabled: boolean; reducedMotion: boolean; teaching?: boolean;
}) {
  const lid = useRef(new Animated.Value(0)).current;
  const isOpen = hovered === index;
  const artwork = BIN_ART[stream];
  useEffect(() => {
    if (reducedMotion) lid.setValue(isOpen ? 1 : 0);
    else Animated.timing(lid, { toValue: isOpen ? 1 : 0, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [isOpen, lid, reducedMotion]);
  // Arthur: NarIyirm
  // 中文：同一款实物桶模型预渲染开合两帧，拖拽悬停时交叉淡化，避免在 Expo Go 中加载实时 3D 场景。
  // EN: Crossfade offline open and closed renders of one bin model on hover, avoiding a live 3D scene in Expo Go.
  return <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={styles.binTouch}>
    <View style={[styles.binFigure, teaching && { width: 94, height: 132 }, (isOpen || highlighted) && styles.binFigureActive]}>
      <Animated.Image resizeMode="contain" source={artwork.closed} style={[styles.binImage, teaching && { width: 94, height: 132 }, { opacity: lid.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} />
      <Animated.Image resizeMode="contain" source={artwork.open} style={[styles.binImage, teaching && { width: 94, height: 132 }, { opacity: lid }]} />
    </View>
    <Text numberOfLines={2} style={teaching ? styles.teachingBinText : styles.binText}>{label}</Text>
  </Pressable>;
}

export function MaterialArtwork({ material, iconUrl, emoji }: { material: WasteOpportunity['material']; iconUrl?: string | null; emoji?: string }) {
  const [failed, setFailed] = useState(false);
  if (iconUrl && !failed) return <Image accessibilityIgnoresInvertColors onError={() => setFailed(true)} resizeMode="contain" source={{ uri: iconUrl }} style={{ width: 100, height: 100 }} />;
  if (emoji && !ICONS[material]) return <Text style={{ fontSize: 65 }}>{emoji}</Text>;
  if (material === 'eggshell') {
    return <Svg height={91} viewBox="0 0 100 91" width={100}>
      <Defs><SvgLinearGradient id="shell" x1="0" x2="1" y1="0" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#ECD9AF" /></SvgLinearGradient></Defs>
      <Path d="M17 37 C19 18 33 7 50 7 C68 7 81 20 83 37 L72 31 L61 40 L49 31 L37 42 L26 34 Z" fill="url(#shell)" stroke="#D6BE92" strokeWidth="2.5" />
      <Path d="M13 45 L24 37 L36 46 L49 36 L62 46 L75 37 L87 45 C86 69 71 84 50 84 C29 84 14 69 13 45 Z" fill="url(#shell)" stroke="#D6BE92" strokeLinejoin="round" strokeWidth="2.5" />
      <Path d="M22 58 C27 70 36 76 45 77" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="5" />
    </Svg>;
  }
  if (material === 'aluminium_can') {
    return <View style={styles.canArt}>
      <View style={styles.canTop} />
      <LinearGradient colors={['#F4F8F3', '#8DD3DD', '#2C9AAC', '#D9F1E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.canBody}>
        <MaterialCommunityIcons color="#FFE277" name="circle-slice-8" size={38} />
      </LinearGradient>
      <View style={styles.canBottom} />
    </View>;
  }
  return <MaterialCommunityIcons
    color="#CDEEF1"
    name={ICONS[material] ?? 'help-circle-outline'}
    size={96}
    style={styles.materialGlyph}
  />;
}


// Arthur: NarIyirm
// 中文：仅展示手势与桶，不调用 API；库存事件和教学题目由各自的父组件保存。
// EN: Present gestures and bins without API calls; inventory events and teaching questions save through their own parents.
export function WasteSortingInteraction({ mode, width, binY, item, itemLabel, itemStyle, gestureHandlers, hovered, choices, disabled, itemDisabled, onChoose, reducedMotion, style }: {
  mode: 'inventory' | 'learning'; width: number; binY: number; item: ReactNode; itemLabel?: string;
  itemStyle?: StyleProp<ViewStyle>; gestureHandlers: GestureResponderHandlers; hovered: number;
  choices: { stream: WasteStream; label: string; highlighted: boolean }[];
  disabled: boolean; itemDisabled: boolean; onChoose: (index: number) => void; reducedMotion: boolean; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ width, height: Math.max(245, binY + 176), alignSelf: 'center' }, style]}>
    <Animated.View {...gestureHandlers} accessibilityLabel={itemLabel} pointerEvents={itemDisabled ? 'none' : 'auto'} style={[{ position: 'absolute', top: 0, left: '50%', marginLeft: -55, width: 110, height: 122, zIndex: itemDisabled ? 1 : 5, alignItems: 'center', justifyContent: 'center' }, itemStyle]}>{item}</Animated.View>
    <View style={{ position: 'absolute', left: 0, right: 0, top: binY, flexDirection: 'row', alignItems: 'flex-start', zIndex: 2 }}>{choices.map((choice,index) => <BinChoice key={choice.stream} {...choice} index={index} hovered={hovered} disabled={disabled} reducedMotion={reducedMotion} teaching={mode === 'learning'} onPress={() => onChoose(index)} />)}</View>
  </View>;
}
const styles = StyleSheet.create({
  teachingBinText: { color: '#173D31', fontSize: 12, fontWeight: '600', lineHeight: 17, textAlign: 'center', marginTop: 0, paddingHorizontal: 2 },
  materialGlyph: { textShadowColor: 'rgba(255,255,255,0.55)', textShadowOffset: { width: -2, height: -2 }, textShadowRadius: 10 },
  canArt: { width: 67, height: 91, alignItems: 'center', transform: [{ rotate: '15deg' }], shadowColor: '#001F23', shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  canTop: { width: 58, height: 10, borderRadius: 9, backgroundColor: '#E7ECEB', borderWidth: 2, borderColor: '#7A9598', zIndex: 2 },
  canBody: { width: 60, height: 72, marginTop: -2, borderWidth: 1, borderColor: '#DBF7F3', alignItems: 'center', justifyContent: 'center' },
  canBottom: { width: 57, height: 8, marginTop: -2, borderRadius: 8, backgroundColor: '#9BB6B5', borderWidth: 1, borderColor: '#ECF8F1' },
  binTouch: { flex: 1, minHeight: 168, alignItems: 'center', justifyContent: 'flex-start' },
  binFigure: { width: 112, height: 145, alignItems: 'center' },
  binFigureActive: { transform: [{ scale: 1.06 }] },
  binImage: { position: 'absolute', width: 112, height: 145 },
  binText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 15, textAlign: 'center', marginTop: -2, paddingHorizontal: 2, textShadowColor: 'rgba(3,30,20,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
});
