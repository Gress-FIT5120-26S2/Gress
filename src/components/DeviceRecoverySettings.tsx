import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../i18n';
import { createDeviceRecoveryCode, getFridgeAccessContext, recoverDevice } from '../services/sharingApi';

type PendingAction = 'create' | 'restore' | null;

// Arthur: NarIyirm
// 中文：设置页只保留换机恢复能力；共享冰箱的创建、加入和管理全部由冰箱页入口承载。
// EN: Settings retains only device recovery; creating, joining, and managing shared fridges now belongs entirely to the fridge-screen entry point.
// Arthur: NarIyirm
// 中文：设置页的设备恢复入口；上游由 Profile 设置挂载，下游调用 sharingApi 生成一次性码或转移旧设备身份。
// EN: This is the settings recovery surface; Profile settings mount it and sharingApi either creates a one-time code or transfers the old device identity.
export function DeviceRecoverySettings({ active, onContentChange }: { active: boolean; onContentChange?: () => void }) {
  const { t } = useI18n();
  const copy = t.settings.sharing;
  const [configured, setConfigured] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [restoreCode, setRestoreCode] = useState('');

  useEffect(() => {
    if (!active) return;
    getFridgeAccessContext().then((context) => setConfigured(context.recoveryConfigured)).catch(() => undefined);
  }, [active]);

  // Arthur: NarIyirm
  // 中文：生成和恢复共用此异步状态包装器，统一处理按钮禁用与错误展示，业务请求仍由 sharingApi 完成。
  // EN: Code creation and recovery share this async-state wrapper for disabled buttons and errors while sharingApi performs the domain request.
  const run = useCallback(async (action: Exclude<PendingAction, null>, task: () => Promise<void>) => {
    setPending(action);
    try {
      await task();
    } catch {
      Alert.alert(copy.errorTitle, copy.errorBody);
    } finally {
      setPending(null);
    }
  }, [copy.errorBody, copy.errorTitle]);

  const createCode = useCallback(() => {
    void run('create', async () => {
      const result = await createDeviceRecoveryCode();
      setRecoveryCode(result.recoveryCode);
      setConfigured(true);
      onContentChange?.();
    });
  }, [onContentChange, run]);

  const restore = useCallback(() => {
    const code = restoreCode.trim();
    if (!code) return;
    Alert.alert(copy.restoreConfirmTitle, copy.restoreConfirmBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.confirm,
        onPress: () => void run('restore', async () => {
          const result = await recoverDevice(code);
          setRecoveryCode(result.recoveryCode);
          setRestoreCode('');
          setConfigured(true);
          onContentChange?.();
        }),
      },
    ]);
  }, [copy, onContentChange, restoreCode, run]);

  return (
    <View style={styles.root}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}><Ionicons color="#168ACB" name="key-outline" size={19} /></View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{copy.recoveryTitle}</Text>
          <Text style={styles.description}>{copy.recoveryDescription}</Text>
        </View>
      </View>
      <Pressable disabled={pending !== null} onPress={createCode} style={styles.secondaryButton}>
        {pending === 'create' ? <ActivityIndicator color="#168ACB" /> : (
          <Text style={styles.secondaryButtonText}>{configured ? copy.rotateRecovery : copy.createRecovery}</Text>
        )}
      </Pressable>
      {recoveryCode ? (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>{copy.recoveryCode}</Text>
          <Text selectable style={styles.codeValue}>{recoveryCode}</Text>
          <Text style={styles.codeHint}>{copy.recoveryWarning}</Text>
        </View>
      ) : null}
      <Text style={styles.fieldLabel}>{copy.restoreLabel}</Text>
      <TextInput
        autoCapitalize="characters"
        autoCorrect={false}
        onChangeText={setRestoreCode}
        placeholder={copy.restorePlaceholder}
        placeholderTextColor="#9AAAB2"
        style={styles.input}
        value={restoreCode}
      />
      <Pressable disabled={!restoreCode.trim() || pending !== null} onPress={restore} style={[styles.secondaryButton, (!restoreCode.trim() || pending !== null) && styles.disabled]}>
        {pending === 'restore' ? <ActivityIndicator color="#168ACB" /> : <Text style={styles.secondaryButtonText}>{copy.restore}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 30, gap: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#EAF7FD' },
  headingCopy: { flex: 1, gap: 4 },
  title: { color: '#294957', fontSize: 15, fontWeight: '800' },
  description: { color: '#718590', fontSize: 13, lineHeight: 19 },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, borderColor: '#BFDDEA', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#168ACB', fontSize: 13, fontWeight: '800' },
  codeCard: { padding: 15, gap: 5, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#EAF7FD' },
  codeLabel: { color: '#34718E', fontSize: 11, fontWeight: '800' },
  codeValue: { color: '#234657', fontSize: 16, fontWeight: '900', letterSpacing: 1.2, lineHeight: 24 },
  codeHint: { color: '#688595', fontSize: 11, lineHeight: 16 },
  fieldLabel: { marginTop: 4, color: '#536D79', fontSize: 12, fontWeight: '800' },
  input: { minHeight: 46, paddingHorizontal: 14, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#D1E2E9', color: '#294957', backgroundColor: '#FFFFFF' },
  disabled: { opacity: 0.45 },
});
