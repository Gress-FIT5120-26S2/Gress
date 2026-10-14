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
const sessionModule = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(await readFile(new URL('../src/components/useRequestSession.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(() => React, sessionModule, sessionModule.exports);

// Arthur: NarIyirm
// 中文：执行真实结账与录入组件的 React 状态和 effect，只替换原生视图、网络与包装子视图；不触碰设备或库存。
// EN: Run the real checkout and entry React state/effects, replacing only native views, network and packaging subviews without accessing devices or inventory.
const native = {
  View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView',
  KeyboardAvoidingView: 'KeyboardAvoidingView', ActivityIndicator: 'ActivityIndicator',
  FlatList: ({ data, renderItem }) => React.createElement(React.Fragment, null, data.map(item => React.createElement(React.Fragment, { key: item.item_uid }, renderItem({ item })))),
  Platform: { OS: 'ios' }, StatusBar: { currentHeight: 0 }, Keyboard: { dismiss: noop },
  StyleSheet: { create: value => value, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove: noop }) },
};
const i18nSource = ts.createSourceFile('i18n.tsx', await readFile(new URL('../src/i18n.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const english = i18nSource.statements.find(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(i18nSource) === 'en'));
const dictionary = ts.transpileModule(`const learningCopy = { en: {} }; const learningTutorCopy = { en: {} }; ${english.getText(i18nSource)}; module.exports = en;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const dictionaryModule = { exports: {} };
new Function('module', dictionary)(dictionaryModule);
const t = dictionaryModule.exports;
let saved = [];
let rejectSave = false;
let topSafeArea = 59;
const inventoryApi = {
  getFoodPresetSuggestion: async () => ({ suggestion: null }),
  generateFoodPreset: async () => ({ suggestion: null }),
  createInventoryBatch: async value => {
    if (rejectSave) throw new Error('Offline regression test');
    saved.push(value);
  },
};
const wasteApi = { suggestWasteProfile: async () => ({ profile: [], needsConfirmation: true }), prepareWasteMaterials: async () => ({ assets: {} }) };
const Packaging = props => {
  React.useEffect(() => { props.onChange([], true); }, [props.onChange]);
  return React.createElement('WasteProfileSection', props);
};
async function loadModule(path, extra = {}) {
  const input = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const output = ts.transpileModule(input, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const dependencies = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: topSafeArea, bottom: 34, left: 0, right: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, 'expo-blur': { BlurView: 'BlurView' },
    '../RetainedTab': { TabModal: 'Modal', useTabActive: () => true }, '../useRequestSession': sessionModule.exports, '../../i18n': { useI18n: () => ({ t, language: 'en' }) },
    '../../services/inventoryApi': inventoryApi, '../../services/wasteLearningApi': wasteApi,
    './ReminderSettingsSection': { ReminderSettingsSection: 'ReminderSettingsSection' },
    './StorageSuggestionCard': { StorageSuggestionCard: 'StorageSuggestionCard' },
    './WasteProfileSection': { WasteProfileSection: Packaging }, ...extra,
  };
  new Function('require', 'module', 'exports', output)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const validation = await loadModule('src/utils/inventoryValidation.ts');
const entry = await loadModule('src/components/inventory-entry/InventoryEntryFlow.tsx', { '../../utils/inventoryValidation': validation });
const checkout = await loadModule('src/components/shopping/ShoppingCheckoutReview.tsx', { '../inventory-entry/InventoryEntryFlow': entry });
const copy = t.fridge.manualEntry;
const cartItem = (item_uid, name, quantity = 2, unit = 'item') => ({ item_uid, name, quantity, unit, preset_uid: null });
const items = [cartItem('milk', 'Milk'), cartItem('eggs', 'Egg', 6)];
const checkoutProps = { visible: true, items, inventoryNames: new Set(), onClose: noop, onAllStocked: noop };
const propsForEntry = initialValues => ({ visible: true, initialValues, onClose: noop, onSubmit: noop });
const text = node => typeof node === 'string' ? node : node.children.map(text).join('');
const button = (root, label) => root.findAllByType('Pressable').find(node => text(node) === label);
const input = (root, label) => root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === label);
const reminder = root => root.findByType('ReminderSettingsSection');
const flattenStyle = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
await test('Standalone entry and checkout controls follow changing safe areas while embedded entry avoids double padding', async () => {
  let renderer;
  try {
    for (const top of [0, 44, 59, 62]) {
      topSafeArea = top;
      await act(async () => { renderer = create(React.createElement(entry.InventoryEntryFlow, propsForEntry({ name: 'Milk' }))); });
      const header = renderer.root.findByType('KeyboardAvoidingView').findAllByType('View')[0];
      assert.ok(flattenStyle(header.props.style).paddingTop >= top, `Entry controls overlap safe area ${top}`);
      await act(async () => { renderer.update(React.createElement(entry.InventoryEntryFlow, { ...propsForEntry({ name: 'Milk' }), presentation: 'embedded' })); });
      const embedded = renderer.root.findAllByType('View').find(node => flattenStyle(node.props.style).paddingTop !== undefined);
      assert.ok(flattenStyle(embedded.props.style).paddingTop < 44, 'Embedded entry repeats its parent safe area');
      await dispose(renderer); renderer = null;
      await act(async () => { renderer = create(React.createElement(checkout.ShoppingCheckoutReview, checkoutProps)); });
      const checkoutHeader = renderer.root.findAllByType('View').find(node => flattenStyle(node.props.style).paddingTop !== undefined);
      assert.ok(flattenStyle(checkoutHeader.props.style).paddingTop >= top, `Checkout controls overlap safe area ${top}`);
      await dispose(renderer); renderer = null;
    }
  } finally { if (renderer) await dispose(renderer); topSafeArea = 59; }
});
async function press(root, label) { await act(async () => { await button(root, label).props.onPress(); }); }
async function type(root, label, value) { await act(async () => { input(root, label).props.onChangeText(value); }); }
async function dispose(renderer) { await act(async () => { renderer.unmount(); }); }
function snapshot(root) {
  const selected = root.findAllByType('Pressable').filter(node => node.props.accessibilityState?.selected).map(text);
  const { expiryDate, expiryTime, expiryEnabled, warningDays, restockEnabled, minimumQuantity, targetQuantity } = reminder(root).props;
  return { name: input(root, copy.name.label).props.value, quantity: input(root, copy.quantity.label).props.value, price: input(root, copy.price.label).props.value,
    selected, expiryDate, expiryTime, expiryEnabled, warningDays, restockEnabled, minimumQuantity, targetQuantity };
}
async function editAll(renderer) {
  const root = renderer.root;
  await type(root, copy.name.label, 'Custom fruit');
  await type(root, copy.quantity.label, '3.5');
  await type(root, copy.price.label, '12.50');
  for (const label of [copy.units.kg, copy.storage.frozen, t.fridge.categories.fruit, copy.expiry.useBy]) await press(root, label);
  await act(async () => {
    const callbacks = reminder(root).props;
    callbacks.onExpiryDateChange('2099-12-31'); callbacks.onExpiryTimeChange('21:45');
    callbacks.onWarningDaysChange(6); callbacks.onRestockEnabledChange(true);
    callbacks.onMinimumQuantityChange(2); callbacks.onTargetQuantityChange(8);
  });
}

for (const automatic of [false, true]) {
  await test(`${automatic ? 'Auto-stock fallback' : 'Add to inventory'} retains every edited field through cart refresh and saves the draft`, async () => {
    saved = []; rejectSave = false;
    let renderer;
    await act(async () => { renderer = create(React.createElement(checkout.ShoppingCheckoutReview, checkoutProps)); });
    try {
      if (automatic) await press(renderer.root, t.shopping.checkout.autoStockAll(items.length));
      else await act(async () => { renderer.root.findAllByType('Pressable').find(node => text(node).startsWith('Milk ×')).props.onPress(); });
      await editAll(renderer);
      const edited = snapshot(renderer.root);
      assert.equal(edited.name, 'Custom fruit');
      assert.equal(edited.quantity, '3.5');
      assert.equal(edited.price, '12.50');
      await act(async () => { renderer.update(React.createElement(checkout.ShoppingCheckoutReview, { ...checkoutProps, items: items.map(item => ({ ...item })) })); });
      assert.deepEqual(snapshot(renderer.root), edited);
      await press(renderer.root, copy.save);
      await press(renderer.root, copy.confirmation.continue);
      assert.equal(saved.length, 1);
      assert.equal(saved[0].name, 'Custom fruit'); assert.equal(saved[0].initialQuantity, 3.5); assert.equal(saved[0].purchasePrice, 12.5);
      assert.equal(saved[0].unit, 'kg'); assert.equal(saved[0].storageZone, 'frozen'); assert.equal(saved[0].categoryCode, 'fruit'); assert.equal(saved[0].deadlineType, 'use_by');
      assert.equal(new Date(saved[0].expiresAt).getFullYear(), 2099); assert.equal(saved[0].expiryWarningDays, 6);
      assert.deepEqual(saved[0].restockRule, { enabled: true, minimumQuantity: 2, targetQuantity: 8, unit: 'kg' });
    } finally { await dispose(renderer); }
  });
}

await test('An open draft keeps its packaging seed and edits even when fresh prefill arrives', async () => {
  const initialValues = { name: 'Milk', quantity: '2', unit: 'item', wasteProfile: [] };
  let renderer;
  await act(async () => { renderer = create(React.createElement(entry.InventoryEntryFlow, propsForEntry(initialValues))); });
  try {
    await editAll(renderer);
    const edited = snapshot(renderer.root);
    const packagingSeed = renderer.root.findByType('WasteProfileSection').props.initialProfile;
    await act(async () => { renderer.update(React.createElement(entry.InventoryEntryFlow, propsForEntry({ name: 'Server milk', quantity: '9', unit: 'bottle', wasteProfile: [] }))); });
    assert.deepEqual(snapshot(renderer.root), edited);
    assert.equal(renderer.root.findByType('WasteProfileSection').props.initialProfile, packagingSeed);
  } finally { await dispose(renderer); }
});

await test('Closing and reopening starts a fresh draft from the latest prefill', async () => {
  let renderer;
  const first = propsForEntry({ name: 'Milk', quantity: '2' });
  await act(async () => { renderer = create(React.createElement(entry.InventoryEntryFlow, first)); });
  try {
    await type(renderer.root, copy.name.label, 'Unsaved name');
    await act(async () => { renderer.update(React.createElement(entry.InventoryEntryFlow, { ...first, visible: false })); });
    await act(async () => { renderer.update(React.createElement(entry.InventoryEntryFlow, propsForEntry({ name: 'Egg', quantity: '6', price: '5' }))); });
    assert.equal(input(renderer.root, copy.name.label).props.value, 'Egg');
    assert.equal(input(renderer.root, copy.quantity.label).props.value, '6');
    assert.equal(input(renderer.root, copy.price.label).props.value, '5');
  } finally { await dispose(renderer); }
});

await test('Selecting another cart item creates its own draft', async () => {
  let renderer;
  await act(async () => { renderer = create(React.createElement(checkout.ShoppingCheckoutReview, checkoutProps)); });
  try {
    await act(async () => { renderer.root.findAllByType('Pressable').find(node => text(node).startsWith('Milk ×')).props.onPress(); });
    await editAll(renderer);
    await act(async () => { renderer.root.findAllByType('Pressable').find(node => text(node).startsWith('Egg ×')).props.onPress(); });
    assert.equal(input(renderer.root, copy.name.label).props.value, 'Egg');
    assert.equal(input(renderer.root, copy.quantity.label).props.value, '6');
    assert.equal(input(renderer.root, copy.price.label).props.value, '');
  } finally { await dispose(renderer); }
});

await test('A failed save preserves the full draft, including disabled expiry, for retry', async () => {
  saved = []; rejectSave = true;
  let renderer;
  await act(async () => { renderer = create(React.createElement(checkout.ShoppingCheckoutReview, checkoutProps)); });
  try {
    await act(async () => { renderer.root.findAllByType('Pressable').find(node => text(node).startsWith('Milk ×')).props.onPress(); });
    await editAll(renderer);
    await act(async () => { reminder(renderer.root).props.onExpiryEnabledChange(false); });
    const edited = snapshot(renderer.root);
    await press(renderer.root, copy.save);
    await press(renderer.root, copy.confirmation.continue);
    assert.equal(saved.length, 0);
    assert.deepEqual(snapshot(renderer.root), edited);
    assert.ok(renderer.root.findAllByType('Text').some(node => text(node) === 'Offline regression test'));
    rejectSave = false;
    await press(renderer.root, copy.save);
    await press(renderer.root, copy.confirmation.continue);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].name, edited.name);
    assert.equal(saved[0].expiresAt, null);
    assert.equal(saved[0].expiryWarningDays, null);
  } finally { rejectSave = false; await dispose(renderer); }
});

await test('A late save from a closed form cannot close or replace the reopened inventory draft', async () => {
  let complete, closes = 0;
  const pending = new Promise(resolve => { complete = resolve; });
  const first = { ...propsForEntry({ name: 'Milk', quantity: '2', price: '5', expiryDate: '2099-12-31' }), onSubmit: () => pending, onClose: () => { closes++; } };
  let renderer;
  await act(async () => { renderer = create(React.createElement(entry.InventoryEntryFlow, first)); });
  try {
    await press(renderer.root, copy.save);
    await press(renderer.root, copy.confirmation.continue);
    await act(async () => { renderer.update(React.createElement(entry.InventoryEntryFlow, { ...first, visible: false })); });
    await act(async () => { renderer.update(React.createElement(entry.InventoryEntryFlow, { ...first, initialValues: { name: 'Egg', quantity: '6', price: '4' } })); });
    await act(async () => { complete(); });
    assert.equal(closes, 0);
    assert.equal(input(renderer.root, copy.name.label).props.value, 'Egg');
    assert.equal(input(renderer.root, copy.quantity.label).props.value, '6');
    assert.equal(button(renderer.root, copy.save).props.disabled, false);
  } finally { await dispose(renderer); }
});
