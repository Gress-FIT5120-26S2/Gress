import type { LearningLanguage, LearningSource, LearningText } from './learningContent';

export type TutorContext = { contentVersion: string } & (
  | { kind: 'general' }
  | { kind: 'course' | 'activity' | 'resource'; entityCode: string }
  | { kind: 'submitted-question' | 'practice-question'; attemptUid: string; questionUid: string }
  | { kind: 'practice-template'; entityCode: string }
);
export type TutorIntent = 'explain' | 'simplify' | 'example' | 'hint';
export type TutorAction = { type: 'open_lesson' | 'open_resource' | 'open_practice'; entityCode: string; label: LearningText };
export type TutorReply = {
  conversationUid: string; messageUid: string; answer: string; sources: LearningSource[];
  suggestedActions: TutorAction[]; contextLabel: LearningText; contentVersion: string; manifestVersion: string;
  answerStatus: 'answered' | 'insufficient_evidence' | 'out_of_scope'; fallback: boolean;
};
export type TutorMessage = { messageUid: string; role: 'user' | 'assistant'; content: string; response: TutorReply | null;
  rating: 'useful' | 'not_useful' | null; createdAt: string };
export type TutorConversation = { conversationUid: string; context: TutorContext; createdAt: string; expiresAt: string; withdrawn?: boolean };
export type TutorPreferences = { proactiveEnabled: boolean; personalizedEnabled: boolean; dwellHintsEnabled: boolean; timeZone: string };
export type TutorRecommendation = { topicCode: string; sampleCount: number; wrongCount: number; activityCode: string; resourceCode: string; templateCode: string };
export type TutorRecommendations = { evidenceVersion: string; ruleVersion: string; windowDays: number; topics: TutorRecommendation[] };
export type TutorIntervention = { interventionUid: string; reason: string; topicCode: string; context: TutorContext; prompt: LearningText };
export type TutorPractice = { templateCode: string; contentVersion: string; title: LearningText; prompt: LearningText;
  options: { optionId: string; text: LearningText }[]; sourceRefs: string[] };
export type TutorSend = { context: TutorContext; language: LearningLanguage; requestKey: string; conversationUid?: string;
  message?: string; intent?: TutorIntent };
