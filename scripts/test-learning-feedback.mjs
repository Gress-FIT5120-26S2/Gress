import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const noop = () => {};
let calls = [], frames = new Map(), frameId = 0, reduceMotion = false, language = 'en';
globalThis.requestAnimationFrame = callback => { const id = ++frameId; frames.set(id, callback); return id; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
function flushFrames() { const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback()); }
class Value { setValue() {} stopAnimation() {} interpolate() { return 1; } getTranslateTransform() { return []; } }
const native = {
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Platform: { OS: 'ios' }, Linking: { openURL: noop }, PanResponder: { create: handlers => ({ panHandlers: handlers }) },
  Animated: { Value, ValueXY: Value, View: 'AnimatedView', timing: () => ({ start: noop }), spring: () => ({ start: noop }) },
  StyleSheet: { create: value => value, hairlineWidth: 1 },
  AccessibilityInfo: { isReduceMotionEnabled: async () => reduceMotion, addEventListener: () => ({ remove: noop }) },
};
const bottomSafeArea = React.createContext(true), tutorSlot = React.createContext(null);
let copy;
async function load(path, extra = {}) {
  const input = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(input, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const dependencies = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, 'expo-image': { Image: 'Image' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../../i18n': { useI18n: () => ({ language, t: { learning: copy[language] } }) },
    './learningAssets': { learningAssets: {}, getLearningImageSource: noop, learningSdgAttribution: {} },
    './learningViewport': { useLearningViewport: () => ({ width: 390, height: 844 }), LearningBottomSafeAreaContext: bottomSafeArea },
    './tutor/LearningTutorSlot': { LearningTutorSlot: tutorSlot },
    '../fridge/WasteSortingInteraction': { WasteSortingInteraction: 'WasteSortingInteraction' }, ...extra,
  };
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
copy = (await load('src/i18n/learning.ts')).learningCopy;
const theme = await load('src/components/learning/learningTheme.ts');
const focus = await load('src/components/learning/useLearningFeedbackFocus.ts');
const ui = await load('src/components/learning/LearningUi.tsx', { './learningTheme': theme });
const dependencies = { './LearningUi': ui, './learningTheme': theme, './useLearningFeedbackFocus': focus };
const { LearningQuizScreen } = await load('src/components/learning/LearningQuizScreen.tsx', dependencies);
const { LearningPracticeScreen } = await load('src/components/learning/LearningPracticeScreen.tsx', { ...dependencies, './LearningQuizScreen': { LearningQuizScreen } });
const text = value => ({ en: value, zh: `中文 ${value}` });
const question = (id = 'q1', sorting = false) => ({ questionUid: id, prompt: text('Which action?'),
  options: (sorting ? ['organics', 'recycling', 'general'] : ['a', 'b', 'c']).map(optionId => ({ optionId, label: text(optionId) })),
  imageAssetKey: null, serviceAssumptions: text('Service assumptions'), regionCode: 'AU-VIC' });
const quiz = (mode = 'checkpoint', sorting = false) => ({ attemptUid: 'attempt', stageCode: 'beginner', mode, questionNumber: 1, questionCount: 3, question: question('q1', sorting), feedback: null });
const feedback = (isCorrect, sorting = false) => ({ isCorrect, selectedOptionId: sorting ? 'organics' : 'a', correctOptionId: sorting ? 'recycling' : 'b', explanation: text('An explanation with sources'), sourceRefs: [] });
const base = { stageTitle: text('Beginner'), selectedOptionId: 'a', sources: [], busy: false, error: null, selectionLocked: false,
  onSelect: noop, onSubmit: noop, onNext: noop, onBack: noop, onClose: noop, onAnswer: noop };
async function mount(Component, props) {
  calls = []; frames.clear();
  let renderer;
  await act(async () => { renderer = create(React.createElement(Component, props), {
    createNodeMock: element => element.type === 'ScrollView' ? { scrollTo: options => calls.push(options) } : null,
  }); });
  return renderer;
}
async function update(renderer, Component, props) { await act(async () => { renderer.update(React.createElement(Component, props)); }); }
async function dispose(renderer) { await act(async () => { renderer.unmount(); }); }
function layout(renderer, y = 880) {
  renderer.root.findByProps({ testID: 'learning-answer-feedback' }).props.onLayout({ nativeEvent: { layout: { y, height: 180, width: 342, x: 24 } } });
}
function contentSize(renderer) { renderer.root.findByType('ScrollView').props.onContentSizeChange(390, 1200); }

// Arthur: NarIyirm
// 中文：执行真实页面、滚动容器和定位 hook，只替换原生布局事件与滚动命令；核对正确/错误反馈出现到滚动的完整路径，不访问评分服务。
// EN: Run the real screens, scroll container and focus hook with native layout events and scroll commands replaced; verify the full correct/incorrect feedback-to-scroll path without contacting grading services.
for (const mode of ['checkpoint', 'review', 'mixed-review', 'practice']) {
  for (const isCorrect of [true, false]) {
    await test(`${mode} ${isCorrect ? 'correct' : 'incorrect'} feedback scrolls into view once after layout`, async () => {
      const initial = { ...base, quiz: quiz(mode) };
      const renderer = await mount(LearningQuizScreen, initial);
      try {
        assert.equal(calls.length, 0);
        await update(renderer, LearningQuizScreen, { ...initial, quiz: { ...initial.quiz, feedback: feedback(isCorrect) } });
        assert.equal(calls.length, 0, 'Do not scroll before feedback has layout');
        layout(renderer); contentSize(renderer);
        assert.equal(calls.length, 0, 'Wait for content size to commit');
        flushFrames();
        assert.equal(calls.length, 1);
        assert.ok(calls[0].y > 0 && calls[0].y < 880);
        assert.equal(calls[0].animated, true);
        await update(renderer, LearningQuizScreen, { ...initial, quiz: { ...initial.quiz, feedback: feedback(isCorrect) } });
        layout(renderer, 900); contentSize(renderer); flushFrames();
        assert.equal(calls.length, 1, 'A refresh must not steal the user scroll position');
      } finally { await dispose(renderer); }
    });
  }
}
for (const sorting of [true, false]) {
  for (const isCorrect of [true, false]) {
    await test(`Practice ${sorting ? 'sorting interaction' : 'fallback options'} reveals ${isCorrect ? 'correct' : 'incorrect'} feedback`, async () => {
      const initial = { ...base, quiz: quiz('practice', sorting) };
      const renderer = await mount(LearningPracticeScreen, initial);
      try {
        await update(renderer, LearningPracticeScreen, { ...initial, quiz: { ...initial.quiz, feedback: feedback(isCorrect, sorting) } });
        layout(renderer); contentSize(renderer); flushFrames();
        assert.equal(calls.length, 1);
        assert.ok(calls[0].y > 0);
      } finally { await dispose(renderer); }
    });
  }
}
await test('Pending or failed answers do not scroll before actual feedback arrives', async () => {
  const initial = { ...base, quiz: quiz(), busy: true, selectionLocked: true };
  const renderer = await mount(LearningQuizScreen, initial);
  try {
    contentSize(renderer); flushFrames();
    await update(renderer, LearningQuizScreen, { ...initial, busy: false, error: 'Retry submission' });
    contentSize(renderer); flushFrames();
    assert.equal(calls.length, 0);
    assert.equal(renderer.root.findAllByProps({ testID: 'learning-answer-feedback' }).length, 0);
  } finally { await dispose(renderer); }
});
await test('Next question discards queued old feedback and can reveal its own answer', async () => {
  const first = { ...base, quiz: { ...quiz(), feedback: feedback(false) } };
  const renderer = await mount(LearningQuizScreen, first);
  try {
    layout(renderer);
    const next = { ...base, quiz: { ...quiz(), question: question('q2'), questionNumber: 2 } };
    await update(renderer, LearningQuizScreen, next); flushFrames();
    assert.equal(calls.length, 0);
    await update(renderer, LearningQuizScreen, { ...next, quiz: { ...next.quiz, feedback: feedback(true) } });
    contentSize(renderer); flushFrames();
    assert.equal(calls.length, 0, 'Never reuse the previous question position');
    layout(renderer, 460); flushFrames();
    assert.equal(calls.length, 1); assert.ok(calls[0].y < 460);
  } finally { await dispose(renderer); }
});
await test('Leaving before layout commits cancels the pending scroll', async () => {
  const renderer = await mount(LearningQuizScreen, { ...base, quiz: { ...quiz(), feedback: feedback(true) } });
  layout(renderer); await dispose(renderer); flushFrames();
  assert.equal(calls.length, 0); assert.equal(frames.size, 0);
});
await test('Reduced motion in Chinese reveals feedback without scrolling animation', async () => {
  reduceMotion = true; language = 'zh';
  const renderer = await mount(LearningQuizScreen, { ...base, quiz: { ...quiz(), feedback: feedback(false) } });
  try {
    layout(renderer, 8); flushFrames();
    assert.deepEqual(calls, [{ y: 0, animated: false }]);
  } finally { await dispose(renderer); reduceMotion = false; language = 'en'; }
});
await test('Read-only missed-answer review preserves its initial question position', async () => {
  const renderer = await mount(LearningQuizScreen, { ...base, reviewing: true, quiz: { ...quiz(), feedback: feedback(false) } });
  try { layout(renderer); contentSize(renderer); flushFrames(); assert.equal(calls.length, 0); }
  finally { await dispose(renderer); }
});
