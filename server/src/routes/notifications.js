import express from 'express';
import { supabase } from '../supabase.js';
import { requireFridge } from '../middleware/requireFridge.js';

const router = express.Router();
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const EXPO_PUSH_TOKEN_PATTERN = /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/u;

const DEFAULT_PREFERENCES = {
  notificationsEnabled: true,
  badgesEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  expiringEnabled: true,
  restockEnabled: true,
  sharedEnabled: true,
  systemEnabled: true,
  systemDeliveryEnabled: false,
  timeZone: 'UTC',
};

function asTime(value, fallback) {
  return typeof value === 'string' && value.length >= 5 ? value.slice(0, 5) : fallback;
}

function serializePreferences(row) {
  return {
    notificationsEnabled: row?.notifications_enabled ?? DEFAULT_PREFERENCES.notificationsEnabled,
    badgesEnabled: row?.notification_badges_enabled ?? DEFAULT_PREFERENCES.badgesEnabled,
    quietHoursEnabled: row?.quiet_hours_enabled ?? DEFAULT_PREFERENCES.quietHoursEnabled,
    quietHoursStart: asTime(row?.quiet_hours_start, DEFAULT_PREFERENCES.quietHoursStart),
    quietHoursEnd: asTime(row?.quiet_hours_end, DEFAULT_PREFERENCES.quietHoursEnd),
    expiringEnabled: row?.expiring_notifications_enabled ?? DEFAULT_PREFERENCES.expiringEnabled,
    restockEnabled: row?.restock_notifications_enabled ?? DEFAULT_PREFERENCES.restockEnabled,
    sharedEnabled: row?.shared_notifications_enabled ?? DEFAULT_PREFERENCES.sharedEnabled,
    systemEnabled: row?.system_notifications_enabled ?? DEFAULT_PREFERENCES.systemEnabled,
    systemDeliveryEnabled: row?.system_delivery_enabled ?? DEFAULT_PREFERENCES.systemDeliveryEnabled,
    timeZone: row?.notification_time_zone ?? DEFAULT_PREFERENCES.timeZone,
    updatedAt: row?.updated_at ?? null,
  };
}

function isQuietNow(preferences) {
  if (!preferences.quietHoursEnabled) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      timeZone: preferences.timeZone,
    }).formatToParts(new Date());
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
    const current = `${hour}:${minute}`;
    const { quietHoursEnd: end, quietHoursStart: start } = preferences;
    return start < end ? current >= start && current < end : current >= start || current < end;
  } catch {
    return false;
  }
}

function preferenceAllowsType(type, preferences) {
  if (!preferences.notificationsEnabled) return false;
  if (type === 'expiring' || type === 'expired') return preferences.expiringEnabled;
  if (type === 'restock') return preferences.restockEnabled;
  if (type === 'system') return preferences.systemEnabled;
  if (type === 'shared') return preferences.sharedEnabled;
  return true;
}

function asPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function daysLeftFrom(expiresAt) {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(remaining)) return null;
  return Math.max(0, Math.ceil(remaining / 86_400_000));
}

// Arthur: NarIyirm
// 中文：NotificationInbox 和首页角标共用此读取；先从实时库存同步派生通知，再合并当前设备 notification_reads。
// EN: NotificationInbox and the home badge share this read; it first derives notifications from live stock, then merges current-device notification_reads.
router.get('/notifications', requireFridge, async (req, res) => {
  const { error: syncError } = await supabase.rpc('sync_fridge_notifications', {
    p_fridge: req.fridgeUid,
  });
  if (syncError) return res.status(500).json({ error: syncError.message });

  const [notificationsResult, readsResult, batchesResult, preferencesResult] = await Promise.all([
    supabase
      .from('notifications')
      .select('notification_uid, related_batch_uid, actor_device_id, notification_type, message_key, message_payload, created_at')
      .eq('fridge_uid', req.fridgeUid)
      .order('created_at', { ascending: false }),
    supabase
      .from('notification_reads')
      .select('notification_uid')
      .eq('device_id', req.deviceId),
    supabase
      .from('inventory_batches')
      .select('batch_uid, expires_at, lifecycle_state')
      .eq('fridge_uid', req.fridgeUid),
    supabase
      .from('device_profiles')
      .select('notifications_enabled, notification_badges_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, expiring_notifications_enabled, restock_notifications_enabled, shared_notifications_enabled, system_notifications_enabled, system_delivery_enabled, notification_time_zone, updated_at')
      .eq('device_id', req.deviceId)
      .maybeSingle(),
  ]);

  const failed = [notificationsResult, readsResult, batchesResult, preferencesResult].find((result) => result.error);
  if (failed?.error) return res.status(500).json({ error: failed.error.message });

  const preferences = serializePreferences(preferencesResult.data);
  const readIds = new Set((readsResult.data ?? []).map((row) => row.notification_uid));
  const batchByUid = new Map((batchesResult.data ?? []).map((row) => [row.batch_uid, row]));

  const items = (notificationsResult.data ?? [])
    .filter((row) => {
      if (row.actor_device_id === req.deviceId) return false;
      if (!preferenceAllowsType(row.notification_type, preferences)) return false;
      if (row.notification_type === 'shared') return true;
      if (!row.related_batch_uid) return true;
      return batchByUid.get(row.related_batch_uid)?.lifecycle_state === 'active';
    })
    .map((row) => {
      const batch = row.related_batch_uid ? batchByUid.get(row.related_batch_uid) : null;
      return {
        id: row.notification_uid,
        relatedBatchUid: row.related_batch_uid,
        type: row.notification_type,
        messageKey: row.message_key,
        payload: {
          ...asPayload(row.message_payload),
          daysLeft: daysLeftFrom(batch?.expires_at),
        },
        createdAt: row.created_at,
        isRead: readIds.has(row.notification_uid),
      };
    });

  const unreadCount = items.filter((item) => !item.isRead).length;
  res.json({
    unreadCount,
    badgeCount: preferences.badgesEnabled && !isQuietNow(preferences) ? unreadCount : 0,
    items,
  });
});

// Arthur: NarIyirm
// 中文：通知偏好属于当前已鉴权设备；共享成员各自读取自己的开关和免打扰时段。
// EN: Notification preferences belong to the authenticated device, so each shared member reads independent switches and quiet hours.
router.get('/notification-preferences', requireFridge, async (req, res) => {
  const { data, error } = await supabase
    .from('device_profiles')
    .select('notifications_enabled, notification_badges_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, expiring_notifications_enabled, restock_notifications_enabled, shared_notifications_enabled, system_notifications_enabled, system_delivery_enabled, notification_time_zone, updated_at')
    .eq('device_id', req.deviceId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(serializePreferences(data));
});

// Arthur: NarIyirm
// 中文：只接受白名单中的局部偏好更新，时间与时区先在服务端验证，再写入当前设备资料。
// EN: Accept only whitelisted partial preference updates, validating times and time zone before updating the current device profile.
router.patch('/notification-preferences', requireFridge, async (req, res) => {
  const fields = {
    notificationsEnabled: 'notifications_enabled',
    badgesEnabled: 'notification_badges_enabled',
    quietHoursEnabled: 'quiet_hours_enabled',
    quietHoursStart: 'quiet_hours_start',
    quietHoursEnd: 'quiet_hours_end',
    expiringEnabled: 'expiring_notifications_enabled',
    restockEnabled: 'restock_notifications_enabled',
    sharedEnabled: 'shared_notifications_enabled',
    systemEnabled: 'system_notifications_enabled',
    systemDeliveryEnabled: 'system_delivery_enabled',
    timeZone: 'notification_time_zone',
  };
  const update = {};

  for (const [clientKey, column] of Object.entries(fields)) {
    if (!Object.hasOwn(req.body ?? {}, clientKey)) continue;
    const value = req.body[clientKey];
    if (clientKey === 'quietHoursStart' || clientKey === 'quietHoursEnd') {
      if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
        return res.status(400).json({ error: 'invalid_notification_preferences' });
      }
    } else if (clientKey === 'timeZone') {
      if (typeof value !== 'string' || value.length > 100 || value.trim() !== value) {
        return res.status(400).json({ error: 'invalid_notification_preferences' });
      }
      try {
        new Intl.DateTimeFormat('en', { timeZone: value }).format();
      } catch {
        return res.status(400).json({ error: 'invalid_notification_preferences' });
      }
    } else if (typeof value !== 'boolean') {
      return res.status(400).json({ error: 'invalid_notification_preferences' });
    }
    update[column] = value;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'invalid_notification_preferences' });
  }

  const { data, error } = await supabase
    .from('device_profiles')
    .update(update)
    .eq('device_id', req.deviceId)
    .select('notifications_enabled, notification_badges_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, expiring_notifications_enabled, restock_notifications_enabled, shared_notifications_enabled, system_notifications_enabled, system_delivery_enabled, notification_time_zone, updated_at')
    .single();

  if (error?.code === '23514') return res.status(400).json({ error: 'invalid_notification_preferences' });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(serializePreferences(data));
});

// Arthur: NarIyirm
// 中文：系统权限授权后只把当前设备的 Expo Push Token 交给 Express；其他成员和 App API 永远读不到该令牌。
// EN: After system permission is granted, only the current device sends its Expo Push Token to Express; members and app APIs never receive it.
router.post('/notification-delivery/register', requireFridge, async (req, res) => {
  const token = typeof req.body?.expoPushToken === 'string' ? req.body.expoPushToken.trim() : '';
  const platform = req.body?.platform;
  const locale = req.body?.locale;
  if (!EXPO_PUSH_TOKEN_PATTERN.test(token)
      || !['ios', 'android'].includes(platform)
      || !['zh', 'en'].includes(locale)) {
    return res.status(400).json({ error: 'invalid_push_token' });
  }

  const { error } = await supabase.rpc('register_device_push_token', {
    p_device_id: req.deviceId,
    p_expo_push_token: token,
    p_locale: locale,
    p_platform: platform,
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).end();
});

// Arthur: NarIyirm
// 中文：标记已读前先确认通知属于当前 fridgeUid，再 upsert 当前 deviceId 的阅读记录。
// EN: Before marking read, this verifies the notification belongs to the current fridgeUid and upserts the current deviceId's read record.
router.post('/notifications/:id/read', requireFridge, async (req, res) => {
  const { data: notification, error: lookupError } = await supabase
    .from('notifications')
    .select('notification_uid')
    .eq('notification_uid', req.params.id)
    .eq('fridge_uid', req.fridgeUid)
    .maybeSingle();

  if (lookupError) return res.status(500).json({ error: lookupError.message });
  if (!notification) return res.status(404).json({ error: 'not_found' });

  const { error } = await supabase.from('notification_reads').upsert({
    notification_uid: notification.notification_uid,
    device_id: req.deviceId,
    read_at: new Date().toISOString(),
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

export default router;
