import type { LearningQuizView, LearningResultView, LearningRoomGateway, LearningRoute, LearningSessionView } from '../../../types/learningRoom';
import { learningPreviewContent } from './learningPreviewContent';

export const previewScenarios = ['hub', 'course', 'quiz', 'result', 'resource', 'new-user', 'failed', 'complete', 'loading', 'error', 'answer-error'] as const;
export type LearningPreviewScenario = typeof previewScenarios[number];

const beginner: LearningSessionView = {
  currentStageCode: 'beginner', stageStatus: { beginner: 'unlocked', intermediate: 'locked', advanced: 'locked' },
  completedActivityCodes: ['beginner-why-waste'], readResourceCodes: [], resumeTarget: { type: 'activity', activityCode: 'beginner-materials' },
};
const progressed: LearningSessionView = {
  ...beginner, currentStageCode: 'intermediate', stageStatus: { beginner: 'completed', intermediate: 'unlocked', advanced: 'locked' },
  resumeTarget: { type: 'activity', activityCode: 'intermediate-components' },
};
const completed: LearningSessionView = {
  ...progressed, currentStageCode: 'advanced', stageStatus: { beginner: 'completed', intermediate: 'completed', advanced: 'completed' },
  resumeTarget: { type: 'mixed-review' },
};

// Arthur: NarIyirm
// 中文：这一道已批准的铝罐情景只用于 UI 预览；没有导入服务端题库，不代表真实抽题或用户考试。
// EN: This single approved aluminium-can scenario is for UI preview only; it imports no server bank and represents neither real sampling nor a user's attempt.
const question: LearningQuizView['question'] = {
  questionUid: 'preview-can-question', prompt: { en: 'Where should an empty aluminium can go?', zh: '空铝罐应该投放到哪里？' },
  options: [{ optionId: 'recycling', label: { en: 'Recycling', zh: '回收' } },
    { optionId: 'food-organics', label: { en: 'Food organics', zh: '厨余' } }, { optionId: 'general', label: { en: 'General waste', zh: '一般垃圾' } }],
  imageAssetKey: 'empty-aluminium-can', regionCode: 'AU-VIC',
  serviceAssumptions: { en: 'This example service accepts empty aluminium beverage cans.', zh: '本示例收集服务接受空铝制饮料罐。' },
};
const quiz: LearningQuizView = { attemptUid: 'ui-preview-attempt', stageCode: 'beginner', mode: 'checkpoint', questionNumber: 2, questionCount: 6, question, feedback: null };
const pass: LearningResultView = { attemptUid: quiz.attemptUid, stageCode: 'beginner', mode: 'checkpoint', correctCount: 5, totalCount: 6,
  scorePercent: 83, passed: true, missedCount: 1, nextStageCode: 'intermediate', session: progressed };

export function createLearningPreview(scenario: LearningPreviewScenario) {
  let session = structuredClone(scenario === 'result' ? progressed : scenario === 'complete' ? completed : beginner);
  if (scenario === 'new-user') { session.completedActivityCodes = []; session.resumeTarget = { type: 'activity', activityCode: 'beginner-why-waste' }; }
  let current = structuredClone(quiz);
  let answerFailure = scenario === 'answer-error';
  let loadFailure = scenario === 'error';
  const result = scenario === 'failed' ? { ...pass, passed: false, correctCount: 4, scorePercent: 67, missedCount: 2, nextStageCode: null, session: beginner }
    : scenario === 'complete' ? { ...pass, stageCode: 'advanced' as const, correctCount: 8, totalCount: 10, scorePercent: 80, missedCount: 2, nextStageCode: null, session: completed } : pass;
  const initialRoute: LearningRoute | undefined = scenario === 'course' ? { name: 'course', courseCode: 'waste-basics' }
    : scenario === 'quiz' || scenario === 'answer-error' ? { name: 'quiz', quiz: current, selectedOptionId: 'recycling' }
    : scenario === 'result' || scenario === 'failed' || scenario === 'complete' ? { name: 'result', result }
    : scenario === 'resource' ? { name: 'resource', resourceCode: 'waste-climate-sdg13' } : undefined;

  // Arthur: NarIyirm
  // 中文：开发适配器只回放固定服务响应，结算不读取或累计点击分数；关闭／重选情景会清空所有内存状态。
  // EN: The development adapter replays fixed responses; finish never reads or tallies clicks, and closing/reselecting scenarios clears all memory state.
  const gateway: LearningRoomGateway = {
    async load() {
      if (scenario === 'loading') return new Promise(() => undefined);
      if (loadFailure) { loadFailure = false; throw new Error('Preview load failure'); }
      return { content: learningPreviewContent, session: structuredClone(session) };
    },
    async startQuiz(stageCode, mode) {
      if (mode === 'checkpoint' && session.stageStatus[stageCode] === 'locked') throw new Error('Preview checkpoint locked');
      const count = learningPreviewContent.stages.find((stage) => stage.stageCode === stageCode)!.questionCount;
      current = { ...structuredClone(quiz), stageCode, mode, questionNumber: 1, questionCount: count };
      return structuredClone(current);
    },
    async resumeQuiz() { return structuredClone(current); },
    async submitAnswer(_attemptUid, _questionUid, selectedOptionId) {
      if (answerFailure) { answerFailure = false; throw new Error('Preview answer failure'); }
      if (current.feedback) return structuredClone(current);
      current.feedback = { selectedOptionId, correctOptionId: 'recycling', isCorrect: selectedOptionId === 'recycling',
        explanation: { en: 'In this example, the mixed recycling service accepts empty aluminium beverage cans.', zh: '本示例的混合回收服务接受空铝制饮料罐。' }, sourceRefs: ['vic-sorting'] };
      return structuredClone(current);
    },
    async nextQuestion() {
      current = { ...current, questionNumber: current.questionCount, question: { ...question, questionUid: 'preview-last-can-question' }, feedback: null };
      return structuredClone(current);
    },
    async finishQuiz() {
      // Arthur: NarIyirm
      // 中文：复习只回放成绩视图并保留原等级；预览的通过响应也不允许复习触发解锁。
      // EN: Reviews replay a result while preserving eligibility; even a passing preview response cannot unlock a stage through review.
      const failing = scenario === 'failed' && current.mode === 'checkpoint';
      const nextSession = current.mode !== 'checkpoint' || failing ? session : current.stageCode === 'advanced' ? completed
        : current.stageCode === 'intermediate' ? { ...progressed, currentStageCode: 'advanced' as const,
          stageStatus: { beginner: 'completed' as const, intermediate: 'completed' as const, advanced: 'unlocked' as const },
          resumeTarget: { type: 'activity' as const, activityCode: 'advanced-plan-first' } } : progressed;
      const correctCount = failing ? 4 : current.stageCode === 'advanced' ? 8 : current.stageCode === 'intermediate' ? 7 : 5;
      const value: LearningResultView = { ...structuredClone(result), stageCode: current.stageCode, mode: current.mode,
        passed: !failing, totalCount: current.questionCount, correctCount, scorePercent: Math.round(correctCount / current.questionCount * 100),
        missedCount: current.questionCount - correctCount,
        nextStageCode: current.mode !== 'checkpoint' || failing || current.stageCode === 'advanced' ? null : current.stageCode === 'beginner' ? 'intermediate' : 'advanced',
        session: structuredClone(nextSession) };
      session = structuredClone(value.session);
      return value;
    },
    async reviewMissed() { return [1, ...(result.missedCount > 1 ? [2] : [])].map(() => ({ ...structuredClone(quiz), stageCode: result.stageCode, mode: 'review' as const, feedback: {
      selectedOptionId: 'general', correctOptionId: 'recycling', isCorrect: false,
      explanation: { en: 'This example service accepts the empty aluminium beverage can in mixed recycling.', zh: '此示例服务接受将空铝饮料罐投入混合回收。' }, sourceRefs: ['vic-sorting'],
    } })); },
    async markActivity(code) {
      if (!session.completedActivityCodes.includes(code)) session.completedActivityCodes.push(code);
      const next = learningPreviewContent.activities.find((item) => item.activityCode === code)?.nextActivityCode;
      session.resumeTarget = next ? { type: 'activity', activityCode: next } : { type: 'checkpoint', stageCode: session.currentStageCode };
      return structuredClone(session);
    },
    async markResource(code) { if (!session.readResourceCodes.includes(code)) session.readResourceCodes.push(code); return structuredClone(session); },
  };
  return { gateway, initialRoute };
}
