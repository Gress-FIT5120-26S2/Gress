import type { LearningRoute } from '../../types/learningRoom';

export type LearningNavigationAction =
  | { type: 'push'; route: LearningRoute }
  | { type: 'replace'; route: LearningRoute }
  | { type: 'back' }
  | { type: 'hub'; route: Extract<LearningRoute, { name: 'hub' }> };

// Arthur: NarIyirm
// 中文：导航只保存页面和服务返回的视图，不在 reducer 里累计分数或改变解锁状态。
// EN: Navigation stores routes and returned views only; the reducer never accumulates scores or changes stage eligibility.
export function learningNavigationReducer(stack: LearningRoute[], action: LearningNavigationAction): LearningRoute[] {
  switch (action.type) {
    case 'push': return [...stack, action.route];
    case 'replace': return [...stack.slice(0, -1), action.route];
    case 'back': return stack.length > 1 ? stack.slice(0, -1) : stack;
    case 'hub': return [action.route];
  }
}
