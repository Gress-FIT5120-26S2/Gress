import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import express from 'express';
import '../src/env.js';
import { supabase } from '../src/supabase.js';
import { requireDevice } from '../src/middleware/requireDevice.js';
import { createLearningRouter } from '../src/routes/learning.js';
import { createLearningRoomService } from '../src/services/learningRoom.js';
import { allowDraftLearning } from '../src/services/learningAssessment.js';
import { validateNoPrivateFields } from '../src/services/learningContent.js';

const ref = 'thmbtsssvnslotoexntz';
assert.equal((await readFile(new URL('../../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim(), ref);
assert.equal(new URL(process.env.SUPABASE_URL).hostname, `${ref}.supabase.co`);
assert.notEqual(process.env.NODE_ENV, 'production');
const environment = { ...process.env, LEARNING_ROOM_ALLOW_DRAFT: '1', LEARNING_ROOM_DRAFT_PROJECT_REF: ref };
assert.equal(allowDraftLearning(environment), true);
const device = `test_learning_gateway_${randomUUID()}`;
const credential = randomBytes(32).toString('hex');
const dir = await mkdtemp(path.join(os.tmpdir(), 'kitchmemo-live-gateway-'));
const source = await readFile(new URL('../../src/services/learningGateway.ts', import.meta.url), 'utf8');
await writeFile(path.join(dir, 'gateway.mjs'), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
const { createLearningGateway } = await import(pathToFileURL(path.join(dir, 'gateway.mjs')).href);
const app = express(); app.use(express.json()); app.use('/api', requireDevice);
app.use('/api', createLearningRouter(createLearningRoomService(supabase, environment)));
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let requests = 0; let lose = null; const lostBodies = [];
const request = async (endpoint, init = {}) => {
  requests++;
  const response = await fetch(base + endpoint, { ...init, signal: AbortSignal.timeout(25_000), headers: { 'Content-Type': 'application/json', 'Device-ID': device, 'Device-Credential': credential } });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error), { code: body.error, status: response.status });
  if (lose && endpoint.endsWith(lose)) { lostBodies.push({ endpoint, body: JSON.parse(init.body) }); lose = null; throw new Error('Injected loss after server commit'); }
  return body;
};
const create = () => createLearningGateway(request, randomUUID, async () => device);
let gateway = create();
const row = async (table, columns, column, value) => {
  const { data, error } = await supabase.from(table).select(columns).eq(column, value).single(); if (error) throw new Error(`${table}/${error.code}`); return data;
};
const counts = async fridge => {
  const values = {};
  for (const table of ['inventory_batches', 'inventory_events', 'waste_sorting_attempts', 'fridge_xp_events', 'fridge_achievements', 'notifications']) {
    const { count, error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).eq('fridge_uid', fridge); if (error) throw new Error(`${table}/${error.code}`); values[table] = count;
  }
  return values;
};

// Arthur: NarIyirm
// 中文：只在开发测试服务端读取私有快照控制正确数；真正前端适配器只收到公开题目及已答反馈。
// EN: Only this development test server reads private snapshots to control correct counts; the actual frontend adapter receives public questions and submitted feedback only.
async function solve(quiz, correctCount, exerciseLosses = false) {
  const uid = quiz.attemptUid;
  const stored = await row('learning_quiz_attempts', 'question_snapshot', 'attempt_uid', uid);
  for (let i = 0; i < stored.question_snapshot.length; i++) {
    const question = stored.question_snapshot[i];
    assert.equal(quiz.question.questionUid, question.questionUid); assert.deepEqual(validateNoPrivateFields(quiz.question), []);
    const option = i < correctCount ? question.correctOptionId : question.options.find(o => o.optionId !== question.correctOptionId).optionId;
    if (exerciseLosses && i === 0) {
      lose = '/answers'; await assert.rejects(gateway.submitAnswer(uid, question.questionUid, option));
      assert.equal(gateway.getPendingAnswer(uid, question.questionUid), option);
      quiz = await gateway.submitAnswer(uid, question.questionUid, question.options.find(o => o.optionId !== option).optionId);
      assert.equal(quiz.feedback.selectedOptionId, option);
    } else quiz = await gateway.submitAnswer(uid, question.questionUid, option);
    assert.equal(quiz.feedback.isCorrect, i < correctCount);
    if (i + 1 < stored.question_snapshot.length) {
      if (exerciseLosses && i === 0) {
        lose = '/next'; await assert.rejects(gateway.nextQuestion(uid));
        await gateway.load(); quiz = await gateway.resumeQuiz(uid);
      } else quiz = await gateway.nextQuestion(uid);
    }
  }
  if (exerciseLosses) { lose = '/finish'; await assert.rejects(gateway.finishQuiz(uid)); }
  const result = await gateway.finishQuiz(uid);
  assert.equal(result.correctCount, correctCount); assert.equal(result.passed, correctCount * 100 >= result.totalCount * 80);
  assert.equal((await gateway.reviewMissed(uid)).length, result.totalCount - correctCount);
  assert(gateway.getSources(uid).length > 0);
  console.log(JSON.stringify({ stage: result.stageCode, mode: result.mode, score: `${result.correctCount}/${result.totalCount}`, requests }));
  return result;
}

async function cleanup() {
  // Arthur: NarIyirm
  // 中文：仅删除本轮随机设备创建的临时冰箱；验证学习记录级联清空，不扫描真实用户。
  // EN: Remove only the fridge created by this run's random device and verify cascading learning cleanup without scanning real users.
  const { data, error } = await supabase.from('fridges').select('fridge_uid').eq('created_by_device_id', device); if (error) throw error;
  const ids = data.map(f => f.fridge_uid);
  if (ids.length) {
    for (const table of ['notifications', 'shopping_cart_items', 'inventory_events', 'inventory_batches', 'restock_rules', 'food_categories', 'fridge_achievements', 'fridge_invites', 'fridge_members', 'fridges']) {
      const { error: failure } = await supabase.from(table).delete().in('fridge_uid', ids); if (failure) throw new Error(`Cleanup ${table}/${failure.code}`);
    }
  }
  const removed = await supabase.from('devices').delete().eq('device_id', device); if (removed.error) throw removed.error;
  for (const [table, field] of [['learning_learners', 'owner_device_id'], ['learning_quiz_attempts', 'created_by_device_id']]) {
    const { count, error: failure } = await supabase.from(table).select('*', { head: true, count: 'exact' }).eq(field, device); assert(!failure && count === 0, `Cleanup remains: ${table}`);
  }
}

try {
  const { content, session } = await gateway.load(); assert.deepEqual(session.completedActivityCodes, []); assert.equal(session.stageStatus.intermediate, 'locked');
  const fridge = (await row('fridge_members', 'fridge_uid', 'device_id', device)).fridge_uid;
  const baseline = await counts(fridge); assert.equal(baseline.inventory_batches, 0);
  await assert.rejects(createLearningRoomService(supabase, { ...environment, LEARNING_ROOM_ALLOW_DRAFT: '0' }).catalog(), /content_unavailable/);
  await gateway.markActivity('beginner-why-waste'); await gateway.markResource('waste-climate-sdg13');
  const practice = content.activities.find(a => a.type === 'practice');
  const practiceResult = await solve(await gateway.startQuiz(practice.stageCode, 'practice', practice.activityCode), 0);
  assert(practiceResult.session.completedActivityCodes.includes(practice.activityCode)); assert.equal(practiceResult.session.stageStatus.intermediate, 'locked');
  const failure = await solve(await gateway.startQuiz('beginner', 'checkpoint'), 4); assert.equal(failure.session.stageStatus.intermediate, 'locked');
  lose = '/attempts'; await assert.rejects(gateway.startQuiz('beginner', 'checkpoint'));
  const active = (await gateway.load()).session.resumeTarget; assert.equal(active.type, 'attempt');
  let quiz = await gateway.resumeQuiz(active.attemptUid);
  let result = await solve(quiz, 5, true); assert.equal(result.session.stageStatus.intermediate, 'unlocked');
  gateway.dispose(); gateway = create();
  assert.equal((await gateway.load()).session.currentStageCode, 'intermediate');
  assert.equal((await gateway.resumeQuiz(result.attemptUid)).correctCount, 5);
  result = await solve(await gateway.startQuiz('intermediate', 'checkpoint'), 7); assert.equal(result.session.stageStatus.advanced, 'unlocked');
  result = await solve(await gateway.startQuiz('advanced', 'checkpoint'), 8); assert.equal(result.session.resumeTarget.type, 'mixed-review');
  await solve(await gateway.startQuiz('advanced', 'mixed-review'), 12);
  assert.equal((await gateway.load()).session.stageStatus.beginner, 'completed'); assert(gateway.getState().recentResults.length >= 5);
  quiz = await gateway.startQuiz('beginner', 'review'); await gateway.abandonQuiz(quiz.attemptUid);
  const restarted = await gateway.startQuiz('beginner', 'review'); assert.notEqual(restarted.attemptUid, quiz.attemptUid); await gateway.abandonQuiz(restarted.attemptUid);
  assert.deepEqual(await counts(fridge), baseline);
  console.log(JSON.stringify({ result: 'PASS', requests, simulatedLostResponses: lostBodies.length, emptyInventory: true, completePath: true, isolation: true }));
} finally {
  gateway.dispose(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  try { await cleanup(); console.log('Random learning gateway test data cleaned; no learner/attempt remains.'); }
  finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert(path.basename(dir).startsWith('kitchmemo-live-gateway-'));
    await rm(dir, { recursive: true, force: true });
  }
}
