import { getDeviceCredential, getDeviceId } from './deviceId';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

type ApiError = {
  error?: string;
  message?: string;
};

// Arthur: NarIyirm
// 中文：保留服务端稳定错误码供页面本地化展示，同时维持 Error.message 兼容现有调用方。
// EN: Preserve stable server codes for localized UI while retaining Error.message compatibility for existing callers.
export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function getApiErrorCode(error: unknown) {
  return error instanceof ApiRequestError ? error.code : null;
}

export async function requestApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Arthur: NarIyirm
  // 中文：所有前端业务请求都通过同一入口携带 Device-ID 访问 Express，避免各业务模块重复处理环境地址、请求头和错误。
  // EN: All frontend domain requests use one Express client with Device-ID so modules do not duplicate environment, header, and error handling.
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured');

  const [deviceId, deviceCredential] = await Promise.all([getDeviceId(), getDeviceCredential()]);
  // Arthur: NarIyirm
  // 中文：上传照片时让 fetch 自动设置 multipart boundary；其余请求体仍使用 JSON，可恢复错误交给页面展示而不是触发红色开发错误屏。
  // EN: Let fetch set multipart boundaries for photo uploads, keep JSON for other bodies, and leave recoverable errors to the screen instead of a red dev overlay.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        'Device-ID': deviceId,
        'Device-Credential': deviceCredential,
        ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'network error';
    if (__DEV__) console.warn(`API request did not reach ${apiUrl}${path}: ${detail}`);
    throw new Error(`Cannot reach ${apiUrl}. Check that Express is running and Windows Firewall allows TCP ${new URL(apiUrl).port || '80'}.`);
  }
  const body = await response.json().catch(() => null) as T | ApiError | null;

  if (!response.ok) {
    const apiError = body as ApiError | null;
    const message = apiError?.message ?? apiError?.error ?? `API request failed: ${response.status}`;
    if (__DEV__) console.warn(`API ${init.method ?? 'GET'} ${path} failed: ${message}`);
    throw new ApiRequestError(apiError?.error ?? message, response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return body as T;
}

export async function getApiHealth(): Promise<void> {
  const result = await requestApi<{ database?: string }>('/api/health');
  if (result.database !== 'connected') throw new Error('Supabase is not connected');
}
