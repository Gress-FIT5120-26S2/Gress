import { requestApi } from './apiClient';

export type AchievementLevelCode = 'rocky_seedling' | 'polar_guardian' | 'cloud_saver' | 'snowline_steward' | 'climate_summit';
export type AchievementCode = 'first_item' | 'first_rescue' | 'waste_watcher' | 'zero_waste_week' | 'rescue_ten' | 'fridge_regular' | 'shared_kitchen' | 'climate_summit';

export type QuestCode =
  | 'use_it_today'
  | 'rescue_one'
  | 'finish_one_in_time'
  | 'update_after_use'
  | 'quick_fridge_check'
  | 'plan_before_shopping'
  | 'skip_a_double_buy'
  | 'rescue_the_week'
  | 'use_four_in_time'
  | 'three_day_rhythm'
  | 'fridge_reset'
  | 'shop_from_what_you_have'
  | 'duplicate_defender'
  | 'strong_utilisation_week'
  | 'know_the_outcome'
  | 'use_oldest_first'
  | 'use_earliest_first'
  | 'finish_opened'
  | 'use_two_items'
  | 'use_three_items'
  | 'use_two_categories'
  | 'use_chilled'
  | 'use_frozen'
  | 'use_pantry'
  | 'use_two_warning_items'
  | 'five_day_rhythm'
  | 'finish_three'
  | 'finish_opened_two'
  | 'oldest_first_three'
  | 'three_categories_week'
  | 'two_zones_week'
  | 'quantity_care_week'
  | 'warning_clearance_week'
  | 'low_waste_week'
  | 'shared_kitchen_relay'
  | 'rescue_two_days'
  | 'weekly_use_one'
  | 'weekly_use_two'
  | 'weekly_finish_one'
  | 'weekly_two_day_rhythm';

export type FridgeQuestAssignment = {
  assignmentUid: string;
  questCode: QuestCode;
  periodType: 'daily' | 'weekly';
  titleKey: string;
  descriptionKey: string;
  category: 'outcome' | 'organisation' | 'shopping';
  target: number;
  progressCurrent: number;
  progressTarget: number;
  rewardXp: number;
  isReminderOnly: boolean;
  status: 'assigned' | 'completed' | 'expired' | 'rerolled';
  periodStart: string;
  periodEnd: string;
  timeZone: string;
  completedAt: string | null;
  ruleVersion: number;
  slotIndex: number;
  effectiveStartAt: string;
  canReroll: boolean;
};

export type FridgeQuests = {
  daily: FridgeQuestAssignment | null;
  weekly: FridgeQuestAssignment | null;
  dailyAssignments: FridgeQuestAssignment[];
  weeklyAssignments: FridgeQuestAssignment[];
  dailyRerollsRemaining: number;
  weeklyRerollsRemaining: number;
  updatedAt: string;
};

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
  // Arthur: NarIyirm
  // 中文：每日/每周挑战由独立 RPC 对账后并入同一快照；客户端不判定可分配性或完成。
  // EN: Daily/weekly quests are reconciled by a separate RPC and merged into the same snapshot; the client never decides eligibility or completion.
  quests?: FridgeQuests;
  recentXpEvents: Array<{
    id: string;
    reasonCode: string;
    points: number;
    occurredAt: string;
    metadata: Record<string, unknown>;
  }>;
  updatedAt: string;
};

export type AchievementStageReport = {
  periodStart: string;
  periodEnd: string;
  timeZone: string;
  currency: 'AUD';
  overview: {
    completedBatchCount: number;
    discardedBatchCount: number;
    discardedValue: number;
    pricedDiscardCount: number;
    discardRecordCount: number;
    priceCoverageRate: number | null;
  };
  trend: Array<{ startDate: string; endDate: string; usedRecords: number; discardedRecords: number }>;
  reasons: Array<{ code: string; count: number }>;
  categories: Array<{ categoryUid: string | null; systemCode: string | null; name: string; count: number }>;
  upcomingCount: number;
  upcoming: Array<{ batchUid: string; name: string; dateType: 'use_by' | 'best_before' | 'estimated_quality' | 'legacy_expiry'; deadlineAt: string }>;
};

// Arthur: NarIyirm
// 中文：成就页只请求一个共享冰箱快照；数据库负责等级、阈值目录、进度、金额覆盖率、解锁与挑战状态，客户端仅切换预览。
// EN: The achievement screen requests one shared-fridge snapshot; the database owns level, coverage, unlock, and quest state while the client only changes the preview.
export function getAchievementDashboard(): Promise<AchievementDashboard> {
  return requestApi<AchievementDashboard>('/api/achievements');
}

// Arthur: NarIyirm
// 中文：报告只在用户进入详情时加载，避免增加成就概览的首次请求负担。
// EN: Load the report only when its detail opens so the overview stays lightweight.
export function getAchievementStageReport(): Promise<AchievementStageReport> {
  return requestApi<AchievementStageReport>('/api/achievements/report');
}

// Arthur: NarIyirm
// 中文：按服务端分配 ID 更换单个槽位；客户端不自行挑选候选，也不沿用旧任务进度。
// EN: Reroll one server-owned slot by assignment ID; the client neither chooses candidates nor carries old progress forward.
export function rerollQuest(assignmentUid: string): Promise<{ quests: FridgeQuests }> {
  return requestApi<{ quests: FridgeQuests }>('/api/achievements/quests/reroll', {
    method: 'POST',
    body: JSON.stringify({ assignmentUid }),
  });
}
