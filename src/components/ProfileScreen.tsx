import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useI18n } from '../i18n';
import { updateDeviceProfile, type DeviceProfile, type ProfileAvatarKey } from '../services/profileApi';
import { DeviceRecoverySettings } from './DeviceRecoverySettings';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { ProfileBottomSheet } from './ProfileBottomSheet';
import { useProfileData } from './ProfileDataProvider';
import { LanguageSettingsModal } from './ProfileSettings';

const AVATAR_COLOURS: Record<ProfileAvatarKey, { background: string; foreground: string }> = {
  sage: { background: '#DDEFE7', foreground: '#245846' },
  sky: { background: '#DDF3FB', foreground: '#167EA9' },
  apricot: { background: '#FFF0DF', foreground: '#C6661C' },
  plum: { background: '#EEE7F5', foreground: '#6F5185' },
  coral: { background: '#FBE7E5', foreground: '#A95750' },
};

type ProfileScreenProps = {
  onOpenNotifications: () => void;
  onReplayOnboarding: () => void;
};

// Arthur: NarIyirm
// 中文：个人页把设备昵称、共享空间摘要和已实现设置集中展示；口味入口仅保留占位，不创建未生效的数据。
// EN: The profile screen combines device identity, shared-space context, and working settings while keeping taste preferences as a non-persisting placeholder.
export function ProfileScreen({ onOpenNotifications, onReplayOnboarding }: ProfileScreenProps) {
  const { language, t } = useI18n();
  const copy = t.profile;
  const { failed, fridgeContext: context, loading, profile, refresh, setProfile } = useProfileData();
  const [editVisible, setEditVisible] = useState(false);
  const [notificationSettingsVisible, setNotificationSettingsVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [replayVisible, setReplayVisible] = useState(false);

  const displayName = profile?.displayName ?? null;
  const avatar = AVATAR_COLOURS[profile?.avatarKey ?? 'sage'];
  const avatarInitial = useMemo(() => displayName ? Array.from(displayName.trim())[0]?.toUpperCase() ?? 'K' : '+', [displayName]);
  const fridgeDetail = context
    ? context.fridge.mode === 'shared'
      ? copy.sharedFridge(context.fridge.name, context.fridge.memberCount)
      : copy.personalFridge(context.fridge.name)
    : copy.contextUnavailable;

  if (loading) return <ProfileSkeleton />;

  if (failed && !profile) {
    return (
      <View style={styles.failedState}>
        <View style={styles.failedIcon}><Ionicons color="#168ACB" name="cloud-offline-outline" size={29} /></View>
        <Text style={styles.failedTitle}>{copy.loadError}</Text>
        <Text style={styles.failedDescription}>{copy.loadErrorDetail}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void refresh(); }} style={styles.retryButton}>
          <Text style={styles.retryText}>{copy.retry}</Text>
        </Pressable>
      </View>
    );
  }

  const openTastePlaceholder = () => Alert.alert(copy.tastePlaceholderTitle, copy.tastePlaceholderBody);
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.74} numberOfLines={1} style={styles.greeting}>
          {displayName ? copy.greeting(displayName) : copy.greetingWithoutName}
        </Text>

        <View style={styles.identityPanel}>
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            contentFit="contain"
            source={require('../../assets/kitchmemo-assistant.png')}
            style={styles.assistant}
          />
          <View style={styles.identityTopRow}>
            <View style={[styles.avatar, { backgroundColor: avatar.background }]}>
              <Text style={[styles.avatarText, { color: avatar.foreground }]}>{avatarInitial}</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text numberOfLines={1} style={styles.identityName}>{displayName ?? copy.nameNotSet}</Text>
              <Text numberOfLines={2} style={styles.identityMeta}>{fridgeDetail}</Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel={copy.editProfile}
            accessibilityRole="button"
            onPress={() => setEditVisible(true)}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Ionicons color="#D96818" name="pencil-outline" size={17} />
            <Text style={styles.editButtonText}>{copy.editProfile}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{copy.preferencesTitle}</Text>
        <View style={styles.listSurface}>
          <ProfileRow
            detail={copy.notificationsDetail}
            icon="notifications-outline"
            onPress={() => setNotificationSettingsVisible(true)}
            title={copy.notificationsTitle}
          />
          <ProfileRow
            detail={language === 'zh' ? t.settings.chineseDetail : t.settings.englishDetail}
            icon="language-outline"
            onPress={() => setLanguageVisible(true)}
            title={copy.languageTitle}
          />
          <ProfileRow
            detail={copy.replayOnboardingDetail}
            icon="refresh-circle-outline"
            onPress={() => setReplayVisible(true)}
            title={copy.replayOnboardingTitle}
          />
          <ProfileRow
            detail={copy.tastePlaceholderDetail}
            icon="leaf-outline"
            isLast
            onPress={openTastePlaceholder}
            title={copy.tastePlaceholderTitle}
          />
        </View>

        <Text style={styles.sectionTitle}>{copy.securityTitle}</Text>
        <View style={styles.listSurface}>
          <ProfileRow
            detail={context?.recoveryConfigured ? copy.recoveryConfigured : copy.recoveryNotConfigured}
            icon="key-outline"
            onPress={() => setRecoveryVisible(true)}
            title={copy.recoveryTitle}
          />
          <ProfileRow
            detail={copy.privacyDetail}
            icon="shield-checkmark-outline"
            isLast
            onPress={() => setPrivacyVisible(true)}
            title={copy.privacyTitle}
          />
        </View>

        <Text style={styles.accountNote}>{copy.accountNote}</Text>
      </ScrollView>

      <EditProfileModal
        currentName={profile?.displayName ?? ''}
        onClose={() => setEditVisible(false)}
        onSaved={setProfile}
        visible={editVisible}
      />
      <LanguageSettingsModal onClose={() => setLanguageVisible(false)} visible={languageVisible} />
      <NotificationSettingsModal
        onClose={() => setNotificationSettingsVisible(false)}
        onOpenInbox={onOpenNotifications}
        visible={notificationSettingsVisible}
      />
      <RecoveryModal
        onClose={() => {
          setRecoveryVisible(false);
          void refresh(true);
        }}
        visible={recoveryVisible}
      />
      <PrivacyModal onClose={() => setPrivacyVisible(false)} visible={privacyVisible} />
      <ReplayOnboardingModal
        onClose={() => setReplayVisible(false)}
        onReplay={onReplayOnboarding}
        visible={replayVisible}
      />
    </View>
  );
}

function ProfileRow({ detail, icon, isLast = false, onPress, title }: {
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  isLast?: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}><Ionicons color="#168ACB" name={icon} size={20} /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text numberOfLines={2} style={styles.rowDetail}>{detail}</Text>
      </View>
      <Ionicons color="#5F8176" name="chevron-forward" size={19} />
    </Pressable>
  );
}

function EditProfileModal({ currentName, onClose, onSaved, visible }: {
  currentName: string;
  onClose: () => void;
  onSaved: (profile: DeviceProfile) => void;
  visible: boolean;
}) {
  const { t } = useI18n();
  const copy = t.profile.edit;
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(currentName);
    setError(null);
  }, [currentName, visible]);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0 && Array.from(trimmedName).length <= 32;

  const save = async () => {
    if (!isValid || saving) {
      setError(copy.invalidName);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nextProfile = await updateDeviceProfile(trimmedName);
      onSaved(nextProfile);
      onClose();
    } catch {
      setError(copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalRoot}>
        <Pressable accessibilityLabel={t.settings.close} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{copy.title}</Text>
            <Pressable accessibilityLabel={t.settings.close} accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Ionicons color="#365048" name="close" size={22} />
            </Pressable>
          </View>
          <Text style={styles.sheetDescription}>{copy.description}</Text>
          <Text style={styles.fieldLabel}>{copy.nameLabel}</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            maxLength={32}
            onChangeText={(value) => {
              setName(value);
              setError(null);
            }}
            onSubmitEditing={() => { void save(); }}
            placeholder={copy.namePlaceholder}
            placeholderTextColor="#6F817A"
            returnKeyType="done"
            style={[styles.nameInput, error && styles.nameInputError]}
            value={name}
          />
          <View style={styles.fieldMetaRow}>
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error ?? ' '}</Text>
            <Text style={styles.characterCount}>{Array.from(name).length}/32</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!isValid || saving}
            onPress={() => { void save(); }}
            style={[styles.saveButton, (!isValid || saving) && styles.disabled]}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>{copy.save}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RecoveryModal({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const { t } = useI18n();
  const [contentVersion, setContentVersion] = useState(0);
  return (
    <ProfileBottomSheet contentKey={String(contentVersion)} onClose={onClose} title={t.profile.recoveryTitle} visible={visible}>
      {({ onContentScroll }) => (
        <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled" onScroll={onContentScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
          <DeviceRecoverySettings active={visible} onContentChange={() => setContentVersion((version) => version + 1)} />
        </ScrollView>
      )}
    </ProfileBottomSheet>
  );
}

function PrivacyModal({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const { t } = useI18n();
  const copy = t.profile.privacy;
  return (
    <ProfileBottomSheet onClose={onClose} title={copy.title} visible={visible}>
      {({ requestClose }) => (
        <View style={styles.privacyContent}>
          <PrivacyPoint icon="phone-portrait-outline" text={copy.deviceIdentity} />
          <PrivacyPoint icon="people-outline" text={copy.sharedVisibility} />
          <PrivacyPoint icon="lock-closed-outline" text={copy.security} />
          <Pressable accessibilityRole="button" onPress={() => requestClose()} style={styles.privacyCloseButton}>
            <Text style={styles.privacyCloseText}>{copy.close}</Text>
          </Pressable>
        </View>
      )}
    </ProfileBottomSheet>
  );
}

function ReplayOnboardingModal({ onClose, onReplay, visible }: { onClose: () => void; onReplay: () => void; visible: boolean }) {
  const { t } = useI18n();
  const copy = t.profile;
  return (
    <ProfileBottomSheet onClose={onClose} title={copy.replayOnboardingTitle} visible={visible}>
      {({ requestClose }) => (
        <View style={styles.replayContent}>
          <View style={styles.replayIcon}><Ionicons color="#D66C1C" name="map-outline" size={28} /></View>
          <Text style={styles.replayDescription}>{copy.replayOnboardingConfirmBody}</Text>
          <View style={styles.replayActions}>
            <Pressable accessibilityRole="button" onPress={() => requestClose()} style={({ pressed }) => [styles.replayCancelButton, pressed && styles.pressed]}>
              <Text style={styles.replayCancelText}>{copy.replayOnboardingCancel}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => requestClose(onReplay)} style={({ pressed }) => [styles.replayConfirmButton, pressed && styles.pressed]}>
              <Text style={styles.replayConfirmText}>{copy.replayOnboardingConfirm}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ProfileBottomSheet>
  );
}

function PrivacyPoint({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.privacyPoint}>
      <View style={styles.privacyIcon}><Ionicons color="#168ACB" name={icon} size={19} /></View>
      <Text style={styles.privacyText}>{text}</Text>
    </View>
  );
}

function ProfileSkeleton() {
  return (
    <View style={styles.screen}>
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonLine, { width: 92 }]} />
        <View style={[styles.skeletonLine, styles.skeletonHeading]} />
        <View style={styles.skeletonHero} />
        <View style={[styles.skeletonLine, { width: 126, marginTop: 30 }]} />
        <View style={styles.skeletonList} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7FBFA' },
  content: { paddingHorizontal: 18, paddingTop: 68, paddingBottom: 132 },
  eyebrow: { color: '#3C6659', fontSize: 14, fontWeight: '700' },
  greeting: { marginTop: 7, color: '#173D31', fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  identityPanel: { minHeight: 190, marginTop: 22, padding: 18, paddingRight: 92, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#EAF7FD', overflow: 'hidden' },
  assistant: { position: 'absolute', right: -4, bottom: -5, width: 106, height: 106, opacity: 0.96 },
  identityTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 68, height: 68, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 34 },
  avatarText: { fontSize: 30, fontWeight: '900' },
  identityCopy: { flex: 1, minWidth: 0 },
  identityName: { color: '#173D31', fontSize: 23, fontWeight: '900' },
  identityMeta: { marginTop: 5, color: '#526D65', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  editButton: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 22, paddingHorizontal: 15, borderWidth: 1, borderColor: '#F58220', borderRadius: 14, backgroundColor: '#FFFFFF' },
  editButtonText: { color: '#C95F14', fontSize: 13, fontWeight: '800' },
  sectionTitle: { marginTop: 30, marginBottom: 10, color: '#173D31', fontSize: 17, fontWeight: '900' },
  listSurface: { overflow: 'hidden', borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E9E4' },
  rowPressed: { backgroundColor: '#F0F8F6' },
  rowIcon: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#E7F7FC' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#1F3F35', fontSize: 15, fontWeight: '800' },
  rowDetail: { marginTop: 4, color: '#5E756D', fontSize: 12, lineHeight: 17 },
  accountNote: { marginTop: 18, paddingHorizontal: 6, color: '#647B73', fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  failedState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, backgroundColor: '#F7FBFA' },
  failedIcon: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 31, backgroundColor: '#E7F7FC' },
  failedTitle: { marginTop: 18, color: '#173D31', fontSize: 20, fontWeight: '900' },
  failedDescription: { marginTop: 7, color: '#5E756D', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#168ACB' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,38,32,0.34)' },
  sheet: { maxHeight: '91%', paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#F7FBFA' },
  handle: { width: 38, height: 5, alignSelf: 'center', borderRadius: 3, backgroundColor: '#C9D8D3' },
  sheetHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTitle: { flex: 1, color: '#173D31', fontSize: 22, fontWeight: '900' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#E8F0ED' },
  sheetDescription: { color: '#5E756D', fontSize: 13, lineHeight: 19 },
  fieldLabel: { marginTop: 22, color: '#294E42', fontSize: 13, fontWeight: '800' },
  nameInput: { minHeight: 54, marginTop: 8, paddingHorizontal: 15, borderWidth: 1.5, borderColor: '#A8D8EE', borderRadius: 15, color: '#173D31', fontSize: 17, fontWeight: '700', backgroundColor: '#FFFFFF' },
  nameInputError: { borderColor: '#D45B62' },
  fieldMetaRow: { minHeight: 28, flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 5 },
  errorText: { flex: 1, color: '#B5454D', fontSize: 11.5, lineHeight: 17 },
  characterCount: { color: '#667D75', fontSize: 11.5 },
  saveButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 15, backgroundColor: '#F58220' },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.46 },
  modalScrollContent: { paddingHorizontal: 20, paddingBottom: 28 },
  privacyContent: { gap: 4, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  privacyPoint: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  privacyIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#E7F7FC' },
  privacyText: { flex: 1, color: '#4E675E', fontSize: 13, lineHeight: 19 },
  privacyCloseButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderRadius: 15, backgroundColor: '#168ACB' },
  privacyCloseText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  replayContent: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 24 },
  replayIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: '#FFF0E3' },
  replayDescription: { maxWidth: 420, marginTop: 18, color: '#536C63', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  replayActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 24 },
  replayCancelButton: { minHeight: 50, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C9D8D3', borderRadius: 15, backgroundColor: '#FFFFFF' },
  replayCancelText: { color: '#4F675E', fontSize: 14, fontWeight: '800' },
  replayConfirmButton: { minHeight: 50, flex: 1.35, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#F58220' },
  replayConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  skeletonContent: { paddingHorizontal: 18, paddingTop: 72 },
  skeletonLine: { height: 15, borderRadius: 8, backgroundColor: '#E3EEEA' },
  skeletonHeading: { width: 220, height: 34, marginTop: 12 },
  skeletonHero: { height: 190, marginTop: 22, borderRadius: 16, backgroundColor: '#EAF4F2' },
  skeletonList: { height: 296, marginTop: 12, borderRadius: 16, backgroundColor: '#EDF4F1' },
});
