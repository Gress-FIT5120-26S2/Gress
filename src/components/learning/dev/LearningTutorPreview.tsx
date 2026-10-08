import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '../../../i18n';
import type { learningTutorApi } from '../../../services/learningTutorApi';
import type { TutorContext, TutorConversation, TutorMessage, TutorPreferences, TutorReply } from '../../../types/learningTutor';
import { LearningResourceScreen } from '../LearningResourceScreen';
import { LearningTutorPanel } from '../tutor/LearningTutorPanel';
import { LearningTutorSlot } from '../tutor/LearningTutorSlot';
import { TutorEntryButton, TutorHelpCard } from '../tutor/LearningTutorView';
import { learningPreviewContent } from './learningPreviewContent';

export const tutorPreviewScreens = ['welcome', 'explanation', 'submitted', 'proactive', 'restricted', 'failure', 'practice', 'withdrawn'] as const;
export type TutorPreviewScreen = typeof tutorPreviewScreens[number];

// Arthur: NarIyirm
// 中文：显式开发画布使用独立内存服务与公开示例，不读取设备、数据库、私有题库或调用模型；正式入口不会导入这个模块。
// EN: The explicit development canvas uses an isolated in-memory service and public examples, without device, database, private-bank or model access; production entries do not import this module.
function createService(screen: TutorPreviewScreen, language: 'en' | 'zh'): typeof learningTutorApi {
  const context: TutorContext = { kind: 'resource', contentVersion: learningPreviewContent.contentVersion, entityCode: 'waste-climate-sdg13' };
  const uid = 'ui-preview-tutor'; const createdAt = '2026-10-08T02:00:00Z';
  const conversation: TutorConversation = { conversationUid: uid, context, createdAt, expiresAt: '2026-11-07T02:00:00Z', withdrawn: screen === 'withdrawn' };
  const sources = learningPreviewContent.sources.filter(source => /unep|unfccc/i.test(source.publisher)).slice(0, 2);
  const reply: TutorReply = {
    conversationUid: uid, messageUid: 'ui-preview-answer',
    answer: language === 'zh' ? '食物走过的路，也留下排放。\n\n种植、运输和储存都需要资源。丢掉食物，也浪费了这些投入。\n\n先减少浪费，再考虑处理方式。'
      : 'Food’s journey also leaves emissions.\n\nGrowing, transporting and storing food use resources. Throwing food away wastes those inputs, too.\n\nPrevent waste first, then consider disposal.',
    sources, suggestedActions: [], contextLabel: { zh: '食物浪费与气候', en: 'Food waste & climate' },
    contentVersion: context.contentVersion, manifestVersion: 'ui-preview-only', answerStatus: 'answered', fallback: false,
  };
  let messages: TutorMessage[] = ['explanation', 'submitted', 'withdrawn'].includes(screen) ? [
    { messageUid: 'ui-preview-question', role: 'user', content: screen === 'submitted' ? 'explain' : language === 'zh' ? '为什么浪费食物也会影响气候？' : 'Why does wasting food affect the climate?', response: null, rating: null, createdAt },
    { messageUid: reply.messageUid, role: 'assistant', content: reply.answer, response: reply, rating: null, createdAt },
  ] : [];
  let preferences: TutorPreferences = { proactiveEnabled: true, personalizedEnabled: true, dwellHintsEnabled: false, timeZone: 'Australia/Sydney' };
  let exists = messages.length > 0;
  return {
    list: async () => ({ conversations: exists ? [conversation] : [] }), read: async () => ({ ...conversation, messages }),
    send: async (payload, signal) => {
      if (screen === 'failure') throw new Error('Offline preview failure');
      if (signal.aborted) throw new Error('Preview aborted');
      exists = true;
      messages = [...messages, { messageUid: `ui-preview-question-${messages.length}`, role: 'user', content: payload.message ?? payload.intent ?? '', response: null, rating: null, createdAt },
        { messageUid: `ui-preview-answer-${messages.length}`, role: 'assistant', content: reply.answer, response: reply, rating: null, createdAt }];
      return reply;
    },
    delete: async () => { messages = []; exists = false; }, clear: async () => { messages = []; exists = false; },
    feedback: async (messageUid, rating) => { messages = messages.map(message => message.messageUid === messageUid ? { ...message, rating } : message); },
    preferences: async () => preferences, savePreferences: async value => { preferences = { ...preferences, ...value }; return preferences; },
    recommendations: async () => ({ evidenceVersion: 'preview', ruleVersion: 'preview', windowDays: 30, topics: [] }),
    practice: async () => ({ templateCode: 'ui-preview-template', contentVersion: context.contentVersion,
      title: { zh: '练习：减少浪费', en: 'Practice: prevent waste' }, prompt: { zh: '买菜前，哪一步能帮助减少浪费？', en: 'Which step can help prevent waste before shopping?' },
      options: [{ optionId: 'plan', text: { zh: '看看已有食材，再计划用量', en: 'Check what you have and plan quantities' } },
        { optionId: 'more', text: { zh: '每次都多买一些', en: 'Always buy extra' } }, { optionId: 'ignore', text: { zh: '忽略已有食材', en: 'Ignore food already at home' } }], sourceRefs: [] }),
    practiceAnswer: async () => ({ isCorrect: true, correctOptionId: 'plan', explanation: { zh: '这是 UI 预览反馈，不代表正式评分。', en: 'This is UI preview feedback, not formal grading.' } }),
    hint: async () => ({ hintLevel: 1, hint: { zh: 'UI 预览提示', en: 'UI preview hint' } }), claim: async () => ({ intervention: null }), respond: async () => undefined,
    source: async code => { const source = sources.find(item => item.sourceCode === code); if (!source) throw new Error('Missing preview source'); return source; },
  };
}

export function LearningTutorPreview({ screen }: { screen: TutorPreviewScreen }) {
  const { t, language } = useI18n(); const copy = t.learningTutor;
  const service = useMemo(() => createService(screen, language), [screen, language]);
  const [closed, setClosed] = useState(false); const [offer, setOffer] = useState(true); const [read, setRead] = useState(false);
  if (!__DEV__) return null;
  const label = screen === 'submitted' ? { zh: '减少食物浪费，为什么有助于气候行动？', en: 'Why can preventing food waste support climate action?' }
    : { zh: '食物浪费与气候', en: 'Food waste & climate' };
  if (closed) return <View style={{ padding: 24, gap: 16 }}><Text>{language === 'zh' ? '预览面板已关闭' : 'Preview panel closed'}</Text><TutorEntryButton label={copy.ask} onPress={() => setClosed(false)} /></View>;
  if (screen === 'proactive') return <LearningTutorSlot.Provider value={{
    body: offer ? <TutorHelpCard prompt={copy.invitationBody} onAccept={() => setOffer(false)} onDismiss={() => setOffer(false)} onTurnOff={() => setOffer(false)} /> : null,
    footer: <TutorEntryButton label={copy.ask} onPress={() => setClosed(true)} />,
  }}><LearningResourceScreen content={learningPreviewContent} resourceCode="waste-climate-sdg13" read={read} busy={false} error={null}
    onBack={() => setClosed(true)} onMarkRead={() => setRead(true)} onNews={() => setClosed(true)} /></LearningTutorSlot.Provider>;
  const context: TutorContext = screen === 'submitted' ? { kind: 'submitted-question', contentVersion: learningPreviewContent.contentVersion, attemptUid: 'ui-preview-attempt', questionUid: 'ui-preview-submitted' }
    : screen === 'practice' ? { kind: 'practice-template', contentVersion: learningPreviewContent.contentVersion, entityCode: 'ui-preview-template' }
      : { kind: 'resource', contentVersion: learningPreviewContent.contentVersion, entityCode: 'waste-climate-sdg13' };
  return <LearningTutorPanel key={`${screen}:${language}`} embedded service={service} context={context} label={label} coverAssetKey="waste-climate-cover" showLifecycle
    restricted={screen === 'restricted' || screen === 'submitted'} onClose={() => setClosed(true)} onAction={() => undefined}
    onResume={screen === 'restricted' ? () => setClosed(true) : undefined} onAbandon={screen === 'restricted' ? async () => setClosed(true) : undefined} />;
}
