import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const migrationUrl = new URL('../../supabase/migrations/20260913180000_expand_quest_library_and_slots.sql', import.meta.url);
const source = await readFile(fileURLToPath(migrationUrl), 'utf8');

// Arthur: NarIyirm
// 中文：无数据库凭证时仍验证任务目录数量、槽位、三次更换和重置计时契约，避免客户端与 migration 漂移。
// EN: Without database credentials, still verify catalogue counts, slots, three-reroll quotas, and reset-timing contracts to prevent client/migration drift.
const dailyCodes = [...source.matchAll(/\('([a-z0-9_]+)','daily'/g)].map((match) => match[1]);
const weeklyCodes = [...source.matchAll(/\('([a-z0-9_]+)','weekly'/g)].map((match) => match[1]);

assert.equal(new Set(dailyCodes).size, 10, 'The expansion migration must add ten new daily quests.');
assert.equal(new Set(weeklyCodes).size, 11, 'The expansion migration must add eleven new weekly quests.');
assert.match(source, /daily[^;]+then 3 else 2 end/s, 'Daily assignment count must resolve to two or three.');
assert.match(source, /then 9[^;]+then 8 else 7 end/s, 'Weekly assignment count must resolve to seven through nine.');
assert.match(source, /if used>=3/, 'Reroll quota must be three per period type.');
assert.match(source, /row\.effective_start_at/, 'Progress must restart from the replacement effective time.');
assert.match(source, /slot_index/, 'Assignments must preserve explicit task slots.');

console.log('Quest catalogue and slot contract verified.');
