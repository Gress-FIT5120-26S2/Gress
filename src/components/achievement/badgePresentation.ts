import type { AchievementDashboard } from '../../services/achievementApi';

export type AchievementBadgeItem = AchievementDashboard['achievements'][number];
export type AchievementBadgeStatus = AchievementBadgeItem['status'];
export type VisibleBadgeStatus = Exclude<AchievementBadgeStatus, 'unavailable'>;

type ProgressLabelCopy = {
  progressOf: (current: number, total: number) => string;
  membersOf: (current: number, total: number) => string;
  xpOf: (current: number, total: number) => string;
};

// Arthur: NarIyirm
// 中文：前端只映射服务端 status，不因本地指标改写 locked/in_progress/unlocked。
// EN: The client only maps the server status and never rewrites locked/in_progress/unlocked from local metrics.
export function resolveVisibleBadgeStatus(achievement: AchievementBadgeItem): VisibleBadgeStatus {
  if (achievement.status === 'unlocked' || achievement.unlocked) return 'unlocked';
  if (achievement.status === 'in_progress') return 'in_progress';
  if (achievement.status === 'locked') return 'locked';
  // Arthur: NarIyirm
  // 中文：未知或缺失 status 时按 locked 降级展示，避免把不可用徽章渲染成失败进度。
  // EN: Unknown or missing status falls back to locked so unavailable badges are never rendered as failed progress.
  return 'locked';
}

export function isAchievementBadgeVisible(achievement: AchievementBadgeItem): boolean {
  return achievement.status !== 'unavailable';
}

export function getBadgeProgressPair(achievement: AchievementBadgeItem): { current: number; target: number } {
  const target = Math.max(0, Number(achievement.progressTarget ?? 0));
  const current = Math.max(0, Number(achievement.progressCurrent ?? achievement.metricValue ?? 0));
  return { current: Math.min(current, target || current), target };
}

// Arthur: NarIyirm
// 中文：进度文案跟 progressLabelKey 走，保证 XP / 成员 / 通用分母用词一致。
// EN: Progress copy follows progressLabelKey so XP, member, and generic denominators stay consistent.
export function formatBadgeProgressLabel(achievement: AchievementBadgeItem, copy: ProgressLabelCopy): string {
  const { current, target } = getBadgeProgressPair(achievement);
  switch (achievement.progressLabelKey) {
    case 'achievements.progress.membersOfTarget':
      return copy.membersOf(current, target);
    case 'achievements.progress.xpOfTarget':
      return copy.xpOf(current, target);
    case 'achievements.progress.currentOfTarget':
    default:
      return copy.progressOf(current, target);
  }
}

export function getBadgeProgressRatio(achievement: AchievementBadgeItem): number {
  const { current, target } = getBadgeProgressPair(achievement);
  if (target <= 0) return achievement.status === 'unlocked' || achievement.unlocked ? 1 : 0;
  return Math.min(1, current / target);
}
