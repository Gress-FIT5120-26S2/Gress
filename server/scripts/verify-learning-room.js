import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import express from 'express';
import '../src/env.js';
import { supabase } from '../src/supabase.js';
import { requireDevice } from '../src/middleware/requireDevice.js';
import sharingRouter, { recoverDeviceRoute } from '../src/routes/sharing.js';
import { createLearningRouter } from '../src/routes/learning.js';
import { createLearningRoomService } from '../src/services/learningRoom.js';
import { allowDraftLearning } from '../src/services/learningAssessment.js';
import { validateNoPrivateFields } from '../src/services/learningContent.js';

const ref = 'thmbtsssvnslotoexntz';
const linked = (await readFile(new URL('../../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
assert.equal(linked, ref, 'Only the linked development project may run these tests.');
assert.equal(new URL(process.env.SUPABASE_URL).hostname, `${ref}.supabase.co`, 'The server must use the development database.');
assert.notEqual(process.env.NODE_ENV, 'production');
const environment = { ...process.env, LEARNING_ROOM_ALLOW_DRAFT: '1', LEARNING_ROOM_DRAFT_PROJECT_REF: ref };
assert.equal(allowDraftLearning(environment), true);
const devices = ['a', 'b', 'c'].map((suffix) => `test_learning_${randomUUID()}_${suffix}`);
const credentials = devices.map(() => randomBytes(32).toString('hex'));
const verified = [];
let requests = 0;
const app = express();
app.use(express.json());
app.post('/api/devices/recover', recoverDeviceRoute);
app.use('/api', requireDevice);
app.use('/api', sharingRouter);
app.use('/api', createLearningRouter(createLearningRoomService(supabase, environment)));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}/api`;

async function api(device, endpoint, payload, { status = 200, error = null, method = payload === undefined ? 'GET' : 'POST' } = {}) {
  requests += 1;
  const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json', 'Device-ID': devices[device], 'Device-Credential': credentials[device] },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  const body = await response.json();
  assert.equal(response.status, status, `${method} ${endpoint}: ${body.error ?? 'unexpected status'}`);
  if (error) assert.equal(body.error, error);
  return body;
}
const key = () => randomUUID();
const start = (device, stageCode, mode = 'checkpoint', activityCode) => api(device, '/learning/attempts', { stageCode, mode, ...(activityCode ? { activityCode } : {}), createKey: key() });
const mutate = (device, uid, action, fields = {}, expectation) => api(device, `/learning/attempts/${uid}/${action}`, { requestKey: key(), ...fields }, expectation);
async function row(table, columns, column, value) {
  const result = await supabase.from(table).select(columns).eq(column, value).single();
  if (result.error) throw new Error(`Test database read failed: ${table}/${result.error.code}`);
  return result.data;
}
async function counts(fridgeUid) {
  const result = {};
  for (const table of ['inventory_batches', 'inventory_events', 'waste_sorting_attempts', 'fridge_xp_events', 'fridge_achievements', 'notifications']) {
    const query = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('fridge_uid', fridgeUid);
    if (query.error) throw new Error(`Test isolation read failed: ${table}/${query.error.code}`);
    result[table] = query.count;
  }
  return result;
}

// Arthur: NarIyirm
// 中文：只在测试服务端读取私有快照以控制正确数；HTTP 客户端收到的未答题必须没有答案键或解释。
// EN: Only this test server reads private snapshots to control scores; HTTP clients must receive unanswered questions without keys or explanations.
async function solve(device, response, correctCount, { concurrent = false } = {}) {
  const uid = response.quiz.attemptUid;
  const stored = await row('learning_quiz_attempts', 'question_snapshot', 'attempt_uid', uid);
  for (let index = 0; index < stored.question_snapshot.length; index += 1) {
    const question = stored.question_snapshot[index];
    assert.equal(response.quiz.question.questionUid, question.questionUid);
    assert.deepEqual(validateNoPrivateFields(response.quiz.question), []);
    assert.equal(response.quiz.feedback, null);
    const optionId = index < correctCount ? question.correctOptionId : question.options.find((o) => o.optionId !== question.correctOptionId).optionId;
    const fields = { questionUid: question.questionUid, optionId, requestKey: key() };
    let answered;
    if (concurrent && index === 0) {
      const pair = await Promise.all([mutate(device, uid, 'answers', fields), mutate(device, uid, 'answers', fields)]);
      assert.equal(pair[0].stateVersion, pair[1].stateVersion);
      answered = pair[0];
      const alternate = question.options.find((o) => o.optionId !== optionId).optionId;
      await mutate(device, uid, 'answers', { questionUid: question.questionUid, optionId: alternate }, { status: 409, error: 'answer_already_submitted' });
    } else answered = await mutate(device, uid, 'answers', fields);
    assert.equal(answered.quiz.feedback.isCorrect, index < correctCount);
    const restored = await api(device, `/learning/attempts/${uid}`);
    assert.equal(restored.quiz.feedback.selectedOptionId, optionId);
    if (index + 1 < stored.question_snapshot.length) {
      const nextFields = { requestKey: key() };
      response = await mutate(device, uid, 'next', nextFields);
      if (concurrent && index === 0) {
        const retried = await mutate(device, uid, 'next', nextFields);
        assert.equal(retried.quiz.questionNumber, response.quiz.questionNumber);
        assert.equal(retried.stateVersion, response.stateVersion);
      }
    }
  }
  const finishFields = { requestKey: key() };
  const pair = await Promise.all([mutate(device, uid, 'finish', finishFields), mutate(device, uid, 'finish', finishFields)]);
  assert.equal(pair[0].stateVersion, pair[1].stateVersion);
  assert.equal(pair[0].result.correctCount, correctCount);
  assert.equal(pair[0].result.passed, correctCount * 100 >= stored.question_snapshot.length * 80);
  const missed = await api(device, `/learning/attempts/${uid}/review?missedOnly=true`);
  assert.equal(missed.questions.length, stored.question_snapshot.length - correctCount);
  return pair[0];
}

async function cleanup() {
  // Arthur: NarIyirm
  // 中文：清理仅匹配本轮随机设备及其创建的冰箱；级联删除个人考试，绝不扫描或删除真实用户记录。
  // EN: Cleanup matches only this run's random devices and their created fridges; cascading deletion removes personal attempts without touching real users.
  const query = await supabase.from('fridges').select('fridge_uid').in('created_by_device_id', devices);
  if (query.error) throw new Error(`Test cleanup failed: ${query.error.code}`);
  const fridges = query.data.map((f) => f.fridge_uid);
  if (fridges.length) {
    for (const table of ['notifications', 'shopping_cart_items', 'inventory_events', 'inventory_batches', 'restock_rules', 'food_categories', 'fridge_achievements', 'fridge_invites', 'fridge_members']) {
      const removed = await supabase.from(table).delete().in('fridge_uid', fridges);
      if (removed.error) throw new Error(`Test cleanup failed: ${table}/${removed.error.code}`);
    }
    const detached = await supabase.from('fridges').update({ merged_into_fridge_uid: null, status: 'active' }).in('fridge_uid', fridges);
    if (detached.error) throw new Error(`Test cleanup detach failed: ${detached.error.code}`);
    const removed = await supabase.from('fridges').delete().in('fridge_uid', fridges);
    if (removed.error) throw new Error(`Test fridge cleanup failed: ${removed.error.code}`);
  }
  const removed = await supabase.from('devices').delete().in('device_id', devices);
  if (removed.error) throw new Error(`Test device cleanup failed: ${removed.error.code}`);
  for (const [table, owner] of [['learning_learners', 'owner_device_id'], ['learning_quiz_attempts', 'created_by_device_id']]) {
    const remaining = await supabase.from(table).select('*', { count: 'exact', head: true }).in(owner, devices);
    if (remaining.error || remaining.count !== 0) throw new Error(`Test data remains: ${table}`);
  }
}

try {
  const initial = await api(0, '/learning/state');
  assert.deepEqual(initial.session.stageStatus, { beginner: 'unlocked', intermediate: 'locked', advanced: 'locked' });
  assert.deepEqual(initial.session.completedActivityCodes, []);
  const catalog = (await api(0, '/learning/catalog')).content;
  assert.deepEqual(validateNoPrivateFields(catalog), []);
  const normal = createLearningRoomService(supabase, { ...environment, LEARNING_ROOM_ALLOW_DRAFT: '0' });
  await assert.rejects(normal.catalog(), /content_unavailable/);
  verified.push('real credentials, new learner, safe catalog, normal draft gate');
  const fridge = (await row('fridge_members', 'fridge_uid', 'device_id', devices[0])).fridge_uid;
  const baseline = await counts(fridge);
  await api(0, '/learning/attempts', { stageCode: 'intermediate', mode: 'checkpoint', createKey: key() }, { status: 403, error: 'learning_stage_locked' });
  await api(0, '/learning/attempts', { stageCode: 'beginner', mode: 'checkpoint', createKey: key(), passed: true }, { status: 400, error: 'invalid_input' });
  const creation = { stageCode: 'beginner', mode: 'checkpoint', createKey: key() };
  const pair = await Promise.all([api(0, '/learning/attempts', creation), api(0, '/learning/attempts', creation)]);
  const uid = pair[0].quiz.attemptUid;
  assert.equal(pair[1].quiz.attemptUid, uid);
  await api(1, `/learning/attempts/${uid}`, undefined, { status: 404, error: 'attempt_not_found' });
  await mutate(0, uid, 'finish', {}, { status: 409, error: 'attempt_incomplete' });
  await mutate(0, uid, 'next', {}, { status: 409, error: 'learning_answer_required' });
  const snapshot = await row('learning_quiz_attempts', 'question_snapshot', 'attempt_uid', uid);
  await mutate(0, uid, 'answers', { questionUid: snapshot.question_snapshot[1].questionUid, optionId: snapshot.question_snapshot[1].correctOptionId }, { status: 409, error: 'learning_question_not_current' });
  const resumeCreation = { ...creation, createKey: key() };
  const resumed = await api(0, '/learning/attempts', resumeCreation);
  assert.equal(resumed.quiz.attemptUid, uid);
  const failed = await solve(0, resumed, 4, { concurrent: true });
  assert.equal(failed.session.stageStatus.intermediate, 'locked');
  assert.equal((await api(0, '/learning/attempts', resumeCreation)).result.attemptUid, uid);
  verified.push('concurrent create/answer/finish, first answer frozen, out-of-order blocked, alias retry, 4/6 failure');
  for (const [stage, correct, passed] of [['beginner', 5, true], ['intermediate', 6, false], ['intermediate', 7, true], ['advanced', 7, false], ['advanced', 8, true]]) {
    const result = await solve(0, await start(0, stage), correct);
    assert.equal(result.result.passed, passed);
  }
  const mixed = await solve(0, await start(0, 'advanced', 'mixed-review'), 6);
  assert.equal(mixed.result.nextStageCode, null);
  assert.equal(mixed.session.resumeTarget.type, 'mixed-review');
  const lesson = catalog.activities.find((a) => a.type === 'lesson');
  await api(0, `/learning/courses/${catalog.courses[0].courseCode}`);
  await api(0, `/learning/activities/${lesson.activityCode}`);
  const completeBody = { contentVersion: catalog.contentVersion, requestKey: key() };
  const completed = await api(0, `/learning/activities/${lesson.activityCode}/completion`, completeBody, { method: 'PUT' });
  const completedAgain = await api(0, `/learning/activities/${lesson.activityCode}/completion`, completeBody, { method: 'PUT' });
  assert.equal(completedAgain.stateVersion, completed.stateVersion);
  await api(0, `/learning/activities/${catalog.resources[0].resourceCode}/completion`, completeBody, { method: 'PUT' });
  assert.deepEqual(await counts(fridge), baseline);
  verified.push('5/6, 7/8, 8/10 thresholds; failed checkpoints; mixed review; completion idempotency; inventory/XP/stat isolation');
  console.log(JSON.stringify({ progress: verified.length, requests }));

  const personalB = await row('learning_learners', 'learner_uid', 'owner_device_id', devices[1]);
  const share = await api(0, '/fridges/share', { name: 'Learning Room test' }, { status: 201 });
  await api(1, '/fridges/join', { code: share.activeInvite.code });
  assert.equal((await api(1, '/learning/state')).session.stageStatus.intermediate, 'locked');
  assert.equal((await row('learning_learners', 'learner_uid', 'owner_device_id', devices[1])).learner_uid, personalB.learner_uid);
  await api(1, `/learning/attempts/${uid}`, undefined, { status: 404, error: 'attempt_not_found' });
  await solve(1, await start(1, 'intermediate', 'review'), 8);
  assert.equal((await api(1, '/learning/state')).session.stageStatus.intermediate, 'locked');
  const practice = catalog.activities.find((a) => a.stageCode === 'beginner' && a.type === 'practice');
  const practiced = await solve(1, await start(1, 'beginner', 'practice', practice.activityCode), 3);
  assert.ok(practiced.session.completedActivityCodes.includes(practice.activityCode));
  assert.equal(practiced.session.stageStatus.intermediate, 'locked');
  await api(1, `/learning/activities/${practice.activityCode}/completion`, completeBody, { method: 'PUT', status: 409, error: 'learning_practice_requires_attempt' });
  await api(1, '/fridges/leave', { name: 'Personal test' });
  assert.equal((await row('learning_learners', 'learner_uid', 'owner_device_id', devices[1])).learner_uid, personalB.learner_uid);
  verified.push('shared members remain separate; join/leave preserve learner; review/practice never unlock');

  await solve(2, await start(2, 'beginner'), 5);
  const originalActive = await start(1, 'beginner');
  const temporaryActive = await start(2, 'beginner');
  const code = await api(1, '/devices/recovery-code', {}, { status: 201 });
  await api(2, '/devices/recover', { recoveryCode: code.recoveryCode });
  await api(1, '/learning/state', undefined, { status: 401, error: 'invalid_device_credential' });
  const recovered = await api(2, '/learning/state');
  assert.equal(recovered.session.stageStatus.beginner, 'completed');
  assert.equal(recovered.session.stageStatus.intermediate, 'unlocked');
  assert.ok(recovered.session.completedActivityCodes.includes(practice.activityCode));
  assert.equal((await row('learning_learners', 'learner_uid', 'owner_device_id', devices[2])).learner_uid, personalB.learner_uid);
  assert.equal((await api(2, `/learning/attempts/${originalActive.quiz.attemptUid}`)).status, 'in_progress');
  assert.equal((await api(2, `/learning/attempts/${temporaryActive.quiz.attemptUid}`)).status, 'abandoned');
  await mutate(2, originalActive.quiz.attemptUid, 'abandon');
  const restarted = await start(2, 'beginner');
  assert.notEqual(restarted.quiz.attemptUid, originalActive.quiz.attemptUid);
  verified.push('recovery stable identity, merged temporary pass, practice retained, conflict abandoned, old credential revoked, restart');
} finally {
  try { await cleanup(); verified.push('exact temporary data cleanup'); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
console.log(JSON.stringify({ ok: true, project: 'Gress-development', requests, verified }, null, 2));
