import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

// Arthur: NarIyirm
// 中文：离线测试编译纯导航、手势回调与开发适配器，检查真实触摸起点／返回历史及复习隔离，不模拟权威判分。
// EN: Offline tests compile navigation, gesture callbacks and the development adapter, checking actual touch origins, history and review isolation without simulating authoritative grading.
const tempRoot = os.tmpdir();
const testDir = await mkdtemp(path.join(tempRoot, 'kitchmemo-learning-ui-'));
try {
  for (const [source, target] of [
    ['src/components/learning/learningNavigation.ts', 'learningNavigation.mjs'],
    ['src/components/learning/learningBackGesture.ts', 'learningBackGesture.mjs'],
    ['src/components/learning/dev/learningPreviewContent.ts', 'learningPreviewContent.mjs'],
    ['src/components/learning/dev/learningFixtures.ts', 'learningFixtures.mjs'],
  ]) {
    const input = (await readFile(new URL(`../${source}`, import.meta.url), 'utf8'))
      .replace("from './learningPreviewContent'", "from './learningPreviewContent.mjs'");
    const { outputText } = ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    await writeFile(path.join(testDir, target), outputText);
  }
  const { learningNavigationReducer: reduce } = await import(pathToFileURL(path.join(testDir, 'learningNavigation.mjs')).href);
  const { createLearningBackGesture } = await import(pathToFileURL(path.join(testDir, 'learningBackGesture.mjs')).href);
  const { createLearningPreview } = await import(pathToFileURL(path.join(testDir, 'learningFixtures.mjs')).href);
  const hub = { name: 'hub', segment: 'library' };
  const resource = { name: 'resource', resourceCode: 'waste-climate-sdg13' };

  // Arthur: NarIyirm
  // 中文：复现 RN 在 grant 前 x0=0 的状态，按开始／捕获／授权／释放顺序验证，不把鼠标预览当成原生验收。
  // EN: Reproduce RN's pre-grant x0=0 and exercise start/capture/grant/release order without treating mouse previews as native verification.
  const touch = (...positions) => ({ nativeEvent: { touches: positions.map(pageX => ({ pageX })) } });
  const drag = (dx = 100, dy = 0, numberActiveTouches = 1) => ({ x0: 0, y0: 0, dx, dy, numberActiveTouches });
  const setupGesture = (initialEnabled = true) => {
    let enabled = initialEnabled; let backs = 0;
    const callbacks = createLearningBackGesture({ isEnabled: () => enabled, onBack: () => { backs += 1; } });
    return { callbacks, backs: () => backs, enable: value => { enabled = value; } };
  };
  await test('Library root swipes never return to a different primary tab, even from the edge', () => {
    const { callbacks: g, backs } = setupGesture(false);
    for (const x of [12, 180]) {
      g.onStartShouldSetPanResponderCapture(touch(x), drag(0));
      assert.equal(g.onMoveShouldSetPanResponderCapture(touch(x + 100), drag()), false);
      g.onPanResponderGrant(touch(x + 100), drag());
      g.onPanResponderRelease(touch(), drag());
    }
    assert.equal(backs(), 0);
  });
  await test('Pre-grant x0=0 cannot turn a central horizontal scroll into edge Back', () => {
    const { callbacks: g, backs } = setupGesture();
    g.onStartShouldSetPanResponderCapture(touch(180), drag(0));
    assert.equal(g.onMoveShouldSetPanResponderCapture(touch(280), drag()), false);
    g.onPanResponderGrant(touch(280), drag());
    g.onPanResponderRelease(touch(), drag());
    assert.equal(backs(), 0);
  });
  await test('A real single-finger left-edge swipe returns once after ownership', () => {
    const { callbacks: g, backs } = setupGesture();
    assert.equal(g.onStartShouldSetPanResponderCapture(touch(12), drag(0)), false);
    assert.equal(g.onMoveShouldSetPanResponderCapture(touch(34), drag(22)), true);
    g.onPanResponderGrant(touch(34), drag(0));
    g.onPanResponderRelease(touch(), drag(90));
    g.onPanResponderRelease(touch(), drag(90));
    assert.equal(backs(), 1);
  });
  await test('Leftward, vertical and short edge gestures cannot return', () => {
    const { callbacks: g, backs } = setupGesture();
    for (const movement of [drag(-100), drag(10), drag(25, 40)]) {
      g.onStartShouldSetPanResponderCapture(touch(12), drag(0));
      assert.equal(g.onMoveShouldSetPanResponderCapture(touch(12), movement), false);
    }
    g.onStartShouldSetPanResponderCapture(touch(12), drag(0));
    g.onPanResponderGrant(touch(34), drag(0));
    g.onPanResponderRelease(touch(), drag(40));
    assert.equal(backs(), 0);
  });
  await test('Cancellation and an extra finger invalidate an owned edge gesture', () => {
    const { callbacks: g, backs } = setupGesture();
    g.onStartShouldSetPanResponderCapture(touch(12), drag(0));
    g.onPanResponderGrant(touch(34), drag(0));
    g.onPanResponderTerminate(touch(), drag());
    g.onPanResponderRelease(touch(), drag());
    g.onStartShouldSetPanResponderCapture(touch(12), drag(0));
    g.onPanResponderGrant(touch(34), drag(0));
    g.onPanResponderStart(touch(34, 120), drag(0, 0, 2));
    assert.equal(g.onMoveShouldSetPanResponderCapture(touch(140), drag()), false);
    g.onPanResponderRelease(touch(), drag());
    assert.equal(backs(), 0);
  });
  await test('Changing the route or opening video before release suppresses stale Back', () => {
    const { callbacks: g, backs, enable } = setupGesture();
    g.onStartShouldSetPanResponderCapture(touch(12), drag(0));
    g.onPanResponderGrant(touch(34), drag(0));
    enable(false);
    g.onPanResponderRelease(touch(), drag());
    assert.equal(backs(), 0);
  });

  await test('Back returns to the originating hub segment without mutating history', () => {
    const history = [hub, resource];
    assert.deepEqual(reduce(history, { type: 'back' }), [hub]);
    assert.deepEqual(history, [hub, resource]);
    const root = [hub];
    assert.equal(reduce(root, { type: 'back' }), root);
  });
  await test('Answer replacement adds no extra Back step', () => {
    const quiz = { name: 'quiz', selectedOptionId: null };
    const history = reduce([hub], { type: 'push', route: quiz });
    const answered = reduce(history, { type: 'replace', route: { ...quiz, selectedOptionId: 'recycling' } });
    assert.equal(answered.length, 2);
    assert.deepEqual(reduce(answered, { type: 'back' }), [hub]);
    assert.equal(history[1].selectedOptionId, null);
  });
  await test('News navigation resets nested history to the filtered library', () => {
    const news = { name: 'hub', segment: 'library', libraryCategory: 'news' };
    assert.deepEqual(reduce([hub, resource], { type: 'hub', route: news }), [news]);
  });
  await test('A new-user fixture starts at zero lessons and locks later checkpoints', async () => {
    const { gateway } = createLearningPreview('new-user');
    const { session } = await gateway.load();
    assert.equal(session.completedActivityCodes.length, 0);
    await assert.rejects(gateway.startQuiz('intermediate', 'checkpoint'), /locked/);
    const view = await gateway.startQuiz('intermediate', 'review');
    assert.equal(view.questionCount, 8);
    const result = await gateway.finishQuiz(view.attemptUid);
    assert.deepEqual(result.session, session);
    assert.equal(result.nextStageCode, null);
  });
  await test('Preview feedback freezes the first answer; retry keeps it unanswered', async () => {
    const { gateway } = createLearningPreview('answer-error');
    const view = await gateway.resumeQuiz('ui-preview-attempt');
    await assert.rejects(gateway.submitAnswer(view.attemptUid, view.question.questionUid, 'general'));
    assert.equal((await gateway.resumeQuiz(view.attemptUid)).feedback, null);
    const wrong = await gateway.submitAnswer(view.attemptUid, view.question.questionUid, 'general');
    const repeat = await gateway.submitAnswer(view.attemptUid, view.question.questionUid, 'recycling');
    assert.equal(wrong.feedback.isCorrect, false);
    assert.deepEqual(repeat.feedback, wrong.feedback);
  });
  await test('Failed fixed response does not unlock the next stage', async () => {
    const { gateway } = createLearningPreview('failed');
    const before = (await gateway.load()).session;
    const view = await gateway.startQuiz('beginner', 'checkpoint');
    const result = await gateway.finishQuiz(view.attemptUid);
    assert.equal(result.passed, false);
    assert.equal(result.correctCount, 4);
    assert.equal(result.nextStageCode, null);
    assert.deepEqual(result.session, before);
  });
  await test('Advanced mixed review preserves permanent completion', async () => {
    const { gateway } = createLearningPreview('complete');
    const before = (await gateway.load()).session;
    const view = await gateway.startQuiz('advanced', 'mixed-review');
    assert.equal(view.questionCount, 12);
    const result = await gateway.finishQuiz(view.attemptUid);
    assert.equal(result.mode, 'mixed-review');
    assert.equal(result.nextStageCode, null);
    assert.deepEqual(result.session, before);
  });
  await test('Reading and lessons never change stage eligibility', async () => {
    const { gateway } = createLearningPreview('new-user');
    const before = (await gateway.load()).session.stageStatus;
    await gateway.markActivity('beginner-why-waste');
    await gateway.markResource('waste-climate-sdg13');
    await gateway.markResource('waste-climate-sdg13');
    const after = (await gateway.load()).session;
    assert.deepEqual(after.stageStatus, before);
    assert.equal(after.readResourceCodes.length, 1);
  });
} finally {
  if (path.dirname(testDir) !== path.resolve(tempRoot) || !path.basename(testDir).startsWith('kitchmemo-learning-ui-')) throw new Error('Unexpected test directory');
  await rm(testDir, { recursive: true, force: true });
}
