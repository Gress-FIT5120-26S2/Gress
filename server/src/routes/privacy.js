import express from 'express';
import { createHash } from 'node:crypto';
import { AI_CONSENT_VERSION } from '../middleware/aiConsent.js';
import { cleanupErasureAssets } from '../services/erasureAssets.js';

// Arthur: NarIyirm
// 中文：隐私写入只使用鉴权中间件提供的身份；删除再次在同一数据库事务内验证凭证，客户端不能指定另一设备。
// EN: Privacy writes use only the authenticated identity; erasure rechecks credentials transactionally and never accepts a client-selected device.
export function createPrivacyRouter(database) {
  const router = express.Router();
  router.get('/privacy/ai-consent', async (request, response) => {
    const { data, error } = await database.from('device_privacy_choices')
      .select('ai_allowed,consent_version,updated_at').eq('device_id', request.deviceId).maybeSingle();
    if (error) return response.status(503).json({ error: 'privacy_unavailable' });
    response.json({ allowed: data?.ai_allowed === true && data.consent_version === AI_CONSENT_VERSION,
      version: AI_CONSENT_VERSION, updatedAt: data?.updated_at ?? null });
  });
  router.put('/privacy/ai-consent', async (request, response) => {
    if (typeof request.body?.allowed !== 'boolean' || request.body?.version !== AI_CONSENT_VERSION
      || Object.keys(request.body).some(key => !['allowed', 'version'].includes(key))) {
      return response.status(400).json({ error: 'invalid_privacy_choice' });
    }
    const { error } = await database.from('device_privacy_choices').upsert({
      device_id: request.deviceId, ai_allowed: request.body.allowed,
      consent_version: AI_CONSENT_VERSION, updated_at: new Date().toISOString(),
    });
    if (error) return response.status(503).json({ error: 'privacy_unavailable' });
    response.json({ allowed: request.body.allowed, version: AI_CONSENT_VERSION });
  });
  router.delete('/privacy/device-data', async (request, response) => {
    if (request.body?.confirm !== 'DELETE' || Object.keys(request.body).some(key => key !== 'confirm')) {
      return response.status(400).json({ error: 'deletion_confirmation_required' });
    }
    const digest = createHash('sha256').update(request.get('Device-Credential'), 'utf8').digest('hex');
    const { data, error } = await database.rpc('erase_device_data', {
      p_device_id: request.deviceId, p_credential_digest: digest,
    });
    if (error || data?.deleted !== true) return response.status(503).json({ error: 'erasure_unavailable' });
    await cleanupErasureAssets(database).catch(() => console.error('Erasure assets remain queued for the daily retry.'));
    return response.json({ deleted: true });
  });
  return router;
}
