export type PreloadedSnapshot<T> = { data: T | null; loading: boolean; failed: boolean };

// Arthur: NarIyirm
// 中文：成功快照在刷新期间继续可见，空数组也算成功；合并并发读取，并在作用域销毁后丢弃迟到响应。
// EN: Keep successful snapshots visible during refresh, including empty arrays; coalesce reads and reject late responses after scope teardown.
export function createPreloadedSnapshot<T>(read: () => Promise<T>) {
  let state: PreloadedSnapshot<T> = { data: null, loading: true, failed: false };
  let generation = 0;
  let flight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: PreloadedSnapshot<T>) => { state = next; listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh() {
      if (flight) return flight;
      const version = generation;
      if (state.data === null) publish({ data: null, loading: true, failed: false });
      flight = Promise.resolve().then(read).then(data => {
        if (version === generation) publish({ data, loading: false, failed: false });
      }).catch(() => {
        if (version === generation) publish({ ...state, loading: false, failed: state.data === null });
      }).finally(() => { if (version === generation) flight = null; });
      return flight;
    },
    clear() {
      generation += 1; flight = null;
      publish({ data: null, loading: true, failed: false });
    },
  };
}
