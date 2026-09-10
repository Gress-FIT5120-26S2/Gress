import { randomBytes, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.development', quiet: true });

const apiUrl = process.env.ASSISTANT_HISTORY_TEST_API_URL ?? 'http://127.0.0.1:3002';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = randomUUID();
const devices = [
  { credential: randomBytes(32).toString('hex'), id: `assistant-history-a-${runId}` },
  { credential: randomBytes(32).toString('hex'), id: `assistant-history-b-${runId}` },
];
const fridgeUids = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, device) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { 'Device-Credential': device.credential, 'Device-ID': device.id },
  });
  const body = await response.json().catch(() => null);
  return { body, status: response.status };
}

async function cleanup() {
  // Arthur: NarIyirm
  // 中文：验证只清理本次随机设备和冰箱的数据，避免触碰开发库中任何现有会话。
  // EN: Verification removes only this run's random devices and fridges, preserving every existing development conversation.
  for (const device of devices) {
    await supabase.from('devices').delete().eq('device_id', device.id);
  }
  for (const fridgeUid of fridgeUids) {
    await supabase.from('fridges').delete().eq('fridge_uid', fridgeUid);
  }
}

async function main() {
  for (const device of devices) {
    const inventory = await api('/api/inventory', device);
    assert(inventory.status === 200, `Device bootstrap failed: ${inventory.status}`);
    fridgeUids.push(inventory.body.fridge.uid);
  }

  const { data: conversation, error: conversationError } = await supabase.from('assistant_conversations').insert({
    creator_device_id: devices[0].id,
    fridge_uid: fridgeUids[0],
    language: 'en',
    summary: 'Which food should I use first?',
  }).select('conversation_uid').single();
  if (conversationError) throw conversationError;
  const userInsert = await supabase.from('assistant_messages').insert({
    conversation_uid: conversation.conversation_uid,
    role: 'user',
    content: 'Which food should I use first?',
  });
  if (userInsert.error) throw userInsert.error;
  const { data: assistantMessage, error: assistantError } = await supabase.from('assistant_messages').insert({
    conversation_uid: conversation.conversation_uid,
    role: 'assistant',
    content: 'Check the milk first.',
    structured_payload: {
      actionProposal: null,
      answer: 'Check the milk first.',
      batchReferences: [],
      citations: [],
      fallback: false,
      requiresConfirmation: false,
      riskLevel: 'info',
    },
  }).select('message_uid').single();
  if (assistantError) throw assistantError;
  const actionInsert = await supabase.from('assistant_pending_actions').insert({
    action_payload: { itemName: 'Milk', quantity: 1, summary: 'Add milk to the shopping list', unit: 'bottle' },
    action_type: 'prepare_cart_item',
    assistant_message_uid: assistantMessage.message_uid,
    conversation_uid: conversation.conversation_uid,
    creator_device_id: devices[0].id,
    fridge_uid: fridgeUids[0],
  });
  if (actionInsert.error) throw actionInsert.error;
  const feedbackInsert = await supabase.from('assistant_feedback').insert({
    creator_device_id: devices[0].id,
    message_uid: assistantMessage.message_uid,
    rating: 'up',
  });
  if (feedbackInsert.error) throw feedbackInsert.error;
  const legacyUserInsert = await supabase.from('assistant_messages').insert({
    conversation_uid: conversation.conversation_uid,
    role: 'user',
    content: 'Add yoghurt to my shopping list.',
  });
  if (legacyUserInsert.error) throw legacyUserInsert.error;
  const legacyActionInsert = await supabase.from('assistant_pending_actions').insert({
    action_payload: { itemName: 'Yoghurt', quantity: 1, summary: 'Add yoghurt to the shopping list', unit: 'item' },
    action_type: 'prepare_cart_item',
    conversation_uid: conversation.conversation_uid,
    creator_device_id: devices[0].id,
    fridge_uid: fridgeUids[0],
  });
  if (legacyActionInsert.error) throw legacyActionInsert.error;
  const legacyAssistantInsert = await supabase.from('assistant_messages').insert({
    conversation_uid: conversation.conversation_uid,
    role: 'assistant',
    content: 'I can prepare that action.',
    structured_payload: {
      actionProposal: null,
      answer: 'I can prepare that action.',
      batchReferences: [],
      citations: [],
      fallback: false,
      requiresConfirmation: true,
      riskLevel: 'info',
    },
  });
  if (legacyAssistantInsert.error) throw legacyAssistantInsert.error;

  const list = await api('/api/assistant/conversations', devices[0]);
  assert(
    list.status === 200 && list.body.conversations[0]?.conversationUid === conversation.conversation_uid,
    `History list did not return the private conversation: ${list.status} ${JSON.stringify(list.body)}`,
  );
  const detail = await api(`/api/assistant/conversations/${conversation.conversation_uid}`, devices[0]);
  assert(detail.status === 200, `History detail failed: ${detail.status}`);
  assert(detail.body.turns.length === 2 && detail.body.turns[0].feedback === 'up', 'History detail did not restore the turns and feedback');
  assert(detail.body.turns[0].response.pendingAction?.summary === 'Add milk to the shopping list', 'History detail did not restore the linked action');
  assert(detail.body.turns[1].response.pendingAction?.summary === 'Add yoghurt to the shopping list', 'History detail did not restore a legacy unlinked action');
  const isolated = await api(`/api/assistant/conversations/${conversation.conversation_uid}`, devices[1]);
  assert(isolated.status === 404, 'Another device could read a private assistant conversation');

  console.log(JSON.stringify({ valid: true, verified: ['history-list', 'turn-restore', 'feedback-restore', 'action-link', 'legacy-action-fallback', 'device-isolation'] }));
}

try {
  await main();
} finally {
  await cleanup();
}
