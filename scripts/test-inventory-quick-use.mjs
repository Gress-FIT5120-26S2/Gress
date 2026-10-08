import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// Arthur: NarIyirm
// 中文：离线执行实际数量与快照合并逻辑，覆盖小数扣减、清零、共享新版本及跨批次补货边界。
// EN: Execute the real quantity and snapshot logic offline to cover fractional deductions, depletion, newer shared versions and cross-batch restock thresholds.
const source = await readFile(new URL('../src/utils/inventoryQuickUse.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { clampQuickUseQuantity: clamp, parseQuickUseQuantity: parse, quickUseStep: step, remainingAfterQuickUse: remaining, applyQuickUseResult: apply } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const batch = (id, name, quantity, unit = 'item', version = 1) => ({ id, name, remainingQuantity: quantity, unit, version, lifecycleState: 'active', needsRestock: false, restockRule: { enabled: true, minimumQuantity: 2, targetQuantity: 6 } });
const snapshot = (...batches) => ({ fridge: { uid: 'test', name: 'Test', mode: 'shared' }, categories: [], batches });

await test('Decimal capacity deductions retain inventory precision', () => {
  assert.equal(clamp(0.1, 0.3), 0.1);
  assert.equal(remaining(0.3, 0.1), 0.2);
  assert.equal(remaining(0.2, 0.1), 0.1);
  assert.equal(remaining(0.1, 0.1), 0);
});
await test('The final fractional portion can be used without exceeding stock', () => {
  assert.equal(clamp(1, 0.25), 0.25);
  assert.equal(clamp(0.1, 0.035), 0.035);
  assert.equal(clamp(9, 6), 6);
  assert.equal(clamp(-1, 6), 0.001);
  assert.equal(clamp(1, 0), 0);
  assert.equal(remaining(0.035, 0.035), 0);
});
await test('Invalid quantities cannot produce negative or nonfinite stock', () => {
  for (const used of [0, -1, 7, NaN, Infinity]) assert.throws(() => remaining(6, used));
  assert.throws(() => remaining(NaN, 1));
  assert.equal(clamp(NaN, 6), 0);
});
await test('Direct entry accepts large amounts and precise quantities in every unit', () => {
  assert.equal(parse('1000'), 1000);
  assert.equal(remaining(1500, parse('1000')), 500);
  assert.equal(parse('250'), 250);
  assert.equal(parse('0.075'), 0.075);
  assert.equal(parse(' 0,75 '), 0.75);
  assert.equal(parse('.25'), 0.25);
  assert.equal(parse('1.'), 1);
  assert.equal(clamp(25, 1500), 25);
  assert.equal(clamp(0.075, 1), 0.075);
});
await test('Incomplete, malformed, nonpositive and overly precise input cannot submit', () => {
  for (const text of ['', ' ', '.', ',', '0', '-1', '1e3', '1000ml', '1.2.3', '0.0001', 'Infinity', 'NaN', '9'.repeat(400)]) assert.equal(parse(text), null, text);
  assert.throws(() => remaining(1500, parse('1501')));
});
await test('Unit controls use practical steps while retaining small custom amounts', () => {
  for (const unit of ['ml', 'g']) assert.equal(step(unit), 50);
  for (const unit of ['kg', 'L']) assert.equal(step(unit), 0.1);
  for (const unit of ['item', 'bag', 'bottle', 'box']) assert.equal(step(unit), 1);
  assert.equal(clamp(step('ml'), 30), 30);
  assert.equal(clamp(75 - step('ml'), 1500), 25);
  assert.equal(clamp(1480 + step('ml'), 1500), 1500);
});
await test('A confirmed partial use updates stock and version without mutating the old snapshot', () => {
  const before = snapshot(batch('a', 'Egg', 6));
  const after = apply(before, { id: 'a', remainingQuantity: 5, version: 2, lifecycleState: 'active' });
  assert.equal(after.batches[0].remainingQuantity, 5);
  assert.equal(after.batches[0].version, 2);
  assert.equal(before.batches[0].remainingQuantity, 6);
});
await test('Using all removes only the confirmed batch and never resurrects it', () => {
  const result = { id: 'a', remainingQuantity: 0, version: 2, lifecycleState: 'consumed' };
  const after = apply(snapshot(batch('a', 'Egg', 6), batch('b', 'Egg', 2)), result);
  assert.deepEqual(after.batches.map(entry => entry.id), ['b']);
  assert.deepEqual(apply(after, result).batches.map(entry => entry.id), ['b']);
});
await test('A late response cannot overwrite a newer shared version', () => {
  const after = apply(snapshot(batch('a', 'Egg', 3, 'item', 4)), { id: 'a', remainingQuantity: 0, version: 2, lifecycleState: 'consumed' });
  assert.equal(after.batches[0].remainingQuantity, 3);
  assert.equal(after.batches[0].version, 4);
});
await test('Restock totals combine matching names and units, keeping other units separate', () => {
  const before = snapshot(batch('a', ' Egg ', 2), batch('b', 'egg', 2), batch('c', 'egg', 10, 'kg'));
  const after = apply(before, { id: 'a', remainingQuantity: 0, version: 2, lifecycleState: 'consumed' });
  assert.equal(after.batches.find(entry => entry.id === 'b').needsRestock, true);
  assert.equal(after.batches.find(entry => entry.id === 'c').needsRestock, false);
});
