import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/kitchenWastePortal.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { getWastePortalFrame: frame, WASTE_PORTAL_DURATION: duration, KITCHEN_WASTE_BIN_POSITION: position } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

// Arthur: NarIyirm
// 中文：验证开盖先于吸入、遮罩先于导航及真实 GLB 位置，防止穿盖、闪屏或垃圾桶偏离原盆栽。
// EN: Verify lid-before-pull, cover-before-navigation and the actual GLB position to prevent lid clipping, flashes or a misplaced replacement.
await test('The lid opens before the camera starts entering the bin', () => {
  assert.equal(frame(0).lid, 0);
  assert.equal(frame(420).lid, 1);
  assert.equal(frame(420).pull, 0);
  assert.ok(frame(650).pull > 0);
  assert.equal(frame(650).aim, 1);
});

await test('The handoff is fully black before completion, even after dropped frames', () => {
  assert.equal(frame(1800).fade, 1);
  assert.ok(frame(1800).progress < 1);
  for (const elapsed of [duration, duration + 8000]) {
    assert.equal(frame(elapsed).fade, 1);
    assert.equal(frame(elapsed).progress, 1);
  }
});

await test('Motion remains bounded and continuous throughout the sequence', () => {
  let previous = frame(-100);
  for (let elapsed = 0; elapsed <= duration + 100; elapsed += 8) {
    const current = frame(elapsed);
    for (const key of ['progress', 'lid', 'aim', 'pull', 'vortex', 'fade']) {
      assert.ok(current[key] >= 0 && current[key] <= 1, key);
      assert.ok(current[key] >= previous[key], key);
      assert.ok(current[key] - previous[key] < 0.06, key);
    }
    assert.ok(Number.isFinite(current.roll));
    previous = current;
  }
});

await test('The bin occupies the original floor plant location', async () => {
  const glb = await readFile(new URL('../assets/models/Kitchen-Home-rebuilt-lighting.glb', import.meta.url));
  const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
  const pot = json.nodes.find(node => node.name === 'Floor_Plant_Pot');
  assert.ok(pot);
  assert.ok(Math.abs(position[0] - pot.translation[0]) < 0.001);
  assert.ok(Math.abs(position[2] - pot.translation[2]) < 0.001);
  assert.ok(position[1] > 0 && position[1] < 0.05);
});
