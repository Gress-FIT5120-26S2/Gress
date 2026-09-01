import sharp from 'sharp';

const GENERATED_BACKGROUND = { r: 246, g: 243, b: 234 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const CANVAS_SIZE = 256;
const SUBJECT_SIZE = 196;

function colourDistance(data, offset) {
  return Math.hypot(
    data[offset] - GENERATED_BACKGROUND.r,
    data[offset + 1] - GENERATED_BACKGROUND.g,
    data[offset + 2] - GENERATED_BACKGROUND.b,
  );
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

// Arthur: NarIyirm
// 中文：只从画布边缘向内移除与固定底色相连的像素，避免番薯、面包等主体内部的浅色区域被误删。
// EN: Remove only background-coloured pixels connected to the canvas edge so pale areas inside foods such as bread remain intact.
function removeConnectedBackground(data, width, height) {
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  const enqueue = (pixelIndex) => {
    if (visited[pixelIndex]) return;
    const offset = pixelIndex * 4;
    if (colourDistance(data, offset) > 58) return;
    visited[pixelIndex] = 1;
    queue[queueEnd] = pixelIndex;
    queueEnd += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart];
    queueStart += 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x + 1 < width) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y + 1 < height) enqueue(pixelIndex + width);
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (!visited[pixelIndex]) continue;
    const offset = pixelIndex * 4;
    const distance = colourDistance(data, offset);
    const alphaRatio = clamp((distance - 16) / 42, 0, 1);
    data[offset + 3] = Math.round(data[offset + 3] * alphaRatio);
    if (data[offset + 3] === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    }
  }
}

export async function normaliseGeneratedIcon(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .rotate()
    .resize(512, 512, {
      fit: 'contain',
      background: { ...GENERATED_BACKGROUND, alpha: 1 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  removeConnectedBackground(data, info.width, info.height);

  // Arthur: NarIyirm
  // 中文：透明化后统一裁边、主体占比和四周留白，App 中所有远程食材图标因此共用相同视觉尺寸。
  // EN: After transparency, normalise trimming, subject scale, and padding so every remote food icon has the same visual footprint in the app.
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ background: TRANSPARENT, threshold: 10 })
    .resize(SUBJECT_SIZE, SUBJECT_SIZE, {
      fit: 'contain',
      background: TRANSPARENT,
    })
    .extend({
      top: (CANVAS_SIZE - SUBJECT_SIZE) / 2,
      bottom: (CANVAS_SIZE - SUBJECT_SIZE) / 2,
      left: (CANVAS_SIZE - SUBJECT_SIZE) / 2,
      right: (CANVAS_SIZE - SUBJECT_SIZE) / 2,
      background: TRANSPARENT,
    })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}
