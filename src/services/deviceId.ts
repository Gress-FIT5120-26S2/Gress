import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const IOS_DEVICE_ID_KEY = 'gress_ios_device_id_v1';

let pendingDeviceId: Promise<string> | null = null;

/**
 * 获取设备标识：
 *
 * iOS:
 * - 第一次生成 UUID 并保存到 Keychain
 * - 后续直接从 Keychain 读取
 *
 * Android:
 * - 读取系统 ANDROID_ID
 */
async function createOrReadDeviceId(): Promise<string> {
  if (Platform.OS === 'ios') {
    const savedId = await SecureStore.getItemAsync(IOS_DEVICE_ID_KEY);

    if (savedId) {
      return savedId;
    }

    const newId = `ios_${Crypto.randomUUID()}`;

    await SecureStore.setItemAsync(IOS_DEVICE_ID_KEY, newId);

    return newId;
  }

  if (Platform.OS === 'android') {
    const androidId = Application.getAndroidId();

    if (!androidId) {
      throw new Error('Unable to read Android ID');
    }

    return `android_${androidId}`;
  }

  throw new Error(`Unsupported platform: ${Platform.OS}`);
}

/**
 * 防止多个组件同时调用时生成多个 iOS UUID
 */
export function getDeviceId(): Promise<string> {
  if (!pendingDeviceId) {
    pendingDeviceId = createOrReadDeviceId().catch(error => {
      pendingDeviceId = null;
      throw error;
    });
  }

  return pendingDeviceId;
}