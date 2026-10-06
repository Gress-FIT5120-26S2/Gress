import { useState } from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { PublicLearningContent } from '../../types/learningContent';
import { LearningAttribution, LearningBody, LearningButton, LearningImage, LearningLink, LearningPage, LearningSourceLink, ui } from './LearningUi';

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
  const [scopeOpen, setScopeOpen] = useState(false);
  const resource = content.resources.find((item) => item.resourceCode === resourceCode)!;
  const climate = resource.readerLayout === 'climate-feature';
  const fact = resource.body.find((block) => block.type === 'fact');
  const sdg = resource.body.some((block) => block.type === 'sdg-callout');
  const datedSource = `${resource.publisher} · ${resource.publishedAt ? dateFormat[language].format(new Date(`${resource.publishedAt}T12:00:00Z`)) : copy.unspecifiedDate}`;
  const remainingBlocks = climate ? resource.body.filter((block) => block.type !== 'fact' && block.type !== 'source') : resource.body;
  return <LearningPage backLabel={copy.title} onBack={onBack} error={error} testID="learning-resource" contentGap={12}
    footer={<><LearningButton label={busy ? copy.saving : read ? copy.read : copy.markRead} onPress={onMarkRead} disabled={busy || read} testID="learning-mark-read" />
      <LearningLink centered label={copy.exploreNews} onPress={onNews} icon="arrow-forward-outline" /></>}>
    <View style={ui.group}><Text style={ui.eyebrow}>{climate ? copy.wasteClimate : resource.category === 'news' ? copy.news : resource.category === 'data' ? copy.data : copy.guides}</Text>
      <Text accessibilityRole="header" style={ui.title}>{climate && language === 'en' ? 'Less waste.\nMore climate action.' : resource.title[language]}</Text></View>
    <LearningImage assetKey={resource.coverAssetKey} label={copy.coverAlt} style={[ui.cover, climate ? { aspectRatio: undefined, height: 145 } : null]} />
    {climate && fact?.type === 'fact' ? <View style={ui.group}><Text style={ui.fact}>{fact.value[language]}</Text><Text style={[ui.body, { fontWeight: '700', fontSize: 18, lineHeight: 26 }]}>{fact.text[language]}</Text>
      <LearningSourceLink label={datedSource} url={resource.sourceUrl} />
    </View> : <View style={ui.group}>
      <LearningSourceLink label={datedSource} url={resource.sourceUrl} />
      {resource.newsContext === 'historical-background' ? <Text style={ui.eyebrow}>{copy.historical}</Text> : null}
      <Text style={ui.body}>{resource.summary[language]}</Text><Text style={ui.caption}>{copy.whyItMatters}: {resource.whyItMatters[language]}</Text>
    </View>}
    <LearningBody blocks={remainingBlocks} sources={content.sources} gap={12} />
    {resource.statistics ? <View><LearningLink label={scopeOpen ? copy.hideScope : copy.showScope} onPress={() => setScopeOpen((open) => !open)} icon={scopeOpen ? 'chevron-up' : 'chevron-down'} />
      {scopeOpen ? <View style={[ui.panel, ui.group]}>{fact?.type === 'fact' ? <Text style={ui.caption}>{fact.scope[language]}</Text> : null}
        <Text style={ui.caption}>{resource.statistics.populationScope[language]}</Text><Text style={ui.caption}>{resource.statistics.methodologyNote[language]}</Text>
      </View> : null}</View> : null}
    {sdg ? <LearningAttribution /> : null}
  </LearningPage>;
}
