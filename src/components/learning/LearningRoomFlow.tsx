import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, BackHandler, Modal, PanResponder, Platform, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { PublicLearningContent } from '../../types/learningContent';
import type { LearningOrigin, LearningRoomGateway, LearningRoute, LearningSessionView, LearningStageCode, LearningQuizView, LearningOutcome, LearningRecentResult } from '../../types/learningRoom';
import { getLearningErrorCode } from '../../services/learningGateway';
import { LearningPracticeScreen } from './LearningPracticeScreen';
import { LearningLazyModal } from './LearningLazyModal';
import { LearningCourseScreen } from './LearningCourseScreen';
import { LearningHub } from './LearningHub';
import { LearningQuizScreen } from './LearningQuizScreen';
import { LearningResourceScreen } from './LearningResourceScreen';
import { LearningResultScreen } from './LearningResultScreen';
import { learningNavigationReducer } from './learningNavigation';
import { createLearningBackGesture } from './learningBackGesture';
import { LearningBody, LearningButton, LearningPage, ui } from './LearningUi';
import { learningColors as c } from './learningTheme';
import { LearningBottomSafeAreaContext, LearningWidthContext } from './learningViewport';
import { LearningTutorController } from './tutor/LearningTutorController';

const loadStory = () => import('../LinearFoodWasteStory').then(m => ({ default: m.LinearFoodWasteStory }));

type Props = {
  gateway: LearningRoomGateway; origin: LearningOrigin; onClose: () => void;
  initialRoute?: LearningRoute; embedded?: boolean;
};

function LearningRoomContent({ gateway, origin, onClose, initialRoute, embedded = false }: Props) {
  const { language, t } = useI18n();
  const copy = t.learning;
  const outcomeRoute = (value: LearningOutcome): LearningRoute => {
    if (!('question' in value)) return { name: 'result', result: value };
    const pending = !value.feedback ? gateway.getPendingAnswer?.(value.attemptUid, value.question.questionUid) : null;
    return { name: 'quiz', quiz: value, selectedOptionId: value.feedback?.selectedOptionId ?? pending ?? null, answerPending: Boolean(pending) };
  };
  const [content, setContent] = useState<PublicLearningContent | null>(null);
  const [session, setSession] = useState<LearningSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentResults, setRecentResults] = useState<LearningRecentResult[]>([]);
  const [storyVisible, setStoryVisible] = useState(false);
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
  const copyRef = useRef(copy); copyRef.current = copy;
  const errorText = (value: unknown, fallback: string) => {
    const code = getLearningErrorCode(value);
    if (code === 'content_unavailable') return copyRef.current.unavailable;
    if (code === 'attempt_invalidated' || code === 'attempt_not_active' || code === 'attempt_not_found' || code === 'learning_content_changed') return copyRef.current.invalidated;
    if (code === 'learning_identity_changed' || code === 'device_credential_revoked' || code === 'invalid_device_credential') return copyRef.current.identityChanged;
    return fallback;
  };
  const hydrate = () => { const value = gateway.getState?.(); if (value) { setSession(value.session); setRecentResults(value.recentResults); } };
  const frozenSources = (uid: string) => gateway.getSources?.(uid)?.length ? gateway.getSources(uid) : content?.sources ?? [];
  const route = stack[stack.length - 1];
  const routeRef = useRef(route); routeRef.current = route;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestId.current += 1; }; }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    inFlight.current = true; setLoading(true); setError(null);
    try {
      const value = await gateway.load();
      if (mounted.current && requestId.current === id) { setContent(value.content); setSession(value.session); setRecentResults(value.recentResults ?? []); }
    } catch (failure) { if (mounted.current && requestId.current === id) setError(errorText(failure, loadErrorCopy.current)); }
    finally { if (mounted.current && requestId.current === id) { setLoading(false); inFlight.current = false; } }
  }, [gateway]);
  useEffect(() => { void load(); }, [load]);

  const cancelPendingUi = useCallback(() => {
    requestId.current += 1; inFlight.current = false; setBusy(false); setError(null);
  }, []);
  const back = useCallback(() => {
    if (storyVisible) { setStoryVisible(false); return; }
    cancelPendingUi();
    if (stack.length === 1) onClose(); else dispatch({ type: 'back' });
  }, [cancelPendingUi, onClose, stack.length, storyVisible]);
  const close = useCallback(() => { cancelPendingUi(); onClose(); }, [cancelPendingUi, onClose]);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove(); }, [back]);
  // Arthur: NarIyirm
  // 中文：主 Tab 根页不使用滑动返回；保持手势实例稳定，并读取最新返回目标，避免主题滚动或重渲染误切主导航。
  // EN: Primary tab roots have no swipe-back; keep the gesture stable and read the latest destination so topic scrolling or re-renders cannot switch primary tabs.
  const backGestureActions = useRef({ enabled: false, back });
  backGestureActions.current = { enabled: Platform.OS === 'ios' && (origin !== 'tab' || stack.length > 1) && !storyVisible, back };
  const edge = useMemo(() => PanResponder.create(createLearningBackGesture({
    isEnabled: () => backGestureActions.current.enabled,
    onBack: () => backGestureActions.current.back(),
  })), []);

  // Arthur: NarIyirm
  // 中文：返回或关闭会使旧请求的 UI 更新失效；服务端成功仍由下次加载恢复，避免迟到响应把用户带回已离开的页面。
  // EN: Back/close invalidate stale UI updates; server success is recovered on the next load, so late responses cannot pull users into a screen they left.
  const run = async <T,>(operation: () => Promise<T>, apply: (value: T) => void, failure = copy.actionFailed) => {
    if (inFlight.current) return;
    const id = ++requestId.current;
    inFlight.current = true; setBusy(true); setError(null);
    try { const value = await operation(); if (mounted.current && requestId.current === id) { hydrate(); apply(value); } }
    catch (error) { if (mounted.current && requestId.current === id) {
      hydrate(); setError(errorText(error, failure));
      const code = getLearningErrorCode(error);
      if (code === 'attempt_invalidated' || code === 'attempt_not_active' || code === 'attempt_not_found') dispatch({ type: 'hub', route: { name: 'hub', segment: 'learn' } });
      if (code === 'learning_identity_changed') { setContent(null); setSession(null); dispatch({ type: 'hub', route: { name: 'hub', segment: 'learn' } }); }
    } }
    finally { if (mounted.current && requestId.current === id) { inFlight.current = false; setBusy(false); } }
  };
  const navigate = (next: LearningRoute) => { cancelPendingUi(); dispatch({ type: 'push', route: next }); };
  const openQuiz = (stage: LearningStageCode, mode: LearningQuizView['mode'] = 'checkpoint', activityCode?: string) => {
    void run(() => gateway.startQuiz(stage, mode, activityCode), (value) => dispatch({ type: 'push', route: outcomeRoute(value) }));
  };
  const resume = () => {
    if (!session) return;
    const target = session.resumeTarget;
    if (target.type === 'activity') navigate({ name: 'lesson', activityCode: target.activityCode });
    else if (target.type === 'checkpoint') openQuiz(target.stageCode);
    else if (target.type === 'mixed-review') openQuiz('advanced', 'mixed-review');
    else void run(() => gateway.resumeQuiz(target.attemptUid), (value) => dispatch({ type: 'push', route: outcomeRoute(value) }));
  };
  // Arthur: NarIyirm
  // 中文：回到前台重新读取服务器游标；不覆盖已结束页面，未确认的首选仍锁定，直到服务器反馈或用户重试。
  // EN: Refresh the server cursor on foreground without reopening finished screens; an unconfirmed first choice stays locked until feedback or retry.
  const refresh = useRef<() => void>(() => undefined);
  refresh.current = () => {
    void run(async () => {
      const value = await gateway.load();
      const current = routeRef.current;
      const restored = current.name === 'quiz' ? await gateway.resumeQuiz(current.quiz.attemptUid) : null;
      return { value, restored, current };
    }, ({ value, restored, current }) => {
      setContent(value.content); setSession(gateway.getState?.()?.session ?? value.session); setRecentResults(gateway.getState?.()?.recentResults ?? value.recentResults ?? []);
      if (restored && current.name === 'quiz') {
        const next = outcomeRoute(restored);
        if (next.name === 'quiz' && !next.quiz.feedback && current.quiz.question.questionUid === next.quiz.question.questionUid) {
          next.selectedOptionId = current.selectedOptionId; next.answerPending = current.answerPending;
        }
        dispatch({ type: 'replace', route: next });
      }
    });
  };
  useEffect(() => { const sub = AppState.addEventListener('change', value => { if (value === 'active') refresh.current(); }); return () => sub.remove(); }, []);
  const present = (node: ReactNode) => {
    const body = <View style={{ flex: 1 }} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
      <LearningBottomSafeAreaContext.Provider value={origin !== 'tab'}>
        <LearningWidthContext.Provider value={containerWidth}>{node}</LearningWidthContext.Provider>
      </LearningBottomSafeAreaContext.Provider>
    </View>;
    return embedded ? body : <Modal visible presentationStyle="fullScreen" animationType="none" onRequestClose={back}>{body}</Modal>;
  };

  if (loading || !content || !session) return present(<LearningPage backLabel={origin === 'home' ? copy.home : copy.profile} onBack={origin === 'tab' ? undefined : close} brand testID="learning-load"
    footer={!loading ? <LearningButton label={copy.retry} onPress={() => { void load(); }} /> : undefined}>
    <Text accessibilityRole="header" style={ui.title}>{copy.title}</Text><Text style={ui.secondary}>{copy.tagline}</Text>
    <View style={[ui.panel, { minHeight: 190, justifyContent: 'center', gap: 16 }]}>
      {loading ? <><ActivityIndicator color={c.learningGreen} /><Text style={[ui.secondary, { textAlign: 'center' }]}>{copy.loading}</Text></>
        : <><Text style={ui.sectionTitle}>{copy.errorTitle}</Text><Text accessibilityLiveRegion="polite" style={ui.secondary}>{error ?? copy.errorBody}</Text></>}
    </View>
  </LearningPage>);

  let screen;
  if (route.name === 'hub') screen = <LearningHub key={`${route.segment}:${route.libraryCategory ?? 'all'}`} content={content} session={session} origin={origin}
    recentResults={recentResults} onResult={(uid) => { void run(() => gateway.resumeQuiz(uid), value => dispatch({ type: 'push', route: outcomeRoute(value) })); }} onRefresh={() => { dispatch({ type: 'hub', route: { name: 'hub', segment: 'learn' } }); void load(); }}
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
      {activity.type === 'video' ? <LearningButton label={copy.watchAnimation} onPress={() => setStoryVisible(true)} /> : null}
      <LearningBody blocks={activity.body} sources={content.sources} />
      {activity.type === 'practice' ? <View style={ui.panel}><Text style={ui.body}>{copy.practiceBody}</Text><Text style={ui.caption}>{copy.practicePending}</Text><LearningButton label={copy.startPractice} disabled={busy} onPress={() => openQuiz(activity.stageCode, 'practice', activity.activityCode)} /></View> : null}
    </LearningPage>;
  } else if (route.name === 'quiz') {
    const quiz = route.quiz;
    const stage = content.stages.find((item) => item.stageCode === quiz.stageCode)!;
    const submit = (option: string) => {
      if (quiz.feedback || inFlight.current) return;
      const selected = route.answerPending ? route.selectedOptionId : option;
      if (!selected) return;
      dispatch({ type: 'replace', route: { ...route, selectedOptionId: selected, answerPending: true } });
      void run(() => gateway.submitAnswer(quiz.attemptUid, quiz.question.questionUid, selected), value => dispatch({ type: 'replace', route: outcomeRoute(value) }), copy.submissionError);
    };
    const next = () => {
      if (!quiz.feedback) return;
      void run(() => quiz.questionNumber === quiz.questionCount ? gateway.finishQuiz(quiz.attemptUid) : gateway.nextQuestion(quiz.attemptUid), value => dispatch({ type: 'replace', route: outcomeRoute(value) }));
    };
    const quizClose = () => { cancelPendingUi(); dispatch({ type: 'hub', route: { name: 'hub', segment: 'learn' } }); };
    screen = quiz.mode === 'practice' ? <LearningPracticeScreen key={`${quiz.attemptUid}:${quiz.question.questionUid}`} quiz={quiz} selectedOptionId={route.selectedOptionId} selectionLocked={Boolean(route.answerPending)} sources={frozenSources(quiz.attemptUid)} busy={busy} error={error} onBack={back} onClose={quizClose} onAnswer={submit} onNext={next} />
      : <LearningQuizScreen key={`${quiz.attemptUid}:${quiz.question.questionUid}`} quiz={quiz} stageTitle={stage.title} selectedOptionId={route.selectedOptionId} sources={frozenSources(quiz.attemptUid)} selectionLocked={route.answerPending}
        onBack={back} onClose={quizClose} busy={busy} error={error}
        onSelect={(id) => { if (!quiz.feedback && !route.answerPending && !busy) dispatch({ type: 'replace', route: { ...route, selectedOptionId: id } }); }}
        onSubmit={() => { if (route.selectedOptionId) submit(route.selectedOptionId); }} onNext={next}
        onRestart={gateway.abandonQuiz ? () => { void run(async () => { await gateway.abandonQuiz!(quiz.attemptUid); return gateway.startQuiz(quiz.stageCode, quiz.mode); }, value => dispatch({ type: 'replace', route: outcomeRoute(value) })); } : undefined} />;
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
      selectedOptionId={quiz.feedback?.selectedOptionId ?? null} sources={frozenSources(quiz.attemptUid)} busy={false} error={null} onBack={back} onClose={back} onSelect={() => undefined} onSubmit={() => undefined}
      onNext={() => route.index + 1 < route.questions.length ? dispatch({ type: 'replace', route: { ...route, index: route.index + 1 } }) : back()} />;
  }
  const body = <View style={{ flex: 1 }} {...edge.panHandlers}>{screen}{storyVisible ? <LearningLazyModal load={loadStory} componentProps={{ onClose: () => setStoryVisible(false) }} onClose={() => setStoryVisible(false)} closeLabel={copy.cancel} /> : null}</View>;
  return present(gateway.getState ? <LearningTutorController content={content} route={route} gateway={gateway} busy={busy} storyVisible={storyVisible}
    onNavigate={navigate} onResume={(uid) => { void run(() => gateway.resumeQuiz(uid), value => dispatch({ type: 'push', route: outcomeRoute(value) })); }}
    onAbandoned={() => { hydrate(); dispatch({ type: 'hub', route: { name: 'hub', segment: 'learn' } }); }}>{body}</LearningTutorController> : body);
}

export function LearningRoomFlow({ embedded = false, ...props }: Props) {
  return <LearningRoomContent {...props} embedded={embedded} />;
}
