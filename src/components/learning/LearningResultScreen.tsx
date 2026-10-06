import { Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { PublicLearningContent } from '../../types/learningContent';
import type { LearningResultView } from '../../types/learningRoom';
import { LearningButton, LearningIcon, LearningImage, LearningLink, LearningPage, LearningPath, ui } from './LearningUi';
import { learningColors as c } from './learningTheme';

export function LearningResultScreen({ content, result, onBack, onStartNext, onReviewStage, onMissed, busy, error }: {
  content: PublicLearningContent; result: LearningResultView; onBack: () => void; onStartNext: () => void;
  onReviewStage: () => void; onMissed: () => void; busy: boolean; error: string | null;
}) {
  const { language, t } = useI18n();
  const copy = t.learning;
  const stage = content.stages.find((item) => item.stageCode === result.stageCode)!;
  const next = content.stages.find((item) => item.stageCode === result.nextStageCode);
  const complete = result.passed && result.nextStageCode === null && result.mode === 'checkpoint';
  const reviewing = result.mode !== 'checkpoint';
  const headline = result.mode === 'practice' ? copy.practiceFinished : reviewing ? copy.reviewFinished : result.passed ? complete ? copy.pathComplete : copy.complete(stage.title[language]) : copy.notPassed;
  return <LearningPage backLabel={copy.title} onBack={onBack} error={error} testID="learning-result" contentGap={12}
    footer={<><LearningButton label={reviewing ? copy.continueLesson : result.passed ? next ? copy.startStage(next.title[language]) : copy.mixedReview : copy.tryAgain}
      onPress={onStartNext} disabled={busy} testID="learning-next-stage" />
      <LearningLink centered label={copy.reviewStage(stage.title[language])} onPress={onReviewStage} icon="refresh-outline" /></>}>
    <View style={[ui.center, { gap: 6 }]}>
      {result.passed || result.mode === 'practice' ? <LearningImage assetKey="learning-complete-seal" style={{ width: 112, height: 112 }} /> : <View style={[ui.iconDisc, { width: 92, height: 92, borderRadius: 46, backgroundColor: c.skySurface }]}><LearningIcon name="book-outline" size={38} color={c.skyText} /></View>}
      <Text accessibilityRole="header" style={[ui.title, { textAlign: 'center', fontSize: 30, lineHeight: 37 }]}>{headline}</Text>
      <Text style={[ui.secondary, { textAlign: 'center' }]}>{result.mode === 'practice' ? copy.practiceSaved : reviewing ? copy.reviewBody : result.passed ? copy.passedBody : copy.failedBody}</Text>
      <Text accessibilityLabel={`${result.correctCount} / ${result.totalCount}`} style={[ui.fact, { marginTop: 4 }]}>{result.correctCount} / {result.totalCount}</Text>
      <Text style={ui.secondary}>{reviewing ? copy.scoreLabel(result.scorePercent) : copy.passMark(result.scorePercent)}</Text>
      {result.missedCount > 0 ? <LearningLink label={copy.reviewMissed(result.missedCount)} onPress={onMissed} /> : null}
    </View>
    <View style={ui.divider} />
    <View style={ui.section}><Text accessibilityRole="header" style={ui.sectionTitle}>{copy.learningPath}</Text>
      <LearningPath content={content} session={result.session} />
    </View>
    <View style={[ui.panel, ui.row]}><LearningImage assetKey="learning-leaf-sprig" style={{ width: 30, height: 40 }} />
      <Text style={[ui.body, ui.flex]}>{result.mode === 'practice' ? copy.practicePending : reviewing ? copy.reviewBody : result.passed ? next ? copy.nextTime(next.title[language]) : copy.completedPathBody : copy.failedBody}</Text>
    </View>
  </LearningPage>;
}
