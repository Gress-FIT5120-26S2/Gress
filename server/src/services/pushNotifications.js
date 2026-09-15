import { supabase } from '../supabase.js';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

function asPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function timeValue(value, fallback) {
  return typeof value === 'string' && value.length >= 5 ? value.slice(0, 5) : fallback;
}

function isQuietNow(profile) {
  if (!profile.quiet_hours_enabled) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      timeZone: profile.notification_time_zone || 'UTC',
    }).formatToParts(new Date());
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
    const current = `${hour}:${minute}`;
    const start = timeValue(profile.quiet_hours_start, '22:00');
    const end = timeValue(profile.quiet_hours_end, '08:00');
    return start < end ? current >= start && current < end : current >= start || current < end;
  } catch {
    return false;
  }
}

function sharedCopy(locale, payload) {
  const actor = typeof payload.actorName === 'string' && payload.actorName.trim()
    ? payload.actorName.trim()
    : locale === 'zh' ? '一位共享成员' : 'A shared member';
  const item = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim()
    : locale === 'zh' ? '一项库存' : 'an inventory item';
  const action = payload.action;

  if (locale === 'zh') {
    const verb = action === 'stocked' ? '加入了' : action === 'removed' ? '移除了' : '更新了';
    return { title: '共享冰箱有新动态', body: `${actor}${verb}${item}。` };
  }
  const verb = action === 'stocked' ? 'added' : action === 'removed' ? 'removed' : 'updated';
  return { title: 'Shared fridge update', body: `${actor} ${verb} ${item}.` };
}

async function writeDelivery(notificationUid, deviceId, ticket) {
  const success = ticket?.status === 'ok';
  await supabase.from('notification_deliveries').upsert({
    notification_uid: notificationUid,
    device_id: deviceId,
    delivery_status: success ? 'sent' : 'failed',
    expo_ticket_id: success ? ticket.id ?? null : null,
    error_code: success ? null : ticket?.details?.error ?? 'expo_push_failed',
    attempted_at: new Date().toISOString(),
  });
}

// Arthur: NarIyirm
// 中文：库存 RPC 创建共享事件后同步投递给其他已授权设备；失败只记录投递状态，不回滚已经成功的库存修改。
// EN: After the inventory RPC creates a shared event, deliver it to other authorized devices; failures are audited without rolling back the successful inventory mutation.
export async function deliverSharedNotification(notificationUid, actorDeviceId) {
  if (!notificationUid) return;

  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .select('notification_uid, fridge_uid, message_payload, notification_type')
    .eq('notification_uid', notificationUid)
    .eq('notification_type', 'shared')
    .maybeSingle();
  if (notificationError || !notification) return;

  const { data: members, error: membersError } = await supabase
    .from('fridge_members')
    .select('device_id')
    .eq('fridge_uid', notification.fridge_uid)
    .neq('device_id', actorDeviceId);
  if (membersError || !members?.length) return;

  const deviceIds = members.map((member) => member.device_id);
  const [profilesResult, tokensResult, deliveriesResult] = await Promise.all([
    supabase
      .from('device_profiles')
      .select('device_id, notifications_enabled, shared_notifications_enabled, system_delivery_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, notification_time_zone')
      .in('device_id', deviceIds),
    supabase
      .from('device_push_tokens')
      .select('device_id, expo_push_token, locale')
      .in('device_id', deviceIds)
      .eq('is_active', true),
    supabase
      .from('notification_deliveries')
      .select('device_id')
      .eq('notification_uid', notification.notification_uid)
      .in('device_id', deviceIds),
  ]);
  if (profilesResult.error || tokensResult.error || deliveriesResult.error) return;

  const profileByDevice = new Map((profilesResult.data ?? []).map((profile) => [profile.device_id, profile]));
  const tokenByDevice = new Map((tokensResult.data ?? []).map((token) => [token.device_id, token]));
  const attemptedDevices = new Set((deliveriesResult.data ?? []).map((delivery) => delivery.device_id));
  const payload = asPayload(notification.message_payload);
  const recipients = [];

  for (const deviceId of deviceIds) {
    const profile = profileByDevice.get(deviceId);
    const token = tokenByDevice.get(deviceId);
    if (!profile || !token || attemptedDevices.has(deviceId)) continue;
    if (!profile.notifications_enabled || !profile.shared_notifications_enabled || !profile.system_delivery_enabled) continue;

    if (isQuietNow(profile)) {
      await supabase.from('notification_deliveries').upsert({
        notification_uid: notification.notification_uid,
        device_id: deviceId,
        delivery_status: 'suppressed',
        error_code: 'quiet_hours',
        attempted_at: new Date().toISOString(),
      });
      continue;
    }

    const copy = sharedCopy(token.locale, payload);
    recipients.push({
      deviceId,
      message: {
        to: token.expo_push_token,
        sound: 'default',
        title: copy.title,
        body: copy.body,
        channelId: 'kitchmemo-reminders',
        data: { notificationId: notification.notification_uid, screen: 'notifications' },
      },
    });
  }

  if (recipients.length === 0) return;

  try {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(recipients.map((recipient) => recipient.message)),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json().catch(() => null);
    const tickets = Array.isArray(result?.data) ? result.data : [result?.data];
    await Promise.all(recipients.map((recipient, index) =>
      writeDelivery(notification.notification_uid, recipient.deviceId, tickets[index])));
  } catch {
    await Promise.all(recipients.map((recipient) =>
      writeDelivery(notification.notification_uid, recipient.deviceId, { status: 'error', details: { error: 'network_error' } })));
  }
}
