import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

// Arthur: NarIyirm
// 中文：编译真实纯适配器，注入传输故障和服务器响应，验证幂等、首答与身份隔离，不模拟客户端判分。
// EN: Compile the actual pure adapter and inject transport failures/server responses to verify idempotency, first answers and identity isolation without client grading.
const dir = await mkdtemp(path.join(os.tmpdir(), 'kitchmemo-learning-gateway-'));
try {
  const source = await readFile(new URL('../src/services/learningGateway.ts', import.meta.url), 'utf8');
  await writeFile(path.join(dir, 'gateway.mjs'), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
  const { createLearningGateway } = await import(pathToFileURL(path.join(dir, 'gateway.mjs')).href);
  const session = { currentStageCode: 'beginner', stageStatus: { beginner: 'unlocked', intermediate: 'locked', advanced: 'locked' }, completedActivityCodes: [], readResourceCodes: [], resumeTarget: { type: 'checkpoint', stageCode: 'beginner' } };
  const state = (version = '1') => ({ contentVersion: 'v1', stateVersion: version, session: structuredClone(session), recentResults: [], activeAttemptUid: null });
  const quiz = (questionUid = 'q1') => ({ attemptUid: 'a1', stageCode: 'beginner', mode: 'checkpoint', questionNumber: questionUid === 'q1' ? 1 : 2, questionCount: 6, question: { questionUid }, feedback: null });
  const response = (q = quiz(), version = '1') => ({ ...state(version), activeAttemptUid: 'a1', status: 'in_progress', quiz: q, sources: [{ sourceCode: 'frozen', url: 'https://example.org/frozen' }] });
  const catalog = { content: { contentVersion: 'v1', sources: [] } };
  let sequence = 0;
  const uuid = () => `request-key-${++sequence}`;
  const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

  await test('Concurrent starts share one server request, without sending scores', async () => {
    const waiting = deferred(); const bodies = [];
    const gateway = createLearningGateway(async (_path, init) => { bodies.push(JSON.parse(init.body)); return waiting.promise; }, uuid);
    const first = gateway.startQuiz('beginner', 'practice', 'beginner-bin-action');
    const second = gateway.startQuiz('beginner', 'practice', 'beginner-bin-action');
    await new Promise(r => setImmediate(r)); waiting.resolve(response());
    await Promise.all([first, second]); assert.equal(bodies.length, 1);
    assert.deepEqual(Object.keys(bodies[0]).sort(), ['activityCode', 'createKey', 'mode', 'stageCode']);
  });
  await test('A lost answer retries the first payload and original request key', async () => {
    const bodies = [];
    const gateway = createLearningGateway(async (_path, init) => { bodies.push(JSON.parse(init.body)); if (bodies.length === 1) throw new Error('response lost'); return response({ ...quiz(), feedback: { selectedOptionId: 'general' } }); }, uuid);
    await assert.rejects(gateway.submitAnswer('a1', 'q1', 'general'));
    const value = await gateway.submitAnswer('a1', 'q1', 'recycling');
    assert.deepEqual(bodies[0], bodies[1]); assert.equal(value.feedback.selectedOptionId, 'general');
  });
  await test('A lost next response retains the key until acknowledged', async () => {
    const keys = [];
    const gateway = createLearningGateway(async (_path, init) => { keys.push(JSON.parse(init.body).requestKey); if (keys.length === 1) throw new Error('response lost'); return response(quiz('q2'), '2'); }, uuid);
    await assert.rejects(gateway.nextQuestion('a1')); await gateway.nextQuestion('a1'); assert.equal(keys[0], keys[1]);
  });
  await test('Foreground cursor recovery creates a fresh next key for the new question', async () => {
    const keys = []; let current = quiz();
    const gateway = createLearningGateway(async (_path, init) => {
      if (!init) return response(current, current.questionNumber.toString());
      keys.push(JSON.parse(init.body).requestKey);
      if (keys.length === 1) { current = quiz('q2'); throw new Error('response lost'); }
      return response(quiz('q3'), '3');
    }, uuid);
    await gateway.resumeQuiz('a1'); await assert.rejects(gateway.nextQuestion('a1'));
    await gateway.resumeQuiz('a1'); await gateway.nextQuestion('a1'); assert.notEqual(keys[0], keys[1]);
  });
  await test('Restoring a lost start clears its key for a later new attempt', async () => {
    const keys = [];
    const gateway = createLearningGateway(async (_path, init) => {
      if (!init) return response(); keys.push(JSON.parse(init.body).createKey);
      if (keys.length === 1) throw new Error('response lost'); return response();
    }, uuid);
    await assert.rejects(gateway.startQuiz('beginner', 'checkpoint'));
    await gateway.resumeQuiz('a1'); await gateway.startQuiz('beginner', 'checkpoint'); assert.notEqual(keys[0], keys[1]);
  });
  await test('Submitted attempts return server results, frozen sources and recent history', async () => {
    const result = { attemptUid: 'a1', passed: true, correctCount: 5, totalCount: 6, session };
    const gateway = createLearningGateway(async () => ({ ...response(), status: 'submitted', quiz: undefined, result, recentResults: [{ attemptUid: 'a1' }] }), uuid);
    assert.deepEqual(await gateway.resumeQuiz('a1'), result);
    assert.equal(gateway.getState().recentResults[0].attemptUid, 'a1'); assert.equal(gateway.getSources('a1')[0].sourceCode, 'frozen');
  });
  await test('Already-submitted conflicts restore the original answer', async () => {
    const gateway = createLearningGateway(async (_path, init) => { if (init) throw { code: 'answer_already_submitted' }; return response({ ...quiz(), feedback: { selectedOptionId: 'general' } }); }, uuid);
    assert.equal((await gateway.submitAnswer('a1', 'q1', 'recycling')).feedback.selectedOptionId, 'general');
  });
  await test('Stale question submissions restore the current server cursor', async () => {
    const gateway = createLearningGateway(async (_path, init) => { if (init) throw { code: 'learning_question_not_current' }; return response(quiz('q2'), '2'); }, uuid);
    assert.equal((await gateway.submitAnswer('a1', 'q1', 'recycling')).question.questionUid, 'q2');
    assert.equal(gateway.getPendingAnswer('a1', 'q1'), null);
  });
  await test('Late states cannot roll back permanent progress', async () => {
    let calls = 0;
    const gateway = createLearningGateway(async () => response(quiz(), ++calls === 1 ? '10' : '2'), uuid);
    await gateway.resumeQuiz('a1'); await gateway.resumeQuiz('a1'); assert.equal(gateway.getState().stateVersion, '10');
  });
  await test('Credential changes reject late responses and clear old sources/state', async () => {
    let identity = 'old'; const old = deferred();
    const gateway = createLearningGateway(async path => path.endsWith('/a1') ? old.promise : path.endsWith('/catalog') ? catalog : state('1'), uuid, async () => identity);
    const pending = gateway.resumeQuiz('a1'); await new Promise(r => setImmediate(r));
    identity = 'new'; await gateway.load(); old.resolve(response(quiz(), '99'));
    await assert.rejects(pending, { code: 'learning_identity_changed' }); assert.equal(gateway.getState().stateVersion, '1'); assert.deepEqual(gateway.getSources('a1'), []);
  });
  await test('Credential changes prevent completion with an old cached catalog', async () => {
    let identity = 'old'; let writes = 0;
    const gateway = createLearningGateway(async (path, init) => { if (init) writes++; return path.endsWith('/catalog') ? catalog : state(); }, uuid, async () => identity);
    await gateway.load(); identity = 'new'; await assert.rejects(gateway.markActivity('lesson'), { code: 'content_unavailable' }); assert.equal(writes, 0);
  });
  await test('Credential changes during a response are detected without another UI request', async () => {
    let identity = 'old'; const waiting = deferred();
    const gateway = createLearningGateway(async () => waiting.promise, uuid, async () => identity);
    const pending = gateway.resumeQuiz('a1'); await new Promise(r => setImmediate(r)); identity = 'new'; waiting.resolve(response());
    await assert.rejects(pending, { code: 'learning_identity_changed' }); assert.equal(gateway.getState(), null);
  });
  await test('Revoked credentials clear personal cache and pending answers', async () => {
    let revoked = false;
    const gateway = createLearningGateway(async () => { if (revoked) throw { code: 'invalid_device_credential' }; return response(); }, uuid);
    await gateway.resumeQuiz('a1'); revoked = true;
    await assert.rejects(gateway.submitAnswer('a1', 'q1', 'general'), { code: 'learning_identity_changed' });
    assert.equal(gateway.getState(), null); assert.equal(gateway.getPendingAnswer('a1', 'q1'), null); assert.deepEqual(gateway.getSources('a1'), []);
  });
  await test('Catalog/state version races fail safely and never invent content', async () => {
    let catalogs = 0;
    const gateway = createLearningGateway(async path => path.endsWith('/catalog') ? (++catalogs, catalog) : { ...state(), contentVersion: 'v2' }, uuid);
    await assert.rejects(gateway.load(), { code: 'learning_content_changed' }); assert.equal(catalogs, 2); assert.equal(gateway.getState(), null);
  });
  await test('Withdrawn attempts are not mapped to a quiz or result', async () => {
    const gateway = createLearningGateway(async () => ({ ...state(), status: 'invalidated', sources: [] }), uuid);
    await assert.rejects(gateway.resumeQuiz('a1'), { code: 'attempt_invalidated' });
  });
  await test('Unavailable catalog and disposal never fall back to fixtures', async () => {
    const gateway = createLearningGateway(async () => { throw { code: 'content_unavailable' }; }, uuid);
    await assert.rejects(gateway.load(), { code: 'content_unavailable' }); gateway.dispose(); assert.equal(gateway.getState(), null);
  });
} finally {
  assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
  assert(path.basename(dir).startsWith('kitchmemo-learning-gateway-'));
  await rm(dir, { recursive: true, force: true });
}
