import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { PublicLearningContent } from '../../types/learningContent';
import type { LearningOrigin, LearningRecentResult, LearningSegment, LearningSessionView } from '../../types/learningRoom';
import { LearningButton, LearningIcon, LearningImage, LearningLink, LearningPage, LearningPath, LearningProgress, ui } from './LearningUi';
import { learningColors as c, learningStyles as s } from './learningTheme';
import { useLearningViewport } from './learningViewport';

type Props = {
  content: PublicLearningContent; session: LearningSessionView; origin: LearningOrigin; segment: LearningSegment;
  initialCategory?: 'guide' | 'data' | 'news'; onClose: () => void; onSegment: (segment: LearningSegment) => void;
  onCourse: (code: string) => void; onActivity: (code: string) => void; onResource: (code: string) => void;
  onContinue: () => void; busy: boolean; error: string | null;
  recentResults?: LearningRecentResult[]; onResult?: (uid: string) => void; onRefresh?: () => void;
};

export function LearningHub({ content, session, origin, segment, initialCategory, onClose, onSegment, onCourse, onActivity, onResource, onContinue, busy, error, recentResults = [], onResult, onRefresh }: Props) {
  const { language, t } = useI18n();
  const copy = t.learning;
  const { width, fontScale } = useLearningViewport();
  const [category, setCategory] = useState<string>(initialCategory ?? 'all');
  const [topic, setTopic] = useState('all');
  const stage = content.stages.find((item) => item.stageCode === session.currentStageCode)!;
  const course = content.courses.find((item) => item.courseCode === stage.courseCode)!;
  const activities = course.activityCodes.map((code) => content.activities.find((item) => item.activityCode === code)!);
  const completed = activities.filter((item) => session.completedActivityCodes.includes(item.activityCode)).length;
  const upcoming = activities.findIndex((item) => !session.completedActivityCodes.includes(item.activityCode));
  const isQuiz = session.resumeTarget.type === 'checkpoint' || session.resumeTarget.type === 'attempt';
  const isDone = session.resumeTarget.type === 'mixed-review';
  const next = upcoming < 0 ? null : activities[upcoming];
  const subtitle = next ? copy.lessonProgress(upcoming + 1, activities.length, next.durationEstimate.minutes) : copy.checkpointDetail(stage.questionCount);
  const continueLabel = isDone ? copy.mixedReview : isQuiz ? copy.continueQuiz : completed === 0 ? copy.startLearning : copy.continueLesson;
  const visible = content.resources.filter((item) => (category === 'all' || item.category === category) && (topic === 'all' || item.topicCodes.includes(topic)));
  const kinds = { video: copy.animation, lesson: copy.shortLesson, practice: copy.handsOn };
  return <LearningPage backLabel={origin === 'home' ? copy.home : copy.profile} onBack={onClose} brand error={error} testID="learning-hub">
    <View style={ui.group}><Text accessibilityRole="header" style={ui.title}>{copy.title}</Text><Text style={ui.secondary}>{copy.tagline}</Text></View>
    <View accessibilityRole="tablist" style={styles.segments}>{(['learn', 'path', 'library'] as const).map((key) =>
      <Pressable key={key} accessibilityRole="tab" aria-selected={segment === key} accessibilityState={{ selected: segment === key }} onPress={() => onSegment(key)}
        style={({ pressed }) => [styles.segment, segment === key ? styles.activeSegment : null, pressed ? s.pressed : null]}>
        <Text style={[styles.segmentText, segment === key ? styles.activeSegmentText : null]}>{copy[key]}</Text>
      </Pressable>)}</View>
    {segment === 'learn' ? <>
      <View style={styles.hero}>
        <View style={[styles.heroCopy, { maxWidth: width < 360 || fontScale > 1.2 ? '100%' : '68%' }]}>
          <Text style={ui.eyebrow}>{copy.continueLearning}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${copy.courseDetails}: ${course.title[language]}`} onPress={() => onCourse(course.courseCode)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={styles.heroTitle}>{isDone ? copy.pathComplete : course.title[language]}</Text>
          </Pressable>
          <Text style={ui.secondary}>{isDone ? copy.completedPathBody : subtitle}</Text>
          <View style={[ui.row, { gap: 8 }]}><View style={ui.flex}><LearningProgress value={completed / activities.length} label={`${completed}/${activities.length}`} /></View><Text style={ui.caption}>{completed}/{activities.length}</Text></View>
          <View style={{ alignSelf: 'flex-start' }}><LearningButton label={continueLabel} onPress={onContinue} disabled={busy} compact testID="learning-continue" /></View>
        </View>
        {fontScale <= 1.2 && width >= 360 ? <LearningImage assetKey="waste-basics-still-life" style={styles.heroImage} /> : null}
      </View>
      <View><Text accessibilityRole="header" style={ui.sectionTitle}>{copy.nextSteps}</Text>
        {activities.map((activity, index) => {
          const done = session.completedActivityCodes.includes(activity.activityCode);
          return <View key={activity.activityCode}>
            <Pressable accessibilityRole="button" onPress={() => onActivity(activity.activityCode)} style={({ pressed }) => [ui.listRow, pressed ? s.pressed : null]}>
              <View style={[ui.iconDisc, activity.type === 'lesson' && !done ? styles.orangeDisc : null]}>
                <LearningIcon name={done ? 'checkmark' : activity.type === 'video' ? 'play-outline' : activity.type === 'practice' ? 'trash-outline' : 'book-outline'}
                  color={activity.type === 'lesson' && !done ? c.actionOrangeReadable : c.learningGreenReadable} />
              </View><View style={ui.flex}><Text style={ui.listTitle}>{activity.title[language]}</Text><Text style={ui.caption}>{kinds[activity.type]} · {copy.minutes(activity.durationEstimate.minutes)}</Text></View>
              <LearningIcon name="chevron-forward" size={19} color={c.textSecondaryReadable} />
            </Pressable>{index < activities.length - 1 ? <View style={ui.divider} /> : null}
          </View>;
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={() => onResource('waste-climate-sdg13')} style={({ pressed }) => [styles.teaser, pressed ? s.pressed : null]}>
        <LearningImage assetKey="learning-leaf-sprig" style={styles.sprig} />
        <LearningImage assetKey="sdg-13-climate-action" label={copy.sdgAlt} style={{ width: 42, height: 42 }} />
        <View style={ui.flex}><Text style={[ui.eyebrow, { fontSize: 10, letterSpacing: 0.8 }]}>{copy.biggerPicture}</Text><Text style={ui.listTitle}>{copy.sdgTeaser}</Text></View>
        <LearningIcon name="chevron-forward" size={18} />
      </Pressable>
    </> : segment === 'path' ? <>
      <Text accessibilityRole="header" style={ui.sectionTitle}>{copy.learningPath}</Text>
      <LearningPath content={content} session={session} onCourse={onCourse} />
      <View style={ui.panel}><Text style={ui.sectionTitle}>{copy.recentResults}</Text>
        {recentResults.length === 0 ? <Text style={ui.secondary}>{copy.noResults}</Text> : recentResults.map(result => {
          const label = content.stages.find(stage => stage.stageCode === result.stageCode)!.title[language];
          return <Pressable key={result.attemptUid} accessibilityRole="button" disabled={busy} onPress={() => onResult?.(result.attemptUid)} style={ui.listRow}>
            <View style={ui.flex}><Text style={ui.listTitle}>{result.mode === 'practice' ? copy.handsOn : result.mode === 'mixed-review' ? copy.mixedReview : result.mode === 'review' ? copy.reviewStage(label) : copy.checkpoint(label)}</Text>
              <Text style={ui.caption}>{result.correctCount} / {result.totalCount} · {new Date(result.submittedAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-AU')}</Text></View>
            <LearningIcon name="chevron-forward" size={18} /></Pressable>;
        })}</View>
      <LearningButton label={continueLabel} onPress={onContinue} disabled={busy} />
    </> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {[{ topicCode: 'all', title: { en: copy.allTopics, zh: copy.allTopics } }, ...content.libraryTopics].map((item) =>
          <Pressable key={item.topicCode} accessibilityRole="button" accessibilityState={{ selected: topic === item.topicCode }}
            aria-pressed={topic === item.topicCode}
            onPress={() => setTopic(item.topicCode)} style={[styles.filter, topic === item.topicCode ? styles.selectedFilter : null]}>
            <Text style={[ui.caption, topic === item.topicCode ? { color: c.learningGreenReadable, fontWeight: '700' } : null]}>{item.title[language]}</Text>
          </Pressable>)}
      </ScrollView>
      <View style={[ui.row, { gap: 4, flexWrap: 'wrap' }]}>{[['all', copy.allTypes], ['guide', copy.guides], ['data', copy.data], ['news', copy.news]].map(([key, label]) =>
        <Pressable key={key} accessibilityRole="button" aria-pressed={category === key} accessibilityState={{ selected: category === key }} onPress={() => setCategory(key)} style={[styles.filter, category === key ? styles.selectedFilter : null]}>
          <Text style={[ui.caption, category === key ? { color: c.learningGreenReadable, fontWeight: '700' } : null]}>{label}</Text>
        </Pressable>)}</View>
      {visible.length === 0 ? <Text style={ui.secondary}>{copy.noResources}</Text> : visible.map((resource) =>
        <Pressable key={resource.resourceCode} accessibilityRole="button" onPress={() => onResource(resource.resourceCode)}
          style={({ pressed }) => [styles.resource, pressed ? s.pressed : null]}>
          <LearningImage assetKey={resource.coverAssetKey} style={styles.thumbnail} />
          <View style={ui.flex}><Text style={ui.listTitle}>{resource.title[language]}</Text><Text style={ui.caption}>{resource.publisher}{resource.publishedAt ? ` · ${resource.publishedAt}` : ''}</Text>
            <Text style={ui.secondary}>{resource.whyItMatters[language]}</Text>{session.readResourceCodes.includes(resource.resourceCode) ? <Text style={ui.eyebrow}>{copy.read}</Text> : null}</View>
          <LearningIcon name="chevron-forward" size={18} />
        </Pressable>)}
    </>}
    {error && onRefresh ? <LearningLink label={copy.refreshLearning} onPress={() => { if (!busy) onRefresh(); }} /> : null}
  </LearningPage>;
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', borderRadius: 16, backgroundColor: c.mintSurface, padding: 3 },
  segment: { flex: 1, minHeight: 44, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  activeSegment: { backgroundColor: c.learningGreen }, segmentText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: c.textPrimary }, activeSegmentText: { color: c.surface },
  hero: { position: 'relative', minHeight: 205, borderRadius: 16, backgroundColor: c.skySurface, paddingHorizontal: 18, paddingVertical: 15, overflow: 'hidden' },
  heroCopy: { gap: 6, zIndex: 1 }, heroTitle: { fontSize: 27, lineHeight: 33, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.6 },
  heroImage: { width: 118, height: 185, position: 'absolute', right: 2, bottom: 5 }, orangeDisc: { backgroundColor: '#FFF0DF' },
  teaser: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: c.mintSurface, overflow: 'hidden' },
  sprig: { width: 37, height: 50, marginLeft: -7 }, filters: { gap: 8 }, filter: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, justifyContent: 'center', borderRadius: 14 },
  selectedFilter: { backgroundColor: c.mintStrong }, thumbnail: { width: 76, height: 68, borderRadius: 12 },
  resource: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
});
