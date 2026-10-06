import * as Crypto from 'expo-crypto';
import { requestApi } from './apiClient';
import { getDeviceCredential, getDeviceId } from './deviceId';
import { createLearningGateway, type LearningRequest } from './learningGateway';

const request: LearningRequest = async (path, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try { return await requestApi(path, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
};

// Arthur: NarIyirm
// 中文：每次打开创建本人专用适配器，凭证变化会清空内存状态；仅复用现有 Express 请求层，不建立 Supabase 客户端。
// EN: Each opening gets a personal adapter that clears memory on credential changes and reuses the Express client without creating a Supabase client.
export function createLearningApiGateway() {
  return createLearningGateway(request, () => Crypto.randomUUID(), async () => {
    const [device, credential] = await Promise.all([getDeviceId(), getDeviceCredential()]);
    return `${device}:${credential}`;
  });
}
