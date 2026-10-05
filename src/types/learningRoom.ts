import type { LearningAssetKey } from '../components/learning/learningAssets';
import type { LearningStageCode, LearningText, PublicLearningContent } from './learningContent';
export type { LearningStageCode } from './learningContent';

export type LearningOrigin = 'home' | 'profile';
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

// Arthur: NarIyirm
// 中文：页面依赖注入的服务端结果，不推算升级；P2 只提供开发适配器，真实 HTTP 映射由 P3/P4 接入。
// EN: Screens consume injected server outcomes instead of calculating unlocks; P2 supplies a development adapter, with real HTTP mapping left to P3/P4.
export interface LearningRoomGateway {
  load(): Promise<{ content: PublicLearningContent; session: LearningSessionView }>;
  startQuiz(stageCode: LearningStageCode, mode: LearningQuizView['mode']): Promise<LearningQuizView>;
  resumeQuiz(attemptUid: string): Promise<LearningQuizView>;
  submitAnswer(attemptUid: string, questionUid: string, optionId: string): Promise<LearningQuizView>;
  nextQuestion(attemptUid: string): Promise<LearningQuizView>;
  finishQuiz(attemptUid: string): Promise<LearningResultView>;
  reviewMissed(attemptUid: string): Promise<LearningQuizView[]>;
  markActivity(activityCode: string): Promise<LearningSessionView>;
  markResource(resourceCode: string): Promise<LearningSessionView>;
}

export type LearningRoute =
  | { name: 'hub'; segment: LearningSegment; libraryCategory?: 'guide' | 'data' | 'news' }
  | { name: 'course'; courseCode: string }
  | { name: 'lesson'; activityCode: string }
  | { name: 'quiz'; quiz: LearningQuizView; selectedOptionId: string | null }
  | { name: 'result'; result: LearningResultView }
  | { name: 'review'; questions: LearningQuizView[]; index: number }
  | { name: 'resource'; resourceCode: string };
