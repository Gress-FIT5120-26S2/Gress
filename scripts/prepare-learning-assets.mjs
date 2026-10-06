import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(projectRoot, 'assets/learning-room');
const prompts = JSON.parse(await fs.readFile(path.join(assetRoot, 'GENERATION_PROMPTS.json'), 'utf8'));
const records = [];
const officialAssets = ['en', 'zh'].map((language) => ({
  key: `sdg-13-climate-action-${language}`,
  original: `originals/sdg-13-climate-action-${language}.png`,
  runtime: `sdg-13-climate-action-${language}.png`,
  transparent: false,
  maxWidth: 512,
}));

// Arthur: NarIyirm
// 中文：只缩放和编码独立原图，不裁剪或改色；保留 PNG 透明通道，照片用 WebP 减小安装包。
// EN: Resize and encode standalone originals without cropping or recolouring; preserve PNG alpha and use WebP for smaller photos.
for (const asset of [...prompts.assets, ...officialAssets]) {
  const original = await fs.readFile(path.join(assetRoot, asset.original));
  const originalMetadata = await sharp(original).metadata();
  if (asset.transparent && !originalMetadata.hasAlpha) throw new Error(`${asset.key}: missing alpha channel`);
  const pipeline = sharp(original).resize({ width: asset.maxWidth, withoutEnlargement: true });
  const output = asset.runtime.endsWith('.webp')
    ? await pipeline.webp({ quality: 88, effort: 6 }).toBuffer()
    : await pipeline.png({ compressionLevel: 9 }).toBuffer();
  const metadata = await sharp(output).metadata();
  const stats = await sharp(output).stats();
  if (asset.transparent && stats.isOpaque) throw new Error(`${asset.key}: transparency lost`);
  await fs.writeFile(path.join(assetRoot, asset.runtime), output);
  records.push({
    key: asset.key, file: asset.runtime, original: asset.original,
    width: metadata.width, height: metadata.height, bytes: output.length,
    hasAlpha: metadata.hasAlpha, isOpaque: stats.isOpaque,
    sha256: createHash('sha256').update(output).digest('hex'),
    originalSha256: createHash('sha256').update(original).digest('hex'),
    reference: asset.reference ?? null,
    provenance: asset.reference ? 'built-in-imagegen' : 'un-official',
  });
}

const manifest = { version: 1, preparedAt: '2026-10-05', transform: 'Proportional resize only; no crop or recolouring', assets: records };
await fs.writeFile(path.join(assetRoot, 'ASSET_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${records.length} standalone images; runtime total ${records.reduce((sum, asset) => sum + asset.bytes, 0)} bytes.`);
