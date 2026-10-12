import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { cleanupErasureAssets } from '../services/erasureAssets.js';

export function createErasureCleanupRouter(database) {
  const router = express.Router();
  router.get('/api/internal/erasure-assets', async (request, response) => {
    // Arthur: NarIyirm
    // 中文：Vercel 定时任务使用独立服务端秘密，公开请求与设备凭证不能触发管理员存储清理。
    // EN: Vercel cron uses a separate server secret; public requests and device credentials cannot invoke administrative storage cleanup.
    const secret = process.env.CRON_SECRET;
    if (!secret) return response.status(503).json({ error: 'cleanup_unconfigured' });
    const expected = Buffer.from(`Bearer ${secret}`);
    const provided = Buffer.from(request.get('Authorization') ?? '');
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return response.status(401).json({ error: 'unauthorized' });
    }
    try { return response.json(await cleanupErasureAssets(database)); }
    catch { return response.status(503).json({ error: 'cleanup_unavailable' }); }
  });
  return router;
}
