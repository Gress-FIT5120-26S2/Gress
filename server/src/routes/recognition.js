import { Router } from 'express';
import multer from 'multer';
import { requireFridge } from '../middleware/requireFridge.js';

const recognitionRouter = Router();
const modelUrl = process.env.FOOD_RECOGNITION_API_URL
  ?? 'https://d12q94a0v4ih7q.cloudfront.net/predict';
const supportedFoods = new Set([
  'banana',
  'bittermelon',
  'cucumber',
  'eggplant',
  'orange',
  'papaya',
  'pineapple',
  'tomato',
]);
const supportedFreshness = new Set(['fresh', 'semi_fresh', 'rotten']);
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  storage: multer.memoryStorage(),
  fileFilter: (_request, file, callback) => {
    const allowed = allowedImageTypes.has(file.mimetype);
    callback(allowed ? null : new Error('unsupported_image_type'), allowed);
  },
});

function readSingleImage(request, response, next) {
  upload.single('file')(request, response, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'The image must be smaller than 10 MB.'
      : 'Upload a JPEG, PNG, or WebP image.';
    return response.status(400).json({ message });
  });
}

recognitionRouter.post('/photo-recognition', requireFridge, readSingleImage, async (request, response) => {
  if (!request.file) return response.status(400).json({ message: 'An image is required.' });

  try {
    const upstreamUrl = new URL(modelUrl);
    upstreamUrl.searchParams.set('unknown_threshold', '0.6');
    const form = new FormData();
    const fileName = request.file.originalname || 'food-photo.jpg';
    form.append('file', new Blob([request.file.buffer], { type: request.file.mimetype }), fileName);

    // Arthur: NarIyirm
    // 中文：图片只在内存中短暂停留并转发到模型服务；不写磁盘、不进入 Supabase，也不记录图片内容。
    // EN: The image stays briefly in memory while it is proxied to the model; it is not written to disk, Supabase, or logs.
    const upstreamResponse = await fetch(upstreamUrl, {
      body: form,
      method: 'POST',
      signal: AbortSignal.timeout(25_000),
    });
    const result = await upstreamResponse.json().catch(() => null);
    if (!upstreamResponse.ok || !result) {
      return response.status(502).json({ message: 'The recognition model could not analyse this image.' });
    }

    const food = typeof result.food === 'string' ? result.food.trim().toLocaleLowerCase() : 'unknown';
    const freshness = typeof result.freshness === 'string' ? result.freshness.trim().toLocaleLowerCase() : 'unknown';
    const confidence = Number(result.confidence);
    const recognised = supportedFoods.has(food)
      && supportedFreshness.has(freshness)
      && Number.isFinite(confidence)
      && confidence >= 0
      && confidence <= 1;

    return response.json({
      confidence: Number.isFinite(confidence) ? confidence : 0,
      food: recognised ? food : 'unknown',
      freshness: recognised ? freshness : 'unknown',
      rawPrediction: typeof result.raw_prediction === 'string' ? result.raw_prediction : null,
      reason: recognised ? null : (typeof result.reason === 'string' ? result.reason : 'unrecognised_result'),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error('Photo recognition failed:', timedOut ? 'model timeout' : error.message);
    return response.status(502).json({
      message: timedOut
        ? 'The recognition model took too long to respond.'
        : 'Photo recognition is temporarily unavailable.',
    });
  }
});

export { recognitionRouter };
