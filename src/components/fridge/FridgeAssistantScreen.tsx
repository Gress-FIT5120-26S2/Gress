import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useI18n } from '../../i18n';
import { ApiRequestError } from '../../services/apiClient';
import {
  cancelAssistantAction,
  confirmAssistantAction,
  getAssistantConversation,
  getAssistantConversations,
  sendAssistantFeedback,
  sendAssistantMessage,
  type AssistantConversationDetail,
  type AssistantConversationSummary,
  type AssistantMessageResponse,
  type AssistantPendingAction,
  type AssistantRiskLevel,
} from '../../services/assistantApi';
import type { InventoryBatch } from '../../services/inventoryApi';
import { PresetFoodIcon } from './PresetFoodIcon';

export type FridgeAssistantIntent = 'use_first' | 'expired_review' | 'missing_information' | 'restock';

type FridgeAssistantScreenProps = {
  batches: InventoryBatch[];
  fridgeUid: string | null;
  onAddItem: () => void;
  onClose: () => void;
  onDataChanged: () => void;
  onOpenItem: (batchUid: string) => void;
  visible: boolean;
};

type ActionStatus = 'cancelled' | 'cancelling' | 'confirmed' | 'confirming' | 'conflict' | 'executed' | 'expired' | 'failed' | 'pending';

type ConversationTurn = {
  actionStatus: ActionStatus | null;
  feedback: 'down' | 'up' | null;
  id: string;
  question: string;
  response: AssistantMessageResponse | null;
  status: 'complete' | 'error' | 'sending';
};

const QUESTION_ORDER: FridgeAssistantIntent[] = ['use_first', 'expired_review', 'missing_information', 'restock'];
const MAX_MESSAGE_LENGTH = 2000;
const ACTIVE_CONVERSATION_KEY_PREFIX = 'kitchmemo.assistant.active-conversation.v1';
const NEW_CONVERSATION_SENTINEL = 'new';

function activeConversationKey(fridgeUid: string) {
  return `${ACTIVE_CONVERSATION_KEY_PREFIX}.${fridgeUid}`;
}

function updateTurn(turns: ConversationTurn[], id: string, patch: Partial<ConversationTurn>) {
  return turns.map((turn) => turn.id === id ? { ...turn, ...patch } : turn);
}

function restoreTurns(detail: AssistantConversationDetail): ConversationTurn[] {
  return detail.turns.map((turn) => ({
    actionStatus: turn.actionStatus === 'confirmed' ? 'failed' : turn.actionStatus,
    feedback: turn.feedback,
    id: turn.id,
    question: turn.question,
    response: turn.response,
    status: 'complete',
  }));
}

export function FridgeAssistantScreen({
  batches,
  fridgeUid,
  onAddItem,
  onClose,
  onDataChanged,
  onOpenItem,
  visible,
}: FridgeAssistantScreenProps) {
  const { language, t } = useI18n();
  const copy = t.fridge.assistant;
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<AssistantConversationSummary[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const busyRef = useRef(false);
  const conversationUidRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<ConversationTurn> | null>(null);
  const nextTurnId = useRef(0);
  const sessionGenerationRef = useRef(0);
  const hydratedFridgeUidRef = useRef<string | null>(null);
  const batchesByUid = useMemo(() => new Map(batches.map((batch) => [batch.id, batch])), [batches]);
  const questions = useMemo<Record<FridgeAssistantIntent, string>>(() => ({
    expired_review: copy.questions.expired,
    missing_information: copy.questions.missing,
    restock: copy.questions.restock,
    use_first: copy.questions.useFirst,
  }), [copy.questions]);

  const applyConversationDetail = useCallback((detail: AssistantConversationDetail) => {
    conversationUidRef.current = detail.conversation.conversationUid;
    const restoredTurns = restoreTurns(detail);
    nextTurnId.current = restoredTurns.length;
    setConversation(restoredTurns);
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryError(false);
    setIsRestoring(true);
    try {
      const result = await getAssistantConversations();
      setHistory(result.conversations);
    } catch {
      setHistoryError(true);
    } finally {
      setIsRestoring(false);
    }
  }, []);

  // Arthur: NarIyirm
  // 中文：每个冰箱只在首次打开时从服务端恢复；普通关闭和查看食材详情不会清空内存会话，App 重启则用本地保存的 UID 重新鉴权读取正文。
  // EN: Each fridge restores once on first open; ordinary closes and item-detail visits keep memory state, while an app restart uses the locally stored UID to re-fetch authenticated content.
  useEffect(() => {
    if (!visible || !fridgeUid || hydratedFridgeUidRef.current === fridgeUid) return;
    hydratedFridgeUidRef.current = fridgeUid;
    const sessionGeneration = sessionGenerationRef.current += 1;
    busyRef.current = true;
    setIsBusy(true);
    setIsRestoring(true);
    setHistoryError(false);
    setConversation([]);
    setDraft('');
    conversationUidRef.current = null;

    void (async () => {
      try {
        const storedConversationUid = await AsyncStorage.getItem(activeConversationKey(fridgeUid));
        let detail: AssistantConversationDetail | null = null;
        if (storedConversationUid && storedConversationUid !== NEW_CONVERSATION_SENTINEL) {
          try {
            detail = await getAssistantConversation(storedConversationUid);
          } catch (error) {
            if (!(error instanceof ApiRequestError) || error.status !== 404) throw error;
            await AsyncStorage.removeItem(activeConversationKey(fridgeUid));
          }
        }
        if (!detail && storedConversationUid !== NEW_CONVERSATION_SENTINEL) {
          const result = await getAssistantConversations();
          if (sessionGeneration !== sessionGenerationRef.current) return;
          setHistory(result.conversations);
          if (result.conversations[0]) detail = await getAssistantConversation(result.conversations[0].conversationUid);
        }
        if (sessionGeneration !== sessionGenerationRef.current || !detail) return;
        applyConversationDetail(detail);
        await AsyncStorage.setItem(activeConversationKey(fridgeUid), detail.conversation.conversationUid);
      } catch {
        if (sessionGeneration === sessionGenerationRef.current) setHistoryError(true);
      } finally {
        if (sessionGeneration === sessionGenerationRef.current) {
          busyRef.current = false;
          setIsBusy(false);
          setIsRestoring(false);
        }
      }
    })();
  }, [applyConversationDetail, fridgeUid, visible]);

  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Arthur: NarIyirm
  // 中文：快捷问题和自由输入在这里汇合成同一种会话 turn；串行请求确保同一个 conversationUid 的上下文顺序稳定。
  // EN: Quick prompts and free text converge into one conversation turn here; serial requests keep conversationUid context in a stable order.
  const askQuestion = useCallback(async (rawQuestion: string, existingTurnId?: string) => {
    const question = rawQuestion.trim();
    if (!question || busyRef.current) return;
    const sessionGeneration = sessionGenerationRef.current;

    const id = existingTurnId ?? `assistant-turn-${nextTurnId.current += 1}`;
    if (existingTurnId) {
      setConversation((current) => updateTurn(current, id, { actionStatus: null, response: null, status: 'sending' }));
    } else {
      setConversation((current) => [...current, {
        actionStatus: null,
        feedback: null,
        id,
        question,
        response: null,
        status: 'sending',
      }]);
    }
    setDraft('');
    busyRef.current = true;
    setIsBusy(true);
    Keyboard.dismiss();
    scrollToLatest();

    try {
      const response = await sendAssistantMessage({
        conversationUid: conversationUidRef.current,
        language,
        message: question,
      });
      if (sessionGeneration !== sessionGenerationRef.current) return;
      conversationUidRef.current = response.conversationUid;
      if (fridgeUid) void AsyncStorage.setItem(activeConversationKey(fridgeUid), response.conversationUid).catch(() => undefined);
      setConversation((current) => updateTurn(current, id, {
        actionStatus: response.pendingAction ? 'pending' : null,
        response,
        status: 'complete',
      }));
    } catch {
      if (sessionGeneration !== sessionGenerationRef.current) return;
      setConversation((current) => updateTurn(current, id, { status: 'error' }));
    } finally {
      if (sessionGeneration === sessionGenerationRef.current) {
        busyRef.current = false;
        setIsBusy(false);
        scrollToLatest();
      }
    }
  }, [fridgeUid, language, scrollToLatest]);

  const submitDraft = useCallback(() => {
    void askQuestion(draft);
  }, [askQuestion, draft]);

  const changeActionStatus = useCallback((turnId: string, status: ActionStatus) => {
    setConversation((current) => updateTurn(current, turnId, { actionStatus: status }));
  }, []);

  const confirmAction = useCallback(async (turnId: string, action: AssistantPendingAction) => {
    if (busyRef.current) return;
    const sessionGeneration = sessionGenerationRef.current;
    busyRef.current = true;
    setIsBusy(true);
    changeActionStatus(turnId, 'confirming');
    try {
      const result = await confirmAssistantAction(action.actionUid);
      if (sessionGeneration !== sessionGenerationRef.current) return;
      changeActionStatus(turnId, result.status === 'executed' ? 'executed' : result.status);
      if (result.status === 'executed') onDataChanged();
    } catch (error) {
      if (sessionGeneration !== sessionGenerationRef.current) return;
      if (error instanceof ApiRequestError && error.status === 410) changeActionStatus(turnId, 'expired');
      else if (error instanceof ApiRequestError && error.status === 409) changeActionStatus(turnId, 'conflict');
      else changeActionStatus(turnId, 'failed');
    } finally {
      if (sessionGeneration === sessionGenerationRef.current) {
        busyRef.current = false;
        setIsBusy(false);
      }
    }
  }, [changeActionStatus, onDataChanged]);

  const cancelAction = useCallback(async (turnId: string, action: AssistantPendingAction) => {
    if (busyRef.current) return;
    const sessionGeneration = sessionGenerationRef.current;
    busyRef.current = true;
    setIsBusy(true);
    changeActionStatus(turnId, 'cancelling');
    try {
      const result = await cancelAssistantAction(action.actionUid);
      if (sessionGeneration !== sessionGenerationRef.current) return;
      changeActionStatus(turnId, result.status);
    } catch (error) {
      if (sessionGeneration !== sessionGenerationRef.current) return;
      if (error instanceof ApiRequestError && error.status === 410) changeActionStatus(turnId, 'expired');
      else if (error instanceof ApiRequestError && error.status === 409) changeActionStatus(turnId, 'conflict');
      else changeActionStatus(turnId, 'failed');
    } finally {
      if (sessionGeneration === sessionGenerationRef.current) {
        busyRef.current = false;
        setIsBusy(false);
      }
    }
  }, [changeActionStatus]);

  const rateAnswer = useCallback((turnId: string, messageUid: string, rating: 'down' | 'up') => {
    setConversation((current) => updateTurn(current, turnId, { feedback: rating }));
    void sendAssistantFeedback(messageUid, rating).catch(() => {
      setConversation((current) => updateTurn(current, turnId, { feedback: null }));
    });
  }, []);

  const startNewConversation = useCallback(() => {
    if (busyRef.current) return;
    sessionGenerationRef.current += 1;
    conversationUidRef.current = null;
    nextTurnId.current = 0;
    setConversation([]);
    setDraft('');
    setHistoryError(false);
    setIsHistoryVisible(false);
    if (fridgeUid) void AsyncStorage.setItem(activeConversationKey(fridgeUid), NEW_CONVERSATION_SENTINEL).catch(() => undefined);
  }, [fridgeUid]);

  const openHistory = useCallback(() => {
    if (busyRef.current) return;
    setIsHistoryVisible(true);
    void refreshHistory();
  }, [refreshHistory]);

  const selectConversation = useCallback(async (conversationUid: string) => {
    if (busyRef.current || !fridgeUid) return;
    const sessionGeneration = sessionGenerationRef.current += 1;
    busyRef.current = true;
    setIsBusy(true);
    setIsRestoring(true);
    setHistoryError(false);
    try {
      const detail = await getAssistantConversation(conversationUid);
      if (sessionGeneration !== sessionGenerationRef.current) return;
      applyConversationDetail(detail);
      await AsyncStorage.setItem(activeConversationKey(fridgeUid), conversationUid);
      setIsHistoryVisible(false);
    } catch {
      if (sessionGeneration === sessionGenerationRef.current) setHistoryError(true);
    } finally {
      if (sessionGeneration === sessionGenerationRef.current) {
        busyRef.current = false;
        setIsBusy(false);
        setIsRestoring(false);
      }
    }
  }, [applyConversationDetail, fridgeUid]);

  const openItem = useCallback((batchUid: string) => {
    onClose();
    requestAnimationFrame(() => onOpenItem(batchUid));
  }, [onClose, onOpenItem]);

  const addItem = useCallback(() => {
    onClose();
    requestAnimationFrame(onAddItem);
  }, [onAddItem, onClose]);

  const renderTurn = useCallback(({ item }: ListRenderItemInfo<ConversationTurn>) => (
    <ConversationTurnView
      batchesByUid={batchesByUid}
      disabled={isBusy}
      onCancelAction={(action) => { void cancelAction(item.id, action); }}
      onConfirmAction={(action) => { void confirmAction(item.id, action); }}
      onOpenCitation={(url) => { if (/^https?:\/\//i.test(url)) void Linking.openURL(url); }}
      onOpenItem={openItem}
      onRate={(messageUid, rating) => rateAnswer(item.id, messageUid, rating)}
      onRetry={() => { void askQuestion(item.question, item.id); }}
      turn={item}
    />
  ), [askQuestion, batchesByUid, cancelAction, confirmAction, isBusy, openItem, rateAnswer]);

  const historyDateFormatter = useMemo(() => new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-AU', {
    day: 'numeric',
    month: 'short',
  }), [language]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable accessibilityLabel={isHistoryVisible ? copy.backToChat : copy.back} accessibilityRole="button" hitSlop={8} onPress={isHistoryVisible ? () => setIsHistoryVisible(false) : onClose} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons color="#255043" name="chevron-back" size={22} />
              <Text style={styles.backText}>{isHistoryVisible ? copy.chat : copy.back}</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{isHistoryVisible ? copy.historyTitle : copy.title}</Text>
          <View style={styles.headerActions}>
            {!isHistoryVisible ? (
              <Pressable accessibilityLabel={copy.openHistory} accessibilityRole="button" disabled={isBusy} onPress={openHistory} style={({ pressed }) => [styles.headerIconButton, isBusy && styles.disabled, pressed && styles.pressed]}>
                <Ionicons color="#255043" name="time-outline" size={20} />
              </Pressable>
            ) : null}
            <Pressable accessibilityLabel={copy.newConversation} accessibilityRole="button" disabled={isBusy} onPress={startNewConversation} style={({ pressed }) => [styles.headerIconButton, isBusy && styles.disabled, pressed && styles.pressed]}>
              <Ionicons color="#255043" name="create-outline" size={20} />
            </Pressable>
          </View>
        </View>

        {isHistoryVisible ? (
          <FlatList
            contentContainerStyle={styles.historyContent}
            data={history}
            keyExtractor={(item) => item.conversationUid}
            ListEmptyComponent={(
              <View style={styles.historyEmpty}>
                {isRestoring ? <ActivityIndicator color="#D9782D" size="large" /> : <Ionicons color="#83948E" name="chatbubbles-outline" size={38} />}
                <Text style={styles.historyEmptyTitle}>{isRestoring ? copy.loadingHistory : historyError ? copy.historyUnavailable : copy.noHistory}</Text>
                {historyError && !isRestoring ? (
                  <Pressable accessibilityRole="button" onPress={() => { void refreshHistory(); }} style={({ pressed }) => [styles.historyRetryButton, pressed && styles.pressed]}>
                    <Text style={styles.historyRetryText}>{copy.retry}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
            renderItem={({ item }) => (
              <HistoryRow
                current={item.conversationUid === conversationUidRef.current}
                date={historyDateFormatter.format(new Date(item.updatedAt))}
                item={item}
                onPress={() => { void selectConversation(item.conversationUid); }}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <>
            <FlatList
          contentContainerStyle={styles.content}
          data={conversation}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          ListFooterComponent={batches.length === 0 ? (
            <Pressable accessibilityRole="button" onPress={addItem} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <Ionicons color="#FFFFFF" name="add" size={20} />
              <Text style={styles.addButtonText}>{copy.addItem}</Text>
            </Pressable>
          ) : null}
          ListHeaderComponent={(
            <View style={styles.introSection}>
              <AssistantMessage message={copy.intro} />
              {isRestoring ? <AssistantMessage loading message={copy.restoringConversation} /> : null}
              {historyError && conversation.length === 0 && !isRestoring ? (
                <Text style={styles.restoreWarning}>{copy.restoreUnavailable}</Text>
              ) : null}
              <View style={styles.questionSection}>
                <Text style={styles.questionHeading}>{copy.quickQuestions}</Text>
                <View style={styles.questionGrid}>
                  {QUESTION_ORDER.map((intent) => (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isBusy}
                      key={intent}
                      onPress={() => { void askQuestion(questions[intent]); }}
                      style={({ pressed }) => [styles.questionButton, isBusy && styles.disabled, pressed && !isBusy && styles.pressed]}
                    >
                      <Text style={styles.questionText}>{questions[intent]}</Text>
                      <Ionicons color="#B96327" name="arrow-forward" size={16} />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}
          onContentSizeChange={scrollToLatest}
          ref={listRef}
          renderItem={renderTurn}
          showsVerticalScrollIndicator={false}
            />

            <View style={styles.composerArea}>
          <View style={styles.ruleNote}>
            <Ionicons color="#6A7E77" name="shield-checkmark-outline" size={15} />
            <Text style={styles.ruleNoteText}>{copy.aiNote}</Text>
          </View>
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel={copy.inputA11y}
              editable={!isBusy}
              maxLength={MAX_MESSAGE_LENGTH}
              multiline
              onChangeText={setDraft}
              placeholder={copy.inputPlaceholder}
              placeholderTextColor="#73857F"
              style={styles.input}
              value={draft}
            />
            <Pressable
              accessibilityLabel={copy.send}
              accessibilityRole="button"
              disabled={isBusy || draft.trim().length === 0}
              onPress={submitDraft}
              style={({ pressed }) => [styles.sendButton, (isBusy || draft.trim().length === 0) && styles.sendButtonDisabled, pressed && !isBusy && styles.pressed]}
            >
              {isBusy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color="#FFFFFF" name="arrow-up" size={21} />}
            </Pressable>
          </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function HistoryRow({ current, date, item, onPress }: {
  current: boolean;
  date: string;
  item: AssistantConversationSummary;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const copy = t.fridge.assistant;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.historyRow, current && styles.historyRowCurrent, pressed && styles.pressed]}>
      <View style={styles.historyRowIcon}>
        <Ionicons color={current ? '#C76827' : '#557168'} name="chatbubble-ellipses-outline" size={21} />
      </View>
      <View style={styles.historyRowCopy}>
        <View style={styles.historyRowTitleLine}>
          <Text numberOfLines={1} style={styles.historyRowTitle}>{item.title || copy.untitledConversation}</Text>
          {current ? <Text style={styles.currentBadge}>{copy.currentConversation}</Text> : null}
        </View>
        <Text numberOfLines={2} style={styles.historyRowPreview}>{item.preview || copy.noPreview}</Text>
        <Text style={styles.historyRowMeta}>{date} · {copy.messageCount(item.messageCount)}</Text>
      </View>
      <Ionicons color="#81918C" name="chevron-forward" size={19} />
    </Pressable>
  );
}

function ConversationTurnView({
  batchesByUid,
  disabled,
  onCancelAction,
  onConfirmAction,
  onOpenCitation,
  onOpenItem,
  onRate,
  onRetry,
  turn,
}: {
  batchesByUid: Map<string, InventoryBatch>;
  disabled: boolean;
  onCancelAction: (action: AssistantPendingAction) => void;
  onConfirmAction: (action: AssistantPendingAction) => void;
  onOpenCitation: (url: string) => void;
  onOpenItem: (batchUid: string) => void;
  onRate: (messageUid: string, rating: 'down' | 'up') => void;
  onRetry: () => void;
  turn: ConversationTurn;
}) {
  const { t } = useI18n();
  const copy = t.fridge.assistant;
  const response = turn.response;
  const pendingAction = response?.pendingAction ?? null;
  const restoredActionStatus = pendingAction && turn.actionStatus === 'pending' && Date.parse(pendingAction.expiresAt) <= Date.now()
    ? 'expired'
    : turn.actionStatus;
  const referencedBatches = response?.answer.batchReferences
    .map((uid) => batchesByUid.get(uid))
    .filter((batch): batch is InventoryBatch => Boolean(batch)) ?? [];

  return (
    <View style={styles.turn}>
      <View style={styles.userMessageRow}>
        <Text style={styles.userName}>{copy.you}</Text>
        <View style={styles.userBubble}><Text style={styles.userBubbleText}>{turn.question}</Text></View>
      </View>

      {turn.status === 'sending' ? <AssistantMessage loading message={copy.thinking} /> : null}
      {turn.status === 'error' ? (
        <View style={styles.errorCard}>
          <Ionicons color="#A23B46" name="cloud-offline-outline" size={20} />
          <View style={styles.errorCopy}>
            <Text style={styles.errorTitle}>{copy.unavailable}</Text>
            <Text style={styles.errorText}>{copy.unavailableHint}</Text>
          </View>
          <Pressable accessibilityRole="button" disabled={disabled} onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryText}>{copy.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      {turn.status === 'complete' && response ? (
        <>
          <AssistantMessage fallback={response.fallback} message={response.answer.answer} riskLevel={response.answer.riskLevel} />
          {referencedBatches.map((batch) => (
            <BatchReference key={`${turn.id}-${batch.id}`} batch={batch} onPress={() => onOpenItem(batch.id)} />
          ))}
          {response.answer.citations.length > 0 ? (
            <View style={styles.citations}>
              <Text style={styles.citationHeading}>{copy.sources}</Text>
              {response.answer.citations.map((citation) => (
                <Pressable accessibilityRole="link" key={citation.sourceUrl} onPress={() => onOpenCitation(citation.sourceUrl)} style={({ pressed }) => [styles.citationLink, pressed && styles.pressed]}>
                  <Ionicons color="#2C766A" name="open-outline" size={15} />
                  <Text numberOfLines={2} style={styles.citationText}>{citation.sourceTitle}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {pendingAction && restoredActionStatus ? (
            <ActionConfirmationCard
              action={pendingAction}
              disabled={disabled}
              onCancel={() => onCancelAction(pendingAction)}
              onConfirm={() => onConfirmAction(pendingAction)}
              status={restoredActionStatus}
            />
          ) : null}
          <View style={styles.feedbackRow}>
            <Text style={styles.feedbackPrompt}>{copy.helpful}</Text>
            {(['up', 'down'] as const).map((rating) => (
              <Pressable
                accessibilityLabel={rating === 'up' ? copy.helpfulYes : copy.helpfulNo}
                accessibilityRole="button"
                key={rating}
                onPress={() => onRate(response.messageUid, rating)}
                style={({ pressed }) => [styles.feedbackButton, turn.feedback === rating && styles.feedbackButtonSelected, pressed && styles.pressed]}
              >
                <Ionicons color={turn.feedback === rating ? '#FFFFFF' : '#557168'} name={rating === 'up' ? 'thumbs-up-outline' : 'thumbs-down-outline'} size={16} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function AssistantMessage({ fallback = false, loading = false, message, riskLevel = 'info' }: {
  fallback?: boolean;
  loading?: boolean;
  message: string;
  riskLevel?: AssistantRiskLevel;
}) {
  const { t } = useI18n();
  const copy = t.fridge.assistant;
  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatarWrap}>
        <Image contentFit="contain" source={require('../../../assets/kitchmemo-assistant.png')} style={styles.avatar} />
      </View>
      <View style={styles.assistantMessageColumn}>
        <View style={styles.assistantLabelRow}>
          <Text style={styles.assistantName}>{copy.assistantName}</Text>
          {riskLevel !== 'info' ? (
            <View style={[styles.riskBadge, riskLevel === 'danger' ? styles.riskDanger : styles.riskWarning]}>
              <Text style={[styles.riskText, riskLevel === 'danger' ? styles.riskTextDanger : styles.riskTextWarning]}>{riskLevel === 'danger' ? copy.riskDanger : copy.riskWarning}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.assistantBubble}>
          <Text accessibilityLiveRegion="polite" style={styles.assistantBubbleText}>{message}</Text>
          {loading ? <ActivityIndicator color="#D9782D" size="small" style={styles.inlineLoader} /> : null}
          {fallback ? <Text style={styles.fallbackText}>{copy.fallback}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function BatchReference({ batch, onPress }: { batch: InventoryBatch; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable accessibilityHint={t.fridge.assistant.openItem} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.batchReference, pressed && styles.pressed]}>
      <View style={styles.foodIcon}><PresetFoodIcon emoji={batch.iconEmoji ?? '📦'} iconUrl={batch.iconUrl} size="card" /></View>
      <View style={styles.batchCopy}>
        <Text numberOfLines={1} style={styles.batchTitle}>{batch.name}</Text>
        <Text style={styles.batchMeta}>{batch.remainingQuantity} {batch.unit} · {t.fridge.manualEntry.storage[batch.storageZone]}</Text>
      </View>
      <Ionicons color="#7B8D87" name="chevron-forward" size={20} />
    </Pressable>
  );
}

function ActionConfirmationCard({ action, disabled, onCancel, onConfirm, status }: {
  action: AssistantPendingAction;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  status: ActionStatus;
}) {
  const { language, t } = useI18n();
  const copy = t.fridge.assistant;
  const expiry = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-AU', { hour: '2-digit', minute: '2-digit' }).format(new Date(action.expiresAt));
  const settled = !['pending', 'confirming', 'cancelling', 'failed'].includes(status);
  const statusText = status === 'executed' ? copy.actionExecuted
    : status === 'cancelled' ? copy.actionCancelled
      : status === 'expired' ? copy.actionExpired
        : status === 'conflict' ? copy.actionConflict
          : status === 'failed' ? copy.actionFailed
            : null;

  return (
    <View style={[styles.actionCard, settled && styles.actionCardSettled]}>
      <View style={styles.actionTitleRow}>
        <Ionicons color="#B96327" name="create-outline" size={19} />
        <Text style={styles.actionTitle}>{copy.confirmationRequired}</Text>
      </View>
      <Text style={styles.actionSummary}>{action.summary}</Text>
      {statusText ? (
        <View accessibilityLiveRegion="polite" style={styles.actionStatusRow}>
          <Ionicons color={status === 'executed' ? '#28735E' : '#9A4A35'} name={status === 'executed' ? 'checkmark-circle' : 'information-circle'} size={17} />
          <Text style={styles.actionStatusText}>{statusText}</Text>
        </View>
      ) : (
        <Text style={styles.actionExpiry}>{copy.actionExpires(expiry)}</Text>
      )}
      {!settled ? (
        <View style={styles.actionButtons}>
          <Pressable accessibilityRole="button" disabled={disabled} onPress={onCancel} style={({ pressed }) => [styles.cancelButton, disabled && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.cancelButtonText}>{status === 'cancelling' ? copy.cancelling : copy.cancel}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={disabled} onPress={onConfirm} style={({ pressed }) => [styles.confirmButton, disabled && styles.disabled, pressed && styles.pressed]}>
            {status === 'confirming' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.confirmButtonText}>{copy.confirm}</Text>}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F8F7' },
  header: { minHeight: 112, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D8E2DE', backgroundColor: '#F8FBFA' },
  headerSide: { width: 84, alignItems: 'flex-start' },
  headerActions: { width: 84, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  headerIconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#E7F0ED' },
  backButton: { minWidth: 74, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, borderRadius: 21, backgroundColor: '#E7F0ED' },
  backText: { color: '#255043', fontSize: 15, fontWeight: '800' },
  title: { flex: 1, color: '#173D31', fontSize: 19, fontWeight: '900', textAlign: 'center' },
  content: { gap: 18, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 24 },
  restoreWarning: { marginLeft: 51, color: '#94612D', fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
  historyContent: { flexGrow: 1, gap: 10, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 32 },
  historyRow: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#D8E3DF', borderRadius: 16, backgroundColor: '#FFFFFF' },
  historyRowCurrent: { borderColor: '#E6AE82', backgroundColor: '#FFF8F1' },
  historyRowIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EAF2EF' },
  historyRowCopy: { flex: 1, minWidth: 0, gap: 5 },
  historyRowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  historyRowTitle: { flexShrink: 1, color: '#17372D', fontSize: 15, fontWeight: '900' },
  currentBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', backgroundColor: '#F8E2D1', color: '#A85119', fontSize: 10, fontWeight: '900' },
  historyRowPreview: { color: '#5D716A', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  historyRowMeta: { color: '#81918C', fontSize: 11.5, fontWeight: '700' },
  historyEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },
  historyEmptyTitle: { maxWidth: 260, color: '#5F736C', fontSize: 14, fontWeight: '800', lineHeight: 20, textAlign: 'center' },
  historyRetryButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#D9782D' },
  historyRetryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  introSection: { gap: 18, marginBottom: 18 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  avatarWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#DDF5F2' },
  avatar: { width: 38, height: 38 },
  assistantMessageColumn: { flex: 1, alignItems: 'flex-start', gap: 5 },
  assistantLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  assistantName: { color: '#687C75', fontSize: 12, fontWeight: '700' },
  assistantBubble: { maxWidth: '96%', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16, borderTopLeftRadius: 5, backgroundColor: '#FFFFFF' },
  assistantBubbleText: { color: '#203E35', fontSize: 15, fontWeight: '600', lineHeight: 23 },
  inlineLoader: { alignSelf: 'flex-start', marginTop: 8 },
  fallbackText: { marginTop: 9, color: '#8B6B45', fontSize: 11.5, fontWeight: '700', lineHeight: 16 },
  riskBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  riskWarning: { backgroundColor: '#FFF0DB' },
  riskDanger: { backgroundColor: '#FCE3E6' },
  riskText: { fontSize: 10.5, fontWeight: '900' },
  riskTextWarning: { color: '#A65317' },
  riskTextDanger: { color: '#A52C3A' },
  turn: { gap: 13, marginBottom: 20 },
  userMessageRow: { alignItems: 'flex-end', gap: 5, paddingLeft: 42 },
  userName: { paddingRight: 4, color: '#7A8A85', fontSize: 12, fontWeight: '700' },
  userBubble: { maxWidth: '88%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderTopRightRadius: 5, backgroundColor: '#D9782D' },
  userBubbleText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', lineHeight: 21 },
  questionSection: { gap: 9 },
  questionHeading: { color: '#536A62', fontSize: 13, fontWeight: '800' },
  questionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  questionButton: { width: '48.5%', minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 14, backgroundColor: '#FCEFE5' },
  questionText: { flex: 1, color: '#9E4F1C', fontSize: 13, fontWeight: '800', lineHeight: 18 },
  batchReference: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, marginLeft: 51, borderWidth: 1, borderColor: '#DCE5E1', borderRadius: 14, backgroundColor: '#FFFFFF' },
  foodIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F2F6F4' },
  batchCopy: { flex: 1, minWidth: 0, gap: 4 },
  batchTitle: { color: '#17372D', fontSize: 15, fontWeight: '900' },
  batchMeta: { color: '#667A73', fontSize: 12.5, fontWeight: '700' },
  citations: { gap: 7, marginLeft: 51, padding: 12, borderRadius: 13, backgroundColor: '#EAF3F1' },
  citationHeading: { color: '#516B63', fontSize: 12, fontWeight: '900' },
  citationLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  citationText: { flex: 1, color: '#2C766A', fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' },
  actionCard: { gap: 10, marginLeft: 51, padding: 15, borderWidth: 1, borderColor: '#E8B98F', borderRadius: 15, backgroundColor: '#FFF8F0' },
  actionCardSettled: { borderColor: '#C9DCD6', backgroundColor: '#F1F6F4' },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  actionTitle: { color: '#8D471A', fontSize: 13, fontWeight: '900' },
  actionSummary: { color: '#3F514A', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  actionExpiry: { color: '#806B5D', fontSize: 11.5, fontWeight: '600' },
  actionStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionStatusText: { flex: 1, color: '#4C625A', fontSize: 12.5, fontWeight: '800' },
  actionButtons: { flexDirection: 'row', gap: 9 },
  cancelButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C8D4D0', borderRadius: 12, backgroundColor: '#FFFFFF' },
  cancelButtonText: { color: '#4E655D', fontSize: 14, fontWeight: '900' },
  confirmButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#C76827' },
  confirmButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7, marginLeft: 51 },
  feedbackPrompt: { color: '#73857F', fontSize: 11.5, fontWeight: '700' },
  feedbackButton: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#E5ECE9' },
  feedbackButtonSelected: { backgroundColor: '#557168' },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 51, padding: 13, borderRadius: 14, backgroundColor: '#FCE9EB' },
  errorCopy: { flex: 1, gap: 2 },
  errorTitle: { color: '#8E2E39', fontSize: 13.5, fontWeight: '900' },
  errorText: { color: '#77575B', fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  retryButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FFFFFF' },
  retryText: { color: '#963743', fontSize: 12.5, fontWeight: '900' },
  addButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 6, borderRadius: 14, backgroundColor: '#188AA0' },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  composerArea: { gap: 7, paddingHorizontal: 14, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CFDCD7', backgroundColor: '#F8FBFA' },
  ruleNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 5 },
  ruleNoteText: { flex: 1, color: '#6A7E77', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  input: { flex: 1, maxHeight: 112, minHeight: 48, paddingHorizontal: 15, paddingTop: 13, paddingBottom: 12, borderWidth: 1, borderColor: '#C9D8D3', borderRadius: 18, backgroundColor: '#FFFFFF', color: '#173D31', fontSize: 15, lineHeight: 20 },
  sendButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#D9782D' },
  sendButtonDisabled: { backgroundColor: '#B9C5C1' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
