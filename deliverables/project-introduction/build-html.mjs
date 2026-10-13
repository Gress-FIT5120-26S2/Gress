import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const ui = 'docs/art-direction/product-video/narrative-local-v1/production/ui';
const assets = {
  logo: ['assets/icon.png', 120],
  kitchen: ['deliverables/project-introduction/source-assets/kitchen-hero.png', 1100],
  spoonie: ['assets/kitchmemo-assistant.png', 256],
  film: ['docs/art-direction/product-video/proof-2026-10-09-realism/kitchen-first-frame.png', 1400],
  inventory: [`${ui}/U01_inventory.png`, 390],
  detail: [`${ui}/U01_tomatoes_detail.png`, 390],
  mountain: ['assets/achievements/mountain-lv3.png', 900],
  medal1: ['assets/achievements/medals/first-rescue.png', 100],
  medal2: ['assets/achievements/medals/waste-aware.png', 100],
  medal3: ['assets/achievements/medals/shared-kitchen.png', 100],
  wins: ['deliverables/project-introduction/source-assets/wins-level.jpg', 440],
  medals: ['deliverables/project-introduction/source-assets/medal-wall.jpg', 440],
  quests: ['deliverables/project-introduction/source-assets/quests.jpg', 440],
  learning: [`${ui}/U04_learning_hub.png`, 390],
  learningCover: ['assets/learning-room/waste-basics-course-cover.webp', 400],
  family: ['assets/shared-fridge-family.png', 900],
};

// Arthur: NarIyirm
// 中文：把压缩后的图片写入 data URL，让最终页面只依赖一个 HTML 文件。
// EN: Embed compressed images as data URLs so the final page depends on a single HTML file.
const embedded = Object.fromEntries(await Promise.all(Object.entries(assets).map(async ([key, [path, width]]) => {
  const bytes = await sharp(resolve(root, path)).resize({ width, withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 95 }).toBuffer();
  return [key, `data:image/webp;base64,${bytes.toString('base64')}`];
})));
const template = await readFile(resolve(directory, 'src/page.html'), 'utf8');
const html = template.replace(/@@([a-zA-Z0-9]+)@@/g, (_, key) => {
  if (!embedded[key]) throw new Error(`Missing embedded asset: ${key}`);
  return embedded[key];
});
if (/@@[a-zA-Z0-9]+@@/.test(html)) throw new Error('Unresolved image references remain.');
await writeFile(resolve(directory, 'index.html'), html);
console.log(`Created index.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB). All ${Object.keys(assets).length} image assets are embedded.`);
