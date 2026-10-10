import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { getAchievementStageReport, type AchievementStageReport } from '../../services/achievementApi';
import { createPreloadedSnapshot } from '../../services/preloadedSnapshot';
import { subscribeToSync } from '../../services/realtimeSync';

type ReportStore = ReturnType<typeof createPreloadedSnapshot<AchievementStageReport>>;
const ReportContext = createContext<ReportStore | null>(null);

// Arthur: NarIyirm
// 中文：报告与成果 Tab 一起隐藏预加载，受父层冰箱作用域 key 保护；库存同步更新报告而不重建图表页面。
// EN: Preload reports alongside the hidden achievements tab under its fridge-scope key; inventory sync updates data without rebuilding the chart page.
export function AchievementReportDataProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createPreloadedSnapshot(getAchievementStageReport), []);
  useEffect(() => {
    void store.refresh();
    const unsubscribe = subscribeToSync(['inventory', 'fridge', 'members'], () => { void store.refresh(); });
    return () => { unsubscribe(); store.clear(); };
  }, [store]);
  return <ReportContext.Provider value={store}>{children}</ReportContext.Provider>;
}

export function useAchievementReportData() {
  const store = useContext(ReportContext);
  if (!store) throw new Error('AchievementReportDataProvider is required');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...state, refresh: store.refresh };
}
