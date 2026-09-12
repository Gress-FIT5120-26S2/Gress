import { randomBytes, randomUUID } from 'node:crypto';
import { supabase } from '../src/supabase.js';

const apiUrl = `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const deviceId = `achievement_verify_${randomUUID()}`;
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

function batchPayload({ expiresInDays = 1 } = {}) {
  return {
    categoryCode: 'vegetables',
    deadlineType: 'best_before',
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
    expiryWarningDays: 3,
    initialQuantity: 1,
    name: `Achievement verification ${randomUUID()}`,
    presetUid: null,
    priceSource: 'user',
    purchasePrice: 12,
    restockRule: null,
    storageZone: 'chilled',
    unit: 'item',
  };
}

async function createAndResolve(outcome, expiresInDays = 1) {
  const created = await request('/api/inventory/batches', {
    body: JSON.stringify(batchPayload({ expiresInDays })),
    method: 'POST',
  });
  assert(created.response.status === 201, `Batch create failed: ${created.response.status}`);

  const detail = await request(`/api/inventory/batches/${created.body.batchUid}`);
  assert(detail.response.ok, `Batch detail failed: ${detail.response.status}`);
  const resolved = await request(`/api/inventory/batches/${created.body.batchUid}/resolve`, {
    body: JSON.stringify({
      expectedVersion: detail.body.batch.version,
      outcome,
      reasonCode: outcome === 'consume' ? 'used' : 'spoiled',
    }),
    method: 'POST',
  });
  assert(resolved.response.ok, `Batch resolution failed: ${resolved.response.status}`);
  return created.body.batchUid;
}

// Arthur: NarIyirm
// 中文：端到端锁定 XP 幂等、等级阈值、临期挽救金额、丢弃零基础 XP 与成就奖励，避免页面与账本口径漂移。
// EN: End-to-end verification locks XP idempotence, level thresholds, rescue value, zero base XP for discards, and achievement rewards so the UI and ledger cannot drift.
async function run() {
  let fridgeUid = null;
  try {
    const inventory = await request('/api/inventory');
    assert(inventory.response.ok, `Inventory bootstrap failed: ${inventory.response.status}`);
    fridgeUid = inventory.body?.fridge?.uid ?? null;

    const initial = await request('/api/achievements');
    assert(initial.response.ok, `Achievement bootstrap failed: ${initial.response.status}`);
    assert(initial.body?.level?.totalXp === 0, 'A new fridge did not start at 0 XP');
    assert(initial.body?.level?.code === 'rocky_seedling', 'A new fridge did not start at level 1');
    assert(initial.body?.levelCatalog?.length === 5, 'The achievement level preview catalog is incomplete');
    assert(initial.body.levelCatalog[4]?.minimumXp === 1600, 'The level preview catalog does not use the database threshold');

    const firstCreated = await request('/api/inventory/batches', {
      body: JSON.stringify(batchPayload()),
      method: 'POST',
    });
    assert(firstCreated.response.status === 201, `First batch create failed: ${firstCreated.response.status}`);
    const afterFirstItem = await request('/api/achievements');
    assert(afterFirstItem.body?.level?.totalXp === 30, 'First inventory and first-item rewards did not total 30 XP');
    assert(afterFirstItem.body?.achievements?.find((item) => item.code === 'first_item')?.unlocked === true, 'First-item achievement was not unlocked');

    const firstDetail = await request(`/api/inventory/batches/${firstCreated.body.batchUid}`);
    const firstConsumed = await request(`/api/inventory/batches/${firstCreated.body.batchUid}/resolve`, {
      body: JSON.stringify({ expectedVersion: firstDetail.body.batch.version, outcome: 'consume', reasonCode: 'used' }),
      method: 'POST',
    });
    assert(firstConsumed.response.ok, `First rescue failed: ${firstConsumed.response.status}`);

    const afterFirstRescue = await request('/api/achievements');
    assert(afterFirstRescue.body?.level?.totalXp === 70, 'First rescue did not add 8 + 12 + 20 XP');
    assert(afterFirstRescue.body?.metrics?.rescuedBatchCount === 1, 'First rescue was not counted');
    assert(Number(afterFirstRescue.body?.metrics?.rescuedValue) === 12, 'First rescue value was not A$12');

    await createAndResolve('consume');
    await createAndResolve('consume');
    const afterThreeRescues = await request('/api/achievements');
    assert(afterThreeRescues.body?.level?.totalXp === 110, 'Three rescues did not total 110 XP');
    assert(afterThreeRescues.body?.level?.code === 'polar_guardian', '100 XP did not unlock level 2');

    await createAndResolve('discard', 10);
    const afterDiscard = await request('/api/achievements');
    assert(afterDiscard.body?.level?.totalXp === 130, 'Discard should add only the one-time 20 XP waste-watcher reward');
    assert(afterDiscard.body?.metrics?.discardedBatchCount === 1, 'Discarded batch was not counted');
    assert(Number(afterDiscard.body?.metrics?.discardedValue) === 12, 'Discarded value was not A$12');
    assert(afterDiscard.body?.achievements?.find((item) => item.code === 'waste_watcher')?.unlocked === true, 'Waste-watcher achievement was not unlocked');

    const repeated = await request('/api/achievements');
    assert(repeated.body?.level?.totalXp === 130, 'Repeated dashboard reads duplicated XP');
    console.log(JSON.stringify({ discardBaseXp: 0, idempotent: true, levelThreshold: true, rescuedValue: true, verified: true }));
  } finally {
    if (!fridgeUid) {
      const membership = await supabase.from('fridge_members').select('fridge_uid').eq('device_id', deviceId).maybeSingle();
      fridgeUid = membership.data?.fridge_uid ?? null;
    }
    if (fridgeUid) {
      await supabase.from('fridge_xp_events').delete().eq('fridge_uid', fridgeUid);
      await supabase.from('fridge_achievements').delete().eq('fridge_uid', fridgeUid);
      await supabase.from('notifications').delete().eq('fridge_uid', fridgeUid);
      await supabase.from('inventory_events').delete().eq('fridge_uid', fridgeUid);
      await supabase.from('inventory_batches').delete().eq('fridge_uid', fridgeUid);
      await supabase.from('fridges').delete().eq('fridge_uid', fridgeUid);
    }
    await supabase.from('devices').delete().eq('device_id', deviceId);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
