import { useCallback, useLayoutEffect, useRef } from 'react';

// Arthur: NarIyirm
// 中文：表单或相机退出、切页和重新发起操作均使旧请求失效，迟到结果不能推进已取消的 UI 流程。
// EN: Leaving a form/camera, changing tabs or starting again invalidates old requests so late results cannot advance a canceled UI flow.
export function useRequestSession(active: boolean) {
  const controller = useRef<AbortController | null>(null);
  const cancel = useCallback(() => { controller.current?.abort(); controller.current = null; }, []);
  useLayoutEffect(() => cancel, [active, cancel]);
  const start = useCallback(() => {
    cancel();
    const next = new AbortController();
    controller.current = next;
    if (!active) next.abort();
    return next.signal;
  }, [active, cancel]);
  return { start, cancel };
}
