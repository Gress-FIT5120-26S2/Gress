import { randomBytes, randomUUID } from 'node:crypto';
import { supabase } from '../src/supabase.js';

const apiUrl = process.env.KITCHMEMO_NOTIFICATION_TEST_API_URL ?? 'http://127.0.0.1:3001/api';
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const devices = ['a', 'b'].map((suffix) => `notification_${runId}_${suffix}`);
const credentials = devices.map(() => randomBytes(32).toString('hex'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

function findShared(snapshot, action, batchUid) {
  return snapshot.items.find((item) => item.type === 'shared'
    && item.relatedBatchUid === batchUid
    && item.payload?.action === action);
}

async function cleanup() {
  // Arthur: NarIyirm
  // 中文：只删除本轮随机设备创建的冰箱和设备；通知投递与 Push Token 由精确外键级联清理。
  // EN: Delete only fridges and devices created by this random run; delivery records and push tokens cascade through exact foreign keys.
  const { data: fridges, error: fridgeError } = await supabase
    .from('fridges')
    .select('fridge_uid')
    .in('created_by_device_id', devices);
  if (fridgeError) throw fridgeError;
  const fridgeUids = (fridges ?? []).map((fridge) => fridge.fridge_uid);

  if (fridgeUids.length > 0) {
    for (const table of ['notifications', 'shopping_cart_items', 'inventory_events', 'inventory_batches', 'restock_rules', 'food_categories', 'fridge_achievements', 'fridge_invites', 'fridge_members']) {
      const { error } = await supabase.from(table).delete().in('fridge_uid', fridgeUids);
      if (error) throw error;
    }
    const { error: detachError } = await supabase
      .from('fridges')
      .update({ merged_into_fridge_uid: null, status: 'active' })
      .in('fridge_uid', fridgeUids);
    if (detachError) throw detachError;
    const { error: deleteError } = await supabase.from('fridges').delete().in('fridge_uid', fridgeUids);
    if (deleteError) throw deleteError;
  }

  const { error } = await supabase.from('devices').delete().in('device_id', devices);
  if (error) throw error;
}

try {
  await Promise.all([api(0, '/fridges/context'), api(1, '/fridges/context')]);
  await Promise.all([
    api(0, '/profile', { body: JSON.stringify({ displayName: 'Alice Verify' }), method: 'PATCH' }),
    api(1, '/profile', { body: JSON.stringify({ displayName: 'Bob Verify' }), method: 'PATCH' }),
  ]);

  const shared = await api(0, '/fridges/share', {
    body: JSON.stringify({ name: `Notification Family ${runId}` }),
    method: 'POST',
  });
  await api(1, '/fridges/join', {
    body: JSON.stringify({ code: shared.activeInvite.code }),
    method: 'POST',
  });

  const itemName = `Shared Milk ${runId}`;
  const created = await api(1, '/inventory/batches', {
    body: JSON.stringify({
      categoryCode: 'other',
      expiresAt: null,
      initialQuantity: 1,
      name: itemName,
      purchasePrice: null,
      restockRule: null,
      storageZone: 'chilled',
      unit: 'L',
    }),
    method: 'POST',
  });
  assert(created.batchUid, 'Shared inventory creation did not return a batch ID.');

  const ownerAfterStock = await api(0, '/notifications');
  const stockNotice = findShared(ownerAfterStock, 'stocked', created.batchUid);
  assert(stockNotice, 'The other member did not receive the stocked notification.');
  assert(stockNotice.payload.actorName === 'Bob Verify' && stockNotice.payload.name === itemName,
    'The stocked notification did not preserve the actor name and item detail.');
  assert(ownerAfterStock.unreadCount >= 1 && ownerAfterStock.badgeCount >= 1,
    'Unread and badge counts did not include the shared notification.');

  const actorAfterStock = await api(1, '/notifications');
  assert(!findShared(actorAfterStock, 'stocked', created.batchUid), 'The actor received their own shared notification.');

  await api(0, `/notifications/${stockNotice.id}/read`, { body: '{}', method: 'POST' });
  const ownerAfterRead = await api(0, '/notifications');
  assert(ownerAfterRead.items.find((item) => item.id === stockNotice.id)?.isRead === true,
    'Opening a notification did not persist device-scoped read state.');

  const quantityUpdate = await api(1, `/inventory/batches/${created.batchUid}/quantity`, {
    body: JSON.stringify({ expectedVersion: 1, remainingQuantity: 0.5 }),
    method: 'PATCH',
  });
  assert(quantityUpdate.batch.version === 2, 'Quantity update did not advance the optimistic-lock version.');
  const ownerAfterUpdate = await api(0, '/notifications');
  assert(findShared(ownerAfterUpdate, 'updated', created.batchUid), 'The other member did not receive the updated notification.');

  await api(1, `/inventory/batches/${created.batchUid}`, {
    body: JSON.stringify({ expectedVersion: 2 }),
    method: 'DELETE',
  });
  const ownerAfterRemove = await api(0, '/notifications');
  assert(findShared(ownerAfterRemove, 'removed', created.batchUid),
    'The removed notification disappeared with its archived inventory batch.');

  console.log(JSON.stringify({
    status: 'ok',
    verified: ['stocked', 'actor-exclusion', 'detail-payload', 'read-state', 'updated', 'removed', 'badge-count'],
  }));
} finally {
  await cleanup();
}
