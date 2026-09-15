import express from 'express';
import { requireFridge } from '../middleware/requireFridge.js';
import { supabase } from '../supabase.js';

const router = express.Router();

// Arthur: NarIyirm
// 中文：同步会话只允许返回 publishable/anon key；此守卫防止误把 secret 或 service-role key 下发到 App。
// EN: Sync sessions may return only publishable or anon keys; this guard prevents accidentally exposing a secret or service-role key to the app.
function isSafePublishableKey(key) {
  if (!key) return false;
  if (key.startsWith('sb_publishable_')) return true;
  if (!key.startsWith('eyJ')) return false;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return payload.role === 'anon';
  } catch {
    return false;
  }
}

function realtimeEndpoint() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/u, '');
  return url ? `${url}/realtime/v1` : null;
}

// Arthur: NarIyirm
// 中文：RealtimeSyncProvider 的轻量探针进入此路由；只返回领域版本和可选频道能力值，不返回业务记录。
// EN: RealtimeSyncProvider's lightweight probe enters here and returns only domain versions plus an optional channel capability, never business records.
router.get('/sync/state', requireFridge, async (request, response) => {
  const [fridgeResult, versionsResult] = await Promise.all([
    supabase.from('fridges').select('mode').eq('fridge_uid', request.fridgeUid).single(),
    supabase
      .from('fridge_sync_versions')
      .select('inventory_version, cart_version, fridge_version, notifications_version, broadcast_topic')
      .eq('fridge_uid', request.fridgeUid)
      .single(),
  ]);
  const failed = [fridgeResult, versionsResult].find((result) => result.error);
  if (failed?.error) return response.status(503).json({ error: 'sync_state_unavailable' });

  // Arthur: NarIyirm
  // 中文：版本使用字符串返回，避免 JavaScript 数字精度影响长期递增值；响应不含任何库存或成员敏感内容。
  // EN: Versions return as strings to avoid JavaScript precision loss over time; the probe contains no inventory or sensitive member data.
  response.set('Cache-Control', 'private, no-store');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const endpoint = realtimeEndpoint();
  // Arthur: NarIyirm
  // 中文：只向已通过设备凭证验证的共享成员下发公开连接 key 和高熵频道能力值；secret/service-role key 永不进入响应。
  // EN: Only authenticated shared members receive the public connection key and high-entropy topic capability; secret/service-role keys never enter the response.
  const broadcast = fridgeResult.data.mode === 'shared' && endpoint && isSafePublishableKey(publishableKey)
    ? {
        endpoint,
        publishableKey,
        topic: `kitchmemo:fridge:${versionsResult.data.broadcast_topic}`,
      }
    : null;
  return response.json({
    broadcast,
    fridgeUid: request.fridgeUid,
    mode: fridgeResult.data.mode,
    versions: {
      cart: String(versionsResult.data.cart_version),
      fridge: String(versionsResult.data.fridge_version),
      inventory: String(versionsResult.data.inventory_version),
      notifications: String(versionsResult.data.notifications_version),
    },
  });
});

export default router;
