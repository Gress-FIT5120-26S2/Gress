import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyWasteQuestion, classifyProfileQuestions } from '../src/services/wasteQuestionCatalog.js';

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

test('one counted cola drink asks for its actual container material', () => {
  const coke = { name: '可口可乐', unit: 'item', remaining_quantity: 0 };
  assert.equal(classifyWasteQuestion(coke, consumed(-1))?.material, 'unknown_container');
  assert.equal(classifyWasteQuestion({ ...coke, name: 'Coca-Cola' }, consumed(-1), 'plastic_bottle')?.material, 'plastic_bottle');
  assert.equal(classifyWasteQuestion(coke, consumed(-1), 'aluminium_can')?.correctStream, 'recycling');
  assert.equal(classifyWasteQuestion({ ...coke, unit: 'ml', remaining_quantity: 50 }, consumed(-280)), null);
  assert.equal(classifyWasteQuestion({ ...coke, unit: 'ml' }, consumed(-50))?.material, 'unknown_bottle');
  assert.equal(classifyWasteQuestion({ ...coke, name: 'apple', unit: 'item' }, consumed(-1)), null);
});

test('adjustments and discards never generate a sorting lesson', () => {
  const batch = { name: 'aluminium can', unit: 'item', remaining_quantity: 0 };
  assert.equal(classifyWasteQuestion(batch, { event_type: 'adjust', quantity_change: -1 }), null);
  assert.equal(classifyWasteQuestion(batch, { event_type: 'discard', quantity_change: -1 }), null);
  assert.equal(classifyWasteQuestion(batch, consumed(1)), null);
});

const snapshot = (remaining, change, unit = 'item', profile = [{ material: 'plastic_bottle', trigger: 'per_unit' }]) => ({
  event_type: 'consume', quantity_change: change, waste_initial_snapshot: 2,
  waste_remaining_snapshot: remaining, waste_unit_snapshot: unit, waste_profile_snapshot: profile,
});

test('partial count consumption waits for a completed unit across separate events', () => {
  assert.deepEqual(classifyProfileQuestions(snapshot(1.5, -0.5)), []);
  assert.equal(classifyProfileQuestions(snapshot(1, -0.5))[0].quantity, 1);
  assert.equal(classifyProfileQuestions(snapshot(0, -2))[0].quantity, 2);
});

test('volume-based packaging is eligible only on its immutable emptying event', () => {
  assert.deepEqual(classifyProfileQuestions(snapshot(100, -200, 'ml')), []);
  assert.equal(classifyProfileQuestions(snapshot(0, -100, 'ml'))[0].quantity, 1);
});

test('inner residue and shared outer packaging have separate eligibility and keys', () => {
  const profile = [{ material: 'eggshell', trigger: 'per_unit' }, { material: 'paper_cardboard', trigger: 'when_empty' }];
  assert.equal(classifyProfileQuestions(snapshot(1, -1, 'item', profile)).length, 1);
  assert.deepEqual(classifyProfileQuestions(snapshot(0, -1, 'item', profile)).map((q) => q.componentKey), ['eggshell:per_unit', 'paper_cardboard:when_empty']);
});

test('explicit no waste suppresses lessons while uncertain materials provide guidance only', () => {
  assert.deepEqual(classifyProfileQuestions(snapshot(0, -1, 'item', [])), []);
  for (const material of ['soft_plastic', 'rigid_plastic', 'carton', 'glass_container', 'unknown']) {
    assert.equal(classifyProfileQuestions(snapshot(0, -1, 'item', [{ material, trigger: 'when_empty' }]))[0].correctStream, null);
  }
  assert.equal(classifyProfileQuestions({ ...snapshot(0, -1), event_type: 'discard' }), null);
});
