import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { InventoryBatch } from '../../services/inventoryApi';
import { PresetFoodIcon } from './PresetFoodIcon';

export type FridgeAssistantIntent = 'use_first' | 'expired_review' | 'missing_information' | 'restock';

type FridgeAssistantScreenProps = {
  batches: InventoryBatch[];
  onAddItem: () => void;
  onClose: () => void;
  onOpenItem: (batchUid: string) => void;
  visible: boolean;
};

type AssistantResult = {
  item: InventoryBatch;
  reason: string;
  status: string;
  tone: 'critical' | 'neutral' | 'warning';
};

type AssistantResponse = {
  message: string;
  results: AssistantResult[];
};

type ConversationTurn = {
  complete: boolean;
  id: string;
  intent: FridgeAssistantIntent;
  question: string;
  response: AssistantResponse;
  visibleMessage: string;
};

type TypingJob = {
  characters: string[];
  turnId: string;
};

const QUESTION_ORDER: FridgeAssistantIntent[] = ['use_first', 'expired_review', 'missing_information', 'restock'];
const THINKING_DELAY_MS = 360;
const TYPING_INTERVAL_MS = 34;

function validExpiryTime(item: InventoryBatch) {
  if (!item.expiresAt) return null;
  const value = new Date(item.expiresAt).getTime();
  return Number.isNaN(value) ? null : value;
}

// Arthur: NarIyirm
// 中文：四类问答只从同一份库存快照派生；过期食材被隔离出“优先使用”，避免系统暗示它仍适合食用。
// EN: All four answers derive from one inventory snapshot; expired food is kept out of Use First so the system never implies it is still suitable to eat.
function buildRuleGroups(batches: InventoryBatch[], now: number) {
  const dated = batches
    .map((item) => ({ item, time: validExpiryTime(item) }))
    .filter((entry): entry is { item: InventoryBatch; time: number } => entry.time !== null);

  return {
    expired: dated.filter((entry) => entry.time < now).sort((a, b) => a.time - b.time),
    missing: batches.filter((item) => validExpiryTime(item) === null),
    restock: batches.filter((item) => item.needsRestock),
    useFirst: dated.filter((entry) => entry.time >= now).sort((a, b) => a.time - b.time),
  };
}

export function FridgeAssistantScreen({ batches, onAddItem, onClose, onOpenItem, visible }: FridgeAssistantScreenProps) {
  const { language, t } = useI18n();
  const copy = t.fridge.assistant;
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [typingJob, setTypingJob] = useState<TypingJob | null>(null);
  const nextTurnId = useRef(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const groups = useMemo(() => buildRuleGroups(batches, Date.now()), [batches, visible]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }), [language]);

  const instantResponses = reduceMotion || screenReaderEnabled;
  const formatDate = useCallback((value: string | null) => value ? dateFormatter.format(new Date(value)) : copy.missingDate, [copy.missingDate, dateFormatter]);
  const questions = useMemo<Record<FridgeAssistantIntent, string>>(() => ({
    expired_review: copy.questions.expired,
    missing_information: copy.questions.missing,
    restock: copy.questions.restock,
    use_first: copy.questions.useFirst,
  }), [copy.questions]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (mounted) setScreenReaderEnabled(enabled);
    });
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const readerSubscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderEnabled);
    return () => {
      mounted = false;
      motionSubscription.remove();
      readerSubscription.remove();
    };
  }, []);

  useEffect(() => {
    setTypingJob(null);
    if (!visible) return;
    nextTurnId.current = 0;
    setConversation([]);
  }, [visible]);

  const buildAnswer = useCallback((intent: FridgeAssistantIntent): AssistantResponse => {
    if (batches.length === 0) return { message: copy.answers.noInventory, results: [] as AssistantResult[] };

    if (intent === 'use_first') {
      const results = groups.useFirst.map(({ item }, index): AssistantResult => ({
        item,
        reason: copy.reasons.useFirst(index + 1, formatDate(item.expiresAt)),
        status: copy.status.useFirst(formatDate(item.expiresAt)),
        tone: index === 0 ? 'warning' : 'neutral',
      }));
      return {
        message: results.length > 0 ? copy.answers.useFirst(results.length) : copy.answers.useFirstEmpty(groups.missing.length),
        results,
      };
    }

    if (intent === 'expired_review') {
      const results = groups.expired.map(({ item }): AssistantResult => ({
        item,
        reason: copy.reasons.expired(formatDate(item.expiresAt)),
        status: copy.status.expired,
        tone: 'critical',
      }));
      return { message: results.length > 0 ? copy.answers.expired(results.length) : copy.answers.expiredEmpty, results };
    }

    if (intent === 'missing_information') {
      const results = groups.missing.map((item): AssistantResult => ({
        item,
        reason: copy.reasons.missing,
        status: copy.status.missing,
        tone: 'neutral',
      }));
      return { message: results.length > 0 ? copy.answers.missing(results.length) : copy.answers.missingEmpty, results };
    }

    const results = groups.restock.map((item): AssistantResult => ({
      item,
      reason: copy.reasons.restock,
      status: copy.status.restock,
      tone: 'warning',
    }));
    return { message: results.length > 0 ? copy.answers.restock(results.length) : copy.answers.restockEmpty, results };
  }, [batches.length, copy, formatDate, groups]);

  const scrollToLatest = useCallback((animated: boolean) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  // Arthur: NarIyirm
  // 中文：逐字生成以小批量文本更新模拟模型流式输出，不占用每帧动画；减少动态或屏幕阅读器开启时直接完整显示。
  // EN: Typing uses small text batches to simulate streamed output without a frame-driven animation; reduced motion and screen readers receive the complete answer immediately.
  useEffect(() => {
    if (!typingJob) return;

    if (instantResponses) {
      setConversation((current) => current.map((turn) => turn.id === typingJob.turnId
        ? { ...turn, complete: true, visibleMessage: turn.response.message }
        : turn));
      setTypingJob(null);
      scrollToLatest(false);
      return;
    }

    let characterIndex = 0;
    let tickCount = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const chunkSize = language === 'zh' ? 1 : 2;
    const startTimeout = setTimeout(() => {
      intervalId = setInterval(() => {
        characterIndex = Math.min(typingJob.characters.length, characterIndex + chunkSize);
        tickCount += 1;
        const visibleMessage = typingJob.characters.slice(0, characterIndex).join('');
        const complete = characterIndex >= typingJob.characters.length;
        setConversation((current) => current.map((turn) => turn.id === typingJob.turnId
          ? { ...turn, complete, visibleMessage }
          : turn));

        if (tickCount % 4 === 0 || complete) scrollToLatest(false);
        if (!complete) return;
        if (intervalId) clearInterval(intervalId);
        setTypingJob((current) => current?.turnId === typingJob.turnId ? null : current);
      }, TYPING_INTERVAL_MS);
    }, THINKING_DELAY_MS);

    return () => {
      clearTimeout(startTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [instantResponses, language, scrollToLatest, typingJob]);

  const askQuestion = useCallback((intent: FridgeAssistantIntent) => {
    if (typingJob) return;
    const response = buildAnswer(intent);
    const id = `assistant-turn-${nextTurnId.current += 1}`;
    const complete = instantResponses;
    setConversation((current) => [...current, {
      complete,
      id,
      intent,
      question: questions[intent],
      response,
      visibleMessage: complete ? response.message : '',
    }]);
    if (!complete) setTypingJob({ characters: Array.from(response.message), turnId: id });
    scrollToLatest(!instantResponses);
  }, [buildAnswer, instantResponses, questions, scrollToLatest, typingJob]);

  const openItem = (batchUid: string) => {
    onClose();
    requestAnimationFrame(() => onOpenItem(batchUid));
  };

  const addItem = () => {
    onClose();
    requestAnimationFrame(onAddItem);
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityLabel={copy.back} accessibilityRole="button" hitSlop={8} onPress={onClose} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons color="#255043" name="chevron-back" size={22} />
            <Text style={styles.backText}>{copy.back}</Text>
          </Pressable>
          <Text style={styles.title}>{copy.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AssistantMessage message={copy.intro} />
          <AssistantMessage message={copy.summary(batches.length, groups.useFirst.length, groups.missing.length)} subtle />

          {conversation.map((turn, index) => (
            <View key={turn.id} style={styles.turn}>
              <View style={styles.userMessageRow}>
                <Text style={styles.userName}>{copy.you}</Text>
                <View style={styles.userBubble}><Text style={styles.userBubbleText}>{turn.question}</Text></View>
              </View>
              <AssistantMessage isTyping={!turn.complete} message={turn.visibleMessage} />
              {turn.complete ? turn.response.results.map((result) => (
                <ResultRow key={`${turn.id}-${result.item.id}`} onPress={() => openItem(result.item.id)} result={result} storageLabel={t.fridge.manualEntry.storage[result.item.storageZone]} />
              )) : null}
              {turn.complete && batches.length === 0 && index === conversation.length - 1 ? (
                <Pressable accessibilityRole="button" onPress={addItem} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                  <Ionicons color="#FFFFFF" name="add" size={20} />
                  <Text style={styles.addButtonText}>{copy.addItem}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          <View style={styles.questionSection}>
            <Text style={styles.questionHeading}>{typingJob ? copy.generating : conversation.length > 0 ? copy.followUp : copy.chooseQuestion}</Text>
            {QUESTION_ORDER.map((intent) => (
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(typingJob)}
                key={intent}
                onPress={() => askQuestion(intent)}
                style={({ pressed }) => [styles.questionButton, typingJob && styles.questionButtonDisabled, pressed && !typingJob && styles.pressed]}
              >
                <Text style={styles.questionText}>{questions[intent]}</Text>
                <Ionicons color="#B96327" name="arrow-forward" size={17} />
              </Pressable>
            ))}
          </View>

          <View style={styles.ruleNote}>
            <Ionicons color="#6A7E77" name="shield-checkmark-outline" size={16} />
            <Text style={styles.ruleNoteText}>{copy.ruleNote}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function AssistantMessage({ isTyping = false, message, subtle = false }: { isTyping?: boolean; message: string; subtle?: boolean }) {
  const { t } = useI18n();
  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatarWrap}>
        <Image contentFit="contain" source={require('../../../assets/kitchmemo-assistant.png')} style={styles.avatar} />
      </View>
      <View style={styles.assistantMessageColumn}>
        <Text style={styles.assistantName}>{t.fridge.assistant.assistantName}</Text>
        <View style={[styles.assistantBubble, subtle && styles.assistantBubbleSubtle]}>
          <Text accessibilityLiveRegion="polite" style={[styles.assistantBubbleText, subtle && styles.assistantBubbleTextSubtle]}>
            {message || (isTyping ? t.fridge.assistant.thinking : '')}
            {isTyping && message ? <Text style={styles.typingCursor}> ▍</Text> : null}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ResultRow({ onPress, result, storageLabel }: { onPress: () => void; result: AssistantResult; storageLabel: string }) {
  const { t } = useI18n();
  const toneStyle = result.tone === 'critical' ? styles.statusCritical : result.tone === 'warning' ? styles.statusWarning : styles.statusNeutral;
  return (
    <Pressable accessibilityHint={t.fridge.assistant.openItem} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.resultRow, pressed && styles.resultPressed]}>
      <View style={styles.foodIcon}>
        <PresetFoodIcon emoji={result.item.iconEmoji ?? '📦'} iconUrl={result.item.iconUrl} size="card" />
      </View>
      <View style={styles.resultCopy}>
        <View style={styles.resultTitleRow}>
          <Text numberOfLines={1} style={styles.resultTitle}>{result.item.name}</Text>
          <Text style={[styles.statusText, toneStyle]}>{result.status}</Text>
        </View>
        <Text style={styles.resultMeta}>{result.item.remainingQuantity} {result.item.unit} · {storageLabel}</Text>
        <Text style={styles.resultReason}>{result.reason}</Text>
      </View>
      <Ionicons color="#7B8D87" name="chevron-forward" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F8F7' },
  header: { minHeight: 112, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D8E2DE', backgroundColor: '#F8FBFA' },
  backButton: { minWidth: 74, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, borderRadius: 21, backgroundColor: '#E7F0ED' },
  backText: { color: '#255043', fontSize: 15, fontWeight: '800' },
  title: { flex: 1, color: '#173D31', fontSize: 19, fontWeight: '900', textAlign: 'center' },
  headerSpacer: { width: 74 },
  content: { gap: 16, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 42 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  avatarWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#DDF5F2' },
  avatar: { width: 38, height: 38 },
  assistantMessageColumn: { flex: 1, alignItems: 'flex-start', gap: 5 },
  assistantName: { color: '#687C75', fontSize: 12, fontWeight: '700' },
  assistantBubble: { maxWidth: '94%', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16, borderTopLeftRadius: 5, backgroundColor: '#FFFFFF' },
  assistantBubbleSubtle: { backgroundColor: '#E9F3F0' },
  assistantBubbleText: { color: '#203E35', fontSize: 15, fontWeight: '600', lineHeight: 23 },
  assistantBubbleTextSubtle: { color: '#45645A', fontSize: 13.5, lineHeight: 20 },
  typingCursor: { color: '#D9782D', fontWeight: '900' },
  turn: { gap: 16 },
  userMessageRow: { alignItems: 'flex-end', gap: 5, marginTop: 4, paddingLeft: 42 },
  userName: { paddingRight: 4, color: '#7A8A85', fontSize: 12, fontWeight: '700' },
  userBubble: { maxWidth: '88%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderTopRightRadius: 5, backgroundColor: '#D9782D' },
  userBubbleText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', lineHeight: 21 },
  resultRow: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#DCE5E1', borderRadius: 16, backgroundColor: '#FFFFFF' },
  resultPressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  foodIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#F2F6F4' },
  resultCopy: { flex: 1, minWidth: 0, gap: 4 },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { flex: 1, color: '#17372D', fontSize: 16, fontWeight: '900' },
  statusText: { maxWidth: '48%', fontSize: 12, fontWeight: '900' },
  statusWarning: { color: '#B85E1F' },
  statusCritical: { color: '#B53E49' },
  statusNeutral: { color: '#4E6E63' },
  resultMeta: { color: '#667A73', fontSize: 12.5, fontWeight: '700' },
  resultReason: { color: '#526A62', fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  questionSection: { gap: 9, marginTop: 6 },
  questionHeading: { marginBottom: 2, color: '#536A62', fontSize: 13, fontWeight: '800' },
  questionButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 14, backgroundColor: '#FCEFE5' },
  questionButtonDisabled: { opacity: 0.48 },
  questionText: { flex: 1, color: '#9E4F1C', fontSize: 14, fontWeight: '800', lineHeight: 20 },
  addButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, backgroundColor: '#188AA0' },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  ruleNote: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10 },
  ruleNoteText: { flex: 1, color: '#6A7E77', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
