import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAchievementDashboard, type AchievementDashboard } from '../services/achievementApi';
import { subscribeToSync } from '../services/realtimeSync';

type AchievementDataContextValue = {
  dashboard: AchievementDashboard | null;
  failed: boolean;
  loading: boolean;
  refresh: (silent?: boolean) => Promise<void>;
};

const AchievementDataContext = createContext<AchievementDataContextValue | null>(null);

// Arthur: NarIyirm
// 中文：Provider 在 App 根部预取并常驻保存成就快照；同步事件只在后台静默替换快照，Tab 重挂载不再触发重复请求。
// EN: The root provider prefetches and retains the achievement snapshot; sync events replace it silently in the background so tab remounts never trigger duplicate requests.
export function AchievementDataProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<AchievementDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setFailed(false);
    }
    try {
      setDashboard(await getAchievementDashboard());
      setFailed(false);
    } catch {
      // Arthur: NarIyirm
      // 中文：后台刷新失败时继续展示最后一次成功快照；只有首次预取或显式重试失败才进入整页错误态。
      // EN: A failed background refresh preserves the last successful snapshot; only initial prefetch or an explicit retry enters the full-page error state.
      if (!silent) setFailed(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeToSync(['inventory', 'fridge', 'members'], () => {
    void refresh(true);
  }), [refresh]);

  const value = useMemo(() => ({ dashboard, failed, loading, refresh }), [dashboard, failed, loading, refresh]);
  return <AchievementDataContext.Provider value={value}>{children}</AchievementDataContext.Provider>;
}

export function useAchievementData() {
  const context = useContext(AchievementDataContext);
  if (!context) throw new Error('useAchievementData must be used inside AchievementDataProvider');
  return context;
}
