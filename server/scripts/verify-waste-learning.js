import { randomBytes, randomUUID } from 'node:crypto';
import { supabase } from '../src/supabase.js';

const deviceId = `sorting_verify_${randomUUID()}`;
const headers = {
  'Content-Type': 'application/json',
  'Device-Credential': randomBytes(32).toString('hex'),
  'Device-ID': deviceId,
};
const baseUrl = `http://127.0.0.1:${process.env.PORT ?? 3001}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, method = 'GET', body) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json().catch(() => null);
  return { status: response.status, body: value };
}

async function createBatch(name, unit, quantity) {
  const created = await request('/api/inventory/batches', 'POST', {
    categoryCode: 'drinks', deadlineType: 'best_before',
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    expiryWarningDays: 3, initialQuantity: quantity, name, presetUid: null,
    priceSource: 'user', purchasePrice: 0, restockRule: null, storageZone: 'chilled', unit,
  });
  assert(created.status === 201, `Create failed (${name}): ${created.status}`);
  return created.body.batchUid;
}

async function useTo(batchUid, remainingQuantity, unit) {
  const detail = await request(`/api/inventory/batches/${batchUid}`);
  assert(detail.status === 200, `Detail failed: ${detail.status}`);
  const updated = await request(`/api/inventory/batches/${batchUid}/quantity`, 'PATCH', {
    remainingQuantity, expectedVersion: detail.body.batch.version, unit,
  });
  assert(updated.status === 200, `Quantity failed: ${updated.status}`);
  return updated.body.wasteOpportunity;
}

// Arthur: NarIyirm
// 中文：在开发库用临时设备验证真实使用流水、判分幂等性和毫升清零边界，结束时只清理该设备的临时数据。
// EN: Verify consume events, idempotent grading, and the volume-empty boundary with a disposable dev device, then remove only its fixture data.
async function run() {
  let fridgeUid = null;
  try {
    const snapshot = await request('/api/inventory');
    assert(snapshot.status === 200, `Bootstrap failed: ${snapshot.status}`);
    fridgeUid = snapshot.body.fridge.uid;

    const eggUid = await createBatch('egg', 'item', 2);
    const eggQuestion = await useTo(eggUid, 1, 'item');
    assert(eggQuestion?.material === 'eggshell', 'Egg use did not offer an eggshell lesson');
    const wrong = await request('/api/waste-learning/attempts', 'POST', { eventUid: eggQuestion.eventUid, selectedStream: 'general' });
    assert(wrong.status === 200 && wrong.body.isCorrect === false, 'Wrong answer was not recorded correctly');
    const retry = await request('/api/waste-learning/attempts', 'POST', { eventUid: eggQuestion.eventUid, selectedStream: 'general' });
    assert(retry.status === 200 && retry.body.attemptUid === wrong.body.attemptUid, 'Retry created a duplicate attempt');

    const unknownUid = await createBatch('juice', 'ml', 500);
    const unknownQuestion = await useTo(unknownUid, 0, 'ml');
    assert(unknownQuestion?.material === 'unknown_bottle' && unknownQuestion.correctStream === null, 'Unknown juice packaging was guessed');
    const unconfirmed = await request('/api/waste-learning/attempts', 'POST', { eventUid: unknownQuestion.eventUid, selectedStream: 'recycling' });
    assert(unconfirmed.status === 404, 'Unknown packaging was graded without confirmation');
    const confirmed = await request('/api/waste-learning/attempts', 'POST', { eventUid: unknownQuestion.eventUid, selectedStream: 'recycling', confirmedMaterial: 'plastic_bottle' });
    assert(confirmed.status === 200 && confirmed.body.isCorrect === true, 'Confirmed plastic bottle was not graded');

    const colaUid = await createBatch('可口可乐', 'item', 1);
    const colaQuestion = await useTo(colaUid, 0, 'item');
    assert(colaQuestion?.material === 'unknown_container', 'Counted cola did not ask for packaging material');
    const colaAnswer = await request('/api/waste-learning/attempts', 'POST', { eventUid: colaQuestion.eventUid, selectedStream: 'recycling', confirmedMaterial: 'aluminium_can' });
    assert(colaAnswer.status === 200 && colaAnswer.body.isCorrect === true, 'Confirmed aluminium can was not graded');

    const bottleUid = await createBatch('plastic bottle juice', 'ml', 500);
    assert(await useTo(bottleUid, 100, 'ml') === null, 'A partly filled bottle offered a packaging lesson');
    const bottleQuestion = await useTo(bottleUid, 0, 'ml');
    assert(bottleQuestion?.material === 'plastic_bottle', 'Empty plastic bottle did not offer a lesson');
    const right = await request('/api/waste-learning/attempts', 'POST', { eventUid: bottleQuestion.eventUid, selectedStream: 'recycling' });
    assert(right.status === 200 && right.body.isCorrect === true, 'Correct answer was not recorded correctly');
    const stats = await request('/api/waste-learning/stats');
    assert(stats.status === 200 && stats.body.answered === 4 && stats.body.correct === 3, 'Achievement learning counts are wrong');
    console.log(JSON.stringify({ verified: true, answered: stats.body.answered, correct: stats.body.correct }));
  } finally {
    if (!fridgeUid) {
      const membership = await supabase.from('fridge_members').select('fridge_uid').eq('device_id', deviceId).maybeSingle();
      fridgeUid = membership.data?.fridge_uid ?? null;
    }
    if (fridgeUid) {
      for (const table of ['waste_sorting_attempts', 'inventory_events', 'inventory_batches', 'fridges']) {
        const { error } = await supabase.from(table).delete().eq('fridge_uid', fridgeUid);
        assert(!error, `Fixture cleanup failed in ${table}: ${error?.message}`);
      }
    }
    const { error: deviceError } = await supabase.from('devices').delete().eq('device_id', deviceId);
    assert(!deviceError, `Fixture device cleanup failed: ${deviceError?.message}`);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
