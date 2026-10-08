import { useContext, useState } from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { PublicLearningContent } from '../../types/learningContent';
import { LearningAttribution, LearningBody, LearningButton, LearningImage, LearningLink, LearningPage, LearningSourceLink, ui } from './LearningUi';
import { LearningTutorSlot } from './tutor/LearningTutorSlot';
import { TutorButton } from './tutor/LearningTutorView';

const dateFormat = {
  en: new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  zh: new Intl.DateTimeFormat('zh-CN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
};

export function LearningResourceScreen({ content, resourceCode, read, onBack, onMarkRead, onNews, busy, error }: {
  content: PublicLearningContent; resourceCode: string; read: boolean; onBack: () => void;
  onMarkRead: () => void; onNews: () => void; busy: boolean; error: string | null;
}) {
  const { language, t } = useI18n();
  const copy = t.learning;
  const tutor = useContext(LearningTutorSlot);
  const [scopeOpen, setScopeOpen] = useState(false);
  const resource = content.resources.find((item) => item.resourceCode === resourceCode)!;
  const climate = resource.readerLayout === 'climate-feature';
  const fact = resource.body.find((block) => block.type === 'fact');
  const sdg = resource.body.some((block) => block.type === 'sdg-callout');
  const datedSource = `${resource.publisher} · ${resource.publishedAt ? dateFormat[language].format(new Date(`${resource.publishedAt}T12:00:00Z`)) : copy.unspecifiedDate}`;
  const remainingBlocks = climate ? resource.body.filter((block) => block.type !== 'fact' && block.type !== 'source') : resource.body;
  const companionLayout = Boolean(tutor) && climate;
  // Arthur: NarIyirm
  // 中文：伴学版保留原统计与口径在可展开来源区；帮助插在教学正文后，来源和 UN 声明仍可完整阅读。
  // EN: The companion layout retains the original statistic and scope in expandable source details; help follows the lesson while sources and the UN notice remain readable.
  return <LearningPage backLabel={copy.title} onBack={onBack} error={error} testID="learning-resource" contentGap={16} tutorBodyInContent={companionLayout}
    footer={<>{companionLayout ? <TutorButton label={busy ? copy.saving : read ? copy.read : copy.markRead} onPress={onMarkRead} disabled={busy || read} testID="learning-mark-read" />
      : <LearningButton label={busy ? copy.saving : read ? copy.read : copy.markRead} onPress={onMarkRead} disabled={busy || read} testID="learning-mark-read" />}
      <LearningLink centered label={copy.exploreNews} onPress={onNews} icon="arrow-forward-outline" /></>}>
    <View style={ui.group}><Text style={ui.eyebrow}>{climate ? copy.wasteClimate : resource.category === 'news' ? copy.news : resource.category === 'data' ? copy.data : copy.guides}</Text>
      <Text accessibilityRole="header" style={ui.title}>{companionLayout ? t.learningTutor.climateResourceTitle : climate && language === 'en' ? 'Less waste.\nMore climate action.' : resource.title[language]}</Text></View>
    <LearningImage assetKey={resource.coverAssetKey} label={copy.coverAlt} style={[ui.cover, climate ? { aspectRatio: undefined, height: companionLayout ? 168 : 145 } : null]} />
    {companionLayout ? <Text accessibilityRole="header" style={ui.sectionTitle}>{t.learningTutor.climateSectionTitle}</Text> : climate && fact?.type === 'fact' ? <View style={ui.group}><Text style={ui.fact}>{fact.value[language]}</Text><Text style={[ui.body, { fontWeight: '700', fontSize: 18, lineHeight: 26 }]}>{fact.text[language]}</Text>
      <LearningSourceLink label={datedSource} url={resource.sourceUrl} />
    </View> : <View style={ui.group}>
      <LearningSourceLink label={datedSource} url={resource.sourceUrl} />
      {resource.newsContext === 'historical-background' ? <Text style={ui.eyebrow}>{copy.historical}</Text> : null}
      <Text style={ui.body}>{resource.summary[language]}</Text><Text style={ui.caption}>{copy.whyItMatters}: {resource.whyItMatters[language]}</Text>
    </View>}
    <LearningBody blocks={companionLayout ? remainingBlocks.filter(block => block.type !== 'reflection') : remainingBlocks} sources={content.sources} gap={12} compactSdg={companionLayout} />
    {companionLayout ? tutor?.body : null}
    {companionLayout ? <LearningBody blocks={remainingBlocks.filter(block => block.type === 'reflection')} sources={content.sources} gap={12} /> : null}
    {companionLayout && !resource.statistics && fact?.type === 'fact' ? <View style={ui.group}>
      <LearningBody blocks={[fact]} sources={content.sources} gap={12} /><LearningSourceLink label={datedSource} url={resource.sourceUrl} />
    </View> : null}
    {resource.statistics ? <View><LearningLink label={scopeOpen ? copy.hideScope : copy.showScope} onPress={() => setScopeOpen((open) => !open)} icon={scopeOpen ? 'chevron-up' : 'chevron-down'} />
      {scopeOpen ? <View style={[ui.panel, ui.group]}>{companionLayout && fact?.type === 'fact' ? <><Text style={ui.sectionTitle}>{fact.value[language]}</Text><Text style={ui.body}>{fact.text[language]}</Text><LearningSourceLink label={datedSource} url={resource.sourceUrl} /></> : null}
        {fact?.type === 'fact' ? <Text style={ui.caption}>{fact.scope[language]}</Text> : null}
        <Text style={ui.caption}>{resource.statistics.populationScope[language]}</Text><Text style={ui.caption}>{resource.statistics.methodologyNote[language]}</Text>
      </View> : null}</View> : null}
    {sdg ? <LearningAttribution /> : null}
  </LearningPage>;
}
