import { randomBytes, randomUUID } from 'node:crypto';
import { supabase } from '../src/supabase.js';

const apiUrl = `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const deviceId = `expiry_warning_verify_${randomUUID()}`;
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

// Arthur: NarIyirm
// 中文：用临时设备端到端验证临期天数的创建、详情读取和 5→3 编辑持久化，结束后只清理该测试设备的冰箱。
// EN: Use a temporary device to verify expiry lead-time creation, detail reads, and 5-to-3 edit persistence, then clean only its test fridge.
async function run() {
  let fridgeUid = null;
  try {
    const snapshot = await request('/api/inventory');
    assert(snapshot.response.ok, `Inventory bootstrap failed: ${snapshot.response.status}`);

    const expiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const created = await request('/api/inventory/batches', {
      body: JSON.stringify({
        categoryCode: 'vegetables',
        expiresAt: expiry,
        expiryWarningDays: 5,
        initialQuantity: 2,
        name: 'Expiry warning verification item',
        presetUid: null,
        purchasePrice: null,
        restockRule: null,
        storageZone: 'chilled',
        unit: 'item',
      }),
      method: 'POST',
    });
    assert(created.response.status === 201, `Inventory create failed: ${created.response.status}`);
    const batchUid = created.body?.batchUid;
    assert(typeof batchUid === 'string', 'Create response did not include a batch ID');

    const firstDetail = await request(`/api/inventory/batches/${batchUid}`);
    assert(firstDetail.response.ok, `Initial detail failed: ${firstDetail.response.status}`);
    assert(firstDetail.body?.batch?.expiryWarningDays === 5, 'Created expiry warning days were not persisted');

    const updated = await request(`/api/inventory/batches/${batchUid}`, {
      body: JSON.stringify({
        categoryCode: firstDetail.body.batch.categoryCode,
        expectedVersion: firstDetail.body.batch.version,
        expiresAt: expiry,
        expiryWarningDays: 3,
        name: firstDetail.body.batch.name,
        purchasePrice: firstDetail.body.batch.purchasePrice,
        remainingQuantity: firstDetail.body.batch.remainingQuantity,
        storageZone: firstDetail.body.batch.storageZone,
        unit: firstDetail.body.batch.unit,
      }),
      method: 'PATCH',
    });
    assert(updated.response.ok, `Inventory update failed: ${updated.response.status}`);
    assert(updated.body?.batch?.expiryWarningDays === 3, 'Updated expiry warning days were not returned');

    const reopened = await request(`/api/inventory/batches/${batchUid}`);
    assert(reopened.body?.batch?.expiryWarningDays === 3, 'Reopened detail did not retain 3 expiry warning days');
    console.log(JSON.stringify({ from: 5, to: reopened.body.batch.expiryWarningDays, verified: true }));
  } finally {
    const membership = await supabase.from('fridge_members').select('fridge_uid').eq('device_id', deviceId).maybeSingle();
    fridgeUid = membership.data?.fridge_uid ?? null;
    if (fridgeUid) await supabase.from('fridges').delete().eq('fridge_uid', fridgeUid);
    await supabase.from('devices').delete().eq('device_id', deviceId);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
