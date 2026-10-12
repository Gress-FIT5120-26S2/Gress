import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { once } from 'node:events';
import { createAiConsentMiddleware } from '../src/middleware/aiConsent.js';
import { createPrivacyRouter } from '../src/routes/privacy.js';
import { createErasureCleanupRouter } from '../src/routes/erasureCleanup.js';
import { cleanupErasureAssets } from '../src/services/erasureAssets.js';

const resultDatabase = result => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }) });
async function invokeMiddleware(path, method, result) {
  let status = 200; let body; let forwarded = false;
  const response = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
  await createAiConsentMiddleware(resultDatabase(result))({ path, method, deviceId: 'fixture-owner' }, response, () => { forwarded = true; });
  return { status, body, forwarded };
}
test('AI writes fail closed before external processing and manual/read requests remain available', async () => {
  for (const path of ['/assistant/messages', '/learning/tutor/messages', '/photo-recognition', '/food-presets/generate', '/inventory/categories', '/waste-learning/profile', '/waste-learning/materials/prepare']) {
    assert.deepEqual(await invokeMiddleware(path, 'POST', { data: null }), { status: 403, body: { error: 'ai_consent_required' }, forwarded: false });
  }
  assert.equal((await invokeMiddleware('/inventory/batches', 'POST', { error: {} })).forwarded, true);
  assert.equal((await invokeMiddleware('/assistant/conversations', 'GET', { error: {} })).forwarded, true);
  assert.equal((await invokeMiddleware('/learning/tutor/messages', 'POST', { error: {} })).status, 503);
});
test('withdrawn or old permission cannot authorize a provider call', async () => {
  assert.equal((await invokeMiddleware('/photo-recognition', 'POST', { data: { ai_allowed: false, consent_version: '2026-10-12' } })).forwarded, false);
  assert.equal((await invokeMiddleware('/photo-recognition', 'POST', { data: { ai_allowed: true, consent_version: 'old' } })).forwarded, false);
  assert.equal((await invokeMiddleware('/photo-recognition', 'POST', { data: { ai_allowed: true, consent_version: '2026-10-12' } })).forwarded, true);
});

test('privacy routes reject a client-selected identity, and erasure binds the verified credential', async t => {
  const writes = [];
  const database = {
    from(table) { return { upsert: async payload => { writes.push({ table, payload }); return {}; }, select: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }; },
    async rpc(name, parameters) { writes.push({ name, parameters }); return { data: { deleted: true, iconPaths: [] } }; },
  };
  const app = express(); app.use(express.json());
  app.use((request, _response, next) => { request.deviceId = 'authenticated-owner'; next(); });
  app.use(createPrivacyRouter(database));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const send = (path, method, body) => fetch(url + path, { method, headers: { 'Content-Type': 'application/json', 'Device-Credential': 'a'.repeat(64) }, body: JSON.stringify(body) });
  assert.equal((await send('/privacy/ai-consent', 'PUT', { allowed: true, version: '2026-10-12', deviceId: 'other-owner' })).status, 400);
  assert.equal(writes.length, 0);
  assert.equal((await send('/privacy/ai-consent', 'PUT', { allowed: false, version: '2026-10-12' })).status, 200);
  assert.equal(writes[0].payload.device_id, 'authenticated-owner');
  assert.equal((await send('/privacy/device-data', 'DELETE', { confirm: 'DELETE', deviceId: 'other-owner' })).status, 400);
  assert.equal((await send('/privacy/device-data', 'DELETE', { confirm: 'DELETE' })).status, 200);
  assert.equal(writes[1].parameters.p_device_id, 'authenticated-owner');
  assert.match(writes[1].parameters.p_credential_digest, /^[0-9a-f]{64}$/);
  assert.notEqual(writes[1].parameters.p_credential_digest, 'a'.repeat(64));
});

test('failed storage cleanup keeps the durable deletion queue for retry', async () => {
  let dequeued = false;
  const database = {
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [{ icon_path: 'fixture.png' }] }) }) }), delete: () => { dequeued = true; return { in: async () => ({}) }; } }),
    storage: { from: () => ({ remove: async () => ({ error: { message: 'temporary failure' } }) }) },
  };
  await assert.rejects(() => cleanupErasureAssets(database), /erasure_storage_unavailable/);
  assert.equal(dequeued, false);
});

test('admin storage cleanup rejects missing or incorrect cron credentials', async t => {
  const prior = process.env.CRON_SECRET; process.env.CRON_SECRET = 'fixture-secret';
  t.after(() => { if (prior === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prior; });
  const app = express(); app.use(createErasureCleanupRouter({}));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/internal/erasure-assets`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer incorrect' } })).status, 401);
});
