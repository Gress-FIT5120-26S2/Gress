export function requestCancelled() {
  const error = new Error('Request cancelled');
  error.name = 'AbortError';
  return error;
}

// Arthur: NarIyirm
// 中文：主动结束等待，即使原生网络层没有及时响应 abort；所有订阅在成功、失败或取消后清理。
// EN: End the wait even when native networking delays abort; clean up listeners on success, failure or cancellation.
export function waitForRequest<T>(work: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return work;
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(requestCancelled()); };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
