import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const IOS_DEVICE_ID_KEY = 'gress_ios_device_id_v1';
const DEVICE_CREDENTIAL_KEY = 'gress_device_credential_v1';

let pendingDeviceId: Promise<string> | null = null;
let pendingDeviceCredential: Promise<string> | null = null;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

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

async function createOrReadDeviceCredential(): Promise<string> {
  const savedCredential = await SecureStore.getItemAsync(DEVICE_CREDENTIAL_KEY);
  if (savedCredential) return savedCredential;

  // Arthur: NarIyirm
  // 中文：设备凭证使用 Expo 57 原生安全随机数生成并保存在 SecureStore；Device-ID 不再单独构成授权。
  // EN: The device credential uses Expo 57 native secure randomness and is kept in SecureStore; Device-ID alone no longer authorises access.
  const credential = bytesToHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(DEVICE_CREDENTIAL_KEY, credential);
  return credential;
}

export function getDeviceCredential(): Promise<string> {
  if (!pendingDeviceCredential) {
    pendingDeviceCredential = createOrReadDeviceCredential().catch((error) => {
      pendingDeviceCredential = null;
      throw error;
    });
  }
  return pendingDeviceCredential;
}
