import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const IOS_DEVICE_ID_KEY = 'gress_ios_device_id_v1';
const ANDROID_DEVICE_ID_KEY = 'gress_android_device_id_v2';
const DEVICE_CREDENTIAL_KEY = 'gress_device_credential_v1';

type DeviceIdentity = {
  credential: string;
  deviceId: string;
};

let pendingDeviceIdentity: Promise<DeviceIdentity> | null = null;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function createOrReadDeviceIdentity(): Promise<DeviceIdentity> {
  const savedCredential = await SecureStore.getItemAsync(DEVICE_CREDENTIAL_KEY);
  const credential = savedCredential ?? bytesToHex(await Crypto.getRandomBytesAsync(32));

  if (Platform.OS === 'ios') {
    const savedId = await SecureStore.getItemAsync(IOS_DEVICE_ID_KEY);
    const deviceId = savedId ?? `ios_${Crypto.randomUUID()}`;
    await Promise.all([
      savedId ? Promise.resolve() : SecureStore.setItemAsync(IOS_DEVICE_ID_KEY, deviceId),
      savedCredential ? Promise.resolve() : SecureStore.setItemAsync(DEVICE_CREDENTIAL_KEY, credential),
    ]);
    return { credential, deviceId };
  }

  if (Platform.OS === 'android') {
    const savedId = await SecureStore.getItemAsync(ANDROID_DEVICE_ID_KEY);
    let deviceId = savedId;

    if (!deviceId && savedCredential) {
      const androidId = Application.getAndroidId();
      if (!androidId) throw new Error('Unable to read Android ID');

      // Arthur: NarIyirm
      // 中文：已有凭证说明这是覆盖升级；首次迁移继续使用旧 ANDROID_ID，避免现有冰箱被误识别成新安装。
      // EN: An existing credential identifies an in-place upgrade, so the first migration preserves the legacy ANDROID_ID and its fridge membership.
      deviceId = `android_${androidId}`;
    }

    // Arthur: NarIyirm
    // 中文：全新或卸载重装时 ID 与凭证一同生成并保存在 SecureStore；两者同生共灭，避免旧 ANDROID_ID 搭配新凭证造成永久 401。
    // EN: Fresh and reinstalled apps create the ID and credential together in SecureStore so their lifecycles match and cannot form a stale-ID/new-credential 401 pair.
    deviceId ??= `android_${Crypto.randomUUID()}`;
    await Promise.all([
      savedId ? Promise.resolve() : SecureStore.setItemAsync(ANDROID_DEVICE_ID_KEY, deviceId),
      savedCredential ? Promise.resolve() : SecureStore.setItemAsync(DEVICE_CREDENTIAL_KEY, credential),
    ]);
    return { credential, deviceId };
  }

  throw new Error(`Unsupported platform: ${Platform.OS}`);
}

function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (!pendingDeviceIdentity) {
    // Arthur: NarIyirm
    // 中文：ID 与凭证共享一次初始化，避免并发挂载时分别生成不配套的身份字段。
    // EN: Device ID and credential share one initialization so concurrent mounts cannot generate an unmatched identity pair.
    pendingDeviceIdentity = createOrReadDeviceIdentity().catch((error) => {
      pendingDeviceIdentity = null;
      throw error;
    });
  }
  return pendingDeviceIdentity;
}

export async function getDeviceId(): Promise<string> {
  return (await getDeviceIdentity()).deviceId;
}

export async function getDeviceCredential(): Promise<string> {
  return (await getDeviceIdentity()).credential;
}
