import { requestApi } from './apiClient';

export type AssistantLanguage = 'en' | 'zh';
export type AssistantRiskLevel = 'danger' | 'info' | 'warning';
export type AssistantActionType =
  | 'adjust_quantity'
  | 'archive_batch'
  | 'edit_use_by'
  | 'mark_consumed'
  | 'prepare_cart_item'
  | 'set_restock_rule';

export type AssistantCitation = {
  sourceTitle: string;
  sourceUrl: string;
};

export type AssistantActionProposal = {
  actionType: AssistantActionType;
  enabled: boolean | null;
  itemName: string | null;
  minimumQuantity: number | null;
  quantity: number | null;
  summary: string;
  targetBatchUid: string | null;
  targetQuantity: number | null;
  unit: string | null;
  useByAt: string | null;
};

export type AssistantAnswer = {
  actionProposal: AssistantActionProposal | null;
  answer: string;
  batchReferences: string[];
  citations: AssistantCitation[];
  requiresConfirmation: boolean;
  riskLevel: AssistantRiskLevel;
};

export type AssistantPendingAction = {
  actionType: AssistantActionType;
  actionUid: string;
  expiresAt: string;
  summary: string;
};

export type AssistantMessageResponse = {
  answer: AssistantAnswer;
  conversationUid: string;
  fallback: boolean;
  messageUid: string;
  pendingAction: AssistantPendingAction | null;
};

export type AssistantActionResult = {
  actionType: AssistantActionType;
  replayed?: boolean;
  result?: Record<string, unknown>;
  status: 'cancelled' | 'conflict' | 'executed' | 'expired';
};

export type AssistantConversationSummary = {
  conversationUid: string;
  createdAt: string;
  expiresAt: string;
  language: AssistantLanguage;
  messageCount: number;
  preview: string;
  title: string;
  updatedAt: string;
};

export type AssistantConversationTurn = {
  actionStatus: 'cancelled' | 'confirmed' | 'conflict' | 'executed' | 'expired' | 'failed' | 'pending' | null;
  createdAt: string;
  feedback: 'down' | 'up' | null;
  id: string;
  question: string;
  response: AssistantMessageResponse;
};

export type AssistantConversationDetail = {
  conversation: Omit<AssistantConversationSummary, 'messageCount' | 'preview'>;
  turns: AssistantConversationTurn[];
};

// Arthur: NarIyirm
// 中文：自由输入和快捷问题共用同一个消息端点；conversationUid 让同一次打开期间的追问保持上下文。
// EN: Free-form input and quick questions share one message endpoint; conversationUid preserves context while the assistant is open.
export function sendAssistantMessage(input: {
  conversationUid?: string | null;
  language: AssistantLanguage;
  message: string;
}) {
  return requestApi<AssistantMessageResponse>('/api/assistant/messages', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

// Arthur: NarIyirm
// 中文：确认与取消始终命中服务端保存的短时动作草案，客户端不会自行拼装库存写入请求。
// EN: Confirm and cancel always target the server-stored short-lived proposal; the client never assembles inventory mutations itself.
export function confirmAssistantAction(actionUid: string) {
  return requestApi<AssistantActionResult>(`/api/assistant/actions/${encodeURIComponent(actionUid)}/confirm`, {
    body: JSON.stringify({ confirm: true }),
    method: 'POST',
  });
}

export function cancelAssistantAction(actionUid: string) {
  return requestApi<AssistantActionResult>(`/api/assistant/actions/${encodeURIComponent(actionUid)}/cancel`, {
    method: 'POST',
  });
}

export function sendAssistantFeedback(messageUid: string, rating: 'down' | 'up') {
  return requestApi<void>(`/api/assistant/messages/${encodeURIComponent(messageUid)}/feedback`, {
    body: JSON.stringify({ rating }),
    method: 'POST',
  });
}

export function getAssistantConversations(limit = 30) {
  return requestApi<{ conversations: AssistantConversationSummary[] }>(`/api/assistant/conversations?limit=${limit}`);
}

export function getAssistantConversation(conversationUid: string) {
  return requestApi<AssistantConversationDetail>(`/api/assistant/conversations/${encodeURIComponent(conversationUid)}`);
}
