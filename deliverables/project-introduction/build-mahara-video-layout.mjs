import { readFile, writeFile } from 'node:fs/promises';

const directory = new URL('./', import.meta.url);
const full = await readFile(new URL('KitchMemo-Introduction-Final.html', directory), 'utf8');
const journey = full.match(/\s*<h2[^>]*>Our journey<\/h2>/);
const wrapper = full.match(/<div style="max-width:1080px[^>]*>/);
if (!journey || !wrapper) throw new Error('The expected introduction structure was not found.');

// Arthur: NarIyirm
// 中文：在三轮迭代前切分页面，各自闭合外层容器，让平台原生视频可以排在中间。
// EN: Split before the iteration journey and close each wrapper so native platform media can sit between them.
const top = full.slice(0, journey.index) + '\n</div></body></html>';
const bottom = full.slice(0, wrapper.index + wrapper[0].length) + '\n' + full.slice(journey.index);
const testVideoUrl = 'https://eportfolio.monash.edu/artefact/file/download.php?file=572636&view=253992';
const probe = '<p style="color:#ffffff;font-size:14px;">Video compatibility test</p>' +
  `<video controls="controls" preload="metadata" width="960" style="max-width:100%;height:auto;"><source src="${testVideoUrl.replaceAll('&', '&amp;')}" type="video/mp4" /></video>`;
const description = 'An AI-created story about everyday food choices, practical learning and shared responsibility.</p>';
if (!full.includes(description)) throw new Error('The film insertion point was not found.');
const test = full.replace(description, description + '\n' + probe);
await Promise.all([
  writeFile(new URL('KitchMemo-01-Story.html', directory), top),
  writeFile(new URL('KitchMemo-02-Journey.html', directory), bottom),
  writeFile(new URL('KitchMemo-Video-Compatibility-Test.html', directory), test),
]);
console.log('Created the compatibility test and two HTML sections.');
