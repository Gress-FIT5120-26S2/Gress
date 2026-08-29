import { getDeviceId } from './deviceId';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

type ApiError = {
  error?: string;
  message?: string;
};

export async function requestApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Arthur: NarIyirm
  // 中文：所有前端业务请求都通过同一入口携带 Device-ID 访问 Express，避免各业务模块重复处理环境地址、请求头和错误。
  // EN: All frontend domain requests use one Express client with Device-ID so modules do not duplicate environment, header, and error handling.
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured');

  const deviceId = await getDeviceId();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Device-ID': deviceId,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as T | ApiError | null;

  if (!response.ok) {
    const apiError = body as ApiError | null;
    throw new Error(apiError?.message ?? apiError?.error ?? `API request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return body as T;
}

export async function getApiHealth(): Promise<void> {
  const result = await requestApi<{ database?: string }>('/api/health');
  if (result.database !== 'connected') throw new Error('Supabase is not connected');
}
