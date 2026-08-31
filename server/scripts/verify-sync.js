import { randomBytes, randomUUID } from 'node:crypto';
import { REALTIME_SUBSCRIBE_STATES, RealtimeClient } from '@supabase/realtime-js';
import { supabase } from '../src/supabase.js';

const apiUrl = process.env.KITCHMEMO_TEST_API_URL ?? 'http://127.0.0.1:3001/api';
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const devices = ['a', 'b'].map((suffix) => `sync_${runId}_${suffix}`);
const credentials = devices.map(() => randomBytes(32).toString('hex'));
let realtimeClient = null;

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

function assertVersionAdvanced(before, after, domain) {
  if (BigInt(after.versions[domain]) <= BigInt(before.versions[domain])) {
    throw new Error(`${domain} sync version did not advance.`);
  }
}

async function cleanup() {
  // Arthur: NarIyirm
  // 中文：只按本轮随机设备创建的精确冰箱 ID 清理验证数据，避免触碰开发库中已有设备和库存。
  // EN: Cleanup uses exact fridge IDs created by this random test run so existing development devices and inventory are untouched.
  const { data: fridges, error: fridgeError } = await supabase.from('fridges').select('fridge_uid').in('created_by_device_id', devices);
  if (fridgeError) throw fridgeError;
  const fridgeUids = (fridges ?? []).map((fridge) => fridge.fridge_uid);
  if (fridgeUids.length > 0) {
    for (const table of ['notifications', 'shopping_cart_items', 'inventory_events', 'inventory_batches', 'restock_rules', 'food_categories', 'fridge_achievements', 'fridge_invites', 'fridge_members']) {
      const { error } = await supabase.from(table).delete().in('fridge_uid', fridgeUids);
      if (error) throw error;
    }
    const { error: detachError } = await supabase.from('fridges').update({ merged_into_fridge_uid: null, status: 'active' }).in('fridge_uid', fridgeUids);
    if (detachError) throw detachError;
    const { error: deleteError } = await supabase.from('fridges').delete().in('fridge_uid', fridgeUids);
    if (deleteError) throw deleteError;
  }
  const { error } = await supabase.from('devices').delete().in('device_id', devices);
  if (error) throw error;
}

try {
  const owner = await api(0, '/fridges/share', { body: JSON.stringify({ name: `Sync ${runId}` }), method: 'POST' });
  await api(1, '/fridges/context');
  await api(1, '/fridges/join', { body: JSON.stringify({ code: owner.activeInvite.code }), method: 'POST' });

  const beforeInventory = await api(1, '/sync/state');
  const { data: syncRow, error: syncRowError } = await supabase
    .from('fridge_sync_versions')
    .select('broadcast_topic')
    .eq('fridge_uid', beforeInventory.fridgeUid)
    .single();
  if (syncRowError) throw syncRowError;

  // Arthur: NarIyirm
  // 中文：验证脚本仅在服务端进程内使用 secret key 订阅随机测试冰箱，确认数据库触发器真的经 Realtime 发出事件；密钥不会输出或进入 App。
  // EN: The verifier uses the secret key only inside this server process to prove the database trigger emits through Realtime for the random test fridge; it is never printed or shipped to the app.
  realtimeClient = new RealtimeClient(`${process.env.SUPABASE_URL.replace(/\/$/u, '')}/realtime/v1`, {
    params: { apikey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY },
  });
  let resolveBroadcast;
  const broadcastReceived = new Promise((resolve) => { resolveBroadcast = resolve; });
  const channel = realtimeClient
    .channel(`kitchmemo:fridge:${syncRow.broadcast_topic}`, { config: { private: false } })
    .on('broadcast', { event: 'sync_invalidated' }, ({ payload }) => resolveBroadcast(payload));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscription timed out.')), 10_000);
    channel.subscribe((status, error) => {
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        clearTimeout(timeout);
        resolve();
      } else if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR || status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
        clearTimeout(timeout);
        reject(error ?? new Error(`Realtime subscription failed: ${status}`));
      }
    });
  });
  await api(0, '/inventory/batches', {
    body: JSON.stringify({ categoryCode: 'other', expiresAt: null, initialQuantity: 1, name: `Live ${runId}`, purchasePrice: null, restockRule: null, storageZone: 'pantry', unit: 'item' }),
    method: 'POST',
  });
  const broadcastPayload = await Promise.race([
    broadcastReceived,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Inventory Broadcast was not received.')), 10_000)),
  ]);
  const afterInventory = await api(1, '/sync/state');
  assertVersionAdvanced(beforeInventory, afterInventory, 'inventory');
  if (broadcastPayload.domain !== 'inventory' || broadcastPayload.version !== afterInventory.versions.inventory) {
    throw new Error(`Unexpected Broadcast payload: ${JSON.stringify(broadcastPayload)}`);
  }
  const sharedInventory = await api(1, '/inventory');
  if (!sharedInventory.batches.some((batch) => batch.name === `Live ${runId}`)) throw new Error('The second device did not read the changed inventory.');

  const beforeCart = await api(1, '/sync/state');
  await api(0, '/cart', { body: JSON.stringify({ name: `Cart ${runId}`, quantity: 1, source: 'manual', unit: 'item' }), method: 'POST' });
  const afterCart = await api(1, '/sync/state');
  assertVersionAdvanced(beforeCart, afterCart, 'cart');

  const beforeFridge = await api(1, '/sync/state');
  await api(0, '/fridges/current', { body: JSON.stringify({ name: `Renamed ${runId}` }), method: 'PATCH' });
  const afterFridge = await api(1, '/sync/state');
  assertVersionAdvanced(beforeFridge, afterFridge, 'fridge');

  console.log(JSON.stringify({ status: 'ok', verified: ['shared-broadcast', 'inventory-version', 'cart-version', 'fridge-version', 'cross-device-read'] }));
} finally {
  if (realtimeClient) await realtimeClient.disconnect().catch(() => undefined);
  await cleanup();
}
