import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import type { KitchenTimePhase } from './KitchenTimeLighting';

type HomeAmbientOverlayProps = {
  blurTarget: RefObject<View | null>;
  badgeCount: number;
  expiringCount: number;
  onOpenExpiring: () => void;
  onOpenNotifications: () => void;
  phase: KitchenTimePhase;
  showInteractionHint: boolean;
  unreadCount: number;
};

const NIGHT_STARS = [
  { left: '12%', top: '19%', opacity: 0.42, size: 2 },
  { left: '24%', top: '13%', opacity: 0.28, size: 2 },
  { left: '43%', top: '18%', opacity: 0.36, size: 1.5 },
  { left: '67%', top: '14%', opacity: 0.32, size: 2 },
  { left: '84%', top: '22%', opacity: 0.4, size: 1.5 },
] as const;

export function HomeAmbientOverlay({
  blurTarget,
  badgeCount,
  expiringCount,
  onOpenExpiring,
  onOpenNotifications,
  phase,
  showInteractionHint,
  unreadCount,
}: HomeAmbientOverlayProps) {
  const { t } = useI18n();
  const isNight = phase === 'night';
  const hasExpiring = expiringCount > 0;
  const headline = hasExpiring ? t.home.expiring(expiringCount) : t.home.useFirst;

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
        accessibilityHint={t.home.freshnessHint}
        accessibilityLabel={headline}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenExpiring}
        pressRetentionOffset={12}
        style={({ pressed }) => [styles.freshnessCopy, pressed && styles.copyPressed]}
      >
        <Text style={[styles.periodLabel, isNight ? styles.nightPrimary : styles.dayPrimary]}>
          {t.home.period[phase]}
        </Text>
        <Text
          style={[
            styles.freshnessHeadline,
            !hasExpiring && styles.useFirstHeadline,
            isNight ? styles.nightPrimary : styles.dayPrimary,
          ]}
        >
          {headline}
        </Text>
      </Pressable>

      <Pressable
        accessibilityHint={t.home.mailboxHint}
        accessibilityLabel={unreadCount > 0 ? t.home.mailboxUnread(unreadCount) : t.home.mailboxEmpty}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenNotifications}
        pressRetentionOffset={12}
        style={({ pressed }) => [styles.mailButton, pressed && styles.mailPressed]}
      >
        <BlurView
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          intensity={42}
          tint={isNight ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          style={[styles.mailGlass, isNight ? styles.mailGlassNight : styles.mailGlassDay]}
        >
          <Ionicons name={unreadCount > 0 ? 'mail-unread-outline' : 'mail-outline'} size={25} color={isNight ? '#F1F4F5' : '#365048'} />
        </BlurView>
        {badgeCount > 0 ? (
          <View style={styles.mailBadge}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.mailBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        ) : null}
      </Pressable>

      {showInteractionHint ? (
        <View pointerEvents="none" style={styles.interactionHint}>
          <Text style={[styles.interactionHintText, isNight ? styles.nightSecondary : styles.daySecondary]}>
            {t.home.interactionHint}
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
  useFirstHeadline: { fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  nightPrimary: { color: '#F2D5AC' },
  dayPrimary: { color: '#633F2D' },
  nightSecondary: { color: 'rgba(218,231,242,0.72)' },
  daySecondary: { color: 'rgba(55,78,70,0.70)' },
  mailButton: { position: 'absolute', top: 72, right: 22, width: 52, height: 52 },
  mailPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  mailGlass: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 26, borderWidth: 1 },
  mailGlassNight: { borderColor: 'rgba(226,237,247,0.22)', backgroundColor: 'rgba(91,112,132,0.26)' },
  mailGlassDay: { borderColor: 'rgba(255,255,255,0.68)', backgroundColor: 'rgba(255,255,255,0.28)' },
  mailBadge: { position: 'absolute', top: -5, right: -5, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 11, borderWidth: 2, borderColor: '#F7FBFA', backgroundColor: '#F06B24' },
  mailBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', lineHeight: 13 },
  interactionHint: { position: 'absolute', right: 24, bottom: '18%', left: 24, alignItems: 'center' },
  interactionHintText: { fontSize: 13, fontWeight: '600', lineHeight: 18, letterSpacing: 0.15 },
});
