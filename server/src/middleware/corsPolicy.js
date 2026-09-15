import cors from 'cors';

export const corsAllowedHeaders = Object.freeze([
  'Content-Type',
  'Device-ID',
  'Device-Credential',
]);

export const corsAllowedMethods = Object.freeze([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

export function parseAllowedOrigins(value = '') {
  return new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean));
}

export function createCorsPolicy(value = process.env.CORS_ALLOWED_ORIGINS ?? '') {
  const allowedOrigins = parseAllowedOrigins(value);

  // Arthur: NarIyirm
  // 中文：原生 App 请求通常没有 Origin，应继续放行；任何网页 Origin 必须精确命中环境白名单后才获得 CORS 响应。
  // EN: Native app requests normally omit Origin and remain allowed; every browser Origin must exactly match the environment allowlist before receiving CORS headers.
  const rejectUnapprovedOrigin = (request, response, next) => {
    const origin = request.get('Origin');
    if (origin && !allowedOrigins.has(origin)) {
      return response.status(403).json({ error: 'cors_origin_denied' });
    }
    return next();
  };

  const applyCors = cors({
    allowedHeaders: corsAllowedHeaders,
    maxAge: 86400,
    methods: corsAllowedMethods,
    origin(origin, callback) {
      callback(null, Boolean(origin && allowedOrigins.has(origin)));
    },
    optionsSuccessStatus: 204,
  });

  return [rejectUnapprovedOrigin, applyCors];
}
