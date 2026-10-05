import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { LearningSource, LearningText } from '../../types/learningContent';
import type { LearningQuizView } from '../../types/learningRoom';
import { LearningButton, LearningIcon, LearningImage, LearningPage, LearningProgress, LearningSourceLink, ui } from './LearningUi';
import { learningColors as c, learningStyles as s, learningTypography } from './learningTheme';

export function LearningQuizScreen({ quiz, stageTitle, selectedOptionId, sources, onSelect, onSubmit, onNext, onBack, onClose, busy, error, reviewing = false }: {
  quiz: LearningQuizView; stageTitle: LearningText; selectedOptionId: string | null; sources: LearningSource[];
  onSelect: (id: string) => void; onSubmit: () => void; onNext: () => void; onBack: () => void; onClose: () => void;
  busy: boolean; error: string | null; reviewing?: boolean;
}) {
  const { language, t } = useI18n();
  const copy = t.learning;
  const feedback = quiz.feedback;
  const frozen = feedback !== null || reviewing;
  const selected = feedback?.selectedOptionId ?? selectedOptionId;
  const last = quiz.questionNumber === quiz.questionCount;
  const nextLabel = reviewing ? last ? copy.reviewComplete : copy.nextQuestion : last ? copy.seeResults : copy.nextQuestion;
  return <LearningPage backLabel={copy.title} onBack={onBack} onClose={onClose} error={error} testID="learning-quiz"
    footer={<><LearningButton label={busy ? copy.checking : feedback || reviewing ? nextLabel : copy.checkAnswer}
      disabled={busy || (!selected && !reviewing)} onPress={feedback || reviewing ? onNext : onSubmit} testID="learning-check-answer" />
      <Text style={[ui.caption, { textAlign: 'center', paddingTop: 4 }]}>{copy.noTimeLimit}</Text></>}>
    <View style={ui.section}><LearningProgress value={quiz.questionNumber / quiz.questionCount} label={copy.questionProgress(quiz.questionNumber, quiz.questionCount)} />
      <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={[ui.body, ui.flex]}>{reviewing ? copy.reviewTitle : quiz.mode !== 'checkpoint' ? copy.reviewStage(stageTitle[language]) : copy.checkpoint(stageTitle[language])}</Text>
        <Text style={ui.body}>{copy.questionProgress(quiz.questionNumber, quiz.questionCount)}</Text></View>
    </View>
    <View style={ui.group}><Text style={ui.caption}>{quiz.question.regionCode === 'AU-VIC' ? copy.practiceGuide : copy.globalGuide}</Text>
      <Text accessibilityRole="header" style={styles.question}>{quiz.question.prompt[language]}</Text></View>
    {quiz.question.imageAssetKey ? <View style={styles.illustration}><LearningImage assetKey={quiz.question.imageAssetKey} label={copy.canAlt} style={{ width: 150, height: 165 }} /></View> : null}
    <View accessibilityRole="radiogroup" style={{ gap: 10 }}>{quiz.question.options.map((option) => {
      const chosen = selected === option.optionId;
      const correct = feedback?.correctOptionId === option.optionId;
      const wrong = chosen && feedback && !feedback.isCorrect;
      return <Pressable key={option.optionId} accessibilityRole="radio" accessibilityLabel={option.label[language]}
        aria-checked={chosen}
        accessibilityState={{ checked: chosen, disabled: frozen || busy }} disabled={frozen || busy} onPress={() => onSelect(option.optionId)}
        testID={`learning-option-${option.optionId}`} style={({ pressed }) => [s.option, chosen ? s.selectedOption : null,
          wrong ? styles.wrongOption : null, pressed ? s.pressed : null]}>
        <View style={[styles.radio, chosen ? styles.selectedRadio : null, wrong ? { borderColor: c.error } : null]}>
          {chosen ? <View style={[styles.radioDot, wrong ? { backgroundColor: c.error } : null]} /> : null}
        </View><View style={ui.flex}><Text style={[learningTypography.option, { color: c.textPrimary }]}>{option.label[language]}</Text>
          {feedback && (chosen || correct) ? <Text style={[ui.caption, { color: wrong ? c.error : c.learningGreenReadable }]}>{correct ? copy.correctAnswer : copy.yourAnswer}</Text> : null}</View>
        {correct && feedback ? <LearningIcon name="checkmark-circle-outline" size={23} /> : wrong ? <LearningIcon name="close-circle-outline" size={23} color={c.error} /> : null}
      </Pressable>;
    })}</View>
    {quiz.question.regionCode === 'AU-VIC' ? <View style={[ui.row, { alignItems: 'flex-start', gap: 8 }]}><LearningIcon name="information-circle-outline" size={18} color={c.textSecondaryReadable} />
      <Text style={[ui.caption, ui.flex]}>{copy.councilHint}</Text></View> : null}
    <Text style={ui.caption}>{quiz.question.serviceAssumptions[language]}</Text>
    {feedback ? <View accessibilityLiveRegion="polite" style={[ui.panel, feedback.isCorrect ? null : styles.feedbackError]}>
      <View style={ui.row}><LearningIcon name={feedback.isCorrect ? 'checkmark-circle-outline' : 'information-circle-outline'} color={feedback.isCorrect ? c.learningGreenReadable : c.error} />
        <Text style={ui.listTitle}>{feedback.isCorrect ? copy.correct : copy.incorrect}</Text></View>
      <Text style={ui.body}>{feedback.explanation[language]}</Text><Text style={ui.caption}>{copy.firstAnswer}</Text>
      {feedback.sourceRefs.map((code) => { const source = sources.find((item) => item.sourceCode === code); return source ? <LearningSourceLink key={code} label={source.publisher} url={source.url} /> : null; })}
    </View> : null}
  </LearningPage>;
}

const styles = StyleSheet.create({
  question: { ...learningTypography.question, color: c.textPrimary },
  illustration: { height: 178, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, borderColor: '#AAB9B2', alignItems: 'center', justifyContent: 'center' },
  selectedRadio: { borderColor: c.learningGreen }, radioDot: { width: 17, height: 17, borderRadius: 9, backgroundColor: c.learningGreen },
  wrongOption: { borderColor: c.error, backgroundColor: '#FFF5F4' },
  feedbackError: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.error },
});
