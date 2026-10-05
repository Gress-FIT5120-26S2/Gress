import { readFile, writeFile } from 'node:fs/promises';
import { buildPublicLearningContent, readLearningAssetKeys, readLearningContent, validateLearningContent } from '../src/services/learningContent.js';

const args = process.argv.slice(2);
const draft = args.includes('--draft');
const filename = args.find((arg) => /^\d{14}_learning_room_(draft|content)\.sql$/.test(arg));
if (!filename || args.length !== (draft ? 2 : 1)) throw new Error('Usage: node scripts/generate-learning-migration.js [--draft] <timestamp>_learning_room_<draft|content>.sql');
const bundle = await readLearningContent();
const validation = validateLearningContent(bundle, { assetKeys: await readLearningAssetKeys(), release: !draft });
if (!validation.ok) throw new Error(validation.errors.join('\n'));
const manifest = JSON.parse(await readFile(new URL('../data/learning-room/v1/manifest.json', import.meta.url), 'utf8'));
if (manifest.contentHash !== validation.contentHash) throw new Error('Manifest content hash mismatch');
const sqlJson = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

// Arthur: NarIyirm
// 中文：可重复参考数据写入新的 migration；草稿保持不可发布，绝不覆盖已存在的迁移。
// EN: Write reproducible reference data into a new migration; drafts remain unpublished and existing migrations are never overwritten.
const sql = `-- Arthur: NarIyirm
-- 中文：${draft ? '未独立审核的开发草稿；正式服务默认不读取。' : '独立审核绑定 hash 的不可变公开内容与服务端私有题库。'}
-- EN: ${draft ? 'Unreviewed development draft; normal services do not read it.' : 'Immutable public content and private server bank bound to an independently reviewed hash.'}
insert into public.learning_content_versions(content_version, public_catalog, private_question_bank, content_hash, review_metadata, status, published_at)
values ('${bundle.catalog.contentVersion.replaceAll("'", "''")}',
  ${sqlJson(buildPublicLearningContent(bundle))},
  ${sqlJson(bundle.bank)},
  '${validation.contentHash}',
  ${sqlJson(bundle.review)}, '${draft ? 'draft' : 'published'}', ${draft ? 'null' : 'now()'});
`;
await writeFile(new URL(`../../supabase/migrations/${filename}`, import.meta.url), sql, { flag: 'wx' });
console.log(`Generated ${filename}: ${validation.contentHash}; status=${draft ? 'draft' : 'published'}`);
