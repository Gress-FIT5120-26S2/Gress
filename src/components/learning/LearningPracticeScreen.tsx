import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { LearningSource } from '../../types/learningContent';
import type { LearningQuizView } from '../../types/learningRoom';
import type { WasteStream } from '../../services/wasteLearningApi';
import { WasteSortingInteraction } from '../fridge/WasteSortingInteraction';
import { LearningButton, LearningIcon, LearningImage, LearningLink, LearningPage, LearningProgress, LearningSourceLink, ui } from './LearningUi';
import { useLearningViewport } from './learningViewport';
import { LearningQuizScreen } from './LearningQuizScreen';

const streams: Record<string, WasteStream | undefined> = { organics: 'organics', 'food-organics': 'organics', recycling: 'recycling', general: 'general' };

// Arthur: NarIyirm
// 中文：教学投放只提交服务器选项 ID；反馈后的再演示不再次评分，也不会创建库存 waste 事件。
// EN: Teaching submits server option IDs only; demonstrations after feedback never regrade or create inventory waste events.
export function LearningPracticeScreen({ quiz, selectedOptionId, selectionLocked, sources, busy, error, onAnswer, onNext, onBack, onClose }: {
  quiz: LearningQuizView; selectedOptionId: string | null; selectionLocked: boolean; sources: LearningSource[];
  busy: boolean; error: string | null; onAnswer: (option: string) => void; onNext: () => void; onBack: () => void; onClose: () => void;
}) {
  const { language, t } = useI18n();
  const copy = t.learning;
  const { width } = useLearningViewport();
  const playWidth = Math.min(width - (width < 360 ? 36 : 48), 430);
  const position = useRef(new Animated.ValueXY()).current;
  const [hovered, setHovered] = useState(-1);
  const [dragging, setDragging] = useState(false);
  const [demonstrating, setDemonstrating] = useState(false);
  const [demonstrated, setDemonstrated] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [fallbackSelection, setFallbackSelection] = useState<string | null>(selectedOptionId);
  const feedback = quiz.feedback;
  const disabled = busy || (Boolean(feedback) && !demonstrating) || (selectionLocked && !feedback);
  const current = useRef({ disabled, demonstrating, feedback, options: quiz.question.options, onAnswer });
  current.current = { disabled, demonstrating, feedback, options: quiz.question.options, onAnswer };
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReducedMotion(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { alive = false; sub.remove(); position.stopAnimation(); };
  }, [position]);
  const returnItem = () => {
    position.stopAnimation();
    if (reducedMotion) position.setValue({ x: 0, y: 0 });
    else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: Platform.OS !== 'web', speed: 18, bounciness: 4 }).start();
    setHovered(-1); setDragging(false);
  };
  const choose = (index: number) => {
    const value = current.current;
    const option = value.options[index];
    if (value.disabled || !option) return;
    if (value.demonstrating) {
      if (option.optionId === value.feedback?.correctOptionId) { setDemonstrated(true); setDemonstrating(false); }
    } else value.onAnswer(option.optionId);
  };
  const gestureActions = useRef({ choose, returnItem });
  gestureActions.current = { choose, returnItem };
  const pan = useMemo(() => {
    const binAt = (dx: number, dy: number) => {
      const x = playWidth / 2 + dx;
      return dy >= 65 && dy <= 235 && x >= 0 && x < playWidth ? Math.floor(x / (playWidth / 3)) : -1;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !current.current.disabled,
      onMoveShouldSetPanResponder: (_, g) => !current.current.disabled && Math.abs(g.dx) + Math.abs(g.dy) > 5,
      onPanResponderGrant: () => { position.stopAnimation(); position.setValue({ x: 0, y: 0 }); setDragging(true); },
      onPanResponderMove: (_, g) => { position.setValue({ x: g.dx, y: g.dy }); setHovered(binAt(g.dx, g.dy)); },
      onPanResponderRelease: (_, g) => { const index = binAt(g.dx, g.dy); gestureActions.current.returnItem(); if (index >= 0) gestureActions.current.choose(index); },
      onPanResponderTerminate: () => gestureActions.current.returnItem(),
      onPanResponderTerminationRequest: () => false,
    });
  }, [playWidth, position]);
  // Arthur: NarIyirm
  // 中文：若未来课程的选项并非这三条收集流，回退到原测验选项，避免强行套用某地的三桶规则。
  // EN: Fall back to quiz options for future collection streams instead of imposing a local three-bin model.
  if (quiz.question.options.length !== 3 || quiz.question.options.some(o => !streams[o.optionId])) return <LearningQuizScreen quiz={quiz} stageTitle={{ en: copy.handsOn, zh: copy.handsOn }} selectedOptionId={selectionLocked ? selectedOptionId : fallbackSelection} sources={sources} busy={busy} error={error} selectionLocked={selectionLocked} onBack={onBack} onClose={onClose} onSelect={setFallbackSelection} onSubmit={() => { const option = selectionLocked ? selectedOptionId : fallbackSelection; if (option) onAnswer(option); }} onNext={onNext} />;
  return <LearningPage backLabel={copy.title} onBack={onBack} onClose={onClose} error={error} scrollEnabled={!dragging} testID="learning-practice"
    footer={feedback ? <LearningButton label={busy ? copy.saving : quiz.questionNumber === quiz.questionCount ? copy.seeResults : copy.nextQuestion} onPress={onNext} disabled={busy} />
      : selectionLocked ? <LearningButton label={busy ? copy.checking : copy.retry} disabled={busy} onPress={() => { if (selectedOptionId) onAnswer(selectedOptionId); }} /> : undefined}>
    <LearningProgress value={quiz.questionNumber / quiz.questionCount} label={copy.questionProgress(quiz.questionNumber, quiz.questionCount)} />
    <Text style={ui.eyebrow}>{copy.handsOn} · {copy.questionProgress(quiz.questionNumber, quiz.questionCount)}</Text>
    <Text accessibilityRole="header" style={ui.sectionTitle}>{quiz.question.prompt[language]}</Text>
    <Text style={ui.caption}>{quiz.question.serviceAssumptions[language]}</Text>
    <Text style={ui.secondary}>{copy.practiceInstructions}</Text>
    <WasteSortingInteraction mode="learning" width={playWidth} binY={125} gestureHandlers={pan.panHandlers} hovered={hovered} disabled={disabled} itemDisabled={disabled} reducedMotion={reducedMotion}
      itemLabel={copy.practiceItem} itemStyle={{ transform: position.getTranslateTransform() }} onChoose={choose}
      choices={quiz.question.options.map(o => ({ stream: streams[o.optionId]!, label: o.label[language], highlighted: feedback?.correctOptionId === o.optionId }))}
      item={quiz.question.imageAssetKey ? <LearningImage assetKey={quiz.question.imageAssetKey} style={{ width: 90, height: 110 }} /> : <LearningIcon name="cube-outline" size={72} />} />
    {selectionLocked && !feedback ? <Text accessibilityLiveRegion="polite" style={ui.caption}>{copy.selectionPending}</Text> : null}
    {feedback ? <View accessibilityLiveRegion="polite" style={ui.panel}><Text style={ui.listTitle}>{demonstrated ? copy.demonstrationDone : feedback.isCorrect ? copy.correct : copy.incorrect}</Text>
      <Text style={ui.body}>{feedback.explanation[language]}</Text><Text style={ui.caption}>{copy.firstAnswer}</Text>
      {!feedback.isCorrect && !demonstrated ? <LearningLink label={copy.demonstrate} onPress={() => { if (!busy) { setDemonstrating(true); returnItem(); } }} /> : null}
      {feedback.sourceRefs.map(code => { const source = sources.find(s => s.sourceCode === code); return source ? <LearningSourceLink key={code} label={source.publisher} url={source.url} /> : null; })}
    </View> : null}
    <Text style={ui.caption}>{copy.councilHint} {copy.practicePending}</Text>
  </LearningPage>;
}
