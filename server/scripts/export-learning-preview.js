import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublicLearningContent, readLearningContent, readLearningAssetKeys, validateLearningContent } from '../src/services/learningContent.js';

const bundle = await readLearningContent();
const result = validateLearningContent(bundle, { assetKeys: await readLearningAssetKeys() });
if (!result.ok) throw new Error(result.errors.join('\n'));
const manifest = JSON.parse(await readFile(new URL('../data/learning-room/v1/manifest.json', import.meta.url), 'utf8'));
if (manifest.contentHash !== result.contentHash) throw new Error('Manifest needs verification before exporting preview content.');
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/components/learning/dev/learningPreviewContent.ts');

// Arthur: NarIyirm
// 中文：只导出公开投影到开发目录；私有题库和审核记录绝不进入 Metro 的客户端模块。
// EN: Export only the public projection into the development directory; private banks and review records never become Metro client modules.
await writeFile(target, `import type { PublicLearningContent } from '../../../types/learningContent';

// Arthur: NarIyirm
// 中文：由公开投影生成的 P2 草稿预览，不包含题库，也不是已发布 catalog。
// EN: Generated P2 draft preview from the public projection; this is neither a question bank nor a published catalog.
export const learningPreviewContent = ${JSON.stringify(buildPublicLearningContent(bundle), null, 2)} satisfies PublicLearningContent;
`);
console.log(`Exported public preview ${bundle.catalog.contentVersion}: ${result.contentHash}`);
