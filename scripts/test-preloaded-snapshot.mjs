import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/preloadedSnapshot.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { createPreloadedSnapshot: create } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

// Arthur: NarIyirm
// 中文：覆盖慢网同步、成功空列表、断网和身份切换，确保预加载保留内容但不恢复过期作用域的响应。
// EN: Cover slow sync, successful empty lists, offline failures and identity changes so preload retains content without restoring obsolete scope responses.
await test('Concurrent preload and entry share one network read', async () => {
  const pending = deferred(); let reads = 0;
  const store = create(() => { reads += 1; return pending.promise; });
  const first = store.refresh(); const second = store.refresh();
  assert.equal(first, second);
  await Promise.resolve(); assert.equal(reads, 1);
  pending.resolve({ total: 4 }); await first;
  assert.deepEqual(store.getSnapshot(), { data: { total: 4 }, loading: false, failed: false });
});

await test('Slow background sync keeps content visible and publishes the new result', async () => {
  const pending = deferred(); let reads = 0;
  const store = create(() => ++reads === 1 ? Promise.resolve({ total: 4 }) : pending.promise);
  await store.refresh();
  const visible = store.getSnapshot(); let updates = 0;
  const unsubscribe = store.subscribe(() => { updates += 1; });
  const refresh = store.refresh();
  assert.equal(store.getSnapshot(), visible);
  pending.resolve({ total: 5 }); await refresh;
  assert.equal(store.getSnapshot().data.total, 5); assert.equal(updates, 1);
  unsubscribe(); await store.refresh(); assert.equal(updates, 1);
});

await test('A successful empty list stays visible when a later read fails', async () => {
  let reads = 0;
  const store = create(() => ++reads === 1 ? Promise.resolve([]) : Promise.reject(new Error('offline')));
  await store.refresh(); await store.refresh();
  assert.deepEqual(store.getSnapshot(), { data: [], loading: false, failed: false });
});

await test('Cold failures expose retry feedback and a later retry recovers', async () => {
  let reads = 0;
  const store = create(() => ++reads === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ total: 2 }));
  await store.refresh();
  assert.deepEqual(store.getSnapshot(), { data: null, loading: false, failed: true });
  const retry = store.refresh();
  assert.deepEqual(store.getSnapshot(), { data: null, loading: true, failed: false });
  await retry; assert.equal(store.getSnapshot().data.total, 2);
});

await test('A late old-fridge response cannot restore cleared data or cancel the new read', async () => {
  const old = deferred(); const current = deferred(); let reads = 0;
  const store = create(() => ++reads === 1 ? old.promise : current.promise);
  const before = store.refresh(); await Promise.resolve();
  store.clear(); const after = store.refresh(); await Promise.resolve();
  old.resolve({ fridge: 'old' }); await before;
  assert.equal(store.getSnapshot().data, null);
  assert.equal(store.refresh(), after);
  current.resolve({ fridge: 'current' }); await after;
  assert.equal(store.getSnapshot().data.fridge, 'current'); assert.equal(reads, 2);
});

await test('An obsolete rejection cannot overwrite a successful new identity snapshot', async () => {
  const old = deferred(); let reads = 0;
  const store = create(() => ++reads === 1 ? old.promise : Promise.resolve({ owner: 'recovered' }));
  const before = store.refresh(); await Promise.resolve();
  store.clear(); await store.refresh();
  old.reject(new Error('credential revoked')); await before;
  assert.deepEqual(store.getSnapshot(), { data: { owner: 'recovered' }, loading: false, failed: false });
});
