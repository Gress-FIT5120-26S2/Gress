import { randomBytes, randomUUID } from 'node:crypto';
import { supabase } from '../src/supabase.js';

const apiUrl = process.env.PROFILE_VERIFY_API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const deviceId = `profile_verify_${randomUUID()}`;
const credential = randomBytes(32).toString('hex');
const headers = {
  'Content-Type': 'application/json',
  'Device-Credential': credential,
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
// 中文：端到端验证首次资料、昵称更新、共享摘要和输入拒绝；finally 按精确测试 ID 清理开发库记录。
// EN: Verify first profile read, name update, shared summary, and invalid input end to end, then clean exact development rows in finally.
async function run() {
  let fridgeUid = null;
  try {
    const initial = await request('/api/profile');
    assert(initial.response.ok, `Initial profile failed: ${initial.response.status}`);
    assert(initial.body?.displayName === null, 'A new device should start with a null display name');
    assert(typeof initial.body?.avatarKey === 'string', 'A new device should receive a stable avatar key');

    const updated = await request('/api/profile', {
      body: JSON.stringify({ displayName: 'Profile Verify' }),
      method: 'PATCH',
    });
    assert(updated.response.ok, `Profile update failed: ${updated.response.status}`);
    assert(updated.body?.displayName === 'Profile Verify', 'Updated display name was not returned');

    const context = await request('/api/fridges/context');
    assert(context.response.ok, `Fridge context failed: ${context.response.status}`);
    assert(context.body?.members?.[0]?.displayName === 'Profile Verify', 'Member summary did not expose the saved name');
    assert(!Object.hasOwn(context.body?.members?.[0] ?? {}, 'deviceId'), 'Member summary leaked a device ID');
    fridgeUid = context.body?.fridge?.uid ?? null;

    const invalid = await request('/api/profile', {
      body: JSON.stringify({ displayName: '   ' }),
      method: 'PATCH',
    });
    assert(invalid.response.status === 400, 'Blank display names should be rejected with 400');
    assert(invalid.body?.error === 'invalid_display_name', 'Blank display names should use the stable error code');

    console.log(JSON.stringify({ avatarKey: initial.body.avatarKey, displayName: updated.body.displayName, verified: true }));
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
