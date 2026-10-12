export const AI_CONSENT_VERSION = '2026-10-12';
const AI_PATHS = new Set([
  '/assistant/messages', '/learning/tutor/messages', '/photo-recognition',
  '/food-presets/generate', '/inventory/categories', '/waste-learning/profile',
  '/waste-learning/materials/prepare',
]);

// Arthur: NarIyirm
// 中文：统一在供应商请求与照片解析前核对数据库授权；读取历史与人工库存录入仍可在拒绝 AI 后使用。
// EN: Check recorded permission before provider requests and photo parsing; history reads and manual inventory remain available after declining AI.
export function createAiConsentMiddleware(database) {
  return async (request, response, next) => {
    if (request.method !== 'POST' || !AI_PATHS.has(request.path)) return next();
    const { data, error } = await database.from('device_privacy_choices')
      .select('ai_allowed,consent_version').eq('device_id', request.deviceId).maybeSingle();
    if (error) return response.status(503).json({ error: 'privacy_unavailable' });
    if (!data?.ai_allowed || data.consent_version !== AI_CONSENT_VERSION) {
      return response.status(403).json({ error: 'ai_consent_required' });
    }
    return next();
  };
}
