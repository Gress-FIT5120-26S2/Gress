import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Modal, PanResponder, Platform, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { PublicLearningContent } from '../../types/learningContent';
import type { LearningOrigin, LearningRoomGateway, LearningRoute, LearningSessionView, LearningStageCode, LearningQuizView } from '../../types/learningRoom';
import { LearningCourseScreen } from './LearningCourseScreen';
import { LearningHub } from './LearningHub';
import { LearningQuizScreen } from './LearningQuizScreen';
import { LearningResourceScreen } from './LearningResourceScreen';
import { LearningResultScreen } from './LearningResultScreen';
import { learningNavigationReducer } from './learningNavigation';
import { LearningBody, LearningButton, LearningIcon, LearningPage, ui } from './LearningUi';
import { learningColors as c } from './learningTheme';
import { LearningWidthContext } from './learningViewport';

type Props = {
  gateway: LearningRoomGateway; origin: LearningOrigin; onClose: () => void;
  initialRoute?: LearningRoute; embedded?: boolean;
};

function LearningRoomContent({ gateway, origin, onClose, initialRoute, embedded = false }: Props) {
  const { language, t } = useI18n();
  const copy = t.learning;
  const [content, setContent] = useState<PublicLearningContent | null>(null);
  const [session, setSession] = useState<LearningSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialStack: LearningRoute[] = initialRoute ? [{ name: 'hub', segment: 'learn' }, initialRoute] : [{ name: 'hub', segment: 'learn' }];
  const [stack, dispatch] = useReducer(learningNavigationReducer, initialStack);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  // Arthur: NarIyirm
  // 中文：切换语言只更换提示文案，不重新加载并丢弃当前的学习视图。
  // EN: Language changes update error copy without reloading and discarding the current learning view.
  const loadErrorCopy = useRef(copy.errorBody);
  loadErrorCopy.current = copy.errorBody;
  const route = stack[stack.length - 1];
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestId.current += 1; }; }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    inFlight.current = true; setLoading(true); setError(null);
    try {
      const value = await gateway.load();
      if (mounted.current && requestId.current === id) { setContent(value.content); setSession(value.session); }
    } catch { if (mounted.current && requestId.current === id) setError(loadErrorCopy.current); }
    finally { if (mounted.current && requestId.current === id) { setLoading(false); inFlight.current = false; } }
  }, [gateway]);
  useEffect(() => { void load(); }, [load]);

  const cancelPendingUi = useCallback(() => {
    requestId.current += 1; inFlight.current = false; setBusy(false); setError(null);
  }, []);
  const back = useCallback(() => {
    cancelPendingUi();
    if (stack.length === 1) onClose(); else dispatch({ type: 'back' });
  }, [cancelPendingUi, onClose, stack.length]);
  const close = useCallback(() => { cancelPendingUi(); onClose(); }, [cancelPendingUi, onClose]);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove(); }, [back]);
  const edge = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => Platform.OS === 'ios' && gesture.x0 <= 24 && gesture.dx > 18 && Math.abs(gesture.dy) < 12,
    onPanResponderRelease: (_, gesture) => { if (gesture.dx > 65 && Math.abs(gesture.dy) < 35) back(); },
  }), [back]);

  // Arthur: NarIyirm
  // 中文：返回或关闭会使旧请求的 UI 更新失效；服务端成功仍由下次加载恢复，避免迟到响应把用户带回已离开的页面。
  // EN: Back/close invalidate stale UI updates; server success is recovered on the next load, so late responses cannot pull users into a screen they left.
  const run = async <T,>(operation: () => Promise<T>, apply: (value: T) => void, failure = copy.actionFailed) => {
    if (inFlight.current) return;
    const id = ++requestId.current;
    inFlight.current = true; setBusy(true); setError(null);
    try { const value = await operation(); if (mounted.current && requestId.current === id) apply(value); }
    catch { if (mounted.current && requestId.current === id) setError(failure); }
    finally { if (mounted.current && requestId.current === id) { inFlight.current = false; setBusy(false); } }
  };
  const navigate = (next: LearningRoute) => { cancelPendingUi(); dispatch({ type: 'push', route: next }); };
  const openQuiz = (stage: LearningStageCode, mode: LearningQuizView['mode'] = 'checkpoint') => {
    void run(() => gateway.startQuiz(stage, mode), (quiz) => dispatch({ type: 'push', route: { name: 'quiz', quiz, selectedOptionId: null } }));
  };
  const resume = () => {
    if (!session) return;
    const target = session.resumeTarget;
    if (target.type === 'activity') navigate({ name: 'lesson', activityCode: target.activityCode });
    else if (target.type === 'checkpoint') openQuiz(target.stageCode);
    else if (target.type === 'mixed-review') openQuiz('advanced', 'mixed-review');
    else void run(() => gateway.resumeQuiz(target.attemptUid), (quiz) => dispatch({ type: 'push', route: { name: 'quiz', quiz, selectedOptionId: null } }));
  };
  const present = (node: ReactNode) => {
    const body = <View style={{ flex: 1 }} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
      <LearningWidthContext.Provider value={containerWidth}>{node}</LearningWidthContext.Provider>
    </View>;
    return embedded ? body : <Modal visible presentationStyle="fullScreen" animationType="none" onRequestClose={back}>{body}</Modal>;
  };

  if (loading || !content || !session) return present(<LearningPage backLabel={origin === 'home' ? copy.home : copy.profile} onBack={close} brand testID="learning-load"
    footer={!loading ? <LearningButton label={copy.retry} onPress={() => { void load(); }} /> : undefined}>
    <Text accessibilityRole="header" style={ui.title}>{copy.title}</Text><Text style={ui.secondary}>{copy.tagline}</Text>
    <View style={[ui.panel, { minHeight: 190, justifyContent: 'center', gap: 16 }]}>
      {loading ? <><ActivityIndicator color={c.learningGreen} /><Text style={[ui.secondary, { textAlign: 'center' }]}>{copy.loading}</Text></>
        : <><Text style={ui.sectionTitle}>{copy.errorTitle}</Text><Text accessibilityLiveRegion="polite" style={ui.secondary}>{error ?? copy.errorBody}</Text></>}
    </View>
  </LearningPage>);

  let screen;
  if (route.name === 'hub') screen = <LearningHub key={`${route.segment}:${route.libraryCategory ?? 'all'}`} content={content} session={session} origin={origin}
    segment={route.segment} initialCategory={route.libraryCategory} busy={busy} error={error} onClose={close}
    onSegment={(segment) => { cancelPendingUi(); dispatch({ type: 'hub', route: { name: 'hub', segment } }); }}
    onCourse={(courseCode) => navigate({ name: 'course', courseCode })} onActivity={(activityCode) => navigate({ name: 'lesson', activityCode })}
    onResource={(resourceCode) => navigate({ name: 'resource', resourceCode })} onContinue={resume} />;
  else if (route.name === 'course') screen = <LearningCourseScreen content={content} session={session} courseCode={route.courseCode} onBack={back} busy={busy} error={error}
    onActivity={(activityCode) => navigate({ name: 'lesson', activityCode })}
    onCheckpoint={(stageCode) => openQuiz(stageCode, session.stageStatus[stageCode] === 'completed' ? 'review' : 'checkpoint')}
    onResource={(resourceCode) => navigate({ name: 'resource', resourceCode })} />;
  else if (route.name === 'resource') screen = <LearningResourceScreen key={route.resourceCode} content={content} resourceCode={route.resourceCode} read={session.readResourceCodes.includes(route.resourceCode)} onBack={back} busy={busy} error={error}
    onMarkRead={() => { void run(() => gateway.markResource(route.resourceCode), setSession); }}
    onNews={() => { cancelPendingUi(); dispatch({ type: 'hub', route: { name: 'hub', segment: 'library', libraryCategory: 'news' } }); }} />;
  else if (route.name === 'lesson') {
    const activity = content.activities.find((item) => item.activityCode === route.activityCode)!;
    const complete = session.completedActivityCodes.includes(activity.activityCode);
    screen = <LearningPage key={activity.activityCode} backLabel={copy.title} onBack={back} error={error}
      footer={activity.type !== 'practice' ? <LearningButton label={busy ? copy.saving : complete ? copy.lessonComplete : copy.markLesson}
        onPress={() => { void run(() => gateway.markActivity(activity.activityCode), setSession); }} disabled={busy || complete} /> : undefined}>
      <View style={ui.group}><Text style={ui.eyebrow}>{copy.lessonSummary} · {copy.minutes(activity.durationEstimate.minutes)}</Text>
        <Text accessibilityRole="header" style={ui.title}>{activity.title[language]}</Text><Text style={ui.secondary}>{activity.objective[language]}</Text></View>
      <LearningBody blocks={activity.body} sources={content.sources} />
      {activity.type === 'practice' ? <View style={ui.panel}><LearningIcon name="trash-outline" /><Text style={ui.body}>{copy.practiceBody}</Text><Text style={ui.caption}>{copy.practicePending}</Text></View> : null}
    </LearningPage>;
  } else if (route.name === 'quiz') {
    const quiz = route.quiz;
    const stage = content.stages.find((item) => item.stageCode === quiz.stageCode)!;
    screen = <LearningQuizScreen key={`${quiz.attemptUid}:${quiz.question.questionUid}`} quiz={quiz} stageTitle={stage.title} selectedOptionId={route.selectedOptionId} sources={content.sources}
      onBack={back} onClose={() => { cancelPendingUi(); dispatch({ type: 'hub', route: { name: 'hub', segment: 'learn' } }); }} busy={busy} error={error}
      onSelect={(optionId) => { if (!quiz.feedback) dispatch({ type: 'replace', route: { ...route, selectedOptionId: optionId } }); }}
      onSubmit={() => { if (route.selectedOptionId && !quiz.feedback) void run(() => gateway.submitAnswer(quiz.attemptUid, quiz.question.questionUid, route.selectedOptionId!),
        (value) => dispatch({ type: 'replace', route: { name: 'quiz', quiz: value, selectedOptionId: value.feedback?.selectedOptionId ?? route.selectedOptionId } }), copy.submissionError); }}
      onNext={() => { if (!quiz.feedback) return;
        if (quiz.questionNumber === quiz.questionCount) void run(() => gateway.finishQuiz(quiz.attemptUid), (result) => { setSession(result.session); dispatch({ type: 'replace', route: { name: 'result', result } }); });
        else void run(() => gateway.nextQuestion(quiz.attemptUid), (value) => dispatch({ type: 'replace', route: { name: 'quiz', quiz: value, selectedOptionId: null } }));
      }} />;
  } else if (route.name === 'result') {
    const result = route.result;
    screen = <LearningResultScreen content={content} result={result} onBack={back} busy={busy} error={error}
      onStartNext={() => { const next = content.stages.find((item) => item.stageCode === result.nextStageCode);
        if (result.mode !== 'checkpoint') { cancelPendingUi(); dispatch({ type: 'hub', route: { name: 'hub', segment: 'path' } }); return; }
        if (result.passed && next) navigate({ name: 'course', courseCode: next.courseCode });
        else openQuiz(result.stageCode, result.passed ? 'mixed-review' : 'checkpoint'); }}
      onReviewStage={() => openQuiz(result.stageCode, 'review')}
      onMissed={() => { void run(() => gateway.reviewMissed(result.attemptUid), (questions) => { if (questions.length > 0) dispatch({ type: 'push', route: { name: 'review', questions, index: 0 } }); }); }} />;
  } else {
    const quiz = route.questions[route.index];
    const stage = content.stages.find((item) => item.stageCode === quiz.stageCode)!;
    screen = <LearningQuizScreen key={`review:${route.index}`} reviewing quiz={{ ...quiz, questionNumber: route.index + 1, questionCount: route.questions.length }} stageTitle={stage.title}
      selectedOptionId={quiz.feedback?.selectedOptionId ?? null} sources={content.sources} busy={false} error={null} onBack={back} onClose={back} onSelect={() => undefined} onSubmit={() => undefined}
      onNext={() => route.index + 1 < route.questions.length ? dispatch({ type: 'replace', route: { ...route, index: route.index + 1 } }) : back()} />;
  }
  return present(<View style={{ flex: 1 }} {...edge.panHandlers}>{screen}</View>);
}

export function LearningRoomFlow({ embedded = false, ...props }: Props) {
  return <LearningRoomContent {...props} embedded={embedded} />;
}
