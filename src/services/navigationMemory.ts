const recoveryListeners = new Set<() => void>();

// Arthur: NarIyirm
// 中文：恢复会在同一安装凭证下更换学习所有者，即使冰箱 ID 相同也必须清除旧页面内存。
// EN: Recovery changes the learner behind the same installation credential; discard old page memory even if the fridge ID stays the same.
export function invalidateNavigationMemory() {
  recoveryListeners.forEach(listener => listener());
}

export function subscribeNavigationMemory(listener: () => void) {
  recoveryListeners.add(listener);
  return () => { recoveryListeners.delete(listener); };
}
