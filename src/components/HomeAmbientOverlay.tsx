import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { KitchenTimePhase } from './KitchenTimeLighting';

type HomeAmbientOverlayProps = {
  blurTarget: RefObject<View | null>;
  expiringCount: number;
  onOpenExpiring: () => void;
  onOpenSettings: () => void;
  phase: KitchenTimePhase;
  showInteractionHint: boolean;
};

const NIGHT_STARS = [
  { left: '12%', top: '19%', opacity: 0.42, size: 2 },
  { left: '24%', top: '13%', opacity: 0.28, size: 2 },
  { left: '43%', top: '18%', opacity: 0.36, size: 1.5 },
  { left: '67%', top: '14%', opacity: 0.32, size: 2 },
  { left: '84%', top: '22%', opacity: 0.4, size: 1.5 },
] as const;

function getPeriodLabel(phase: KitchenTimePhase) {
  if (phase === 'night') return '今晚的厨房';
  if (phase === 'dawn') return '清晨的厨房';
  if (phase === 'sunset') return '傍晚的厨房';
  return '今天的厨房';
}

export function HomeAmbientOverlay({
  blurTarget,
  expiringCount,
  onOpenExpiring,
  onOpenSettings,
  phase,
  showInteractionHint,
}: HomeAmbientOverlayProps) {
  const isNight = phase === 'night';
  const headline = expiringCount > 0 ? `${expiringCount} 件食材值得先用` : '今天的食材状态很好';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {isNight ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {NIGHT_STARS.map((star, index) => (
            <View
              key={index}
              style={[
                styles.star,
                {
                  left: star.left,
                  top: star.top,
                  width: star.size,
                  height: star.size,
                  borderRadius: star.size / 2,
                  opacity: star.opacity,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityHint="打开冰箱并查看临期食材"
        accessibilityLabel={headline}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenExpiring}
        pressRetentionOffset={12}
        style={({ pressed }) => [styles.freshnessCopy, pressed && styles.copyPressed]}
      >
        <Text style={[styles.periodLabel, isNight ? styles.nightPrimary : styles.dayPrimary]}>
          {getPeriodLabel(phase)}
        </Text>
        <Text style={[styles.freshnessHeadline, isNight ? styles.nightPrimary : styles.dayPrimary]}>
          {headline}
        </Text>
      </Pressable>

      <Pressable
        accessibilityLabel="打开设置"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenSettings}
        pressRetentionOffset={12}
        style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsPressed]}
      >
        <BlurView
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          intensity={42}
          tint={isNight ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          style={[styles.settingsGlass, isNight ? styles.settingsGlassNight : styles.settingsGlassDay]}
        >
          <Ionicons name="settings-sharp" size={25} color={isNight ? '#F1F4F5' : '#365048'} />
        </BlurView>
      </Pressable>

      {showInteractionHint ? (
        <View pointerEvents="none" style={styles.interactionHint}>
          <Text style={[styles.interactionHintText, isNight ? styles.nightSecondary : styles.daySecondary]}>
            拖动查看 · 轻点白点进入
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  star: { position: 'absolute', backgroundColor: '#DDEBFF' },
  freshnessCopy: { position: 'absolute', top: 118, right: 92, left: 24, alignSelf: 'flex-start' },
  copyPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  periodLabel: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  freshnessHeadline: { marginTop: 7, fontSize: 23, fontWeight: '700', lineHeight: 30, letterSpacing: -0.35 },
  nightPrimary: { color: '#F2D5AC' },
  dayPrimary: { color: '#633F2D' },
  nightSecondary: { color: 'rgba(218,231,242,0.72)' },
  daySecondary: { color: 'rgba(55,78,70,0.70)' },
  settingsButton: { position: 'absolute', top: 72, right: 22, width: 52, height: 52 },
  settingsPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  settingsGlass: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 26, borderWidth: 1 },
  settingsGlassNight: { borderColor: 'rgba(226,237,247,0.22)', backgroundColor: 'rgba(91,112,132,0.26)' },
  settingsGlassDay: { borderColor: 'rgba(255,255,255,0.68)', backgroundColor: 'rgba(255,255,255,0.28)' },
  interactionHint: { position: 'absolute', right: 24, bottom: '18%', left: 24, alignItems: 'center' },
  interactionHintText: { fontSize: 13, fontWeight: '600', lineHeight: 18, letterSpacing: 0.15 },
});
