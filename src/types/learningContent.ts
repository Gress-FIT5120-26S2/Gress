import type { LearningAssetKey } from '../components/learning/learningAssets';

export type LearningLanguage = 'en' | 'zh';
export type LearningText = Record<LearningLanguage, string>;
export type LearningStageCode = 'beginner' | 'intermediate' | 'advanced';
export type LearningRegionCode = 'global' | 'AU' | 'AU-VIC' | 'AU-NSW';

export type LearningBodyBlock =
  | { type: 'paragraph'; text: LearningText }
  | { type: 'bullet-list'; items: LearningText[] }
  | { type: 'reflection'; title: LearningText; text: LearningText }
  | { type: 'source'; sourceRefs: string[] }
  | { type: 'image'; assetKey: LearningAssetKey; alt: LearningText }
  | { type: 'fact'; value: LearningText; text: LearningText; scope: LearningText; sourceRefs: string[] }
  | { type: 'sdg-callout'; goal: 13; target: '13.3'; attributionRequired: true;
      assetKey: LearningAssetKey; title: LearningText; text: LearningText; detail: LearningText; sourceRefs: string[] };

export interface LearningStage {
  stageCode: LearningStageCode;
  title: LearningText;
  courseCode: string;
  questionCount: 6 | 8 | 10;
  passPercent: 80;
  minimumCorrect: 5 | 7 | 8;
  minimumBankSize: number;
  nextStageCode: LearningStageCode | null;
  blueprint: { topicCode: string; count: number }[];
}

export interface LearningCourse {
  courseCode: string;
  stageCode: LearningStageCode;
  title: LearningText;
  summary: LearningText;
  objective: LearningText;
  coverAssetKey: LearningAssetKey;
  activityCodes: string[];
  relatedResourceCodes: string[];
}

export interface LearningActivity {
  activityCode: string;
  contentVersion: string;
  stageCode: LearningStageCode;
  type: 'video' | 'lesson' | 'practice';
  title: LearningText;
  objective: LearningText;
  durationEstimate: { minutes: number; includesReflection: boolean; basis: LearningText };
  mediaAssetKey: string | null;
  sourceRefs: string[];
  relatedActivityCodes: string[];
  nextActivityCode: string | null;
  completionKind: 'explicit-confirmation' | 'verified-practice';
  body: LearningBodyBlock[];
}

export interface LearningStatistics {
  measurementPeriod: string;
  populationScope: LearningText;
  units: string;
  includes: string[];
  excludes: string[];
  methodologyNote: LearningText;
}

export interface LearningResource {
  resourceCode: string;
  contentVersion: string;
  category: 'guide' | 'data' | 'news';
  title: LearningText;
  summary: LearningText;
  whyItMatters: LearningText;
  publisher: string;
  sourceUrl: string;
  publishedAt: string | null;
  reviewedAt: string;
  regionCode: LearningRegionCode;
  relatedCourseCodes: string[];
  relatedNewsCodes?: string[];
  topicCodes: string[];
  coverAssetKey: LearningAssetKey;
  summaryKind: 'kitchmemo-editorial-summary';
  body: LearningBodyBlock[];
  completionKind: 'explicit-confirmation';
  readerLayout: 'standard' | 'climate-feature';
  newsContext?: 'dated-announcement' | 'historical-background';
  sourceRefs: string[];
  statistics?: LearningStatistics;
}

export interface LearningSource {
  sourceCode: string;
  title: string;
  publisher: string;
  url: string;
  regionCode: LearningRegionCode;
  publishedAt: string | null;
  updatedAt: string | null;
  reviewedAt: string;
  dateNote: string | null;
}

export interface LearningAssessmentRules {
  answerKind: 'single-choice';
  timeLimitSeconds: null;
  firstAnswerFinal: true;
  gradingAuthority: 'server';
  unlockAuthority: 'atomic-finish';
  requiredActivitiesBeforeCheckpoint: false;
  courseReadingRequiresUnlock: false;
  personalProgress: true;
  addsSharedXp: false;
  changesInventory: false;
  reviewCanUnlock: false;
  practiceCanUnlock: false;
  percentageRounding: 'display-only';
  completionAfterAdvanced: 'mixed-review';
}

// Arthur: NarIyirm
// 中文：客户端只接收公开教学内容；答案、题库、考试快照和升级状态不属于这个契约。
// EN: The client receives public teaching content only; answers, question banks, attempt snapshots and progression state are outside this contract.
export interface PublicLearningContent {
  schemaVersion: 1;
  contentVersion: string;
  projectSdg: { goal: 13; target: '13.3' };
  languages: LearningLanguage[];
  stages: LearningStage[];
  courses: LearningCourse[];
  libraryTopics: { topicCode: string; title: LearningText }[];
  media: { mediaAssetKey: string; type: 'video'; durationSeconds: number;
    assetPath: string; posterPath: string; sourceRefs: string[] }[];
  assessmentRules: LearningAssessmentRules;
  errorCodes: string[];
  activities: LearningActivity[];
  resources: LearningResource[];
  sources: LearningSource[];
}
