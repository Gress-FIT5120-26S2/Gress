import { AppModal as Modal } from './RetainedTab';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { privacyCopy, privacyUrl } from '../privacyCopy';
import { AI_CONSENT_VERSION, registerAiConsentHandler } from '../services/aiConsentBridge';
import { requestApi } from '../services/apiClient';

// Arthur: NarIyirm
// 中文：同一时间只显示一个授权弹窗，所有并发 AI 请求等待同一选择；关闭、失败或卸载均默认拒绝。
// EN: Concurrent AI requests share one prompt and one choice; dismissals, failures and unmounts always default to denial.
export function PrivacyConsentProvider({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  const copy = privacyCopy(language);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const flight = useRef<Promise<boolean> | null>(null);
  const resolve = useRef<((allowed: boolean) => void) | null>(null);
  const mounted = useRef(true);
  const finish = useCallback((allowed: boolean) => {
    resolve.current?.(allowed); resolve.current = null;
    if (mounted.current) { setVisible(false); setSaving(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const unregister = registerAiConsentHandler(force => {
      if (flight.current) return flight.current;
      const pending = (async () => {
        if (!force) {
          const state = await requestApi<{ allowed: boolean; updatedAt: string | null }>('/api/privacy/ai-consent');
          if (state.allowed) return true;
          if (state.updatedAt) return false;
        }
        if (!mounted.current) return false;
        return new Promise<boolean>(done => { resolve.current = done; setVisible(true); });
      })().catch(() => false).finally(() => { if (flight.current === pending) flight.current = null; });
      flight.current = pending;
      return pending;
    });
    return () => { mounted.current = false; unregister(); finish(false); };
  }, [finish]);
  const save = async (allowed: boolean) => {
    setSaving(true);
    try {
      await requestApi('/api/privacy/ai-consent', { method: 'PUT', body: JSON.stringify({ allowed, version: AI_CONSENT_VERSION }) });
      finish(allowed);
    } catch { if (mounted.current) { setSaving(false); Alert.alert(copy.failure, copy.failureBody); } }
  };
  return <>{children}<Modal animationType="slide" visible={visible} onRequestClose={() => { if (!saving) finish(false); }}>
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
        <Text style={styles.intro}>{copy.intro}</Text><Text style={styles.body}>{copy.providers}</Text>
        <Text style={styles.body}>{copy.choice}</Text>
        <Pressable accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(privacyUrl(language)).catch(() => Alert.alert(copy.failure, copy.failureBody))}><Text style={styles.linkText}>{copy.policy}</Text></Pressable>
      </ScrollView>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving} style={styles.allow} onPress={() => void save(true)}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.allowText}>{copy.allow}</Text>}</Pressable>
        <Pressable accessibilityRole="button" disabled={saving} style={styles.decline} onPress={() => void save(false)}><Text style={styles.declineText}>{copy.decline}</Text></Pressable>
      </View>
    </SafeAreaView>
  </Modal></>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7FBFA' }, content: { padding: 24, gap: 22 },
  title: { color: '#173D31', fontSize: 28, fontWeight: '800' }, intro: { color: '#173D31', fontSize: 17, lineHeight: 25 },
  body: { color: '#38564B', fontSize: 15, lineHeight: 23 }, link: { minHeight: 48, justifyContent: 'center' },
  linkText: { color: '#126DA1', fontSize: 15, textDecorationLine: 'underline' }, actions: { padding: 20, gap: 10 },
  allow: { backgroundColor: '#168ACB', borderRadius: 15, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  allowText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, decline: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  declineText: { color: '#38564B', fontSize: 16, fontWeight: '700' },
});
