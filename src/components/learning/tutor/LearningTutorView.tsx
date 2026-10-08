import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useI18n } from '../../../i18n';
import type { LearningText } from '../../../types/learningContent';
import type { TutorAction, TutorConversation, TutorIntent, TutorMessage, TutorPractice, TutorPreferences } from '../../../types/learningTutor';
import { LearningIcon, LearningImage, LearningLink, ui } from '../LearningUi';
import type { LearningAssetKey } from '../learningAssets';
import { learningColors as c } from '../learningTheme';
import { useLearningViewport } from '../learningViewport';

const spoonie = require('../../../../assets/kitchmemo-assistant.png');
type Icon = React.ComponentProps<typeof LearningIcon>['name'];
type Confirmation = 'clear' | 'delete' | 'abandon' | null;
type Props = {
  label: LearningText; coverAssetKey?: LearningAssetKey; showLifecycle?: boolean; submitted: boolean;
  messages: TutorMessage[]; input: string; loading: boolean; busy: boolean; slow: boolean; error: string | null;
  withdrawn: boolean; restricted: boolean; retrying: boolean; intent: TutorIntent;
  settings: boolean; history: TutorConversation[] | null; moreHistory: boolean; preferences: TutorPreferences | null;
  practice: TutorPractice | null; selected: string | null; practiceLocked: boolean;
  practiceFeedback: { isCorrect: boolean; explanation: LearningText } | null; confirmation: Confirmation;
  onClose: () => void; onInput: (value: string) => void; onSend: (value?: string, intent?: TutorIntent) => void;
  onMenu: (action: 'history' | 'new' | 'settings') => void; onHistory: (uid: string) => void; onMoreHistory: () => void;
  onBackToConversation: () => void;
  onPreferences: (value: Partial<TutorPreferences>) => void; onConfirmation: (value: Confirmation) => void; onConfirm: () => void;
  onSelect: (id: string) => void; onPracticeAnswer: () => void; onSource: (code: string) => void;
  onFeedback: (uid: string, value: 'useful' | 'not_useful') => void; onAction: (action: TutorAction) => void;
  onResume?: () => void; canAbandon: boolean;
};

export function TutorButton({ label, onPress, disabled = false, quiet = false, testID }: {
  label: string; onPress: () => void; disabled?: boolean; quiet?: boolean; testID?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} testID={testID}
    style={({ pressed }) => [styles.button, quiet ? styles.quietButton : null, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}>
    <Text style={styles.buttonLabel}>{label}</Text>
  </Pressable>;
}

export function TutorEntryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} testID="learning-tutor-entry"
    style={({ pressed }) => [styles.entry, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}>
    <LearningIcon name="chatbubble-ellipses-outline" color={c.textPrimary} size={22} /><Text style={styles.buttonLabel}>{label}</Text>
  </Pressable>;
}

export function TutorHelpCard({ prompt, onAccept, onDismiss, onTurnOff, disabled = false }: {
  prompt: string; onAccept: () => void; onDismiss: () => void; onTurnOff: () => void; disabled?: boolean;
}) {
  const { t } = useI18n(); const copy = t.learningTutor;
  const { width, fontScale } = useLearningViewport(); const stacked = width < 360 || fontScale > 1.2;
  return <View style={styles.helpSection} testID="learning-tutor-help">
    <View style={[styles.helpCard, stacked ? styles.helpStacked : null]}>
      <Image source={spoonie} contentFit="contain" style={stacked ? styles.helpSmallMascot : styles.helpMascot} accessible={false} />
      <View style={styles.helpCopy}>
        <Text style={styles.caption}>{copy.title}</Text><Text accessibilityRole="header" style={styles.helpTitle}>{copy.invitationTitle}</Text>
        <Text style={styles.secondary}>{prompt}</Text>
        <View style={styles.helpActions}><TutorButton label={copy.example} onPress={onAccept} disabled={disabled} testID="learning-tutor-help-accept" />
          <TutorButton label={copy.dismiss} onPress={onDismiss} disabled={disabled} quiet testID="learning-tutor-help-dismiss" /></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.dismiss} disabled={disabled} onPress={onDismiss} style={styles.dismiss}><LearningIcon name="close-outline" size={23} color={c.textPrimary} /></Pressable>
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onTurnOff} style={styles.turnOff}>
      <Text style={styles.turnOffLabel}>{copy.turnOff}</Text>
    </Pressable>
  </View>;
}

function WelcomeAction({ title, body, icon, disabled, onPress }: { title: string; body: string; icon: Icon; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.welcomeAction, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}>
    <View style={styles.iconDisc}><LearningIcon name={icon} color={c.textPrimary} size={26} /></View>
    <View style={ui.flex}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.secondary}>{body}</Text></View>
    <LearningIcon name="chevron-forward" color={c.textSecondaryReadable} size={22} />
  </Pressable>;
}

function Answer({ message, submitted, showLifecycle, disabled, details, onSource, onFeedback, onAction }: {
  message: TutorMessage; submitted: boolean; showLifecycle: boolean; disabled: boolean; details: boolean;
  onSource: Props['onSource']; onFeedback: Props['onFeedback']; onAction: Props['onAction'];
}) {
  const { t, language } = useI18n(); const copy = t.learningTutor; const [sourcesOpen, setSourcesOpen] = useState(false);
  const reply = message.response;
  // Arthur: NarIyirm
  // 中文：只排版服务器原文，不补造标题、结论或引用；静态流程图只辅助匹配的食物与气候讲解。
  // EN: Format the server text without inventing headings, conclusions or citations; the static illustration only supports matching food/climate explanations.
  const paragraphs = message.content.split(/\n\s*\n/).filter(Boolean);
  const illustrated = !submitted && showLifecycle && reply?.answerStatus === 'answered' && !reply.fallback
    && /食物|food/i.test(message.content) && /运输|transport/i.test(message.content) && /气候|排放|climate|emission/i.test(message.content);
  const headline = paragraphs.length > 1 && paragraphs[0].length <= 90;
  return <View style={styles.answer} testID="learning-tutor-answer">
    <View style={styles.byline}><Image source={spoonie} contentFit="contain" style={styles.avatar} accessible={false} /><Text style={styles.secondary}>{copy.explaining}</Text></View>
    {paragraphs.map((paragraph, index) => <View key={index} style={styles.paragraphGroup}>
      {submitted && !(index === 0 && headline) ? <View style={styles.coachingStep}>
        <View style={styles.stepNumber}><Text style={styles.stepNumberLabel}>{String(headline ? index : index + 1).padStart(2, '0')}</Text></View>
        <Text selectable style={[styles.coachingText, ui.flex]}>{paragraph}</Text>
      </View> : index === paragraphs.length - 1 && paragraphs.length > 2 && paragraph.length < 96 ? <View style={styles.takeaway}>
        <Text selectable style={styles.listTitle}>{paragraph}</Text>
      </View> : <Text selectable style={index === 0 && headline ? submitted ? styles.listTitle : styles.answerTitle : styles.body}>{paragraph}</Text>}
      {index === 0 && illustrated ? <View style={styles.lifecycle} accessible accessibilityLabel={`${copy.lifecycleTitle}: ${copy.lifecycleLabels.join(' → ')}`}>
        <Image source={require('../../../../assets/learning-room/tutor-food-lifecycle.png')} contentFit="contain" style={styles.lifecycleImage} accessible={false} />
        <View style={styles.lifecycleCaptions}>{copy.lifecycleLabels.map((label, i) => <View key={label} style={styles.lifecycleLabel}>
          <Text style={styles.listTitle}>{label}</Text>{i < 2 ? <View style={styles.lifecycleArrow}><LearningIcon name="arrow-forward" color={c.learningGreenReadable} size={22} /></View> : null}
        </View>)}</View>
      </View> : null}
    </View>)}
    {submitted && /食物|food|bread|面包/i.test(message.content) ? <View style={styles.kitchenExample}>
      <Text style={[styles.listTitle, ui.flex]}>{copy.kitchenExample}</Text><Image source={require('../../../../assets/learning-room/tutor-kitchen-example.png')} contentFit="contain" style={styles.exampleImage} accessible={false} />
    </View> : null}
    {reply ? <>
      {reply.sources.length ? <View style={styles.sourceGroup}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: sourcesOpen }} aria-expanded={sourcesOpen} onPress={() => setSourcesOpen(v => !v)} style={styles.sourcesHeader}>
          <View style={styles.iconDisc}><LearningIcon name="book-outline" size={24} color={c.textPrimary} /></View>
          <View style={ui.flex}><Text style={styles.listTitle}>{copy.sources}</Text><Text style={styles.caption}>{copy.viewSources}</Text></View>
          <LearningIcon name={sourcesOpen ? 'chevron-up' : 'chevron-forward'} color={c.textSecondaryReadable} size={22} />
        </Pressable>
        {sourcesOpen ? <View style={styles.sourcesBody}>{reply.sources.map(source => <View key={source.sourceCode} style={styles.sourceItem}>
          <Pressable accessibilityRole="link" accessibilityState={{ disabled }} disabled={disabled} onPress={() => onSource(source.sourceCode)} style={styles.sourceLink}>
            <Text style={[styles.listTitle, ui.flex]}>{source.publisher} · {source.title}</Text><LearningIcon name="open-outline" size={18} />
          </Pressable><Text style={styles.caption}>{source.regionCode} · {copy.published}: {source.publishedAt ?? t.learning.unspecifiedDate}{source.updatedAt ? ` · ${copy.updated}: ${source.updatedAt}` : ''}</Text>
        </View>)}</View> : null}
      </View> : <Text style={styles.caption}>{copy.sourceMissing}</Text>}
      {!disabled ? reply.suggestedActions.map(action => <LearningLink key={action.type + action.entityCode} label={action.label[language]} onPress={() => onAction(action)} />) : null}
      <View style={styles.feedbackRow}>{(['useful', 'not_useful'] as const).map(value => <Pressable key={value} accessibilityRole="button"
        accessibilityState={{ selected: message.rating === value, disabled }} aria-pressed={message.rating === value} disabled={disabled} onPress={() => onFeedback(message.messageUid, value)}
        style={({ pressed }) => [styles.feedback, message.rating === value ? styles.feedbackSelected : null, pressed ? styles.pressed : null]}>
        <LearningIcon name={value === 'useful' ? 'thumbs-up-outline' : 'thumbs-down-outline'} color={c.textSecondaryReadable} size={18} />
        <Text style={styles.caption}>{value === 'useful' ? copy.useful : copy.notUseful}</Text>
      </Pressable>)}</View>
      {details ? <Text selectable style={styles.caption}>{reply.contentVersion} · {reply.manifestVersion} · {new Date(message.createdAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-AU')}</Text> : null}
    </> : null}
  </View>;
}

export function LearningTutorView(props: Props) {
  const { t, language } = useI18n(); const copy = t.learningTutor;
  const { width, fontScale } = useLearningViewport(); const compact = width < 360 || fontScale > 1.2;
  const [menuOpen, setMenuOpen] = useState(false); const [details, setDetails] = useState(false);
  const [inputHeight, setInputHeight] = useState(42);
  const scroll = useRef<ScrollView>(null);
  const followingAnswer = useRef<string | null | undefined>(undefined);
  const send: Props['onSend'] = (value, intent) => {
    followingAnswer.current = props.messages.at(-1)?.messageUid ?? null;
    props.onSend(value, intent);
  };
  const blocked = props.busy || props.loading || props.withdrawn || (props.restricted && !props.submitted);
  const activeConversation = !props.settings && !props.history;
  const empty = !props.messages.length && !props.practice && !props.loading && !props.withdrawn && !props.restricted && activeConversation;
  const menuAction = (action: 'history' | 'new' | 'settings') => { followingAnswer.current = undefined; setMenuOpen(false); props.onMenu(action); };
  return <View style={styles.screen} testID="learning-tutor-view">
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={props.onClose} style={styles.headerHit}><LearningIcon name="chevron-back" size={28} color={c.textPrimary} /></Pressable>
      <Text accessibilityRole="header" style={styles.headerTitle}>{copy.title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.menu} accessibilityState={{ expanded: menuOpen }} aria-expanded={menuOpen} onPress={() => setMenuOpen(v => !v)} style={styles.headerHit}><LearningIcon name="ellipsis-horizontal" size={25} color={c.textPrimary} /></Pressable>
    </View>
    {menuOpen ? <View style={styles.menu} testID="learning-tutor-menu">
      <LearningLink label={copy.history} icon="time-outline" onPress={() => menuAction('history')} /><LearningLink label={copy.newChat} icon="add-outline" onPress={() => menuAction('new')} />
      <LearningLink label={copy.settings} icon="options-outline" onPress={() => menuAction('settings')} />
      <LearningLink label={copy.details} icon="information-circle-outline" onPress={() => { setDetails(v => !v); setMenuOpen(false); }} />
    </View> : null}
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, compact ? styles.narrowContent : null]}>
      {!props.submitted ? <View style={styles.context}>
        <LearningImage assetKey={props.coverAssetKey ?? 'waste-climate-cover'} style={styles.contextImage} />
        <View style={ui.flex}><Text style={styles.caption}>{copy.currentCourse}</Text><Text style={styles.contextTitle}>{props.label[language]}</Text></View>
      </View> : null}
      {props.loading ? <View style={styles.status}><ActivityIndicator color={c.learningGreenReadable} /><Text accessibilityLiveRegion="polite" style={styles.secondary}>{t.learning.loading}</Text></View> : null}
      {props.settings ? <View style={styles.settings}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{copy.settings}</Text><Text style={styles.secondary}>{copy.settingsBody}</Text>
        {props.preferences ? (['proactiveEnabled', 'personalizedEnabled', 'dwellHintsEnabled'] as const).map((key, i) => <View key={key} style={styles.preference}>
          <Text style={[styles.body, ui.flex]}>{[copy.proactive, copy.personalized, copy.dwell][i]}</Text>
          <Switch accessibilityLabel={[copy.proactive, copy.personalized, copy.dwell][i]} value={props.preferences![key]} disabled={props.busy}
            trackColor={{ true: c.learningGreenReadable }} onValueChange={value => props.onPreferences({ [key]: value })} />
        </View>) : null}
        <LearningLink label={copy.clear} onPress={() => props.onConfirmation('clear')} />
        {props.messages.length ? <LearningLink label={copy.deleteChat} onPress={() => props.onConfirmation('delete')} /> : null}
        <TutorButton label={copy.backConversation} quiet onPress={props.onBackToConversation} />
      </View> : props.history ? <View style={styles.settings}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{copy.history}</Text>
        {!props.history.length ? <Text style={styles.secondary}>{copy.historyEmpty}</Text> : props.history.map(item => <LearningLink key={item.conversationUid}
          label={new Date(item.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-AU')} onPress={() => props.onHistory(item.conversationUid)} />)}
        {props.moreHistory ? <TutorButton label={copy.moreHistory} onPress={props.onMoreHistory} disabled={props.busy} /> : null}
        <TutorButton label={copy.backConversation} quiet onPress={props.onBackToConversation} />
      </View> : <>
        {props.withdrawn ? <Text style={ui.error}>{copy.withdrawn}</Text> : null}
        {props.submitted ? <View style={styles.coachingHero}>
          <Text style={styles.caption}>{copy.afterSubmission}</Text>
          <View style={styles.heroRow}><View style={ui.flex}><Text accessibilityRole="header" style={[styles.heroTitle, compact ? styles.compactTitle : null]}>{copy.coachingTitle}</Text><Text style={styles.secondary}>{copy.coachingBody}</Text></View>
            <Image source={spoonie} contentFit="contain" style={compact ? styles.smallMascot : styles.coachingMascot} accessible={false} /></View>
          <View style={styles.questionContext}><Text style={styles.caption}>{copy.questionContext}</Text><Text style={styles.listTitle}>{props.label[language]}</Text>
            <View style={styles.byline}><LearningIcon name="lock-closed-outline" size={16} color={c.textSecondaryReadable} /><Text style={styles.caption}>{copy.answerSaved}</Text></View></View>
        </View> : empty ? <View style={styles.welcome}>
          <View style={styles.heroRow}><View style={ui.flex}><Text style={styles.caption}>{copy.welcomeEyebrow}</Text><Text accessibilityRole="header" style={[styles.heroTitle, compact ? styles.compactTitle : null]}>{copy.welcomeTitle}</Text><Text style={styles.secondary}>{copy.welcomeBody}</Text></View>
            <Image source={spoonie} contentFit="contain" style={compact ? styles.smallMascot : styles.welcomeMascot} accessible={false} /></View>
          <Text style={styles.sdgLine}>{copy.sdgLine}</Text>
          <View><Text accessibilityRole="header" style={styles.sectionTitle}>{copy.howToLearn}</Text>
            <WelcomeAction title={copy.welcomeExplain} body={copy.welcomeExplainBody} icon="bulb-outline" disabled={blocked || props.retrying} onPress={() => send(copy.welcomeExplain)} />
            <WelcomeAction title={copy.welcomeExample} body={copy.welcomeExampleBody} icon="restaurant-outline" disabled={blocked || props.retrying} onPress={() => send(copy.welcomeExample)} />
            <WelcomeAction title={copy.welcomePractice} body={copy.welcomePracticeBody} icon="document-text-outline" disabled={blocked || props.retrying} onPress={() => send(copy.practicePrompt)} />
          </View>
        </View> : null}
        {props.practice ? <View style={styles.settings}><Text accessibilityRole="header" style={styles.sectionTitle}>{props.practice.title[language]}</Text><Text style={styles.caption}>{copy.practiceBody}</Text>
          <Text style={styles.body}>{props.practice.prompt[language]}</Text>{props.practice.options.map(option => <Pressable key={option.optionId} accessibilityRole="radio"
            accessibilityState={{ checked: props.selected === option.optionId, disabled: blocked || props.practiceLocked }} aria-checked={props.selected === option.optionId} disabled={blocked || props.practiceLocked}
            onPress={() => props.onSelect(option.optionId)} style={[styles.practiceOption, props.selected === option.optionId ? styles.feedbackSelected : null]}><Text style={styles.body}>{option.text[language]}</Text></Pressable>)}
          {props.practiceFeedback ? <><Text style={styles.listTitle}>{props.practiceFeedback.isCorrect ? copy.practiceCorrect : copy.practiceIncorrect}</Text><Text style={styles.body}>{props.practiceFeedback.explanation[language]}</Text><Text style={styles.caption}>{copy.practiceSaved}</Text></>
            : <TutorButton label={copy.check} disabled={!props.selected || blocked} onPress={props.onPracticeAnswer} />}
        </View> : null}
        {props.messages.map((message, index) => message.role === 'user' ? props.submitted ? <Text key={message.messageUid} selectable style={styles.caption}>
          {(['explain','simplify','example'] as const).includes(message.content as 'explain'|'simplify'|'example') ? copy[message.content as 'explain'|'simplify'|'example'] : message.content}
        </Text> : <View key={message.messageUid} style={styles.userMessage}><Text selectable style={styles.body}>{message.content}</Text></View>
          : <View key={message.messageUid} onLayout={event => {
            // Arthur: NarIyirm
            // 中文：新回答从开头阅读；初次恢复保留课程上下文，避免自动跳到长回答末尾。
            // EN: Start new answers at their beginning; initial restoration preserves lesson context instead of jumping to the end of a long answer.
            if (followingAnswer.current !== undefined && followingAnswer.current !== message.messageUid && index === props.messages.length - 1) {
              followingAnswer.current = undefined;
              scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
            }
          }}><Answer message={message} submitted={props.submitted} showLifecycle={Boolean(props.showLifecycle)} disabled={props.busy || props.withdrawn}
            details={details} onSource={props.onSource} onFeedback={props.onFeedback} onAction={props.onAction} /></View>)}
      </>}
      {props.confirmation ? <View style={styles.questionContext}><Text style={styles.body}>{props.confirmation === 'clear' ? copy.confirmClear : props.confirmation === 'delete' ? copy.confirmDelete : copy.abandonBody}</Text>
        <TutorButton label={copy.confirm} onPress={props.onConfirm} disabled={props.busy} /><LearningLink label={copy.cancel} onPress={() => props.onConfirmation(null)} /></View> : null}
      {props.restricted && !props.submitted ? <View style={styles.questionContext}><Text style={styles.body}>{copy.restricted}</Text>
        {props.onResume ? <LearningLink label={copy.resume} onPress={props.onResume} /> : null}{props.canAbandon ? <LearningLink label={copy.abandon} onPress={() => props.onConfirmation('abandon')} /> : null}
      </View> : null}
      {props.busy ? <View style={styles.status}><ActivityIndicator color={c.learningGreenReadable} /><Text accessibilityLiveRegion="polite" style={[styles.secondary, ui.flex]}>{props.slow ? copy.stillWaiting : copy.waiting}</Text></View> : null}
      {props.error ? <Text accessibilityLiveRegion="polite" style={ui.error}>{props.error}</Text> : null}
    </ScrollView>
    {activeConversation && !props.withdrawn ? <View style={styles.dock}>
      {props.submitted ? <>
        <View style={[styles.intentRow, compact ? styles.intentStack : null]}>{(['explain', 'simplify', 'example'] as const).map(intent => <Pressable key={intent} accessibilityRole="button"
          accessibilityState={{ selected: props.intent === intent, disabled: blocked || props.retrying }} aria-pressed={props.intent === intent} disabled={blocked || props.retrying} onPress={() => send(undefined, intent)}
          style={[styles.intent, props.intent === intent ? styles.intentSelected : null]}><Text style={styles.intentLabel}>{copy[intent]}</Text></Pressable>)}</View>
        {props.retrying ? <TutorButton label={copy.retry} onPress={() => send()} disabled={blocked} /> : null}
        <TutorButton label={copy.returnQuiz} onPress={props.onClose} /><Text style={styles.dockCaption}>{copy.gradeNote}</Text>
      </> : <>
        {empty ? <Text style={styles.caption}>{copy.directAsk}</Text> : <View style={styles.quickActions}>
          {(['simplify', 'example'] as const).map(intent => <Pressable key={intent} accessibilityRole="button" disabled={blocked || props.retrying}
            accessibilityState={{ disabled: blocked || props.retrying }} onPress={() => send(copy[intent], intent)} style={styles.quickAction}>
            <LearningIcon name={intent === 'simplify' ? 'list-outline' : 'bulb-outline'} size={19} color={c.textPrimary} /><Text style={styles.caption}>{copy[intent]}</Text>
          </Pressable>)}
        </View>}
        <View style={styles.composer}>
          <TextInput accessibilityLabel={copy.placeholder} placeholder={copy.placeholder} placeholderTextColor={c.textSecondaryReadable} value={props.input}
            onChangeText={props.onInput} editable={!blocked && !props.retrying} multiline numberOfLines={1} maxLength={2000}
            onContentSizeChange={event => setInputHeight(Math.max(42, Math.min(128, event.nativeEvent.contentSize.height)))}
            style={[styles.input, { height: inputHeight }]} testID="learning-tutor-input" />
          <Pressable accessibilityRole="button" accessibilityLabel={props.retrying ? copy.retry : copy.send} disabled={blocked || (!props.input.trim() && !props.retrying)}
            accessibilityState={{ disabled: blocked || (!props.input.trim() && !props.retrying) }} onPress={() => send()} testID="learning-tutor-send"
            style={({ pressed }) => [styles.send, blocked || (!props.input.trim() && !props.retrying) ? styles.disabled : null, pressed ? styles.pressed : null]}>
            <LearningIcon name={props.retrying ? 'refresh-outline' : 'arrow-up'} size={25} color={c.textPrimary} />
          </Pressable>
        </View><Text style={styles.dockCaption}>{copy.grounded}</Text>
      </>}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, body: { fontSize: 17, lineHeight: 27, fontWeight: '500', color: c.textPrimary },
  coachingText: { fontSize: 17, lineHeight: 28, fontWeight: '500', color: c.textPrimary }, secondary: { fontSize: 15, lineHeight: 23, color: c.textSecondaryReadable },
  caption: { fontSize: 13, lineHeight: 20, color: c.textSecondaryReadable }, sectionTitle: { fontSize: 22, lineHeight: 29, fontWeight: '800', color: c.textPrimary },
  listTitle: { fontSize: 17, lineHeight: 25, fontWeight: '700', color: c.textPrimary }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 12, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  headerHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, minWidth: 0, fontSize: 19, lineHeight: 26, fontWeight: '700', color: c.textPrimary },
  menu: { paddingHorizontal: 24, paddingVertical: 8, backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border },
  scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 16, gap: 16 }, narrowContent: { paddingHorizontal: 18 },
  context: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  contextImage: { width: 96, height: 60, borderRadius: 12 }, contextTitle: { fontSize: 19, lineHeight: 27, fontWeight: '800', color: c.textPrimary },
  welcome: { gap: 16 }, heroRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, heroTitle: { fontSize: 30, lineHeight: 38, fontWeight: '800', letterSpacing: -0.7, color: c.textPrimary, marginVertical: 12 },
  compactTitle: { fontSize: 27, lineHeight: 35 }, welcomeMascot: { width: 120, height: 154 }, coachingMascot: { width: 98, height: 130 }, smallMascot: { width: 68, height: 92 },
  sdgLine: { fontSize: 12, lineHeight: 19, color: c.learningGreenReadable, alignSelf: 'flex-start', backgroundColor: c.mintSurface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderCurve: 'continuous' },
  welcomeAction: { minHeight: 70, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  actionTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: c.textPrimary }, iconDisc: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.mintSurface, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 52, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 26, borderCurve: 'continuous', backgroundColor: c.actionOrange, alignItems: 'center', justifyContent: 'center' },
  quietButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border }, buttonLabel: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: c.textPrimary, textAlign: 'center' },
  entry: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 26, borderCurve: 'continuous', backgroundColor: c.mintSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  coachingHero: { gap: 8 }, questionContext: { padding: 16, borderRadius: 16, borderCurve: 'continuous', backgroundColor: c.mintSurface, gap: 10 },
  coachingStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, stepNumber: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF0DF', alignItems: 'center', justifyContent: 'center' },
  stepNumberLabel: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: c.actionOrangeReadable }, takeaway: { padding: 16, borderRadius: 14, backgroundColor: c.mintSurface, borderLeftWidth: 3, borderLeftColor: c.learningGreenReadable },
  kitchenExample: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderCurve: 'continuous', backgroundColor: c.mintSurface, flexDirection: 'row', alignItems: 'center', gap: 12 }, exampleImage: { width: 120, height: 84 },
  answer: { gap: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border, paddingBottom: 24 }, byline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 42 }, answerTitle: { fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5, color: c.textPrimary }, paragraphGroup: { gap: 18 },
  userMessage: { alignSelf: 'flex-end', maxWidth: '94%', padding: 14, borderRadius: 18, borderCurve: 'continuous', backgroundColor: c.mintStrong },
  lifecycle: { backgroundColor: c.mintSurface, borderRadius: 16, borderCurve: 'continuous', padding: 12, gap: 4 }, lifecycleImage: { width: '100%', aspectRatio: 3 },
  lifecycleCaptions: { flexDirection: 'row' }, lifecycleLabel: { flex: 1, alignItems: 'center', minWidth: 0 }, lifecycleArrow: { position: 'absolute', right: -11, top: -15 },
  sourceGroup: { borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: c.border }, sourcesHeader: { minHeight: 72, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourcesBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 }, sourceItem: { gap: 4 }, sourceLink: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center' },
  feedbackRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, feedback: { minHeight: 44, paddingHorizontal: 13, borderRadius: 22, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 8 }, feedbackSelected: { backgroundColor: c.mintStrong, borderColor: c.learningGreenReadable },
  dock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  dockCaption: { fontSize: 12, lineHeight: 19, color: c.textSecondaryReadable, textAlign: 'center' }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 6, borderWidth: 1, borderColor: c.border, borderRadius: 27, borderCurve: 'continuous' },
  input: { flex: 1, minWidth: 0, minHeight: 42, maxHeight: 128, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16, lineHeight: 24, color: c.textPrimary },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.actionOrange },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, quickAction: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 7 },
  intentRow: { flexDirection: 'row', padding: 3, borderWidth: 1, borderColor: c.border, borderRadius: 26, borderCurve: 'continuous' }, intentStack: { flexDirection: 'column' },
  intent: { flex: 1, minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 23 }, intentSelected: { backgroundColor: c.mintStrong }, intentLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: c.textPrimary },
  settings: { gap: 16 }, preference: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  practiceOption: { padding: 16, minHeight: 56, borderWidth: 1, borderColor: c.border, borderRadius: 14, borderCurve: 'continuous', backgroundColor: c.surface }, status: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  helpSection: { gap: 2 }, helpCard: { backgroundColor: c.mintSurface, borderRadius: 16, borderCurve: 'continuous', padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  helpStacked: { flexDirection: 'column', alignItems: 'flex-start' }, helpMascot: { width: 80, height: 116 }, helpSmallMascot: { width: 52, height: 70 }, helpCopy: { flex: 1, minWidth: 0, gap: 8, paddingTop: 4 },
  helpTitle: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: c.textPrimary, paddingRight: 12 }, helpActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  dismiss: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, turnOff: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  turnOffLabel: { fontSize: 13, lineHeight: 20, textDecorationLine: 'underline', color: c.textSecondaryReadable },
});
