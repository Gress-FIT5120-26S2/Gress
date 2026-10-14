import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const never = () => new Promise(() => {});

// Arthur: NarIyirm
// 中文：运行真实请求、授权、弹窗和相机组件，仅替换原生视图与外部 I/O，并模拟不会自行结束的网络。
// EN: Run real request, consent, modal and camera logic with native views/external I/O replaced, including networking that never settles itself.
class Timers {
  now = 0; next = 0; tasks = new Map();
  set = (callback, delay = 0) => { const id = ++this.next; this.tasks.set(id, { callback, at: this.now + delay }); return id; };
  clear = id => this.tasks.delete(id);
  async advance(ms) {
    const target = this.now + ms;
    for (;;) {
      const next = [...this.tasks].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.now = next[1].at; this.tasks.delete(next[0]); next[1].callback(); await tick();
    }
    this.now = target; await tick();
  }
}
const native = {
  Modal: 'NativeModal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', StatusBar: 'StatusBar',
  Keyboard: { dismiss() {} }, Platform: { OS: 'ios' },
  StyleSheet: { create: value => value, absoluteFill: {}, absoluteFillObject: {} },
};
function runtime(overrides = {}, globals = {}) {
  const timers = new Timers(); const cache = new Map();
  const dependencies = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    ...overrides,
  };
  const load = name => {
    const filename = resolve(root, name);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'fetch', 'process', '__DEV__', output)(specifier => {
      if (specifier in dependencies) return dependencies[specifier];
      assert.ok(specifier.startsWith('.'), `Missing mock: ${specifier}`);
      const base = resolve(dirname(filename), specifier);
      const extension = ['.ts', '.tsx'].find(ext => { try { readFileSync(base + ext); return true; } catch { return false; } });
      assert.ok(extension, `Missing source: ${base}`);
      return load(base + extension);
    }, module, module.exports, timers.set, timers.clear, globals.fetch ?? never, { env: { EXPO_PUBLIC_API_URL: 'https://test.invalid' } }, false);
    return module.exports;
  };
  return { load, timers };
}
const identity = { './deviceId': { getDeviceId: async () => 'test-device', getDeviceCredential: async () => 'test-credential' } };
const response = body => ({ ok: true, status: 200, json: async () => body });

await test('Stalled transport times out, aborts native fetch and releases activity without retrying a write', async () => {
  let calls = 0, signal;
  const run = runtime(identity, { fetch: async (_url, init) => { calls++; signal = init.signal; return never(); } });
  const api = run.load('src/services/apiClient.ts'); const activity = [];
  api.subscribeToApiActivity(count => activity.push(count));
  const pending = api.requestApi('/api/cart', { method: 'POST', body: '{}' });
  const rejected = assert.rejects(pending, error => error.code === 'request_timeout');
  await tick(); await run.timers.advance(30_000); await rejected;
  assert.equal(calls, 1); assert.equal(signal.aborted, true); assert.deepEqual(activity, [0, 1, 0]);
  assert.equal(run.timers.tasks.size, 0);
});
await test('Credential lookup and response-body stalls share the same deadline', async () => {
  for (const credentials of [true, false]) {
    const run = runtime(credentials ? { './deviceId': { getDeviceId: never, getDeviceCredential: never } } : identity,
      { fetch: async () => ({ ok: true, status: 200, json: never }) });
    const api = run.load('src/services/apiClient.ts');
    const rejected = assert.rejects(api.requestApi('/api/inventory'), error => error.code === 'request_timeout');
    await tick(); await run.timers.advance(30_000); await rejected; assert.equal(run.timers.tasks.size, 0);
  }
});
await test('Caller cancellation settles immediately even when fetch ignores abort and does not become a network error', async () => {
  const run = runtime(identity); const api = run.load('src/services/apiClient.ts');
  const controller = new AbortController(); const activity = [];
  api.subscribeToApiActivity(count => activity.push(count));
  const rejected = assert.rejects(api.requestApi('/api/barcode-products/123', { signal: controller.signal }), { name: 'AbortError' });
  await tick(); controller.abort(); await rejected;
  assert.deepEqual(activity, [0, 1, 0]); assert.equal(run.timers.tasks.size, 0);
});
await test('Already canceled AI work cannot open consent or send a request', async () => {
  let calls = 0;
  const run = runtime(identity, { fetch: async () => { calls++; return response({}); } });
  const bridge = run.load('src/services/aiConsentBridge.ts'); let prompts = 0;
  bridge.registerAiConsentHandler(async () => { prompts++; return true; });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(run.load('src/services/apiClient.ts').requestApi('/api/food-presets/generate', { method: 'POST', signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0); assert.equal(prompts, 0);
});

async function modalTest(check) {
  const run = runtime(); const components = run.load('src/components/RetainedTab.tsx');
  let renderer;
  await act(async () => { renderer = create(React.createElement(components.AppModal, { visible: true, testID: 'old' })); });
  await act(async () => { await run.timers.advance(0); });
  try { await check({ ...run, ...components, renderer }); }
  finally { await act(async () => { renderer.unmount(); }); await act(async () => { await run.timers.advance(1000); }); }
}
await test('iOS sibling modal waits for dismissal; canceling a queued presentation cannot resurrect it', async () => {
  await modalTest(async ({ AppModal, renderer, timers }) => {
    const tree = (old, next) => React.createElement(React.Fragment, null,
      React.createElement(AppModal, { visible: old, testID: 'old' }), React.createElement(AppModal, { visible: next, testID: 'next' }));
    await act(async () => { renderer.update(tree(true, false)); });
    await act(async () => { await timers.advance(0); });
    const byId = id => renderer.root.findAllByType('NativeModal').find(modal => modal.props.testID === id);
    await act(async () => { renderer.update(tree(false, true)); });
    await act(async () => { await timers.advance(20); });
    assert.equal(byId('old').props.visible, false); assert.equal(byId('next').props.visible, false);
    await act(async () => { renderer.update(tree(false, false)); byId('old').props.onDismiss(); });
    await act(async () => { await timers.advance(1000); });
    assert.equal(byId('next').props.visible, false);
    await act(async () => { renderer.update(tree(false, true)); });
    await act(async () => { await timers.advance(0); });
    assert.equal(byId('next').props.visible, true);
  });
});
await test('Conditional modal teardown has a bounded handoff when native onDismiss is lost', async () => {
  await modalTest(async ({ AppModal, renderer, timers }) => {
    await act(async () => { renderer.update(React.createElement(AppModal, { key: 'new', visible: true })); });
    await act(async () => { await timers.advance(500); });
    assert.equal(renderer.root.findByType('NativeModal').props.visible, false);
    await act(async () => { await timers.advance(500); });
    assert.equal(renderer.root.findByType('NativeModal').props.visible, true);
  });
});

function consentRuntime(fetch = async () => response({ allowed: false, updatedAt: null })) {
  return runtime({ ...identity, './RetainedTab': { AppModal: 'ConsentModal' },
    '../i18n': { useI18n: () => ({ language: 'en' }) },
    '../privacyCopy': { privacyCopy: () => ({}), privacyUrl: () => 'https://test.invalid/privacy' },
  }, { fetch });
}
await test('Concurrent consent callers cancel independently; the last cancellation closes the global prompt', async () => {
  const run = consentRuntime(); const Provider = run.load('src/components/PrivacyConsentProvider.tsx').PrivacyConsentProvider;
  const bridge = run.load('src/services/aiConsentBridge.ts'); let renderer;
  await act(async () => { renderer = create(React.createElement(Provider)); });
  const first = new AbortController(), second = new AbortController(); let a, b;
  await act(async () => { a = bridge.askAiConsent(false, first.signal); b = bridge.askAiConsent(false, second.signal); await tick(); });
  const aRejected = assert.rejects(a, { name: 'AbortError' }), bRejected = assert.rejects(b, { name: 'AbortError' });
  assert.equal(renderer.root.findByType('ConsentModal').props.visible, true);
  await act(async () => { first.abort(); await aRejected; });
  assert.equal(renderer.root.findByType('ConsentModal').props.visible, true);
  await act(async () => { second.abort(); await bRejected; });
  assert.equal(renderer.root.findByType('ConsentModal').props.visible, false);
  await act(async () => { renderer.unmount(); });
});
await test('Leaving while consent state is still loading cannot show a late global prompt', async () => {
  const read = deferred(); const run = consentRuntime(() => read.promise);
  const Provider = run.load('src/components/PrivacyConsentProvider.tsx').PrivacyConsentProvider;
  const bridge = run.load('src/services/aiConsentBridge.ts'); let renderer;
  await act(async () => { renderer = create(React.createElement(Provider)); });
  const controller = new AbortController(); let pending;
  await act(async () => { pending = bridge.askAiConsent(false, controller.signal); });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await act(async () => { controller.abort(); await rejected; read.resolve(response({ allowed: false, updatedAt: null })); await tick(); });
  assert.equal(renderer.root.findByType('ConsentModal').props.visible, false);
  assert.equal(run.timers.tasks.size, 0);
  await act(async () => { renderer.unmount(); });
});

const dictionarySource = ts.createSourceFile('i18n.tsx', readFileSync(resolve(root, 'src/i18n.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const english = dictionarySource.statements.find(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(dictionarySource) === 'en'));
const dictionary = { exports: {} };
new Function('module', ts.transpileModule(`const learningCopy={en:{}}; const learningTutorCopy={en:{}}; ${english.getText(dictionarySource)}; module.exports=en;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(dictionary);
const t = dictionary.exports;
async function cameraTest(check) {
  const lookups = []; let active = true;
  const run = runtime({
    '../RetainedTab': { TabModal: 'CameraModal', useTabActive: () => active },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-image': { Image: 'Image' },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, async () => ({ granted: true })] },
    'expo-image-manipulator': { ImageManipulator: {}, SaveFormat: {} }, 'expo-image-picker': {},
    '../../i18n': { useI18n: () => ({ t }) }, '../../services/apiClient': { getApiErrorCode: () => null },
    '../../services/recognitionApi': {}, '../../services/barcodeApi': { lookupBarcodeProduct: (_code, signal) => { const lookup = deferred(); lookups.push({ ...lookup, signal }); return lookup.promise; } },
  });
  const Camera = run.load('src/components/inventory-entry/PhotoRecognitionCamera.tsx').PhotoRecognitionCamera;
  let renderer, results = 0, closed = 0;
  const props = { visible: true, barcodeEnabled: true, onBarcodeProduct: async () => { results++; }, onRecognised() {}, onManualFallback() {}, onClose: () => { closed++; } };
  const tree = visible => React.createElement(Camera, { ...props, visible });
  await act(async () => { renderer = create(tree(true)); });
  const scan = async () => {
    const button = renderer.root.findAllByType('Pressable').find(node => node.findAllByType('Text').some(text => text.children.join('') === t.fridge.photoRecognition.barcodeMode));
    assert.ok(button, 'Barcode mode button');
    await act(async () => { button.props.onPress(); });
    await act(async () => { void renderer.root.findByType('CameraView').props.onBarcodeScanned({ data: '0123456789012' }); });
  };
  try { await check({ renderer, lookups, tree, scan, count: () => results, closed: () => closed, deactivate: () => { active = false; } }); }
  finally { await act(async () => { renderer.unmount(); }); }
}
await test('iPhone barcode cancel aborts lookup immediately and ignores a result arriving after returning', async () => {
  await cameraTest(async ({ renderer, lookups, scan, tree, count, closed }) => {
    await scan();
    await act(async () => { renderer.root.findByType('CameraModal').props.onRequestClose(); });
    assert.equal(closed(), 1); assert.equal(lookups[0].signal.aborted, true);
    await act(async () => { renderer.update(tree(false)); });
    assert.equal(renderer.root.findAllByType('CameraView').length, 0);
    await act(async () => { lookups[0].resolve({ found: true, product: { name: 'Milk' } }); });
    assert.equal(count(), 0);
    await act(async () => { renderer.update(tree(true)); });
    await scan();
    await act(async () => { lookups[1].resolve({ found: true, product: { name: 'Eggs' } }); });
    assert.equal(count(), 1);
  });
});
await test('Hidden retained camera cancels lookup and a late result cannot advance shopping', async () => {
  await cameraTest(async ({ renderer, lookups, scan, tree, count, deactivate }) => {
    await scan(); deactivate();
    await act(async () => { renderer.update(tree(true)); });
    assert.equal(lookups[0].signal.aborted, true);
    assert.equal(renderer.root.findAllByType('CameraView').length, 0);
    await act(async () => { lookups[0].resolve({ found: true, product: { name: 'Milk' } }); });
    assert.equal(count(), 0);
  });
});

await test('Canceling barcode enrichment cannot reopen the shopping review after the camera has closed', async () => {
  const preset = deferred(), generated = deferred(); let usedSignal;
  const run = runtime({
    '../AddItemMethodSheet': { AddItemMethodSheet: 'MethodSheet' },
    '../inventory-entry/PhotoRecognitionCamera': { PhotoRecognitionCamera: 'Camera' },
    '../inventory-entry/BarcodeResultReview': { BarcodeResultReview: 'Review', buildBarcodeInitialValues: () => ({ name: 'Milk' }) },
    './ShoppingManualEntry': { ShoppingManualEntry: 'Manual' },
    '../../i18n': { useI18n: () => ({ t }) },
    '../../services/inventoryApi': {
      getFoodPresetSuggestion: (_name, signal) => { usedSignal = signal; return preset.promise; },
      generateFoodPreset: () => generated.promise,
    },
  });
  const Sheet = run.load('src/components/shopping/ShoppingAddSheet.tsx').ShoppingAddSheet;
  let renderer;
  await act(async () => { renderer = create(React.createElement(Sheet, { visible: false, onAdd() {}, onClose() {}, inventoryNames: new Set(), inventoryByName: new Map() })); });
  const controller = new AbortController(); let pending;
  await act(async () => { pending = renderer.root.findByType('Camera').props.onBarcodeProduct({ name: 'Milk' }, controller.signal); });
  assert.equal(usedSignal, controller.signal);
  await act(async () => { preset.resolve({ suggestion: null }); await tick(); controller.abort(); generated.resolve({ suggestion: {}, generated: true }); await pending; });
  assert.equal(renderer.root.findByType('Review').props.visible, false);
  await act(async () => { renderer.unmount(); });
});

await test('Interrupted picker exit releases its invisible modal and hands off once despite parent rerenders', async () => {
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    stopAnimation(callback) { callback?.(this.value); }
    interpolate() { return this.value; }
  }
  const animation = (value, options) => ({ start() { value.setValue(options.toValue); } });
  const run = runtime({
    './RetainedTab': { TabModal: 'PickerModal' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native': { ...native, Animated: { Value, View: 'AnimatedView', timing: animation, spring: animation, parallel: () => ({ start(callback) { callback?.({ finished: false }); } }) },
      Easing: { bezier() {} }, PanResponder: { create: () => ({ panHandlers: {} }) },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
      useWindowDimensions: () => ({ height: 844, width: 390 }),
    },
  });
  const previousFrame = globalThis.requestAnimationFrame, previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = callback => run.timers.set(callback, 0);
  globalThis.cancelAnimationFrame = run.timers.clear;
  const Picker = run.load('src/components/AddItemMethodSheet.tsx').AddItemMethodSheet;
  const selections = []; const copy = { manualA11y: 'manual', cameraA11y: 'camera' };
  const tree = visible => React.createElement(Picker, { visible, copy, onClose() {}, onSelect: value => selections.push(value) });
  let renderer;
  try {
    await act(async () => { renderer = create(tree(true)); });
    await act(async () => { await run.timers.advance(0); });
    await act(async () => { renderer.root.findAllByType('Pressable').find(button => button.props.accessibilityLabel === 'camera').props.onPress(); renderer.update(tree(false)); });
    await act(async () => { await run.timers.advance(100); renderer.update(tree(false)); });
    await act(async () => { await run.timers.advance(220); });
    assert.equal(renderer.root.findAllByType('PickerModal').length, 0);
    assert.deepEqual(selections, ['camera']);
  } finally {
    if (renderer) await act(async () => { renderer.unmount(); });
    globalThis.requestAnimationFrame = previousFrame; globalThis.cancelAnimationFrame = previousCancel;
  }
});
