import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/components/RetainedTab.tsx', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
const dismissalModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(await readFile(new URL('../src/components/modalDismissal.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(dismissalModule, dismissalModule.exports);
// Arthur: NarIyirm
// 中文：运行真实弹窗包装与 Tab 门控，只替换原生视图；验证独立安全区容器而非模拟 iPhone 测量。
// EN: Run the real modal wrapper and tab gate with native views replaced; verify the separate safe-area root without pretending to measure an iPhone.
const dependencies = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  'react-native': { Modal: 'NativeModal', View: 'View', Keyboard: { dismiss() {} }, Platform: { OS: 'ios' }, StyleSheet: { create: value => value, absoluteFill: {} } },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider' },
  './modalDismissal': dismissalModule.exports,
};
new Function('require', 'module', 'exports', output)(name => {
  assert.ok(name in dependencies, `Unexpected dependency ${name}`);
  return dependencies[name];
}, module, module.exports);
const { AppModal, TabModal, RetainedTab } = module.exports;
async function render(element, check) {
  let renderer;
  await act(async () => { renderer = create(element); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  try { await check(renderer); } finally {
    const dismiss = renderer.root.findAllByType('NativeModal').map(modal => modal.props.onDismiss);
    await act(async () => { renderer.unmount(); });
    await act(async () => { dismiss.forEach(callback => callback?.()); });
  }
}

await test('Every native modal measures its own safe area without reusing window metrics or adding padding', async () => {
  const onRequestClose = () => {};
  await render(React.createElement(AppModal, { visible: true, transparent: true, onRequestClose, presentationStyle: 'overFullScreen' }, React.createElement('Content')), renderer => {
    const modal = renderer.root.findByType('NativeModal');
    assert.equal(modal.props.onRequestClose, onRequestClose);
    assert.equal(modal.props.transparent, true);
    assert.equal(modal.props.presentationStyle, 'overFullScreen');
    const provider = modal.findByType('SafeAreaProvider');
    assert.equal(provider.props.initialMetrics, undefined);
    assert.equal(provider.props.style, undefined);
    assert.equal(provider.findByType('Content').parent, provider);
  });
});

await test('Tab modals remain hidden on inactive retained pages and reopen with their content preserved', async () => {
  let mounts = 0;
  function Content() { React.useEffect(() => { mounts++; }, []); return React.createElement('Content'); }
  const tree = active => React.createElement(RetainedTab, { active, preload: true }, React.createElement(TabModal, { visible: true }, React.createElement(Content)));
  await render(tree(true), async renderer => {
    const child = renderer.root.findByType('Content');
    assert.equal(renderer.root.findByType('NativeModal').props.visible, true);
    await act(async () => { renderer.update(tree(false)); });
    assert.equal(renderer.root.findByType('NativeModal').props.visible, false);
    await act(async () => { renderer.root.findByType('NativeModal').props.onDismiss(); });
    await act(async () => { renderer.update(tree(true)); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(renderer.root.findByType('NativeModal').props.visible, true);
    assert.equal(renderer.root.findByType('Content'), child);
    assert.equal(mounts, 1);
  });
});

await test('Global modals keep their requested visibility independently of retained tab state', async () => {
  await render(React.createElement(RetainedTab, { active: false, preload: true }, React.createElement(AppModal, { visible: true })), renderer => {
    assert.equal(renderer.root.findByType('NativeModal').props.visible, true);
  });
});

await test('Expanded profile sheets stay below the cutout even during a strong upward drag', async () => {
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    stopAnimation(callback) { callback?.(this.value); }
    interpolate({ inputRange, outputRange, extrapolate, extrapolateLeft }) {
      return { read: () => {
        const value = this.value;
        if (value < inputRange[0] && (extrapolateLeft ?? extrapolate) === 'clamp') return outputRange[0];
        let index = inputRange.findIndex((point, i) => i > 0 && value <= point) - 1;
        if (index < 0) index = value < inputRange[0] ? 0 : inputRange.length - 2;
        return outputRange[index] + (value - inputRange[index]) / (inputRange[index + 1] - inputRange[index]) * (outputRange[index + 1] - outputRange[index]);
      } };
    }
  }
  const animate = (value, options) => ({ start(callback) { value.setValue(options.toValue); callback?.({ finished: true }); } });
  let top = 59;
  globalThis.requestAnimationFrame = callback => { callback(); return 1; };
  globalThis.cancelAnimationFrame = () => {};
  const sheetDependencies = {
    ...dependencies,
    './RetainedTab': { TabModal }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '../i18n': { useI18n: () => ({ t: { settings: { close: 'Close' }, fridge: { addItem: { dragHint: 'Drag' } } } }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top, bottom: 34, left: 0, right: 0 }) },
    'react-native': { ...dependencies['react-native'], Text: 'Text', Pressable: 'Pressable',
      Animated: { Value, View: 'AnimatedView', timing: animate, spring: animate },
      Easing: { bezier: () => {} }, PanResponder: { create: handlers => ({ panHandlers: handlers }) },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
      useWindowDimensions: () => ({ width: 390, height: 844 }),
    },
  };
  const sheetSource = await readFile(new URL('../src/components/ProfileBottomSheet.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(sheetSource, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const sheetModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(name in sheetDependencies, `Unexpected sheet dependency ${name}`);
    return sheetDependencies[name];
  }, sheetModule, sheetModule.exports);
  for (top of [0, 44, 59, 62]) {
    await render(React.createElement(sheetModule.exports.ProfileBottomSheet, { visible: true, title: 'Settings', onClose() {} }), async renderer => {
      const grabber = renderer.root.findAllByType('View').find(node => node.props.onPanResponderMove);
      await act(async () => {
        grabber.props.onPanResponderGrant();
        grabber.props.onPanResponderMove(null, { dy: -5000 });
      });
      const styles = renderer.root.findAllByType('AnimatedView').map(node => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)));
      const sheet = styles.find(style => style.height !== undefined);
      const translation = sheet.transform.find(transform => transform.translateY !== undefined).translateY.read();
      assert.ok(844 - sheet.bottom - sheet.height + translation >= top, `Dragged header overlaps safe area ${top}`);
    });
  }
});

await test('Application sources cannot bypass the shared native-modal safe-area root', async () => {
  async function scan(directory) {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      if (entry.isDirectory()) result.push(...await scan(child));
      else if (/\.tsx?$/.test(entry.name)) result.push(child);
    }
    return result;
  }
  const files = [...await scan(new URL('../src/', import.meta.url)), new URL('../App.tsx', import.meta.url)];
  let wrappers = 0;
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const ast = ts.createSourceFile(file.pathname, content, ts.ScriptTarget.Latest, true);
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'react-native') continue;
      const bindings = statement.importClause?.namedBindings;
      assert.ok(!bindings || !ts.isNamespaceImport(bindings), `Uninspected native namespace import in ${file.pathname}`);
      for (const binding of bindings?.elements ?? []) {
        if ((binding.propertyName ?? binding.name).text !== 'Modal') continue;
        assert.ok(file.pathname.endsWith('/RetainedTab.tsx'), `Native Modal bypasses safe-area provider in ${file.pathname}`);
        wrappers++;
      }
    }
  }
  assert.equal(wrappers, 1);
  console.log(`Audited native-modal imports across ${files.length} application source files.`);
});
