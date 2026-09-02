import { randomBytes, randomUUID } from 'node:crypto';
import { supabase } from '../src/supabase.js';

const apiUrl = process.env.NOTIFICATION_PREFERENCES_VERIFY_API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const deviceId = `notification_preferences_verify_${randomUUID()}`;
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
// 中文：端到端验证设备偏好默认值、局部保存、角标抑制和非法时间拒绝，并按精确测试 ID 清理开发库。
// EN: Verify device preference defaults, partial saves, badge suppression, and invalid-time rejection end to end, then clean exact development rows.
async function run() {
  let fridgeUid = null;
  try {
    const initial = await request('/api/notification-preferences');
    assert(initial.response.ok, `Initial preferences failed: ${initial.response.status}`);
    assert(initial.body?.notificationsEnabled === true, 'Reminders should be enabled by default');
    assert(initial.body?.sharedEnabled === true, 'Shared activity should be enabled by default');

    const updated = await request('/api/notification-preferences', {
      body: JSON.stringify({
        badgesEnabled: false,
        quietHoursEnabled: true,
        quietHoursStart: '21:30',
        quietHoursEnd: '07:15',
        sharedEnabled: false,
        timeZone: 'Australia/Sydney',
      }),
      method: 'PATCH',
    });
    assert(updated.response.ok, `Preference update failed: ${updated.response.status}`);
    assert(updated.body?.badgesEnabled === false, 'Badge preference was not saved');
    assert(updated.body?.sharedEnabled === false, 'Shared preference was not saved');
    assert(updated.body?.quietHoursStart === '21:30', 'Quiet-hours start was not normalized');

    const inbox = await request('/api/notifications');
    assert(inbox.response.ok, `Notification inbox failed: ${inbox.response.status}`);
    assert(inbox.body?.badgeCount === 0, 'Disabled badges should always return a zero badge count');
    fridgeUid = (await supabase.from('fridge_members').select('fridge_uid').eq('device_id', deviceId).maybeSingle()).data?.fridge_uid ?? null;

    const invalid = await request('/api/notification-preferences', {
      body: JSON.stringify({ quietHoursStart: '25:90' }),
      method: 'PATCH',
    });
    assert(invalid.response.status === 400, 'Invalid times should be rejected with 400');
    assert(invalid.body?.error === 'invalid_notification_preferences', 'Invalid times should use the stable error code');

    console.log(JSON.stringify({ badgeCount: inbox.body.badgeCount, sharedEnabled: updated.body.sharedEnabled, verified: true }));
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
