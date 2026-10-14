const dismissals = new Set<() => void>();
const listeners = new Set<() => void>();

// Arthur: NarIyirm
// 中文：iOS 原生关闭动画跨越多个 JS 帧；等待 onDismiss 后才呈现下一层，卸载丢失事件时用有界回退释放队列。
// EN: iOS dismissal spans multiple JS frames; wait for onDismiss before presenting again, with a bounded fallback for events lost on unmount.
export function beginModalDismissal() {
  const finish = () => {
    clearTimeout(timer);
    if (dismissals.delete(finish)) listeners.forEach(listener => listener());
  };
  const timer = setTimeout(finish, 1000);
  dismissals.add(finish);
  return finish;
}

export function afterModalDismissals(show: () => void) {
  const attempt = () => {
    if (dismissals.size) return;
    listeners.delete(attempt);
    show();
  };
  listeners.add(attempt);
  // Arthur: NarIyirm
  // 中文：先让同一提交中的旧弹窗 layout cleanup 登记关闭，再检查是否可打开新弹窗。
  // EN: Let old modals register dismissal in this commit's layout cleanup before checking a new presentation.
  const timer = setTimeout(attempt, 0);
  return () => { clearTimeout(timer); listeners.delete(attempt); };
}
