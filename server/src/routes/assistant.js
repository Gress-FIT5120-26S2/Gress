import { createHmac } from 'node:crypto';
import { Router } from 'express';
import { consumeRateLimit, rateLimitPolicies } from '../middleware/rateLimit.js';
import { notifySharedInventory } from './inventory.js';
import { ASSISTANT_PROMPT_VERSION, runAssistant } from '../services/assistantOrchestrator.js';
import { supabase } from '../supabase.js';

const assistantRouter = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVENTORY_UNITS = new Set(['item', 'g', 'kg', 'ml', 'L', 'bag', 'bottle', 'box']);

function quantityLimit(unit) {
  return unit === 'g' || unit === 'ml' ? 1_000_000 : 1_000;
}

function safetyIdentifier(deviceId) {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createHmac('sha256', secret).update(`assistant:${deviceId}`, 'utf8').digest('hex');
}

function presentString(value, maxLength = 120) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function finiteNumber(value, minimum = 0) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum;
}

function validateActionProposal(action) {
  if (!action || !presentString(action.summary, 300)) throw new Error('assistant_action_invalid');
  const needsTarget = ['archive_batch', 'adjust_quantity', 'mark_consumed', 'edit_use_by'].includes(action.actionType);
  if (needsTarget && !UUID_PATTERN.test(action.targetBatchUid ?? '')) throw new Error('assistant_action_invalid');

  switch (action.actionType) {
    case 'prepare_cart_item':
      if (action.targetBatchUid !== null || !presentString(action.itemName)
        || (action.unit !== null && !INVENTORY_UNITS.has(action.unit))
        || (action.quantity !== null && (!finiteNumber(action.quantity, Number.EPSILON) || action.quantity >= quantityLimit(action.unit)))) {
        throw new Error('assistant_action_invalid');
      }
      break;
    case 'archive_batch':
      break;
    case 'adjust_quantity':
      if (!finiteNumber(action.quantity)) throw new Error('assistant_action_invalid');
      break;
    case 'mark_consumed':
      if (action.quantity !== null && action.quantity !== 0) throw new Error('assistant_action_invalid');
      break;
    case 'edit_use_by':
      if (!presentString(action.useByAt) || !Number.isFinite(Date.parse(action.useByAt))) throw new Error('assistant_action_invalid');
      break;
    case 'set_restock_rule':
      if (!UUID_PATTERN.test(action.targetBatchUid ?? '') || !presentString(action.itemName) || typeof action.enabled !== 'boolean'
        || (action.enabled && (!finiteNumber(action.minimumQuantity) || !finiteNumber(action.targetQuantity) || action.targetQuantity <= action.minimumQuantity))) {
        throw new Error('assistant_action_invalid');
      }
      break;
    default:
      throw new Error('assistant_action_invalid');
  }
  if (action.unit !== null && !presentString(action.unit, 24)) throw new Error('assistant_action_invalid');
}

async function resolveConversation(conversationUid, request, language, initialMessage) {
  if (conversationUid) {
    const { data, error } = await supabase
      .from('assistant_conversations')
      .select('conversation_uid')
      .eq('conversation_uid', conversationUid)
      .eq('creator_device_id', request.deviceId)
      .eq('fridge_uid', request.fridgeUid)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('assistant_conversation_not_found');
    return data.conversation_uid;
  }

  const { data, error } = await supabase.from('assistant_conversations').insert({
    creator_device_id: request.deviceId,
    fridge_uid: request.fridgeUid,
    language,
    summary: initialMessage.slice(0, 200),
  }).select('conversation_uid').single();
  if (error) throw error;
  return data.conversation_uid;
}

function effectiveActionStatus(status, expiresAt) {
  return status === 'pending' && Date.parse(expiresAt) <= Date.now() ? 'expired' : status;
}

function presentPendingAction(action) {
  if (!action) return null;
  return {
    actionUid: action.action_uid,
    actionType: action.action_type,
    expiresAt: action.expires_at,
    summary: action.action_payload?.summary ?? action.action_type,
  };
}

// Arthur: NarIyirm
// 中文：历史列表严格限定当前设备和当前冰箱，只返回会话摘要；共享库存权限不会扩展为读取其他成员的私人对话。
// EN: History is scoped to the current device and fridge and returns summaries only; shared inventory access never grants access to another member's private conversations.
assistantRouter.get('/assistant/conversations', async (request, response) => {
  const requestedLimit = Number.parseInt(String(request.query.limit ?? '30'), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 30;
  try {
    const { data: conversations, error } = await supabase
      .from('assistant_conversations')
      .select('conversation_uid,language,summary,created_at,updated_at,expires_at')
      .eq('creator_device_id', request.deviceId)
      .eq('fridge_uid', request.fridgeUid)
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!conversations?.length) return response.json({ conversations: [] });

    const conversationUids = conversations.map((conversation) => conversation.conversation_uid);
    const { data: messages, error: messageError } = await supabase
      .from('assistant_messages')
      .select('conversation_uid,role,content,created_at')
      .in('conversation_uid', conversationUids)
      .order('created_at', { ascending: true });
    if (messageError) throw messageError;

    const messagesByConversation = new Map();
    for (const message of messages ?? []) {
      const existing = messagesByConversation.get(message.conversation_uid) ?? [];
      existing.push(message);
      messagesByConversation.set(message.conversation_uid, existing);
    }
    return response.json({
      conversations: conversations.map((conversation) => {
        const conversationMessages = messagesByConversation.get(conversation.conversation_uid) ?? [];
        const firstUserMessage = conversationMessages.find((message) => message.role === 'user');
        const latestMessage = conversationMessages.at(-1);
        return {
          conversationUid: conversation.conversation_uid,
          createdAt: conversation.created_at,
          expiresAt: conversation.expires_at,
          language: conversation.language,
          messageCount: conversationMessages.length,
          preview: latestMessage?.content.slice(0, 180) ?? '',
          title: conversation.summary?.trim() || firstUserMessage?.content.slice(0, 180) || '',
          updatedAt: conversation.updated_at,
        };
      }),
    });
  } catch (error) {
    console.error('Assistant conversation history failed:', error.message);
    return response.status(503).json({ error: 'assistant_history_unavailable' });
  }
});

// Arthur: NarIyirm
// 中文：恢复接口返回服务端保存的结构化回答、反馈和动作最终状态，客户端无需信任本地消息或猜测待确认动作是否仍有效。
// EN: Restoration returns server-stored structured answers, feedback, and final action state so the client never trusts cached messages or guesses whether an action remains valid.
assistantRouter.get('/assistant/conversations/:conversationUid', async (request, response) => {
  const { conversationUid } = request.params;
  if (!UUID_PATTERN.test(conversationUid)) return response.status(400).json({ error: 'assistant_conversation_invalid' });
  try {
    const { data: conversation, error: conversationError } = await supabase
      .from('assistant_conversations')
      .select('conversation_uid,language,summary,created_at,updated_at,expires_at')
      .eq('conversation_uid', conversationUid)
      .eq('creator_device_id', request.deviceId)
      .eq('fridge_uid', request.fridgeUid)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return response.status(404).json({ error: 'assistant_conversation_not_found' });

    const messageResult = await supabase.from('assistant_messages')
      .select('message_uid,role,content,structured_payload,created_at')
      .eq('conversation_uid', conversationUid)
      .order('created_at', { ascending: true })
      .limit(200);
    if (messageResult.error) throw messageResult.error;
    const messageUids = (messageResult.data ?? []).map((message) => message.message_uid);
    const [actionResult, feedbackResult] = await Promise.all([
      supabase.from('assistant_pending_actions')
        .select('action_uid,assistant_message_uid,action_type,action_payload,status,expires_at,created_at')
        .eq('conversation_uid', conversationUid)
        .eq('creator_device_id', request.deviceId)
        .order('created_at', { ascending: true }),
      messageUids.length > 0
        ? supabase.from('assistant_feedback')
          .select('message_uid,rating')
          .eq('creator_device_id', request.deviceId)
          .in('message_uid', messageUids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (actionResult.error) throw actionResult.error;
    if (feedbackResult.error) throw feedbackResult.error;

    const actionsByMessage = new Map((actionResult.data ?? [])
      .filter((action) => action.assistant_message_uid)
      .map((action) => [action.assistant_message_uid, action]));
    const legacyActions = (actionResult.data ?? []).filter((action) => !action.assistant_message_uid);
    const usedLegacyActionUids = new Set();
    const feedbackByMessage = new Map((feedbackResult.data ?? []).map((feedback) => [feedback.message_uid, feedback.rating]));
    const turns = [];
    let latestUserMessage = null;
    for (const message of messageResult.data ?? []) {
      if (message.role === 'user') {
        latestUserMessage = message;
        continue;
      }
      const payload = message.structured_payload;
      if (!latestUserMessage || !payload || typeof payload.answer !== 'string') continue;
      // Arthur: NarIyirm
      // 中文：新动作按外键精确恢复；迁移前的少量空外键记录仅在同一 user/assistant 时间窗内做兼容匹配。
      // EN: New actions restore by exact foreign key; the few pre-migration null links are matched only within their user/assistant time window.
      const action = actionsByMessage.get(message.message_uid) ?? [...legacyActions].reverse().find((candidate) => (
        !usedLegacyActionUids.has(candidate.action_uid)
        && Date.parse(candidate.created_at) >= Date.parse(latestUserMessage.created_at)
        && Date.parse(candidate.created_at) <= Date.parse(message.created_at)
      )) ?? null;
      if (action && !action.assistant_message_uid) usedLegacyActionUids.add(action.action_uid);
      turns.push({
        actionStatus: action ? effectiveActionStatus(action.status, action.expires_at) : null,
        createdAt: message.created_at,
        feedback: feedbackByMessage.get(message.message_uid) ?? null,
        id: message.message_uid,
        question: latestUserMessage.content,
        response: {
          answer: {
            actionProposal: payload.actionProposal ?? null,
            answer: payload.answer,
            batchReferences: Array.isArray(payload.batchReferences) ? payload.batchReferences : [],
            citations: Array.isArray(payload.citations) ? payload.citations : [],
            requiresConfirmation: Boolean(payload.requiresConfirmation),
            riskLevel: ['info', 'warning', 'danger'].includes(payload.riskLevel) ? payload.riskLevel : 'info',
          },
          conversationUid,
          fallback: Boolean(payload.fallback),
          messageUid: message.message_uid,
          pendingAction: presentPendingAction(action),
        },
      });
      latestUserMessage = null;
    }

    return response.json({
      conversation: {
        conversationUid,
        createdAt: conversation.created_at,
        expiresAt: conversation.expires_at,
        language: conversation.language,
        title: conversation.summary?.trim() || turns[0]?.question.slice(0, 180) || '',
        updatedAt: conversation.updated_at,
      },
      turns,
    });
  } catch (error) {
    console.error('Assistant conversation restore failed:', error.message);
    return response.status(503).json({ error: 'assistant_history_unavailable' });
  }
});

async function readConversationContext(conversationUid) {
  // Arthur: NarIyirm
  // 中文：数据库按倒序高效取最近八条，再恢复时间顺序交给模型；旧库存事实仍须通过工具重新读取。
  // EN: Fetch the latest eight rows efficiently in reverse order, then restore chronology; stale inventory facts must still be refreshed through tools.
  const { data, error } = await supabase
    .from('assistant_messages')
    .select('role,content,created_at')
    .eq('conversation_uid', conversationUid)
    .order('created_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []).reverse().map(({ role, content }) => ({ role, content }));
}

async function stageAction(action, conversationUid, request) {
  if (!action) return null;
  // Arthur: NarIyirm
  // 中文：结构化输出只保证 JSON 形状；真正入库前仍按动作语义验证必填字段、数值范围和目标类型。
  // EN: Structured output guarantees JSON shape only; semantic requirements, ranges, and target rules are revalidated before persistence.
  validateActionProposal(action);
  let expectedBatchVersion = null;
  let targetBatch = null;
  if (action.targetBatchUid) {
    const { data, error } = await supabase
      .from('inventory_batches')
      .select('version,unit,stocked_at,initial_quantity')
      .eq('batch_uid', action.targetBatchUid)
      .eq('fridge_uid', request.fridgeUid)
      .eq('lifecycle_state', 'active')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('assistant_action_target_invalid');
    targetBatch = data;
    expectedBatchVersion = data.version;
  }
  if (action.actionType === 'adjust_quantity' && (action.quantity > Number(targetBatch.initial_quantity) || action.quantity >= quantityLimit(targetBatch.unit))) {
    throw new Error('assistant_action_invalid');
  }
  if (action.actionType === 'edit_use_by' && Date.parse(action.useByAt) < Date.parse(targetBatch.stocked_at)) {
    throw new Error('assistant_action_invalid');
  }
  if (action.actionType === 'set_restock_rule' && action.enabled
    && (action.minimumQuantity >= quantityLimit(targetBatch.unit) || action.targetQuantity >= quantityLimit(targetBatch.unit))) {
    throw new Error('assistant_action_invalid');
  }

  // Arthur: NarIyirm
  // 中文：模型只能生成短时动作草案；这里重新绑定当前冰箱和批次版本，确认接口以后只能执行这份服务端记录。
  // EN: The model only proposes a short-lived action; the server rebinds it to the current fridge and batch version so confirmation can execute only this server record.
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const { data, error } = await supabase.from('assistant_pending_actions').insert({
    conversation_uid: conversationUid,
    fridge_uid: request.fridgeUid,
    creator_device_id: request.deviceId,
    action_type: action.actionType,
    action_payload: {
      itemName: action.itemName,
      quantity: action.quantity,
      unit: targetBatch?.unit ?? action.unit,
      useByAt: action.useByAt,
      enabled: action.enabled,
      minimumQuantity: action.minimumQuantity,
      targetQuantity: action.targetQuantity,
      summary: action.summary,
    },
    target_batch_uid: action.targetBatchUid,
    expected_batch_version: expectedBatchVersion,
    status: 'pending',
    expires_at: expiresAt,
  }).select('action_uid,action_type,expires_at').single();
  if (error) throw error;
  return { actionUid: data.action_uid, actionType: data.action_type, expiresAt: data.expires_at, summary: action.summary };
}

assistantRouter.post('/assistant/messages', async (request, response) => {
  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
  const language = request.body?.language === 'zh' ? 'zh' : request.body?.language === 'en' ? 'en' : null;
  const conversationUid = request.body?.conversationUid ?? null;
  if (!message || message.length > 2000 || !language) return response.status(400).json({ error: 'assistant_request_invalid' });
  if (conversationUid !== null && (typeof conversationUid !== 'string' || !UUID_PATTERN.test(conversationUid))) {
    return response.status(400).json({ error: 'assistant_conversation_invalid' });
  }
  if (!await consumeRateLimit({ request, response, identifier: request.deviceId, policy: rateLimitPolicies.assistant })) return undefined;

  const startedAt = Date.now();
  let resolvedConversationUid = null;
  try {
    resolvedConversationUid = await resolveConversation(conversationUid, request, language, message);
    const conversationMessages = await readConversationContext(resolvedConversationUid);
    const userInsert = await supabase.from('assistant_messages').insert({
      conversation_uid: resolvedConversationUid,
      role: 'user',
      content: message,
      prompt_version: ASSISTANT_PROMPT_VERSION,
    });
    if (userInsert.error) throw userInsert.error;

    const result = await runAssistant({
      message,
      language,
      conversationMessages,
      context: {
        deviceId: request.deviceId,
        fridgeUid: request.fridgeUid,
        safetyIdentifier: safetyIdentifier(request.deviceId),
        supabase,
      },
    });
    const pendingAction = await stageAction(result.response.actionProposal, resolvedConversationUid, request);
    const assistantInsert = await supabase.from('assistant_messages').insert({
      conversation_uid: resolvedConversationUid,
      role: 'assistant',
      content: result.response.answer,
      structured_payload: { ...result.response, fallback: result.fallback },
      model: result.model,
      prompt_version: ASSISTANT_PROMPT_VERSION,
      input_tokens: result.usage?.input_tokens ?? null,
      output_tokens: result.usage?.output_tokens ?? null,
      latency_ms: result.latencyMs,
    }).select('message_uid').single();
    if (assistantInsert.error) throw assistantInsert.error;
    if (pendingAction) {
      const actionLink = await supabase.from('assistant_pending_actions')
        .update({ assistant_message_uid: assistantInsert.data.message_uid })
        .eq('action_uid', pendingAction.actionUid)
        .eq('creator_device_id', request.deviceId);
      if (actionLink.error) throw actionLink.error;
    }

    // Arthur: NarIyirm
    // 中文：消息新增不会自动触发会话 updated_at；轻量更新同语言字段让历史列表按最近一次真实对话排序。
    // EN: Message inserts do not touch the conversation row, so a no-op language update advances updated_at for correct recent-history ordering.
    const conversationTouch = await supabase.from('assistant_conversations')
      .update({ language })
      .eq('conversation_uid', resolvedConversationUid)
      .eq('creator_device_id', request.deviceId)
      .eq('fridge_uid', request.fridgeUid);
    if (conversationTouch.error) throw conversationTouch.error;

    const auditInsert = await supabase.from('assistant_request_audit').insert({
      conversation_uid: resolvedConversationUid,
      fridge_uid: request.fridgeUid,
      creator_device_id: request.deviceId,
      model: result.model,
      prompt_version: ASSISTANT_PROMPT_VERSION,
      tool_names: result.toolNames,
      status: result.fallback ? 'fallback' : 'completed',
      validation_status: result.fallback ? 'fallback' : 'valid',
      input_tokens: result.usage?.input_tokens ?? null,
      output_tokens: result.usage?.output_tokens ?? null,
      latency_ms: result.latencyMs,
      error_code: result.errorCode?.slice(0, 120) ?? null,
    });
    if (auditInsert.error) throw auditInsert.error;

    return response.json({
      conversationUid: resolvedConversationUid,
      messageUid: assistantInsert.data.message_uid,
      answer: result.response,
      pendingAction,
      fallback: result.fallback,
    });
  } catch (error) {
    console.error('Assistant request failed:', error.message);
    return response.status(error.message === 'assistant_conversation_not_found' ? 404 : 503).json({ error: 'assistant_unavailable' });
  }
});

assistantRouter.post('/assistant/messages/:messageUid/feedback', async (request, response) => {
  const { messageUid } = request.params;
  const { rating, reasonCode = null, comment = null } = request.body ?? {};
  if (!UUID_PATTERN.test(messageUid) || !['up', 'down'].includes(rating)) return response.status(400).json({ error: 'assistant_feedback_invalid' });
  if (reasonCode !== null && (typeof reasonCode !== 'string' || reasonCode.length > 80)) return response.status(400).json({ error: 'assistant_feedback_invalid' });
  if (comment !== null && (typeof comment !== 'string' || comment.length > 1000)) return response.status(400).json({ error: 'assistant_feedback_invalid' });
  if (!await consumeRateLimit({ request, response, identifier: request.deviceId, policy: rateLimitPolicies.assistant })) return undefined;

  try {
    const { data: message, error: messageError } = await supabase
      .from('assistant_messages')
      .select('message_uid,role,assistant_conversations!inner(creator_device_id,fridge_uid)')
      .eq('message_uid', messageUid)
      .eq('assistant_conversations.creator_device_id', request.deviceId)
      .eq('assistant_conversations.fridge_uid', request.fridgeUid)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message || message.role !== 'assistant') return response.status(404).json({ error: 'assistant_message_not_found' });

    // Arthur: NarIyirm
    // 中文：反馈只能写到当前设备私有会话中的助手消息；唯一键让重复评价更新同一条记录。
    // EN: Feedback can target only an assistant message in this device's private conversation; the unique key updates repeat ratings in place.
    const { error } = await supabase.from('assistant_feedback').upsert({
      message_uid: messageUid,
      creator_device_id: request.deviceId,
      rating,
      reason_code: reasonCode?.trim() || null,
      comment: comment?.trim() || null,
    }, { onConflict: 'message_uid,creator_device_id' });
    if (error) throw error;
    return response.status(204).send();
  } catch (error) {
    console.error('Assistant feedback failed:', error.message);
    return response.status(503).json({ error: 'assistant_unavailable' });
  }
});

function sendAssistantActionStatus(response, result) {
  if (result.status === 'expired') return response.status(410).json(result);
  if (result.status === 'conflict' || result.status === 'cancelled') return response.status(409).json(result);
  return response.json(result);
}

assistantRouter.post('/assistant/actions/:actionUid/confirm', async (request, response) => {
  const { actionUid } = request.params;
  if (!UUID_PATTERN.test(actionUid) || request.body?.confirm !== true) return response.status(400).json({ error: 'assistant_confirmation_invalid' });
  if (!await consumeRateLimit({ request, response, identifier: request.deviceId, policy: rateLimitPolicies.assistant })) return undefined;

  try {
    // Arthur: NarIyirm
    // 中文：数据库函数在一个事务中锁定动作、复核创建者/冰箱/期限/版本并执行业务写入，Express 不做可竞态的读后写确认。
    // EN: The database function locks, authorizes, expiry/version-checks, and executes in one transaction; Express never performs a race-prone read-then-write confirmation.
    const { data, error } = await supabase.rpc('confirm_assistant_pending_action', {
      p_action_uid: actionUid,
      p_device_id: request.deviceId,
    });
    if (error) throw error;

    const batchUid = data.result?.batchUid;
    if (data.status === 'executed' && !data.replayed && batchUid) {
      await notifySharedInventory(request.deviceId, batchUid, data.actionType === 'archive_batch' ? 'removed' : 'updated');
    }
    return sendAssistantActionStatus(response, data);
  } catch (error) {
    if (error.message?.includes('Assistant action not found')) return response.status(404).json({ error: 'assistant_action_not_found' });
    console.error('Assistant action confirmation failed:', error.message);
    return response.status(503).json({ error: 'assistant_action_unavailable' });
  }
});

assistantRouter.post('/assistant/actions/:actionUid/cancel', async (request, response) => {
  const { actionUid } = request.params;
  if (!UUID_PATTERN.test(actionUid)) return response.status(400).json({ error: 'assistant_action_invalid' });
  if (!await consumeRateLimit({ request, response, identifier: request.deviceId, policy: rateLimitPolicies.assistant })) return undefined;

  try {
    const { data, error } = await supabase.rpc('cancel_assistant_pending_action', {
      p_action_uid: actionUid,
      p_device_id: request.deviceId,
    });
    if (error) throw error;
    return sendAssistantActionStatus(response, data);
  } catch (error) {
    if (error.message?.includes('Assistant action not found')) return response.status(404).json({ error: 'assistant_action_not_found' });
    console.error('Assistant action cancellation failed:', error.message);
    return response.status(503).json({ error: 'assistant_action_unavailable' });
  }
});

export default assistantRouter;
