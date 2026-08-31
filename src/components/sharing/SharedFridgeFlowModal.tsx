import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ExpoSharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import { useI18n } from '../../i18n';
import { getApiErrorCode } from '../../services/apiClient';
import {
  activateSharedFridge,
  createFridgeInvite,
  joinSharedFridge,
  leaveSharedFridge,
  renameCurrentFridge,
  type FridgeAccessContext,
} from '../../services/sharingApi';

export type SharedFridgeFlowScreen = 'create' | 'join' | 'manage' | 'share';

type SharedFridgeFlowModalProps = {
  context: FridgeAccessContext | null;
  initialScreen: SharedFridgeFlowScreen;
  onClose: () => void;
  onContextChanged: (context: FridgeAccessContext) => void | Promise<void>;
  visible: boolean;
};

const BLUE = '#168ACB';
const DARK = '#234657';
const PALE = '#EAF7FD';

function rawInviteCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function formatInviteCode(value: string) {
  const raw = rawInviteCode(value);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

function invitePayload(code: string) {
  return `kitchmemo://join?code=${rawInviteCode(code)}`;
}

function extractInviteCode(value: string) {
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    return rawInviteCode(parsed.searchParams.get('code') ?? '');
  } catch {
    const marker = trimmed.toLowerCase().indexOf('code=');
    return rawInviteCode(marker >= 0 ? trimmed.slice(marker + 5) : trimmed);
  }
}

function ScreenHeader({ onBack, title }: { onBack: () => void; title: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel={t.fridge.sharing.back} accessibilityRole="button" onPress={onBack} style={styles.headerButton}>
        <Ionicons color={DARK} name="chevron-back" size={24} />
      </Pressable>
      <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}><Ionicons color={BLUE} name={icon} size={19} /></View>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

// Arthur: NarIyirm
// 中文：创建、管理、分享、加入和扫码共用一个原生全屏流程；成功后统一把最新冰箱上下文交回库存页刷新。
// EN: Creation, management, sharing, joining, and scanning share one native full-screen flow; every success returns fresh fridge context for inventory refresh.
export function SharedFridgeFlowModal({
  context,
  initialScreen,
  onClose,
  onContextChanged,
  visible,
}: SharedFridgeFlowModalProps) {
  const { language, t } = useI18n();
  const copy = t.fridge.sharing;
  const [screen, setScreen] = useState<SharedFridgeFlowScreen | 'scan'>(initialScreen);
  const [currentContext, setCurrentContext] = useState(context);
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [pending, setPending] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const qrCardRef = useRef<View>(null);

  useEffect(() => {
    if (!visible) return;
    setScreen(initialScreen);
    setCurrentContext(context);
    setName(initialScreen === 'create' ? '' : (context?.fridge.name ?? ''));
    setJoinCode('');
    setPending(false);
    setEditingName(false);
    setScanLocked(false);
  }, [context, initialScreen, visible]);

  const activeInvite = currentContext?.activeInvite ?? null;
  const formattedCode = activeInvite ? formatInviteCode(activeInvite.code) : '';
  const qrValue = activeInvite ? invitePayload(activeInvite.code) : '';
  const expiresLabel = useMemo(() => {
    if (!activeInvite) return '';
    return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-AU', {
      day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short',
    }).format(new Date(activeInvite.expiresAt));
  }, [activeInvite, language]);
  const remainingDays = activeInvite
    ? Math.max(0, Math.ceil((new Date(activeInvite.expiresAt).getTime() - Date.now()) / 86_400_000))
    : 0;

  const commitContext = useCallback(async (next: FridgeAccessContext) => {
    setCurrentContext(next);
    setName(next.fridge.name);
    await onContextChanged(next);
  }, [onContextChanged]);

  const run = useCallback(async (task: () => Promise<void>, errorMessage?: (error: unknown) => string) => {
    setPending(true);
    try {
      await task();
    } catch (error) {
      Alert.alert(copy.errorTitle, errorMessage?.(error) ?? copy.errorBody);
    } finally {
      setPending(false);
    }
  }, [copy.errorBody, copy.errorTitle]);

  const joinErrorMessage = useCallback((error: unknown) => {
    const code = getApiErrorCode(error);
    if (code === 'invite_expired') return copy.joinErrorExpired;
    if (code === 'invite_used') return copy.joinErrorUsed;
    if (code === 'invite_revoked' || code === 'invite_unavailable') return copy.joinErrorRevoked;
    if (code === 'invite_not_found' || code === 'invalid_invite_code') return copy.joinErrorNotFound;
    if (code === 'already_in_fridge') return copy.joinErrorAlreadyMember;
    if (code === 'source_must_be_personal' || code === 'source_must_have_one_member') return copy.joinErrorPersonalRequired;
    if (code === 'target_fridge_unavailable') return copy.joinErrorTargetUnavailable;
    return copy.errorBody;
  }, [copy]);

  const create = useCallback(() => {
    const nextName = name.trim();
    if (!nextName) return;
    void run(async () => {
      const next = await activateSharedFridge(nextName);
      await commitContext(next);
      setScreen('share');
    });
  }, [commitContext, name, run]);

  const regenerate = useCallback(() => {
    void run(async () => {
      const next = await createFridgeInvite();
      await commitContext(next);
    });
  }, [commitContext, run]);

  const saveName = useCallback(() => {
    const nextName = name.trim();
    if (!nextName) return;
    void run(async () => {
      const next = await renameCurrentFridge(nextName);
      await commitContext(next);
      setEditingName(false);
    });
  }, [commitContext, name, run]);

  const join = useCallback(() => {
    const code = rawInviteCode(joinCode);
    if (code.length !== 8) return;
    Alert.alert(copy.joinConfirmTitle, copy.joinConfirmBody, [
      { text: copy.back, style: 'cancel' },
      {
        text: copy.confirmJoin,
        onPress: () => void run(async () => {
          const next = await joinSharedFridge(code);
          await commitContext(next);
          onClose();
        }, joinErrorMessage),
      },
    ]);
  }, [commitContext, copy, joinCode, joinErrorMessage, onClose, run]);

  const leave = useCallback(() => {
    Alert.alert(copy.leaveTitle, copy.leaveBody, [
      { text: copy.back, style: 'cancel' },
      {
        text: copy.leaveConfirm,
        style: 'destructive',
        onPress: () => void run(async () => {
          const next = await leaveSharedFridge();
          await commitContext(next);
          onClose();
        }),
      },
    ]);
  }, [commitContext, copy, onClose, run]);

  const shareText = useCallback(async () => {
    if (!activeInvite) return;
    await Share.share({
      message: `${currentContext?.fridge.name ?? copy.family}\n${copy.inviteCode}: ${formattedCode}\n${qrValue}`,
    });
  }, [activeInvite, copy.family, copy.inviteCode, currentContext?.fridge.name, formattedCode, qrValue]);

  const copyCode = useCallback(async () => {
    if (!activeInvite) return;
    await Clipboard.setStringAsync(formattedCode);
    Alert.alert(copy.copied);
  }, [activeInvite, copy.copied, formattedCode]);

  const shareQr = useCallback(async () => {
    if (!activeInvite || !qrCardRef.current) return;
    try {
      const uri = await captureRef(qrCardRef, { format: 'png', quality: 1 });
      if (await ExpoSharing.isAvailableAsync()) {
        await ExpoSharing.shareAsync(uri, { dialogTitle: copy.shareQr, mimeType: 'image/png' });
      } else {
        await shareText();
      }
    } catch {
      await shareText();
    }
  }, [activeInvite, copy.shareQr, shareText]);

  const scan = useCallback(({ data }: { data: string }) => {
    if (scanLocked) return;
    const code = extractInviteCode(data);
    if (code.length !== 8) {
      setScanLocked(true);
      Alert.alert(copy.invalidQr, undefined, [{ text: copy.back, onPress: () => setScanLocked(false) }]);
      return;
    }
    setScanLocked(true);
    setJoinCode(formatInviteCode(code));
    setScreen('join');
  }, [copy.back, copy.invalidQr, scanLocked]);

  const goBack = useCallback(() => {
    if (screen === 'scan') {
      setScanLocked(false);
      setScreen('join');
      return;
    }
    onClose();
  }, [onClose, screen]);

  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 50;

  return (
    <Modal animationType="slide" onRequestClose={goBack} presentationStyle="fullScreen" statusBarTranslucent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: topInset }]}>
        {screen === 'scan' ? (
          <Scanner
            copy={copy}
            locked={scanLocked}
            onBack={goBack}
            onScan={scan}
            permission={cameraPermission}
            requestPermission={requestCameraPermission}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {screen === 'create' ? (
              <>
                <ScreenHeader onBack={goBack} title={copy.createTitle} />
                <View style={styles.createHero}>
                  <Image
                    accessibilityLabel={copy.createTitle}
                    contentFit="contain"
                    source={require('../../../assets/shared-fridge-family.png')}
                    style={styles.createHeroImage}
                    transition={180}
                  />
                </View>
                <Text style={styles.pageTitle}>{copy.createTitle}</Text>
                <Text style={styles.pageSubtitle}>{copy.createSubtitle}</Text>
                <Text style={styles.fieldLabel}>{copy.nameLabel}</Text>
                <View style={styles.nameInputRow}>
                  <MaterialCommunityIcons color={BLUE} name="fridge-outline" size={23} />
                  <TextInput
                    autoFocus
                    maxLength={80}
                    onChangeText={setName}
                    placeholder={copy.namePlaceholder}
                    placeholderTextColor="#91A8B4"
                    returnKeyType="done"
                    style={styles.nameInput}
                    value={name}
                  />
                </View>
                <Text style={styles.fieldHint}>{copy.nameHint}</Text>
                <View style={styles.infoCard}>
                  <Text style={styles.cardTitle}>{copy.createInfoTitle}</Text>
                  <InfoRow icon="cube-outline" text={copy.createInfoInventory} />
                  <InfoRow icon="qr-code-outline" text={copy.createInfoInvite} />
                  <InfoRow icon="people-outline" text={copy.createInfoTogether} />
                </View>
                <Pressable disabled={!name.trim() || pending} onPress={create} style={[styles.primaryButton, (!name.trim() || pending) && styles.disabled]}>
                  {pending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{copy.create}</Text>}
                </Pressable>
              </>
            ) : null}

            {screen === 'share' ? (
              <>
                <ScreenHeader onBack={goBack} title={copy.createdTitle} />
                <View style={styles.successHeader}>
                  <View style={styles.successIcon}><Ionicons color={BLUE} name="checkmark" size={26} /></View>
                  <View style={styles.successCopy}>
                    <Text numberOfLines={1} style={styles.successName}>{currentContext?.fridge.name}</Text>
                    <Text style={styles.pageSubtitle}>{copy.createdSubtitle}</Text>
                  </View>
                </View>
                {activeInvite ? (
                  <View collapsable={false} ref={qrCardRef} style={styles.qrCard}>
                    <QRCode backgroundColor="#FFFFFF" color={DARK} size={190} value={qrValue} />
                    <Text style={styles.inviteLabel}>{copy.inviteCode}</Text>
                    <Text selectable style={styles.inviteCode}>{formattedCode}</Text>
                    <Text style={styles.expiryText}>{copy.inviteExpiry(expiresLabel)}</Text>
                  </View>
                ) : null}
                <View style={styles.twoActions}>
                  <Pressable onPress={() => { void shareText(); }} style={styles.primaryHalf}>
                    <Ionicons color="#FFFFFF" name="share-social-outline" size={20} />
                    <Text style={styles.primaryButtonText}>{copy.shareInvite}</Text>
                  </Pressable>
                  <Pressable onPress={() => { void copyCode(); }} style={styles.secondaryHalf}>
                    <Ionicons color={BLUE} name="copy-outline" size={20} />
                    <Text style={styles.secondaryButtonText}>{copy.copyInvite}</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => { void shareQr(); }} style={styles.outlineButton}>
                  <Ionicons color={BLUE} name="qr-code-outline" size={20} />
                  <Text style={styles.secondaryButtonText}>{copy.shareQr}</Text>
                </Pressable>
                <Text style={styles.privacyText}>{copy.invitePrivacy}</Text>
                <Pressable onPress={onClose} style={styles.textButton}><Text style={styles.textButtonText}>{copy.enterFamily}</Text></Pressable>
              </>
            ) : null}

            {screen === 'manage' ? (
              <>
                <ScreenHeader onBack={goBack} title={copy.manageTitle} />
                <View style={styles.manageHero}>
                  <View style={styles.manageIcon}><MaterialCommunityIcons color={BLUE} name="fridge-outline" size={31} /></View>
                  <View style={styles.manageCopy}>
                    {editingName ? (
                      <TextInput maxLength={80} onChangeText={setName} style={styles.renameInput} value={name} />
                    ) : <Text numberOfLines={1} style={styles.manageName}>{currentContext?.fridge.name}</Text>}
                    <Text style={styles.manageMeta}>{copy.sharedMeta(currentContext?.fridge.memberCount ?? 0)}</Text>
                  </View>
                  <Pressable onPress={editingName ? saveName : () => setEditingName(true)} style={styles.smallAction}>
                    {pending && editingName ? <ActivityIndicator color={BLUE} /> : <Ionicons color={BLUE} name={editingName ? 'checkmark' : 'pencil-outline'} size={20} />}
                  </Pressable>
                </View>

                <Text style={styles.sectionTitle}>{copy.membersTitle}</Text>
                <View style={styles.listCard}>
                  {(currentContext?.members ?? []).map((member) => (
                    <View key={`${member.index}-${member.joinedAt}`} style={styles.memberRow}>
                      <View style={styles.memberIcon}><Ionicons color={BLUE} name="phone-portrait-outline" size={21} /></View>
                      <View style={styles.memberCopy}>
                        <Text style={styles.memberName}>{member.isCurrent ? copy.currentDevice : copy.deviceLabel(member.index)}</Text>
                        <Text style={styles.memberMeta}>{copy.joinedAt(new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-AU', { day: 'numeric', month: 'short' }).format(new Date(member.joinedAt)))}</Text>
                      </View>
                      {member.isCurrent ? <View style={styles.currentDot} /> : null}
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>{copy.inviteFamily}</Text>
                <View style={styles.inviteManageCard}>
                  {activeInvite ? (
                    <>
                      <QRCode backgroundColor="#FFFFFF" color={DARK} size={70} value={qrValue} />
                      <View style={styles.inviteManageCopy}>
                        <Text style={styles.smallLabel}>{copy.inviteCode}</Text>
                        <Text style={styles.manageCode}>{formattedCode}</Text>
                        <Text style={styles.remainingText}>{copy.inviteRemaining(remainingDays)}</Text>
                      </View>
                      <Pressable onPress={() => setScreen('share')} style={styles.shareCircle}><Ionicons color="#FFFFFF" name="share-social-outline" size={20} /></Pressable>
                    </>
                  ) : <Text style={styles.noInvite}>{copy.noInvite}</Text>}
                </View>
                <Pressable disabled={pending} onPress={regenerate} style={styles.outlineButton}>
                  {pending ? <ActivityIndicator color={BLUE} /> : <Ionicons color={BLUE} name="refresh-outline" size={20} />}
                  <Text style={styles.secondaryButtonText}>{copy.regenerate}</Text>
                </Pressable>
                <Text style={styles.centerHint}>{copy.regenerateHint}</Text>

                <Text style={styles.sectionTitle}>{copy.dataOwnership}</Text>
                <View style={styles.ownershipCard}>
                  <Ionicons color={BLUE} name="shield-checkmark-outline" size={28} />
                  <Text style={styles.ownershipText}>{copy.ownershipHint}</Text>
                </View>
                <Pressable disabled={pending} onPress={leave} style={styles.dangerButton}>
                  <Text style={styles.dangerText}>{copy.leave}</Text>
                </Pressable>
              </>
            ) : null}

            {screen === 'join' ? (
              <>
                <ScreenHeader onBack={goBack} title={copy.joinTitle} />
                <Text style={styles.joinTitle}>{copy.joinHeading}</Text>
                <Text style={styles.joinSubtitle}>{copy.joinSubtitle}</Text>
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={9}
                  onChangeText={(value) => setJoinCode(formatInviteCode(value))}
                  placeholder={copy.codePlaceholder}
                  placeholderTextColor="#AAC0CA"
                  returnKeyType="done"
                  style={styles.codeInput}
                  value={joinCode}
                />
                <Pressable disabled={rawInviteCode(joinCode).length !== 8 || pending} onPress={join} style={[styles.primaryButton, (rawInviteCode(joinCode).length !== 8 || pending) && styles.disabled]}>
                  {pending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{copy.confirmJoin}</Text>}
                </Pressable>
                <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>{copy.or}</Text><View style={styles.orLine} /></View>
                <Pressable onPress={() => { setScanLocked(false); setScreen('scan'); }} style={styles.scanCard}>
                  <View style={styles.scanIcon}><Ionicons color={BLUE} name="scan-outline" size={38} /></View>
                  <Text style={styles.scanTitle}>{copy.scanQr}</Text>
                  <Text style={styles.scanHint}>{copy.scanHint}</Text>
                </Pressable>
                <View style={styles.infoCard}>
                  <Text style={styles.cardTitle}>{copy.joinInfoTitle}</Text>
                  <InfoRow icon="git-merge-outline" text={copy.joinInfoMerge} />
                  <InfoRow icon="cube-outline" text={copy.joinInfoOwner} />
                  <InfoRow icon="return-down-back-outline" text={copy.joinInfoLeave} />
                </View>
                <Text style={styles.privacyText}>{copy.joinPrivacy}</Text>
              </>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Scanner({
  copy,
  locked,
  onBack,
  onScan,
  permission,
  requestPermission,
}: {
  copy: ReturnType<typeof useI18n>['t']['fridge']['sharing'];
  locked: boolean;
  onBack: () => void;
  onScan: (result: { data: string }) => void;
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: ReturnType<typeof useCameraPermissions>[1];
}) {
  if (!permission) return <View style={styles.scannerState}><ActivityIndicator color={BLUE} /></View>;
  if (!permission.granted) {
    return (
      <View style={styles.scannerState}>
        <View style={styles.heroIcon}><Ionicons color={BLUE} name="camera-outline" size={42} /></View>
        <Text style={styles.pageTitle}>{copy.scannerPermissionTitle}</Text>
        <Text style={styles.permissionBody}>{copy.scannerPermissionBody}</Text>
        <Pressable onPress={() => { void requestPermission(); }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{copy.grantCamera}</Text></Pressable>
        <Pressable onPress={onBack} style={styles.textButton}><Text style={styles.textButtonText}>{copy.back}</Text></Pressable>
      </View>
    );
  }
  return (
    <View style={styles.scannerRoot}>
      <CameraView
        active
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        facing="back"
        onBarcodeScanned={locked ? undefined : onScan}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.scannerShade} />
      <View style={styles.scannerTopBar}>
        <Pressable onPress={onBack} style={styles.scannerClose}><Ionicons color="#FFFFFF" name="chevron-back" size={26} /></Pressable>
        <Text style={styles.scannerHeading}>{copy.scannerTitle}</Text>
        <View style={styles.scannerClose} />
      </View>
      <View pointerEvents="none" style={styles.scannerGuide}>
        <View style={styles.scanFrame} />
        <Text style={styles.scannerHint}>{copy.scanHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5FBFE' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 42 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#FFFFFF' },
  headerTitle: { flex: 1, paddingHorizontal: 12, color: DARK, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  heroIcon: { width: 82, height: 82, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 24, borderRadius: 28, borderCurve: 'continuous', backgroundColor: PALE },
  createHero: { width: '100%', height: 184, alignSelf: 'center', marginTop: 4 },
  createHeroImage: { width: '100%', height: '100%' },
  pageTitle: { marginTop: 20, color: DARK, fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.7 },
  pageSubtitle: { marginTop: 7, color: '#728996', fontSize: 14, lineHeight: 20 },
  fieldLabel: { marginTop: 34, color: DARK, fontSize: 14, fontWeight: '800' },
  nameInputRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 10, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#A8D8EE', borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  nameInput: { flex: 1, minWidth: 0, color: DARK, fontSize: 17, fontWeight: '700' },
  fieldHint: { marginTop: 8, color: '#8095A0', fontSize: 12 },
  infoCard: { gap: 2, marginTop: 28, padding: 18, borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  cardTitle: { marginBottom: 8, color: DARK, fontSize: 16, fontWeight: '800' },
  infoRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: PALE },
  infoText: { flex: 1, color: '#526D7A', fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', marginTop: 24, paddingHorizontal: 20, borderRadius: 18, borderCurve: 'continuous', backgroundColor: BLUE },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.42 },
  successHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, padding: 18, borderRadius: 22, backgroundColor: PALE },
  successIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#FFFFFF' },
  successCopy: { flex: 1 },
  successName: { color: DARK, fontSize: 24, fontWeight: '900' },
  qrCard: { alignItems: 'center', marginTop: 20, padding: 24, borderRadius: 24, backgroundColor: '#FFFFFF' },
  inviteLabel: { marginTop: 17, color: '#7B909B', fontSize: 12, fontWeight: '700' },
  inviteCode: { marginTop: 5, color: DARK, fontSize: 30, fontWeight: '900', letterSpacing: 3 },
  expiryText: { marginTop: 7, color: '#728996', fontSize: 12 },
  twoActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryHalf: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 17, backgroundColor: BLUE },
  secondaryHalf: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 17, backgroundColor: PALE },
  secondaryButtonText: { color: '#167FB7', fontSize: 14, fontWeight: '800' },
  outlineButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, borderWidth: 1, borderColor: '#A8D8EE', borderRadius: 17, backgroundColor: '#FFFFFF' },
  privacyText: { marginTop: 14, paddingHorizontal: 10, color: '#8397A1', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  textButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  textButtonText: { color: BLUE, fontSize: 14, fontWeight: '800' },
  manageHero: { minHeight: 102, flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 14, padding: 17, borderRadius: 22, backgroundColor: PALE },
  manageIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#FFFFFF' },
  manageCopy: { flex: 1, minWidth: 0 },
  manageName: { color: DARK, fontSize: 22, fontWeight: '900' },
  manageMeta: { marginTop: 5, color: '#708996', fontSize: 12 },
  renameInput: { minHeight: 42, paddingHorizontal: 11, borderRadius: 12, color: DARK, fontSize: 16, fontWeight: '800', backgroundColor: '#FFFFFF' },
  smallAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#FFFFFF' },
  sectionTitle: { marginTop: 28, marginBottom: 10, color: DARK, fontSize: 16, fontWeight: '800' },
  listCard: { overflow: 'hidden', borderRadius: 20, backgroundColor: '#FFFFFF' },
  memberRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1ECF1' },
  memberIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: PALE },
  memberCopy: { flex: 1 },
  memberName: { color: DARK, fontSize: 14, fontWeight: '800' },
  memberMeta: { marginTop: 3, color: '#8297A2', fontSize: 11 },
  currentDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: BLUE },
  inviteManageCard: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF' },
  inviteManageCopy: { flex: 1 },
  smallLabel: { color: '#8094A0', fontSize: 11, fontWeight: '700' },
  manageCode: { marginTop: 4, color: DARK, fontSize: 20, fontWeight: '900', letterSpacing: 1.5 },
  remainingText: { marginTop: 4, color: BLUE, fontSize: 11, fontWeight: '700' },
  shareCircle: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: BLUE },
  noInvite: { flex: 1, color: '#728996', fontSize: 13, textAlign: 'center' },
  centerHint: { marginTop: 7, color: '#879AA4', fontSize: 11, textAlign: 'center' },
  ownershipCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 17, borderRadius: 20, backgroundColor: PALE },
  ownershipText: { flex: 1, color: '#526D7A', fontSize: 12, lineHeight: 18 },
  dangerButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 26, borderRadius: 17, backgroundColor: '#FFF0EF' },
  dangerText: { color: '#C45249', fontSize: 14, fontWeight: '800' },
  joinTitle: { marginTop: 26, color: DARK, fontSize: 27, fontWeight: '900', textAlign: 'center', letterSpacing: -0.7 },
  joinSubtitle: { marginTop: 8, color: '#728996', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  codeInput: { minHeight: 70, marginTop: 28, paddingHorizontal: 18, borderWidth: 1.5, borderColor: '#A8D8EE', borderRadius: 20, color: DARK, fontSize: 28, fontWeight: '800', letterSpacing: 5, textAlign: 'center', backgroundColor: '#FFFFFF' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 24 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#CFE0E8' },
  orText: { color: '#8CA0AA', fontSize: 13 },
  scanCard: { alignItems: 'center', padding: 24, borderRadius: 22, backgroundColor: '#FFFFFF' },
  scanIcon: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: PALE },
  scanTitle: { marginTop: 14, color: DARK, fontSize: 17, fontWeight: '800' },
  scanHint: { marginTop: 5, color: '#7E939E', fontSize: 12 },
  scannerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#F5FBFE' },
  permissionBody: { maxWidth: 300, marginTop: 10, color: '#728996', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  scannerRoot: { flex: 1, backgroundColor: '#0A1820' },
  scannerShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3, 20, 29, 0.24)' },
  scannerTopBar: { position: 'absolute', top: 12, left: 18, right: 18, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scannerClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(12, 38, 50, 0.54)' },
  scannerHeading: { flex: 1, paddingHorizontal: 10, color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  scannerGuide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 260, height: 260, borderWidth: 3, borderColor: '#9FE2FF', borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)' },
  scannerHint: { marginTop: 24, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, overflow: 'hidden', color: '#FFFFFF', fontSize: 13, fontWeight: '700', backgroundColor: 'rgba(12, 38, 50, 0.62)' },
});
