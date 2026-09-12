import { randomBytes, randomUUID } from 'node:crypto';
import { supabase } from '../src/supabase.js';

const apiUrl = `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const deviceId = `outcome_verify_${randomUUID()}`;
const headers = {
  'Content-Type': 'application/json',
  'Device-Credential': randomBytes(32).toString('hex'),
  'Device-ID': deviceId,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}) {
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const body = await response.json().catch(() => null);
  return { body, response };
}

function batchPayload(overrides = {}) {
  return {
    categoryCode: 'vegetables',
    deadlineType: 'best_before',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    expiryWarningDays: 3,
    initialQuantity: 2,
    name: `Outcome verification ${randomUUID()}`,
    presetUid: null,
    priceSource: 'user',
    purchasePrice: 12,
    restockRule: null,
    storageZone: 'chilled',
    unit: 'item',
    ...overrides,
  };
}

// Arthur: NarIyirm
// 中文：端到端锁定三条核心规则：新库存价格必填、临期移出记 consume、use-by 过期拒绝 consume 并允许 discard。
// EN: End-to-end verification locks the three core rules: required new prices, near-expiry consume, and post-use-by consume rejection with discard allowed.
async function run() {
  let fridgeUid = null;
  try {
    const snapshot = await request('/api/inventory');
    assert(snapshot.response.ok, `Inventory bootstrap failed: ${snapshot.response.status}`);
    fridgeUid = snapshot.body?.fridge?.uid ?? null;

    const missingPrice = await request('/api/inventory/batches', {
      body: JSON.stringify({ ...batchPayload(), purchasePrice: null }),
      method: 'POST',
    });
    assert(missingPrice.response.status === 400, 'A missing purchase price was accepted');

    const nearCreated = await request('/api/inventory/batches', {
      body: JSON.stringify(batchPayload()),
      method: 'POST',
    });
    assert(nearCreated.response.status === 201, `Near-expiry create failed: ${nearCreated.response.status}`);
    const nearDetail = await request(`/api/inventory/batches/${nearCreated.body.batchUid}`);
    const nearResolved = await request(`/api/inventory/batches/${nearCreated.body.batchUid}/resolve`, {
      body: JSON.stringify({ expectedVersion: nearDetail.body.batch.version, outcome: 'consume', reasonCode: 'used' }),
      method: 'POST',
    });
    assert(nearResolved.body?.batch?.lifecycleState === 'consumed', 'Near-expiry resolution was not consumed');

    const nearEvent = await supabase.from('inventory_events')
      .select('event_type, reason_code, was_in_warning_window, purchase_price_snapshot')
      .eq('batch_uid', nearCreated.body.batchUid)
      .eq('event_type', 'consume')
      .single();
    assert(!nearEvent.error && nearEvent.data.was_in_warning_window === true, 'Near-expiry event snapshot is incomplete');
    assert(Number(nearEvent.data.purchase_price_snapshot) === 12, 'Purchase price snapshot was not recorded');

    const hardCreated = await request('/api/inventory/batches', {
      body: JSON.stringify(batchPayload({ deadlineType: 'use_by' })),
      method: 'POST',
    });
    assert(hardCreated.response.status === 201, `Use-by create failed: ${hardCreated.response.status}`);
    const stockedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const expiredUpdate = await supabase.from('inventory_batches').update({ expires_at: expiredAt, stocked_at: stockedAt, use_by_at: expiredAt }).eq('batch_uid', hardCreated.body.batchUid);
    assert(!expiredUpdate.error, `Could not prepare expired use-by fixture: ${expiredUpdate.error?.message}`);

    const hardDetail = await request(`/api/inventory/batches/${hardCreated.body.batchUid}`);
    const invalidConsume = await request(`/api/inventory/batches/${hardCreated.body.batchUid}/resolve`, {
      body: JSON.stringify({ expectedVersion: hardDetail.body.batch.version, outcome: 'consume', reasonCode: 'used' }),
      method: 'POST',
    });
    assert(invalidConsume.response.status === 409 && invalidConsume.body?.error === 'inventory_use_by_expired', 'Expired use-by stock was allowed as consumed');

    const expiredDiscard = await request(`/api/inventory/batches/${hardCreated.body.batchUid}/resolve`, {
      body: JSON.stringify({ expectedVersion: hardDetail.body.batch.version, outcome: 'discard', reasonCode: 'confirmed_use_by_expiry' }),
      method: 'POST',
    });
    assert(expiredDiscard.body?.batch?.lifecycleState === 'discarded', 'Expired use-by stock was not discarded');
    console.log(JSON.stringify({ expiredUseByBlocked: true, nearExpiryConsumed: true, priceRequired: true, verified: true }));
  } finally {
    if (!fridgeUid) {
      const membership = await supabase.from('fridge_members').select('fridge_uid').eq('device_id', deviceId).maybeSingle();
      fridgeUid = membership.data?.fridge_uid ?? null;
    }
    if (fridgeUid) await supabase.from('fridges').delete().eq('fridge_uid', fridgeUid);
    await supabase.from('devices').delete().eq('device_id', deviceId);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
