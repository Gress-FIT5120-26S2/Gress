import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
import { dismissAllNotificationsAsync } from 'expo-notifications/build/dismissAllNotificationsAsync';
import { setBadgeCountAsync } from 'expo-notifications/build/setBadgeCountAsync';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { privacyCopy } from '../privacyCopy';
import { subscribeToIdentityErasure, suspendApiRequests } from '../services/apiClient';
import { clearErasedDeviceIdentity } from '../services/deviceId';

const context = createContext({ completeErasure: () => {} });
export const useDevicePrivacy = () => useContext(context);
const ERASED_KEY = '@kitchmemo/identity-erased:v1';
const clearNotifications = () => Promise.all([
  cancelAllScheduledNotificationsAsync().catch(() => undefined),
  dismissAllNotificationsAsync().catch(() => undefined), setBadgeCountAsync(0).catch(() => undefined),
]);

// Arthur: NarIyirm
// 中文：删除后卸载全部业务 Provider 并暂停请求，不自动创建新访客；用户重新开始时才清理本机身份与通知并重挂数据树。
// EN: Erasure unmounts all domain providers and suspends requests without creating a new guest; explicit restart clears local identity/notifications before remounting.
export function DevicePrivacyBoundary({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  const copy = privacyCopy(language);
  const [erased, setErased] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [checking, setChecking] = useState(true);
  const markerWrite = useRef(Promise.resolve());
  const completeErasure = useCallback(() => {
    suspendApiRequests(true); setErased(true);
    // Arthur: NarIyirm
    // 中文：重新开始先等待删除标记写完，防止迟到的写入覆盖已清除的状态。
    // EN: Restart waits for marker persistence so a late write cannot restore the erased state.
    markerWrite.current = markerWrite.current.then(() => AsyncStorage.setItem(ERASED_KEY, 'true')).catch(() => undefined);
    void clearNotifications();
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeToIdentityErasure(completeErasure);
    void AsyncStorage.getItem(ERASED_KEY).then(value => { if (value === 'true') completeErasure(); })
      .catch(() => undefined).finally(() => setChecking(false));
    return unsubscribe;
  }, [completeErasure]);
  const restart = async () => {
    setRestarting(true);
    try {
      await markerWrite.current;
      await clearErasedDeviceIdentity();
      await AsyncStorage.multiRemove(['kitchmemo:first-use-journey:v1', '@kitchmemo/inactivity-notification-id', '@kitchmemo/expiry-notification-map']);
      await clearNotifications();
      await AsyncStorage.removeItem(ERASED_KEY);
      setEpoch(value => value + 1); suspendApiRequests(false); setErased(false);
    } catch { Alert.alert(copy.failure, copy.failureBody); }
    finally { setRestarting(false); }
  };
  if (checking) return <View style={styles.screen}><ActivityIndicator color="#168ACB" /></View>;
  if (erased) return <View style={styles.screen}>
    <Text accessibilityRole="header" style={styles.title}>{copy.deleted}</Text><Text style={styles.body}>{copy.deletedBody}</Text>
    <Pressable accessibilityRole="button" disabled={restarting} style={styles.button} onPress={() => void restart()}>
      {restarting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{copy.startAgain}</Text>}
    </Pressable>
  </View>;
  return <context.Provider key={epoch} value={{ completeErasure }}>{children}</context.Provider>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 28, gap: 24, backgroundColor: '#F7FBFA' },
  title: { fontSize: 28, fontWeight: '800', color: '#173D31' }, body: { fontSize: 16, lineHeight: 25, color: '#38564B' },
  button: { minHeight: 52, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: '#168ACB' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
