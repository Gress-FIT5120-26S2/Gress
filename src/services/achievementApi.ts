import { requestApi } from './apiClient';

export type AchievementLevelCode = 'rocky_seedling' | 'polar_guardian' | 'cloud_saver' | 'snowline_steward' | 'climate_summit';
export type AchievementCode = 'first_item' | 'first_rescue' | 'waste_watcher' | 'zero_waste_week' | 'rescue_ten' | 'fridge_regular' | 'shared_kitchen' | 'climate_summit';

export type AchievementDashboard = {
  level: {
    current: number;
    code: AchievementLevelCode;
    titleKey: string;
    totalXp: number;
    currentLevelMinimumXp: number;
    nextLevelMinimumXp: number | null;
    progress: number;
    isMaxLevel: boolean;
    mountainKey: string;
    themeKey: string;
  };
  levelCatalog: Array<{
    level: number;
    code: AchievementLevelCode;
    titleKey: string;
    minimumXp: number;
    mountainKey: string;
    themeKey: string;
  }>;
  journey: { previousLevel: number | null; currentLevel: number; nextLevel: number | null };
  metrics: {
    consumedBatchCount: number;
    rescuedBatchCount: number;
    discardedBatchCount: number;
    consumedValue: number;
    rescuedValue: number;
    discardedValue: number;
    currency: 'AUD';
    priceCoverageRate: number | null;
    memberCount: number;
  };
  achievements: Array<{
    code: AchievementCode;
    titleKey: string;
    descriptionKey: string;
    xpReward: number;
    badgeAssetKey: string | null;
    ruleVersion: number;
    // Arthur: NarIyirm
    // 中文：status 与进度分母由 GET /api/achievements 权威返回；unlocked 仅作兼容布尔快捷字段。
    // EN: status and progress denominators come from GET /api/achievements; unlocked remains a compatibility boolean shortcut.
    status: 'locked' | 'in_progress' | 'unlocked' | 'unavailable';
    progressCurrent: number;
    progressTarget: number;
    progressLabelKey: string;
    unlocked: boolean;
    unlockedAt: string | null;
    metricValue: number | null;
  }>;
  recentXpEvents: Array<{
    id: string;
    reasonCode: string;
    points: number;
    occurredAt: string;
    metadata: Record<string, unknown>;
  }>;
  updatedAt: string;
};

// Arthur: NarIyirm
// 中文：成就页只请求一个共享冰箱快照；数据库负责等级、阈值目录、进度、金额覆盖率与解锁状态，客户端仅切换预览。
// EN: The achievement screen requests one shared-fridge snapshot; the database owns the level catalog, progress, coverage, and unlock state while the client only changes the preview.
export function getAchievementDashboard(): Promise<AchievementDashboard> {
  return requestApi<AchievementDashboard>('/api/achievements');
}
