import { createHmac } from 'node:crypto';
import { supabase } from '../supabase.js';

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const rateLimitPolicies = Object.freeze({
  global: {
    limit: positiveInteger(process.env.API_RATE_LIMIT_MAX, 180),
    scope: 'api-global-ip',
    windowSeconds: positiveInteger(process.env.API_RATE_LIMIT_WINDOW_SECONDS, 60),
  },
  recovery: {
    limit: positiveInteger(process.env.RECOVERY_RATE_LIMIT_MAX, 5),
    scope: 'device-recovery-ip-device',
    windowSeconds: positiveInteger(process.env.RECOVERY_RATE_LIMIT_WINDOW_SECONDS, 15 * 60),
  },
  aiGeneration: {
    limit: positiveInteger(process.env.AI_GENERATION_RATE_LIMIT_MAX, 5),
    scope: 'ai-generation-device',
    windowSeconds: positiveInteger(process.env.AI_GENERATION_RATE_LIMIT_WINDOW_SECONDS, 60 * 60),
  },
  photoRecognition: {
    limit: positiveInteger(process.env.PHOTO_RECOGNITION_RATE_LIMIT_MAX, 30),
    scope: 'photo-recognition-device',
    windowSeconds: positiveInteger(process.env.PHOTO_RECOGNITION_RATE_LIMIT_WINDOW_SECONDS, 60 * 60),
  },
  fridgeJoin: {
    limit: positiveInteger(process.env.FRIDGE_JOIN_RATE_LIMIT_MAX, 10),
    scope: 'fridge-join-device',
    windowSeconds: positiveInteger(process.env.FRIDGE_JOIN_RATE_LIMIT_WINDOW_SECONDS, 15 * 60),
  },
});

export function getClientIp(request) {
  // Arthur: NarIyirm
  // 中文：Vercel 会覆盖 X-Forwarded-For 来阻止客户端伪造；本地开发不信任该 header，只使用实际 socket 地址。
  // EN: Vercel overwrites X-Forwarded-For to prevent client spoofing; local development ignores it and uses the socket address.
  if (process.env.VERCEL) {
    return request.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-vercel-client';
  }
  return request.socket?.remoteAddress || request.ip || 'unknown-local-client';
}

function hashIdentifier(scope, identifier) {
  // Arthur: NarIyirm
  // 中文：复用仅服务端可见的环境密钥做 HMAC，数据库限流表不会保存可反查的原始 IP、设备 ID 或凭证。
  // EN: A server-only environment secret keys the HMAC so the rate-limit table never stores reversible IPs, device IDs, or credentials.
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Missing server secret for rate-limit key hashing.');
  return createHmac('sha256', secret).update(`${scope}:${identifier}`, 'utf8').digest('hex');
}

function setRateLimitHeaders(response, policy, result) {
  response.set('RateLimit-Limit', String(result.limit_value ?? policy.limit));
  response.set('RateLimit-Remaining', String(result.remaining ?? 0));
  if (!result.allowed) response.set('Retry-After', String(result.retry_after_seconds));
}

export async function consumeRateLimit({ request, response, identifier, policy, client = supabase }) {
  try {
    const keyHash = hashIdentifier(policy.scope, identifier);
    const { data, error } = await client.rpc('claim_api_rate_limit', {
      p_key_hash: keyHash,
      p_limit: policy.limit,
      p_scope: policy.scope,
      p_window_seconds: policy.windowSeconds,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result.allowed !== 'boolean') {
      throw new Error('Rate-limit RPC returned an invalid result.');
    }

    setRateLimitHeaders(response, policy, result);
    if (result.allowed) return true;

    response.status(429).json({
      error: 'rate_limited',
      retryAfterSeconds: result.retry_after_seconds,
    });
    return false;
  } catch (error) {
    console.error('Rate-limit check failed:', error.message);
    response.status(503).json({ error: 'rate_limit_unavailable' });
    return false;
  }
}

export function databaseRateLimit(policy, identify) {
  return async function enforceDatabaseRateLimit(request, response, next) {
    const identifier = identify(request);
    if (await consumeRateLimit({ request, response, identifier, policy })) next();
  };
}
