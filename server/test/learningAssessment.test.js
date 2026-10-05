import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readLearningContent, buildPublicLearningContent, validateNoPrivateFields } from '../src/services/learningContent.js';
import { shuffled, selectLearningQuestions, projectLearningResponse, allowDraftLearning, learningError } from '../src/services/learningAssessment.js';
import { createLearningRouter } from '../src/routes/learning.js';

const bundle = await readLearningContent();
const content = { public_catalog: buildPublicLearningContent(bundle), private_question_bank: bundle.bank };
const pick = () => 0;

test('checkpoint sampling satisfies every topic quota without replacement or mutation', () => {
  const before = JSON.stringify(content);
  for (const stage of content.public_catalog.stages) {
    const codes = selectLearningQuestions(content, stage.stageCode, 'checkpoint', null, pick);
    assert.equal(codes.length, stage.questionCount);
    assert.equal(new Set(codes).size, codes.length);
    for (const topic of stage.blueprint) assert.equal(codes.filter((code) => bundle.bank.questions.find((q) => q.questionCode === code).topicCode === topic.topicCode).length, topic.count);
  }
  assert.equal(JSON.stringify(content), before);
  assert.deepEqual(shuffled([1, 2, 3], pick), [2, 3, 1]);
});

test('sampling rejects insufficient topics, inactive questions and invalid practice requests', () => {
  const missing = structuredClone(content);
  missing.private_question_bank.questions.filter((q) => q.stageCode === 'beginner').forEach((q) => { q.status = 'withdrawn'; });
  assert.throws(() => selectLearningQuestions(missing, 'beginner', 'checkpoint'), /content_unavailable/);
  assert.throws(() => selectLearningQuestions(content, 'beginner', 'practice', 'unknown'), /invalid_input/);
  assert.throws(() => selectLearningQuestions(content, 'beginner', 'checkpoint', 'unknown'), /invalid_input/);
  assert.throws(() => selectLearningQuestions(content, 'beginner', 'mixed-review'), /invalid_input/);
});

test('practice uses its fixed three questions and mixed review has four from each stage', () => {
  for (const practice of bundle.bank.practice) {
    const activity = bundle.activities.find((a) => a.activityCode === practice.activityCode);
    assert.deepEqual(new Set(selectLearningQuestions(content, activity.stageCode, 'practice', activity.activityCode, pick)), new Set(practice.questionCodes));
  }
  const codes = selectLearningQuestions(content, 'advanced', 'mixed-review', null, pick);
  for (const stage of ['beginner', 'intermediate', 'advanced']) assert.equal(codes.filter((code) => bundle.bank.questions.find((q) => q.questionCode === code).stageCode === stage).length, 4);
});

const rawAttempt = () => ({ contentVersion: 'learning-room-v1', stateVersion: '7', session: {}, activeAttemptUid: null, recentResults: [],
  attempt: { attempt_uid: randomUUID(), learner_uid: randomUUID(), created_by_device_id: 'private-owner', stage_code: 'beginner', mode: 'checkpoint',
    status: 'in_progress', content_version: 'learning-room-v1', cursor_position: 1, question_count: 2, answers: [],
    question_snapshot: bundle.bank.questions.slice(0, 2).map((q) => ({ ...q, questionUid: randomUUID(), sourceSnapshots: bundle.sources.filter((s) => q.sourceRefs.includes(s.sourceCode)) })) } });

test('unanswered quiz projection exposes one question and no private answers or future content', () => {
  const raw = rawAttempt();
  const result = projectLearningResponse(raw);
  assert.equal(result.quiz.feedback, null);
  assert.equal(result.quiz.question.questionUid, raw.attempt.question_snapshot[0].questionUid);
  assert.deepEqual(validateNoPrivateFields(result.quiz.question), []);
  for (const secret of ['private-owner', raw.attempt.learner_uid, raw.attempt.question_snapshot[1].questionUid]) assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(result.sources, []);
  assert.equal(projectLearningResponse(raw, { review: true }).questions.length, 0);
});

test('feedback and review reveal only submitted answers and their frozen source snapshots', () => {
  const raw = rawAttempt();
  const q = raw.attempt.question_snapshot[0];
  raw.attempt.answers.push({ question_instance_uid: q.questionUid, selected_option_id: q.options.find((o) => o.optionId !== q.correctOptionId).optionId, is_correct: false });
  raw.attempt.cursor_position = 2;
  const result = projectLearningResponse(raw, { questionUid: q.questionUid });
  assert.equal(result.quiz.feedback.correctOptionId, q.correctOptionId);
  assert.equal(result.quiz.feedback.isCorrect, false);
  assert.deepEqual(result.quiz.feedback.explanation, q.explanation);
  assert.equal(projectLearningResponse(raw).quiz.feedback, null);
  const review = projectLearningResponse(raw, { review: true, missedOnly: true });
  assert.equal(review.questions.length, 1);
  assert.deepEqual(review.sources, q.sourceSnapshots);
});

test('results use database grades and non-checkpoint modes cannot advertise an unlock', () => {
  const raw = rawAttempt();
  Object.assign(raw.attempt, { status: 'submitted', correct_count: 1, passed: false });
  assert.equal(projectLearningResponse(raw).result.passed, false);
  assert.equal(projectLearningResponse(raw).result.correctCount, 1);
  for (const mode of ['review', 'practice', 'mixed-review']) {
    Object.assign(raw.attempt, { mode, passed: true });
    assert.equal(projectLearningResponse(raw).result.nextStageCode, null);
  }
});

test('draft content is allowed only by both explicit flags on the development host', () => {
  const env = { NODE_ENV: 'development', LEARNING_ROOM_ALLOW_DRAFT: '1', LEARNING_ROOM_DRAFT_PROJECT_REF: 'thmbtsssvnslotoexntz', SUPABASE_URL: 'https://thmbtsssvnslotoexntz.supabase.co' };
  assert.equal(allowDraftLearning(env), true);
  for (const change of [{ NODE_ENV: 'production' }, { LEARNING_ROOM_ALLOW_DRAFT: '0' }, { LEARNING_ROOM_DRAFT_PROJECT_REF: '' }, { SUPABASE_URL: 'https://vcsujjaapchvcnndlhqb.supabase.co' }]) assert.equal(allowDraftLearning({ ...env, ...change }), false);
  assert.deepEqual(learningError({ message: 'private SQL table text' }), { code: 'learning_unavailable', status: 503 });
  assert.deepEqual(learningError({ message: 'answer_already_submitted' }), { code: 'answer_already_submitted', status: 409 });
});

test('HTTP boundary rejects client grades, missing authentication and malformed IDs before calling service', async (t) => {
  const calls = [];
  const service = new Proxy({}, { get: (_, action) => async (...args) => { calls.push({ action, args }); return { ok: true }; } });
  const app = express();
  app.use(express.json());
  // Arthur: NarIyirm
  // 中文：此替身只测试路由输入边界；真实凭证与跨设备权限另由开发库 HTTP 验证覆盖。
  // EN: This stub exercises route input boundaries only; development-database HTTP checks cover real credentials and cross-device access.
  app.use((req, _res, next) => { if (req.get('Test-Auth') === 'yes') { req.deviceId = 'trusted-device'; req.fridgeUid = randomUUID(); } next(); });
  app.use('/api', createLearningRouter(service));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/learning`;
  const send = (path, body, authenticated = true) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { 'Test-Auth': 'yes' } : {}) }, body: JSON.stringify(body) });
  const valid = { stageCode: 'beginner', mode: 'checkpoint', createKey: 'create_key_1' };
  assert.equal((await send('/attempts', valid, false)).status, 401);
  for (const extra of [{ passed: true }, { score: 100 }, { learnerUid: randomUUID() }, { deviceId: 'spoofed' }]) assert.equal((await send('/attempts', { ...valid, ...extra })).status, 400);
  assert.equal((await send('/attempts/not-a-uuid/finish', { requestKey: 'finish_key' })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await send('/attempts', valid)).status, 200);
  assert.equal(calls[0].args[0], 'trusted-device');
});
