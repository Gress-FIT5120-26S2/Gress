import express from 'express';
import { supabase } from '../supabase.js';
import { requireFridge } from '../middleware/requireFridge.js';

const router = express.Router();

function asPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function daysLeftFrom(expiresAt) {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(remaining)) return null;
  return Math.max(0, Math.ceil(remaining / 86_400_000));
}

router.get('/notifications', requireFridge, async (req, res) => {
    // Refresh notifications from live stock, then assemble the inbox with this device's read state.
  const { error: syncError } = await supabase.rpc('sync_fridge_notifications', {
    p_fridge: req.fridgeUid,
  });
  if (syncError) return res.status(500).json({ error: syncError.message });

  const [notificationsResult, readsResult, batchesResult] = await Promise.all([
    supabase
      .from('notifications')
      .select('notification_uid, related_batch_uid, notification_type, message_key, message_payload, created_at')
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
  ]);

  const failed = [notificationsResult, readsResult, batchesResult].find((result) => result.error);
  if (failed?.error) return res.status(500).json({ error: failed.error.message });

  const readIds = new Set((readsResult.data ?? []).map((row) => row.notification_uid));
  const batchByUid = new Map((batchesResult.data ?? []).map((row) => [row.batch_uid, row]));

  const items = (notificationsResult.data ?? [])
    .filter((row) => {
      if (!row.related_batch_uid) return true;
      return batchByUid.get(row.related_batch_uid)?.lifecycle_state === 'active';
    })
    .map((row) => {
      const batch = row.related_batch_uid ? batchByUid.get(row.related_batch_uid) : null;
      return {
        id: row.notification_uid,
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

  res.json({
    unreadCount: items.filter((item) => !item.isRead).length,
    items,
  });
});

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