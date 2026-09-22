import { randomBytes, randomUUID } from 'node:crypto';
import { supabase } from '../src/supabase.js';

const apiUrl = process.env.KITCHMEMO_TEST_API_URL ?? 'http://127.0.0.1:3001/api';
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const devices = ['a', 'b', 'c'].map((suffix) => `test_${runId}_${suffix}`);
const credentials = devices.map(() => randomBytes(32).toString('hex'));

async function api(deviceIndex, path, init = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Device-Credential': credentials[deviceIndex],
      'Device-ID': devices[deviceIndex],
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

async function expectApiError(deviceIndex, path, init, expectedStatus, expectedCode) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Device-Credential': credentials[deviceIndex],
      'Device-ID': devices[deviceIndex],
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  assert(response.status === expectedStatus && body?.error === expectedCode,
    `Expected ${expectedStatus}/${expectedCode}, received ${response.status}/${JSON.stringify(body)}.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function addBatch(deviceIndex, name) {
  return api(deviceIndex, '/inventory/batches', {
    body: JSON.stringify({
      categoryCode: 'other',
      expiresAt: null,
      initialQuantity: 1,
      name,
      deadlineType: 'best_before',
      priceSource: 'user',
      purchasePrice: 0,
      restockRule: null,
      storageZone: 'pantry',
      unit: 'item',
    }),
    method: 'POST',
  });
}

async function cleanup() {
  // Arthur: NarIyirm
  // 中文：测试只清理由本次随机设备创建的冰箱，并按外键依赖逆序删除，绝不按名称或宽泛条件清理开发数据。
  // EN: Cleanup targets only fridges created by this run's random devices and deletes in reverse dependency order, never by broad names or patterns.
  const { data: fridges, error: fridgeError } = await supabase
    .from('fridges')
    .select('fridge_uid')
    .in('created_by_device_id', devices);
  if (fridgeError) throw fridgeError;
  const fridgeUids = (fridges ?? []).map((fridge) => fridge.fridge_uid);

  if (fridgeUids.length > 0) {
    // Arthur: NarIyirm
    // 中文：删除会话会级联清理消息和反馈；待确认动作因批次范围外键限制库存删除，必须优先清理。
    // EN: Deleting conversations cascades through messages and feedback; pending actions must go first because their batch-scope foreign key restricts inventory deletion.
    for (const table of ['assistant_pending_actions', 'assistant_request_audit', 'assistant_conversations', 'notifications', 'shopping_cart_items', 'inventory_events', 'inventory_batches', 'restock_rules', 'food_categories', 'fridge_achievements', 'fridge_invites', 'fridge_members']) {
      const { error } = await supabase.from(table).delete().in('fridge_uid', fridgeUids);
      if (error) throw error;
    }
    const { error: detachError } = await supabase
      .from('fridges')
      .update({ merged_into_fridge_uid: null, status: 'active' })
      .in('fridge_uid', fridgeUids);
    if (detachError) throw detachError;
    const { error } = await supabase.from('fridges').delete().in('fridge_uid', fridgeUids);
    if (error) throw error;
  }

  const { error } = await supabase.from('devices').delete().in('device_id', devices);
  if (error) throw error;
}

try {
  await api(0, '/fridges/context');
  await api(1, '/fridges/context');
  await addBatch(0, `Owner A ${runId}`);
  await addBatch(1, `Owner B ${runId}`);

  // Arthur: NarIyirm
  // 中文：在加入方个人冰箱中放入真实助手会话和待确认动作，覆盖曾被复合外键阻断的合并路径。
  // EN: Seed a real conversation and pending action in the joining personal fridge to cover the composite-FK merge path that previously blocked joins.
  const { data: joiningMembership, error: membershipError } = await supabase
    .from('fridge_members')
    .select('fridge_uid')
    .eq('device_id', devices[1])
    .single();
  if (membershipError) throw membershipError;
  const { data: joiningBatch, error: joiningBatchError } = await supabase
    .from('inventory_batches')
    .select('batch_uid, version')
    .eq('fridge_uid', joiningMembership.fridge_uid)
    .eq('name', `Owner B ${runId}`)
    .single();
  if (joiningBatchError) throw joiningBatchError;
  const { data: conversation, error: conversationError } = await supabase
    .from('assistant_conversations')
    .insert({ creator_device_id: devices[1], fridge_uid: joiningMembership.fridge_uid, language: 'en' })
    .select('conversation_uid')
    .single();
  if (conversationError) throw conversationError;
  const { data: pendingAction, error: pendingActionError } = await supabase
    .from('assistant_pending_actions')
    .insert({
      action_payload: { batchUid: joiningBatch.batch_uid },
      action_type: 'archive_batch',
      conversation_uid: conversation.conversation_uid,
      creator_device_id: devices[1],
      expected_batch_version: joiningBatch.version,
      fridge_uid: joiningMembership.fridge_uid,
      target_batch_uid: joiningBatch.batch_uid,
    })
    .select('action_uid')
    .single();
  if (pendingActionError) throw pendingActionError;

  const enabled = await api(0, '/fridges/share', {
    body: JSON.stringify({ name: `Family ${runId}` }),
    method: 'POST',
  });
  assert(enabled.fridge.mode === 'shared' && enabled.fridge.name === `Family ${runId}`, 'Creating sharing did not name and enable the current fridge.');
  assert(enabled.activeInvite?.code && enabled.members.length === 1, 'Creating sharing did not return its invite and member context.');

  const firstInviteCode = enabled.activeInvite.code;
  const rotated = await api(0, '/fridges/invites', { method: 'POST' });
  assert(rotated.activeInvite?.code && rotated.activeInvite.code !== firstInviteCode, 'Invite rotation did not issue a replacement code.');
  const { data: oldInvite } = await supabase.from('fridge_invites').select('status').eq('code', firstInviteCode).single();
  assert(oldInvite?.status === 'revoked', 'Invite rotation did not revoke the previous code.');
  await expectApiError(1, '/fridges/join', {
    body: JSON.stringify({ code: firstInviteCode }),
    method: 'POST',
  }, 410, 'invite_revoked');

  // Arthur: NarIyirm
  // 中文：构造精确归属本轮随机冰箱的历史邀请码，验证终态错误不会再退化成 invite_not_found。
  // EN: Create a historical invite scoped to this random fridge to prove terminal-state errors no longer degrade to invite_not_found.
  const expiredCode = `EXP${runId.slice(0, 5)}`.toUpperCase();
  const { error: expiredInsertError } = await supabase.from('fridge_invites').insert({
    code: expiredCode,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    created_by_device_id: devices[0],
    expires_at: new Date(Date.now() - 86_400_000).toISOString(),
    fridge_uid: enabled.fridge.uid,
    status: 'expired',
  });
  if (expiredInsertError) throw expiredInsertError;
  await expectApiError(1, '/fridges/join', {
    body: JSON.stringify({ code: expiredCode }),
    method: 'POST',
  }, 410, 'invite_expired');
  await expectApiError(1, '/fridges/join', {
    body: JSON.stringify({ code: 'ZZZZZZZZ' }),
    method: 'POST',
  }, 404, 'invite_not_found');

  const renamed = await api(0, '/fridges/current', {
    body: JSON.stringify({ name: `Shared ${runId}` }),
    method: 'PATCH',
  });
  assert(renamed.fridge.name === `Shared ${runId}`, 'Shared fridge rename did not persist.');

  const joined = await api(1, '/fridges/join', {
    body: JSON.stringify({ code: rotated.activeInvite.code }),
    method: 'POST',
  });
  assert(joined.fridge.mode === 'shared' && joined.fridge.memberCount === 2 && joined.members.length === 2, 'Join did not create a two-device shared fridge.');
  const [{ data: movedConversation, error: movedConversationError }, { data: invalidatedAction, error: invalidatedActionError }] = await Promise.all([
    supabase.from('assistant_conversations').select('fridge_uid').eq('conversation_uid', conversation.conversation_uid).single(),
    supabase.from('assistant_pending_actions').select('fridge_uid, status, target_batch_uid').eq('action_uid', pendingAction.action_uid).single(),
  ]);
  if (movedConversationError || invalidatedActionError) throw movedConversationError ?? invalidatedActionError;
  assert(movedConversation.fridge_uid === joined.fridge.uid, 'Joining did not move creator-private assistant history into the target scope.');
  assert(invalidatedAction.fridge_uid === joined.fridge.uid && invalidatedAction.status === 'expired' && invalidatedAction.target_batch_uid === null,
    'Joining did not invalidate the old-scope assistant action before moving inventory.');
  await expectApiError(1, '/fridges/join', {
    body: JSON.stringify({ code: rotated.activeInvite.code }),
    method: 'POST',
  }, 410, 'invite_used');

  const sharedInventory = await api(0, '/inventory');
  assert(sharedInventory.batches.some((batch) => batch.name === `Owner A ${runId}`), 'Owner A batch disappeared after join.');
  assert(sharedInventory.batches.some((batch) => batch.name === `Owner B ${runId}`), 'Owner B batch did not merge into the shared fridge.');

  const left = await api(1, '/fridges/leave', { body: '{}', method: 'POST' });
  assert(left.fridge.mode === 'personal' && left.fridge.memberCount === 1, 'Leaving device did not receive a personal fridge.');

  const [ownerAInventory, ownerBInventory] = await Promise.all([api(0, '/inventory'), api(1, '/inventory')]);
  assert(ownerAInventory.batches.some((batch) => batch.name === `Owner A ${runId}`), 'Owner A did not retain its own batch.');
  assert(!ownerAInventory.batches.some((batch) => batch.name === `Owner B ${runId}`), 'Owner B batch remained in the old fridge after leave.');
  assert(ownerBInventory.batches.some((batch) => batch.name === `Owner B ${runId}`), 'Owner B did not take its owned batch when leaving.');

  const recovery = await api(1, '/devices/recovery-code', { method: 'POST' });
  const recovered = await api(2, '/devices/recover', {
    body: JSON.stringify({ recoveryCode: recovery.recoveryCode }),
    method: 'POST',
  });
  assert(recovered.recoveryCode && recovered.fridge.mode === 'personal', 'Recovery did not rotate the code or restore the personal fridge.');

  const recoveredInventory = await api(2, '/inventory');
  assert(recoveredInventory.batches.some((batch) => batch.name === `Owner B ${runId}`), 'Recovered device did not receive the old device ownership.');

  const oldDeviceResponse = await fetch(`${apiUrl}/inventory`, {
    headers: { 'Device-Credential': credentials[1], 'Device-ID': devices[1] },
  });
  assert(oldDeviceResponse.status === 401, 'Old device credential remained active after recovery.');

  console.log(JSON.stringify({ status: 'ok', verified: ['enable-sharing', 'invite-error-states', 'invite-rotation', 'rename', 'join', 'assistant-scope-merge', 'ownership', 'leave', 'recovery', 'old-device-revocation'] }));
} finally {
  await cleanup();
}
