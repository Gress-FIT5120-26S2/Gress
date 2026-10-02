import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyWasteQuestion } from '../src/services/wasteQuestionCatalog.js';

const consumed = (quantityChange) => ({ event_type: 'consume', quantity_change: quantityChange });

test('one egg produces an eggshell lesson, and several eggs stay one opportunity', () => {
  assert.equal(classifyWasteQuestion({ name: '鸡蛋', unit: 'item', remaining_quantity: 5 }, consumed(-1))?.material, 'eggshell');
  assert.equal(classifyWasteQuestion({ name: 'egg', unit: 'item', remaining_quantity: 2 }, consumed(-3))?.quantity, 3);
});

test('millilitre bottles wait until empty and unknown juice packaging stays unknown', () => {
  assert.equal(classifyWasteQuestion({ name: 'plastic bottle juice', unit: 'ml', remaining_quantity: 100 }, consumed(-150)), null);
  assert.equal(classifyWasteQuestion({ name: 'plastic bottle juice', unit: 'ml', remaining_quantity: 0 }, consumed(-100))?.material, 'plastic_bottle');
  assert.equal(classifyWasteQuestion({ name: 'juice', unit: 'ml', remaining_quantity: 100 }, consumed(-100)), null);
  assert.equal(classifyWasteQuestion({ name: 'juice', unit: 'ml', remaining_quantity: 0 }, consumed(-100))?.material, 'unknown_bottle');
  assert.equal(classifyWasteQuestion({ name: 'juice', unit: 'ml', remaining_quantity: 0 }, consumed(-100), 'plastic_bottle')?.correctStream, 'recycling');
  assert.equal(classifyWasteQuestion({ name: 'juice', unit: 'bottle', remaining_quantity: 1 }, consumed(-2), 'plastic_bottle')?.quantity, 2);
});

test('adjustments and discards never generate a sorting lesson', () => {
  const batch = { name: 'aluminium can', unit: 'item', remaining_quantity: 0 };
  assert.equal(classifyWasteQuestion(batch, { event_type: 'adjust', quantity_change: -1 }), null);
  assert.equal(classifyWasteQuestion(batch, { event_type: 'discard', quantity_change: -1 }), null);
  assert.equal(classifyWasteQuestion(batch, consumed(1)), null);
});
