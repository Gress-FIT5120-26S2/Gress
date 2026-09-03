import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponseAsync,
  getLastNotificationResponseAsync,
} from 'expo-notifications/build/NotificationsEmitter';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setBadgeCountAsync } from 'expo-notifications/build/setBadgeCountAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { Platform } from 'react-native';
import type { AppLanguage } from '../i18n';
import type { InventoryBatch } from './inventoryApi';
import { registerNotificationDelivery, type NotificationPreferences } from './notificationApi';

const CHANNEL_ID = 'kitchmemo-reminders';
const INACTIVITY_NOTIFICATION_KEY = '@kitchmemo/inactivity-notification-id';
const EXPIRY_NOTIFICATION_KEY = '@kitchmemo/expiry-notification-map';
const INACTIVITY_DAYS = 7;
const EXPIRY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_EXPIRY_REMINDERS = 32;

// 中文：不要从 expo-notifications 入口导入。入口会执行 DevicePushTokenAutoRegistration，在 Android Expo Go 里直接红屏。
// EN: Do not import the expo-notifications barrel. It runs DevicePushTokenAutoRegistration and throws in Android Expo Go.
const isAndroidExpoGo = Platform.OS === 'android' && isRunningInExpoGo();

setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  // 中文：Android Expo Go 的 NotificationChannel 原生 provider 为空，调用会 NPE；开发构建里再创建自定义频道。
  // EN: Android Expo Go's notification-channel provider is null and NPEs; create the custom channel only in a dev/production build.
  if (Platform.OS !== 'android' || isAndroidExpoGo) return false;
  try {
    await setNotificationChannelAsync(CHANNEL_ID, {
      name: 'KitchMemo reminders',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: '#F58220',
      sound: 'default',
    });
    return true;
  } catch {
    return false;
  }
}

function projectId() {
  return Constants.easConfig?.projectId
    ?? Constants.expoConfig?.extra?.eas?.projectId
    ?? null;
}

async function registerPushToken(language: AppLanguage) {
  if (isAndroidExpoGo) return false;
  const easProjectId = projectId();
  if (!easProjectId || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return false;
  try {
    const { getExpoPushTokenAsync } = await import('expo-notifications/build/getExpoPushTokenAsync');
    const token = await getExpoPushTokenAsync({ projectId: easProjectId });
    await registerNotificationDelivery(token.data, Platform.OS, language);
    return true;
  } catch {
    // Arthur: NarIyirm
    // 中文：Expo Go 和模拟器可能允许本地提醒，但无法取得可用于远程投递的 Expo Push Token。
    // EN: Expo Go and simulators may grant local reminders but cannot issue a token for remote push delivery.
    return false;
  }
}

function notificationCopy(language: AppLanguage) {
  return language === 'zh'
    ? { title: '厨房里还有些新鲜事', body: '回来看看食材状态和共享冰箱的新动态吧。' }
    : { title: 'There is something fresh at home', body: 'Come back to check food status and shared-fridge updates.' };
}

function expiryCopy(language: AppLanguage, name: string) {
  return language === 'zh'
    ? { title: '冰箱食材临期提醒', body: `${name} 快到期了，记得优先安排。` }
    : { title: 'Fridge expiry reminder', body: `${name} is expiring soon. Remember to use it first.` };
}

function afterQuietHours(date: Date, preferences: NotificationPreferences) {
  if (!preferences.quietHoursEnabled) return date;
  const [startHour, startMinute] = preferences.quietHoursStart.split(':').map(Number);
  const [endHour, endMinute] = preferences.quietHoursEnd.split(':').map(Number);
  const current = date.getHours() * 60 + date.getMinutes();
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const isQuiet = start < end ? current >= start && current < end : current >= start || current < end;
  if (!isQuiet) return date;
  const adjusted = new Date(date);
  if (start > end && current >= start) adjusted.setDate(adjusted.getDate() + 1);
  adjusted.setHours(endHour, endMinute, 0, 0);
  return adjusted;
}

async function cancelInactivityReminder() {
  const identifier = await AsyncStorage.getItem(INACTIVITY_NOTIFICATION_KEY);
  if (!identifier) return;
  await cancelScheduledNotificationAsync(identifier).catch(() => undefined);
  await AsyncStorage.removeItem(INACTIVITY_NOTIFICATION_KEY);
}

// Arthur: NarIyirm
// 中文：每次活跃使用都把“久未回来”提醒顺延七天；真正连续未使用时系统才会展示一次原生通知。
// EN: Every active use pushes the return reminder seven days forward, so the native notification appears only after genuine inactivity.
export async function scheduleInactivityReminder(preferences: NotificationPreferences, language: AppLanguage) {
  await cancelInactivityReminder();
  if (Platform.OS === 'web'
      || !preferences.notificationsEnabled
      || !preferences.systemEnabled
      || !preferences.systemDeliveryEnabled) return;

  const permission = await getPermissionsAsync();
  if (permission.status !== 'granted') return;
  const useChannel = await ensureAndroidChannel();
  const copy = notificationCopy(language);
  const identifier = await scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      data: { screen: 'notifications', source: 'inactivity' },
      sound: 'default',
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: INACTIVITY_DAYS * 24 * 60 * 60,
      repeats: false,
      ...(useChannel ? { channelId: CHANNEL_ID } : {}),
    },
  });
  await AsyncStorage.setItem(INACTIVITY_NOTIFICATION_KEY, identifier);
}

// Arthur: NarIyirm
// 中文：每个有效批次只保留一条按“到期前三天”触发的本地系统提醒；日期变化、移除库存或关闭提醒时会精确取消旧任务。
// EN: Keep one local system reminder per active batch at three days before expiry, precisely cancelling it when the date changes, stock is removed, or reminders are disabled.
export async function scheduleExpiryReminders(batches: InventoryBatch[], preferences: NotificationPreferences, language: AppLanguage) {
  if (Platform.OS === 'web') return;
  const stored = await AsyncStorage.getItem(EXPIRY_NOTIFICATION_KEY);
  let previous: Record<string, { expiresAt: string; identifier: string }> = {};
  try {
    const parsed = stored ? JSON.parse(stored) : {};
    previous = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    previous = {};
  }
  const permission = await getPermissionsAsync();
  const enabled = permission.status === 'granted'
    && preferences.notificationsEnabled
    && preferences.expiringEnabled
    && preferences.systemDeliveryEnabled;
  const upcoming = enabled
    ? batches
      .filter((batch) => batch.expiresAt && new Date(batch.expiresAt).getTime() > Date.now())
      .sort((left, right) => new Date(left.expiresAt!).getTime() - new Date(right.expiresAt!).getTime())
      .slice(0, MAX_EXPIRY_REMINDERS)
    : [];
  const upcomingById = new Map(upcoming.map((batch) => [batch.id, batch]));

  for (const [batchId, entry] of Object.entries(previous)) {
    const batch = upcomingById.get(batchId);
    if (batch?.expiresAt === entry.expiresAt) continue;
    await cancelScheduledNotificationAsync(entry.identifier).catch(() => undefined);
    delete previous[batchId];
  }
  if (!enabled) {
    await AsyncStorage.removeItem(EXPIRY_NOTIFICATION_KEY);
    return;
  }

  const useChannel = await ensureAndroidChannel();
  for (const batch of upcoming) {
    if (!batch.expiresAt || previous[batch.id]?.expiresAt === batch.expiresAt) continue;
    const expiryAt = new Date(batch.expiresAt);
    const ideal = new Date(expiryAt.getTime() - EXPIRY_WINDOW_MS);
    const triggerDate = afterQuietHours(new Date(Math.max(ideal.getTime(), Date.now() + 5_000)), preferences);
    if (triggerDate >= expiryAt) continue;
    const copy = expiryCopy(language, batch.name);
    const identifier = await scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        data: { batchUid: batch.id, screen: 'notifications', source: 'expiring' },
        sound: 'default',
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        ...(useChannel ? { channelId: CHANNEL_ID } : {}),
      },
    });
    previous[batch.id] = { expiresAt: batch.expiresAt, identifier };
  }
  await AsyncStorage.setItem(EXPIRY_NOTIFICATION_KEY, JSON.stringify(previous));
}

export async function enableSystemNotificationDelivery(language: AppLanguage) {
  if (Platform.OS === 'web') return { granted: false, tokenRegistered: false };
  await ensureAndroidChannel();
  let permission = await getPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  if (permission.status !== 'granted') return { granted: false, tokenRegistered: false };
  return { granted: true, tokenRegistered: await registerPushToken(language) };
}

export async function refreshSystemNotificationDelivery(preferences: NotificationPreferences, language: AppLanguage) {
  if (!preferences.systemDeliveryEnabled || Platform.OS === 'web') {
    await cancelInactivityReminder();
    return;
  }
  const permission = await getPermissionsAsync();
  if (permission.status !== 'granted') return;
  await ensureAndroidChannel();
  await registerPushToken(language);
  await scheduleInactivityReminder(preferences, language);
}

export const setSystemNotificationBadge = (count: number) =>
  Platform.OS === 'web' ? Promise.resolve(false) : setBadgeCountAsync(Math.max(0, count));

export const addSystemNotificationResponseListener = (onOpenNotifications: (notificationId?: string) => void) =>
  addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.screen === 'notifications') onOpenNotifications(typeof data.notificationId === 'string' ? data.notificationId : undefined);
  });

export async function openLastSystemNotification(onOpenNotifications: (notificationId?: string) => void) {
  const response = await getLastNotificationResponseAsync();
  const data = response?.notification.request.content.data;
  if (data?.screen === 'notifications') {
    onOpenNotifications(typeof data.notificationId === 'string' ? data.notificationId : undefined);
    await clearLastNotificationResponseAsync();
  }
}
