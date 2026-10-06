import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LEARNING_CONTENT_ROOT, readLearningContent, readLearningAssetKeys, validateLearningContent, buildPublicLearningContent, verifyLearningMediaFiles } from '../src/services/learningContent.js';

const release = process.argv.includes('--release');
const writeManifest = process.argv.includes('--write-manifest');
if (release && writeManifest) throw new Error('Release verification is read-only; update a draft manifest separately.');
const bundle = await readLearningContent();
if (writeManifest && bundle.catalog.status !== 'draft') throw new Error('Published content is immutable; create a new content version.');
const result = validateLearningContent(bundle, { assetKeys: await readLearningAssetKeys(), release });
await verifyLearningMediaFiles(bundle);
if (!writeManifest) {
  const manifest = JSON.parse(await readFile(path.join(LEARNING_CONTENT_ROOT, 'manifest.json'), 'utf8'));
  if (manifest.contentHash !== result.contentHash || manifest.contentVersion !== bundle.catalog.contentVersion
    || JSON.stringify(manifest.counts) !== JSON.stringify(result.counts)) {
    result.ok = false;
    result.errors.push('Manifest differs from current content; verify changes before writing a draft manifest.');
  }
}
if (!result.ok) {
  console.error(result.errors.join('\n'));
  process.exitCode = 1;
} else {
  buildPublicLearningContent(bundle);
  console.log(`PASS (${release ? 'release' : 'source-checked draft'}): ${JSON.stringify(result.counts)}\nContent SHA-256: ${result.contentHash}`);
  // Arthur: NarIyirm
  // 中文：只在明确的本地 manifest 模式写入 hash；验证与未来发布默认只读，不接触任何数据库。
  // EN: Write the hash only in explicit local manifest mode; validation and future release checks default to read-only and never contact a database.
  if (writeManifest) await writeFile(path.join(LEARNING_CONTENT_ROOT, 'manifest.json'), `${JSON.stringify({
    schemaVersion: 1, contentVersion: bundle.catalog.contentVersion, contentHash: result.contentHash,
    state: 'source-checked-draft', counts: result.counts, independentReview: bundle.review.independentReview.status,
  }, null, 2)}\n`);
}
