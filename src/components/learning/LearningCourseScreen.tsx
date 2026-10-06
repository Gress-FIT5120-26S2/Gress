import { Pressable, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { PublicLearningContent } from '../../types/learningContent';
import type { LearningSessionView, LearningStageCode } from '../../types/learningRoom';
import { LearningButton, LearningIcon, LearningImage, LearningLink, LearningPage, ui } from './LearningUi';
import { learningColors as c, learningStyles as s } from './learningTheme';

export function LearningCourseScreen({ content, session, courseCode, onBack, onActivity, onCheckpoint, onResource, busy, error }: {
  content: PublicLearningContent; session: LearningSessionView; courseCode: string; onBack: () => void;
  onActivity: (code: string) => void; onCheckpoint: (stage: LearningStageCode) => void; onResource: (code: string) => void; busy: boolean; error: string | null;
}) {
  const { language, t } = useI18n();
  const copy = t.learning;
  const course = content.courses.find((item) => item.courseCode === courseCode)!;
  const stage = content.stages.find((item) => item.stageCode === course.stageCode)!;
  const activities = course.activityCodes.map((code) => content.activities.find((item) => item.activityCode === code)!);
  const nextIndex = activities.findIndex((item) => !session.completedActivityCodes.includes(item.activityCode));
  const locked = session.stageStatus[stage.stageCode] === 'locked';
  const reviewing = session.stageStatus[stage.stageCode] === 'completed';
  const previous = content.stages[content.stages.indexOf(stage) - 1];
  const kinds = { video: copy.animation, lesson: copy.shortLesson, practice: copy.handsOn };
  return <LearningPage backLabel={copy.title} onBack={onBack} error={error} testID="learning-course" contentGap={12}
    footer={<LearningButton label={nextIndex >= 0 ? copy.continueNumberedLesson(nextIndex + 1) : reviewing ? copy.reviewStage(stage.title[language]) : copy.startCheckpoint}
      disabled={busy || (nextIndex < 0 && locked)} onPress={() => nextIndex >= 0 ? onActivity(activities[nextIndex].activityCode) : onCheckpoint(stage.stageCode)} />}>
    <View style={ui.group}><Text accessibilityRole="header" style={ui.title}>{course.title[language]}</Text>
      <Text style={ui.secondary}>{stage.title[language]} · {copy.lessons(activities.length)}</Text><Text style={ui.body}>{course.summary[language]}</Text></View>
    <LearningImage assetKey={course.coverAssetKey} label={copy.coverAlt} style={ui.cover} />
    <View style={[ui.panel, ui.row]}><View style={ui.iconDisc}><LearningIcon name="leaf-outline" /></View><Text style={[ui.body, ui.flex]}>{course.objective[language]}</Text></View>
    <View style={ui.section}><Text accessibilityRole="header" style={ui.sectionTitle}>{copy.outline}</Text>
      <View>{activities.map((activity, index) => {
        const done = session.completedActivityCodes.includes(activity.activityCode);
        const current = index === nextIndex;
        return <Pressable key={activity.activityCode} accessibilityRole="button" onPress={() => onActivity(activity.activityCode)} style={({ pressed }) => [ui.timelineRow, pressed ? s.pressed : null]}>
          <View style={ui.timelineTrack}><View style={[ui.timelineNode, done ? ui.doneNode : current ? ui.activeNode : null]}>
            {done ? <LearningIcon name="checkmark" size={18} color={c.surface} /> : current ? <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: c.learningGreen }} /> : null}
          </View>{index < activities.length - 1 ? <View style={ui.timelineLine} /> : null}</View>
          <Text style={ui.timelineNumber}>{String(index + 1).padStart(2, '0')}</Text><View style={ui.timelineCopy}>
            <Text style={ui.listTitle}>{activity.title[language]}</Text><Text style={ui.caption}>{kinds[activity.type]} · {copy.minutes(activity.durationEstimate.minutes)}{done ? ` · ${copy.completed}` : current ? ` · ${copy.upNext}` : ''}</Text>
          </View>
        </Pressable>;
      })}</View>
    </View>
    <View style={ui.divider} />
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: locked || busy }} disabled={locked || busy} onPress={() => onCheckpoint(stage.stageCode)} style={({ pressed }) => [ui.row, { minHeight: 60 }, pressed ? s.pressed : null]}>
      <LearningImage assetKey="sdg-13-climate-action" label={copy.sdgAlt} style={{ width: 46, height: 46 }} />
      <View style={ui.flex}><Text style={ui.listTitle}>{reviewing ? copy.reviewStage(stage.title[language]) : copy.checkpoint(stage.title[language])}</Text><Text style={ui.caption}>{reviewing ? copy.reviewBody : copy.checkpointDetail(stage.questionCount)}</Text></View>
      <LearningIcon name={locked ? 'lock-closed-outline' : 'chevron-forward'} size={20} color={c.textSecondaryReadable} />
    </Pressable>
    {locked ? <Text style={ui.caption}>{copy.checkpointLocked(previous?.title[language] ?? '')}</Text> : null}
    <View style={ui.divider} />
    <LearningLink label={copy.relatedReading} icon="document-text-outline" onPress={() => onResource('waste-climate-sdg13')} />
  </LearningPage>;
}
