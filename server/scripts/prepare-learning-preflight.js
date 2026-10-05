import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLearningContent, buildPublicLearningContent } from '../src/services/learningContent.js';
import { selectLearningQuestions } from '../src/services/learningAssessment.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundle = await readLearningContent();
const content = { public_catalog: buildPublicLearningContent(bundle), private_question_bank: bundle.bank };
const selections = Object.fromEntries(['beginner', 'intermediate', 'advanced'].map((stage) => [stage, selectLearningQuestions(content, stage, 'checkpoint')]));
selections.practice = selectLearningQuestions(content, 'beginner', 'practice', bundle.bank.practice[0].activityCode);
selections.mixed = selectLearningQuestions(content, 'advanced', 'mixed-review');
const migrationFiles = ['20261005010000_learning_room_assessment.sql', '20261005011000_learning_room_draft.sql'];
const applied = process.argv.includes('--applied');
const migrations = applied ? [] : await Promise.all(migrationFiles.map((name) => readFile(path.join(root, 'supabase/migrations', name), 'utf8')));
const checks = await readFile(path.join(root, 'supabase/tests/learning_room.sql'), 'utf8');
const output = path.join(root, '.codex-build/learning-room-p3/preflight.sql');
await mkdir(path.dirname(output), { recursive: true });
// Arthur: NarIyirm
// 中文：新迁移在单一事务中预演并回滚；随机测试设备及审核替身不会留在开发库。
// EN: Rehearse new migrations in one rolled-back transaction so random test devices and review fixtures never persist in development.
await writeFile(output, `begin;\n${migrations.join('\n')}\nset local kitchmemo.test_selections = '${JSON.stringify(selections).replaceAll("'", "''")}';\n${checks}\nrollback;\n`);
console.log(JSON.stringify({ preflight: path.relative(root, output), migrations: applied ? [] : migrationFiles }));
