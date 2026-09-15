import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createCorsPolicy } from '../src/middleware/corsPolicy.js';
import { consumeRateLimit } from '../src/middleware/rateLimit.js';
import { supabase } from '../src/supabase.js';

function createResponse() {
  return {
    body: null,
    headers: new Map(),
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    set(name, value) {
      this.headers.set(name, value);
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

// Arthur: NarIyirm
// 中文：验证白名单只接受精确网页来源，同时保留没有 Origin 的原生 App 请求。
// EN: Verify that the allowlist accepts only exact browser origins while preserving native app requests without Origin.
const [rejectUnapprovedOrigin] = createCorsPolicy('https://approved.example');
for (const [origin, expectedStatus, expectedNextCalls] of [
  ['https://unapproved.example', 403, 0],
  ['https://approved.example', 200, 1],
  [undefined, 200, 1],
]) {
  const response = createResponse();
  let nextCalls = 0;
  rejectUnapprovedOrigin(
    { get: (name) => (name === 'Origin' ? origin : undefined) },
    response,
    () => { nextCalls += 1; },
  );
  assert.equal(response.statusCode, expectedStatus);
  assert.equal(nextCalls, expectedNextCalls);
}

const policy = { limit: 2, scope: 'verification', windowSeconds: 60 };
let receivedArguments;
const allowedClient = {
  async rpc(_name, args) {
    receivedArguments = args;
    return {
      data: [{ allowed: true, limit_value: 2, remaining: 1, retry_after_seconds: 0 }],
      error: null,
    };
  },
};
const allowedResponse = createResponse();
assert.equal(await consumeRateLimit({
  client: allowedClient,
  identifier: 'raw-client-identifier',
  policy,
  request: {},
  response: allowedResponse,
}), true);
assert.match(receivedArguments.p_key_hash, /^[0-9a-f]{64}$/);
assert.equal(receivedArguments.p_key_hash.includes('raw-client-identifier'), false);
assert.equal(allowedResponse.headers.get('RateLimit-Limit'), '2');
assert.equal(allowedResponse.headers.get('RateLimit-Remaining'), '1');

// Arthur: NarIyirm
// 中文：被拒请求必须同时返回机器可读的等待秒数和标准 Retry-After header。
// EN: Rejected requests must return both a machine-readable delay and the standard Retry-After header.
const blockedResponse = createResponse();
assert.equal(await consumeRateLimit({
  client: {
    async rpc() {
      return {
        data: [{ allowed: false, limit_value: 2, remaining: 0, retry_after_seconds: 37 }],
        error: null,
      };
    },
  },
  identifier: 'blocked-client',
  policy,
  request: {},
  response: blockedResponse,
}), false);
assert.equal(blockedResponse.statusCode, 429);
assert.equal(blockedResponse.headers.get('Retry-After'), '37');
assert.deepEqual(blockedResponse.body, { error: 'rate_limited', retryAfterSeconds: 37 });

console.log('API security middleware verification passed.');

if (process.argv.includes('--live')) {
  const scope = `verification-${Date.now()}`;
  const keyHash = 'a'.repeat(64);
  try {
    const decisions = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase.rpc('claim_api_rate_limit', {
        p_key_hash: keyHash,
        p_limit: 2,
        p_scope: scope,
        p_window_seconds: 60,
      });
      if (error) throw error;
      decisions.push(data[0]);
    }
    assert.deepEqual(decisions.map((decision) => decision.allowed), [true, true, false]);
    assert.equal(decisions[2].remaining, 0);
    assert.ok(decisions[2].retry_after_seconds > 0);

    const { data: restockData, error: restockError } = await supabase.rpc('get_restock_suggestions', {
      p_fridge: '00000000-0000-0000-0000-000000000000',
    });
    if (restockError) throw restockError;
    assert.deepEqual(restockData, []);

    // Arthur: NarIyirm
    // 中文：公开 key 只能建立 Realtime 连接，不能执行补货或限流 RPC；这里验证 migration 中的 REVOKE 真正生效。
    // EN: The publishable key is only for Realtime connectivity and must not execute restock or rate-limit RPCs; verify the migration's REVOKEs took effect.
    const publicClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const [{ error: publicRestockError }, { error: publicRateLimitError }] = await Promise.all([
      publicClient.rpc('get_restock_suggestions', {
        p_fridge: '00000000-0000-0000-0000-000000000000',
      }),
      publicClient.rpc('claim_api_rate_limit', {
        p_key_hash: 'b'.repeat(64),
        p_limit: 1,
        p_scope: scope,
        p_window_seconds: 60,
      }),
    ]);
    assert.ok(publicRestockError);
    assert.ok(publicRateLimitError);
    console.log('Live database rate-limit verification passed.');
  } finally {
    // Arthur: NarIyirm
    // 中文：远程验证只删除本次唯一 scope 的测试桶，不接触真实请求计数或业务数据。
    // EN: Remote verification deletes only this run's unique test scope and never touches real counters or business data.
    await supabase.from('api_rate_limit_buckets').delete().eq('scope', scope);
  }
}
