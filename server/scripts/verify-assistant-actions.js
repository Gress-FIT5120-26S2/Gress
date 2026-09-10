import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const environmentName = process.env.NODE_ENV === 'production' ? 'production' : 'development';
dotenv.config({ path: `.env.${environmentName}`, quiet: true });

function requireValue(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Missing ${name}`);
  return value.trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const runId = randomUUID();
const deviceId = `assistant-action-test-${runId}`;
const supabase = createClient(
  requireValue(process.env.SUPABASE_URL, 'SUPABASE_URL'),
  requireValue(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SECRET_KEY'),
  { auth: { autoRefreshToken: false, persistSession: false } },
);
let fridgeUid;
let conversationUid;

async function createBatch(name, quantity = 10) {
  const { data: category, error: categoryError } = await supabase
    .from('food_categories')
    .select('category_uid')
    .eq('fridge_uid', fridgeUid)
    .eq('system_code', 'other')
    .single();
  if (categoryError) throw categoryError;
  const { data, error } = await supabase.from('inventory_batches').insert({
    fridge_uid: fridgeUid,
    category_uid: category.category_uid,
    created_by_device_id: deviceId,
    owner_device_id: deviceId,
    name,
    storage_zone: 'chilled',
    initial_quantity: quantity,
    remaining_quantity: quantity,
    unit: 'item',
  }).select('batch_uid,version,stocked_at').single();
  if (error) throw error;
  return data;
}

async function createAction(actionType, actionPayload, batch = null, timestamps = {}) {
  const { data, error } = await supabase.from('assistant_pending_actions').insert({
    conversation_uid: conversationUid,
    fridge_uid: fridgeUid,
    creator_device_id: deviceId,
    action_type: actionType,
    action_payload: actionPayload,
    target_batch_uid: batch?.batch_uid ?? null,
    expected_batch_version: batch?.version ?? null,
    ...timestamps,
  }).select('action_uid').single();
  if (error) throw error;
  return data.action_uid;
}

async function confirm(actionUid) {
  const { data, error } = await supabase.rpc('confirm_assistant_pending_action', {
    p_action_uid: actionUid,
    p_device_id: deviceId,
  });
  if (error) throw error;
  return data;
}

async function cleanup() {
  if (!fridgeUid) return;
  // Arthur: NarIyirm
  // 中文：只按本次随机 fridge/device 精确清理，并依外键逆序删除；不会使用名称模糊条件触碰现有开发数据。
  // EN: Cleanup targets this run's random fridge/device exactly and follows reverse FK order; no broad name filter can touch existing development data.
  for (const table of ['assistant_feedback', 'assistant_pending_actions', 'assistant_request_audit', 'assistant_messages', 'assistant_conversations', 'notifications', 'shopping_cart_items', 'inventory_events', 'inventory_batches', 'restock_rules', 'food_categories', 'fridge_achievements', 'fridge_invites', 'fridge_members', 'fridge_sync_versions']) {
    const query = supabase.from(table).delete();
    const { error } = table === 'assistant_feedback'
      ? await query.eq('creator_device_id', deviceId)
      : await query.eq('fridge_uid', fridgeUid);
    if (error && error.code !== '42703') throw error;
  }
  const { error: fridgeError } = await supabase.from('fridges').delete().eq('fridge_uid', fridgeUid);
  if (fridgeError) throw fridgeError;
  const { error: deviceError } = await supabase.from('devices').delete().eq('device_id', deviceId);
  if (deviceError) throw deviceError;
}

async function main() {
  assert(environmentName === 'development', 'This verification script is development-only');
  const { data: createdFridge, error: bootstrapError } = await supabase.rpc('bootstrap_device', {
    p_device_id: deviceId,
    p_fridge_name: `Assistant action test ${runId}`,
  });
  if (bootstrapError) throw bootstrapError;
  fridgeUid = createdFridge;
  const { data: conversation, error: conversationError } = await supabase.from('assistant_conversations').insert({
    creator_device_id: deviceId,
    fridge_uid: fridgeUid,
    language: 'en',
  }).select('conversation_uid').single();
  if (conversationError) throw conversationError;
  conversationUid = conversation.conversation_uid;

  const cartAction = await createAction('prepare_cart_item', {
    itemName: `Milk ${runId}`, quantity: 1, unit: 'bottle', summary: 'Add one milk bottle',
  });
  const [cartFirst, cartSecond] = await Promise.all([confirm(cartAction), confirm(cartAction)]);
  assert(cartFirst.status === 'executed' && cartSecond.status === 'executed', 'Concurrent cart confirmation did not resolve idempotently');
  assert([cartFirst.replayed, cartSecond.replayed].filter(Boolean).length === 1, 'Exactly one concurrent cart confirmation must be a replay');
  const { count: cartCount, error: cartCountError } = await supabase
    .from('shopping_cart_items')
    .select('*', { count: 'exact', head: true })
    .eq('fridge_uid', fridgeUid)
    .eq('name', `Milk ${runId}`);
  if (cartCountError) throw cartCountError;
  assert(cartCount === 1, 'Concurrent confirmation inserted more than one cart row');

  let batch = await createBatch(`Quantity ${runId}`);
  const adjustResult = await confirm(await createAction('adjust_quantity', { quantity: 6, summary: 'Set remaining quantity to six' }, batch));
  assert(adjustResult.result.remainingQuantity === 6, 'Quantity confirmation returned the wrong quantity');
  batch = { ...batch, version: adjustResult.result.version };

  const useByAt = new Date(Date.parse(batch.stocked_at) + 86_400_000).toISOString();
  const useByResult = await confirm(await createAction('edit_use_by', { useByAt, summary: 'Set package use-by' }, batch));
  assert(Date.parse(useByResult.result.useByAt) === Date.parse(useByAt), 'Use-by confirmation returned the wrong timestamp');
  batch = { ...batch, version: useByResult.result.version };

  const restockResult = await confirm(await createAction('set_restock_rule', {
    itemName: `Quantity ${runId}`, enabled: true, minimumQuantity: 2, targetQuantity: 5, summary: 'Set restock rule',
  }, batch));
  assert(restockResult.result.enabled === true, 'Restock confirmation was not enabled');

  const consumedResult = await confirm(await createAction('mark_consumed', { quantity: 0, summary: 'Mark used up' }, batch));
  assert(consumedResult.result.remainingQuantity === 0, 'Consumed confirmation did not set quantity to zero');

  const archiveBatch = await createBatch(`Archive ${runId}`, 3);
  const archiveResult = await confirm(await createAction('archive_batch', { summary: 'Archive batch' }, archiveBatch));
  assert(archiveResult.status === 'executed', 'Archive confirmation did not execute');

  const staleBatch = await createBatch(`Stale ${runId}`, 9);
  const staleAction = await createAction('adjust_quantity', { quantity: 4, summary: 'Stale update' }, staleBatch);
  const { error: competingError } = await supabase.rpc('adjust_inventory_batch_quantity', {
    p_batch_uid: staleBatch.batch_uid,
    p_device_id: deviceId,
    p_expected_version: staleBatch.version,
    p_remaining_quantity: 8,
  });
  if (competingError) throw competingError;
  const staleResult = await confirm(staleAction);
  assert(staleResult.status === 'conflict', 'Stale action did not become conflict');

  const cancelledName = `Cancelled ${runId}`;
  const cancelledAction = await createAction('prepare_cart_item', { itemName: cancelledName, quantity: 1, unit: 'item', summary: 'Cancel this' });
  const { data: cancelled, error: cancelError } = await supabase.rpc('cancel_assistant_pending_action', {
    p_action_uid: cancelledAction,
    p_device_id: deviceId,
  });
  if (cancelError) throw cancelError;
  assert(cancelled.status === 'cancelled', 'Pending action was not cancelled');
  assert((await confirm(cancelledAction)).status === 'cancelled', 'Cancelled action was later executable');

  const expiredName = `Expired ${runId}`;
  const expiredAction = await createAction('prepare_cart_item', { itemName: expiredName, quantity: 1, unit: 'item', summary: 'Expired action' }, null, {
    created_at: new Date(Date.now() - 20 * 60_000).toISOString(),
    expires_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  });
  assert((await confirm(expiredAction)).status === 'expired', 'Expired action was not rejected');

  const unauthorizedAction = await createAction('prepare_cart_item', { itemName: `Private ${runId}`, quantity: 1, unit: 'item', summary: 'Private action' });
  const unauthorized = await supabase.rpc('confirm_assistant_pending_action', {
    p_action_uid: unauthorizedAction,
    p_device_id: `not-owner-${runId}`,
  });
  assert(Boolean(unauthorized.error), 'A different device unexpectedly confirmed the action');

  console.log(JSON.stringify({
    valid: true,
    verified: ['atomic-idempotency', 'cart', 'quantity', 'use-by', 'restock', 'consumed', 'archive', 'version-conflict', 'cancel', 'expiry', 'creator-isolation'],
  }));
}

try {
  await main();
} finally {
  await cleanup();
}
