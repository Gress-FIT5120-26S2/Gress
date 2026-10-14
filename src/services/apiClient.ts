import { getDeviceCredential, getDeviceId } from './deviceId';
import { askAiConsent, needsAiConsent } from './aiConsentBridge';
import { requestCancelled, waitForRequest } from './requestLifetime';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

type ApiError = {
  error?: string;
  message?: string;
};

type ApiActivityListener = (activeRequestCount: number) => void;

let activeRequestCount = 0;
let apiRequestsSuspended = false;
export function suspendApiRequests(suspended: boolean) { apiRequestsSuspended = suspended; }
const erasureListeners = new Set<() => void>();
export function subscribeToIdentityErasure(listener: () => void) {
  erasureListeners.add(listener);
  return () => { erasureListeners.delete(listener); };
}
const apiActivityListeners = new Set<ApiActivityListener>();

function changeApiActivity(delta: number) {
  activeRequestCount = Math.max(0, activeRequestCount + delta);
  apiActivityListeners.forEach((listener) => listener(activeRequestCount));
}

// Arthur: NarIyirm
// 中文：全局加载提示订阅通用请求计数，并发请求结束前不会误报为空闲。
// EN: The global loading indicator subscribes to a shared request count so concurrent calls cannot report idle until every request settles.
export function subscribeToApiActivity(listener: ApiActivityListener) {
  apiActivityListeners.add(listener);
  listener(activeRequestCount);
  return () => {
    apiActivityListeners.delete(listener);
  };
}

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

// Arthur: NarIyirm
// 中文：所有业务 service 最终汇入此函数；上游见 inventoryApi/sharingApi 等，下游是 EXPO_PUBLIC_API_URL 指向的 Express。
// EN: Every domain service converges here; upstream callers live in inventoryApi/sharingApi and downstream is the Express server at EXPO_PUBLIC_API_URL.
export async function requestApi<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  // Arthur: NarIyirm
  // 中文：所有前端业务请求都通过同一入口携带 Device-ID 访问 Express，避免各业务模块重复处理环境地址、请求头和错误。
  // EN: All frontend domain requests use one Express client with Device-ID so modules do not duplicate environment, header, and error handling.
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured');
  if (init.signal?.aborted) throw requestCancelled();
  if (apiRequestsSuspended && path !== '/api/privacy/device-data') throw new ApiRequestError('identity_erased', 401);
  if (needsAiConsent(path, init.method)) {
    if (!await askAiConsent(false, init.signal)) throw new ApiRequestError('ai_consent_required', 403, 'AI permission is required. Manage it in Profile → Privacy.');
  }
  if (init.signal?.aborted) throw requestCancelled();
  if (apiRequestsSuspended && path !== '/api/privacy/device-data') throw new ApiRequestError('identity_erased', 401);

  // Arthur: NarIyirm
  // 中文：授权选择不计入网络超时；凭证、上传及响应体读取共享截止时间，取消保留 AbortError，不自动重发写请求。
  // EN: Consent choice is outside the network deadline; credentials, upload and response body share it, preserving AbortError without retrying writes.
  const { timeoutMs = needsAiConsent(path, init.method) ? 90_000 : 30_000, signal: callerSignal, ...fetchInit } = init;
  const controller = new AbortController();
  const abort = () => controller.abort();
  callerSignal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  changeApiActivity(1);
  try {

    const [deviceId, deviceCredential] = await waitForRequest(Promise.all([getDeviceId(), getDeviceCredential()]), controller.signal);
    if (controller.signal.aborted) throw requestCancelled();
  // Arthur: NarIyirm
  // 中文：上传照片时让 fetch 自动设置 multipart boundary；其余请求体仍使用 JSON，可恢复错误交给页面展示而不是触发红色开发错误屏。
  // EN: Let fetch set multipart boundaries for photo uploads, keep JSON for other bodies, and leave recoverable errors to the screen instead of a red dev overlay.
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    let response: Response;
    try {
      response = await waitForRequest(fetch(`${apiUrl}${path}`, {
        ...fetchInit,
        signal: controller.signal,
        headers: {
          'Device-ID': deviceId,
          'Device-Credential': deviceCredential,
          ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      }), controller.signal);
    } catch (error) {
      if (controller.signal.aborted) throw requestCancelled();
      const detail = error instanceof Error ? error.message : 'network error';
      if (__DEV__) console.warn(`API request did not reach ${apiUrl}${path}: ${detail}`);
      throw new Error(`Cannot reach ${apiUrl}. Check that Express is running and Windows Firewall allows TCP ${new URL(apiUrl).port || '80'}.`);
    }
    const body = await waitForRequest(response.json().catch(() => null), controller.signal) as T | ApiError | null;
    if (controller.signal.aborted) throw requestCancelled();

    if (!response.ok) {
      const apiError = body as ApiError | null;
      // Arthur: NarIyirm
      // 中文：删除响应丢失或删除后重启时，服务端专用错误仍会进入已删除界面，避免永久困在失效凭证上。
      // EN: A dedicated server error restores the erased screen after a lost deletion response or relaunch, preventing a stale-credential dead end.
      if (apiError?.error === 'identity_erased') {
        apiRequestsSuspended = true;
        erasureListeners.forEach(listener => listener());
      }
      const message = apiError?.message ?? apiError?.error ?? `API request failed: ${response.status}`;
      if (__DEV__) console.warn(`API ${init.method ?? 'GET'} ${path} failed: ${message}`);
      throw new ApiRequestError(apiError?.error ?? message, response.status, message);
    }

    if (response.status === 204) return undefined as T;
    return body as T;
  } catch (error) {
    if (timedOut) throw new ApiRequestError('request_timeout', 0, 'Request timed out. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abort);
    changeApiActivity(-1);
  }
}

// Arthur: NarIyirm
// 中文：App 启动时用此函数检查 Express 是否能以管理权限连接 Supabase；它不下载任何业务记录。
// EN: App startup uses this to verify Express can reach Supabase with admin credentials without downloading domain records.
export async function getApiHealth(): Promise<void> {
  const result = await requestApi<{ database?: string }>('/api/health');
  if (result.database !== 'connected') throw new Error('Supabase is not connected');
}
