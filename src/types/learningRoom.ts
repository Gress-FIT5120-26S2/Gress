import type { LearningAssetKey } from '../components/learning/learningAssets';
import type { LearningSource, LearningStageCode, LearningText, PublicLearningContent } from './learningContent';
export type { LearningStageCode } from './learningContent';

export type LearningOrigin = 'home' | 'profile' | 'tab';
export type LearningSegment = 'learn' | 'path' | 'library';
export type LearningStageStatus = 'completed' | 'unlocked' | 'locked';
export type LearningResumeTarget =
  | { type: 'activity'; activityCode: string }
  | { type: 'checkpoint'; stageCode: LearningStageCode }
  | { type: 'attempt'; attemptUid: string }
  | { type: 'mixed-review' };

export interface LearningSessionView {
  currentStageCode: LearningStageCode;
  stageStatus: Record<LearningStageCode, LearningStageStatus>;
  completedActivityCodes: string[];
  readResourceCodes: string[];
  resumeTarget: LearningResumeTarget;
}

export interface LearningQuestionView {
  questionUid: string;
  prompt: LearningText;
  options: { optionId: string; label: LearningText }[];
  imageAssetKey: LearningAssetKey | null;
  serviceAssumptions: LearningText;
  regionCode: string;
}

// Arthur: NarIyirm
// 中文：正确答案只存在于已提交反馈类型，不能通过待答题的类型泄露未来答案。
// EN: Correct answers exist only in submitted feedback, keeping future answers out of unanswered question types.
export interface LearningAnswerFeedback {
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  explanation: LearningText;
  sourceRefs: string[];
}

export interface LearningQuizView {
  attemptUid: string;
  stageCode: LearningStageCode;
  mode: 'checkpoint' | 'review' | 'practice' | 'mixed-review';
  questionNumber: number;
  questionCount: number;
  question: LearningQuestionView;
  feedback: LearningAnswerFeedback | null;
}

export interface LearningResultView {
  attemptUid: string;
  stageCode: LearningStageCode;
  mode: LearningQuizView['mode'];
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  passed: boolean;
  missedCount: number;
  nextStageCode: LearningStageCode | null;
  session: LearningSessionView;
}

export type LearningOutcome = LearningQuizView | LearningResultView;
export type LearningRecentResult = Pick<LearningResultView, 'attemptUid' | 'stageCode' | 'mode' | 'correctCount' | 'totalCount' | 'passed'> & { submittedAt: string };
export interface LearningStateView {
  contentVersion: string; stateVersion: string; session: LearningSessionView;
  activeAttemptUid: string | null; recentResults: LearningRecentResult[];
}
export interface LearningAttemptView extends LearningStateView {
  status: 'in_progress' | 'submitted' | 'abandoned' | 'invalidated'; attemptContentVersion: string;
  quiz?: LearningQuizView; result?: LearningResultView; questions?: LearningQuizView[]; sources: LearningSource[];
}

// Arthur: NarIyirm
// 中文：页面只消费适配器的服务器结果，不推算升级；预览与真实 HTTP 使用同一接口、各自独立运行。
// EN: Screens consume server outcomes without calculating unlocks; preview and real HTTP share an interface but run independently.
export interface LearningRoomGateway {
  load(): Promise<{ content: PublicLearningContent; session: LearningSessionView; recentResults?: LearningRecentResult[] }>;
  startQuiz(stageCode: LearningStageCode, mode: LearningQuizView['mode'], activityCode?: string): Promise<LearningOutcome>;
  resumeQuiz(attemptUid: string): Promise<LearningOutcome>;
  submitAnswer(attemptUid: string, questionUid: string, optionId: string): Promise<LearningQuizView>;
  nextQuestion(attemptUid: string): Promise<LearningOutcome>;
  finishQuiz(attemptUid: string): Promise<LearningResultView>;
  reviewMissed(attemptUid: string): Promise<LearningQuizView[]>;
  markActivity(activityCode: string): Promise<LearningSessionView>;
  markResource(resourceCode: string): Promise<LearningSessionView>;
  abandonQuiz?(attemptUid: string): Promise<LearningSessionView>;
  getState?(): LearningStateView | null;
  getSources?(attemptUid: string): LearningSource[];
  getAttemptContentVersion?(attemptUid: string): string | undefined;
  getPendingAnswer?(attemptUid: string, questionUid: string): string | null;
  dispose?(): void;
}

export type LearningRoute =
  | { name: 'hub'; segment: LearningSegment; libraryCategory?: 'guide' | 'data' | 'news' }
  | { name: 'course'; courseCode: string }
  | { name: 'lesson'; activityCode: string }
  | { name: 'quiz'; quiz: LearningQuizView; selectedOptionId: string | null; answerPending?: boolean }
  | { name: 'result'; result: LearningResultView }
  | { name: 'review'; questions: LearningQuizView[]; index: number }
  | { name: 'resource'; resourceCode: string };
