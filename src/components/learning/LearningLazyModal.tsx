import { Component, lazy, Suspense, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { LearningLoadingModal } from './LearningLoadingModal';

class LoadingBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// Arthur: NarIyirm
// 中文：懒加载失败只影响当前功能，保留关闭／重试入口；重试重新创建 lazy，避免一直复用已拒绝的 Promise。
// EN: Lazy-load failures affect only this feature and retain close/retry; retry recreates lazy instead of reusing a rejected promise.
export function LearningLazyModal<P extends object>({ load, componentProps, onClose, closeLabel }: {
  load: () => Promise<{ default: ComponentType<P> }>; componentProps: P; onClose: () => void; closeLabel?: string;
}) {
  const [revision, setRevision] = useState(0);
  const Screen = useMemo(() => lazy(load), [load, revision]);
  return <LoadingBoundary key={revision} fallback={<LearningLoadingModal onClose={onClose} closeLabel={closeLabel} failed onRetry={() => setRevision(value => value + 1)} />}>
    <Suspense fallback={<LearningLoadingModal onClose={onClose} closeLabel={closeLabel} />}><Screen {...componentProps} /></Suspense>
  </LoadingBoundary>;
}
