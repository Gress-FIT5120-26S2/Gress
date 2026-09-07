import { Router } from 'express';

const barcodeProductsRouter = Router();
const OPEN_FOOD_FACTS_FIELDS = [
  'code', 'product_name', 'product_name_en', 'brands', 'quantity', 'product_quantity',
  'product_quantity_unit', 'categories_tags', 'selected_images', 'countries_tags', 'conservation_conditions',
].join(',');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const resultCache = new Map();

const CATEGORY_RULES = [
  { code: 'drinks', terms: ['beverage', 'drink', 'soda', 'cola', 'juice', 'water', 'coffee', 'tea', 'milk', 'yogurt', 'yoghurt', 'dairy'] },
  { code: 'meat', terms: ['meat', 'poultry', 'chicken', 'beef', 'pork', 'seafood', 'fish'] },
  { code: 'vegetables', terms: ['vegetable', 'legume'] },
  { code: 'fruit', terms: ['fruit'] },
  { code: 'condiments', terms: ['sauce', 'seasoning', 'condiment', 'spread', 'dressing', 'jam'] },
  { code: 'staples', terms: ['bread', 'rice', 'pasta', 'cereal', 'flour', 'noodle', 'breakfast'] },
];

export function isValidGtin(value) {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function mapCategory(tags = []) {
  const searchable = tags.join(' ').toLocaleLowerCase();
  return CATEGORY_RULES.find((rule) => rule.terms.some((term) => searchable.includes(term)))?.code ?? 'other';
}

function pickImage(selectedImages) {
  const images = selectedImages?.front?.display;
  if (!images || typeof images !== 'object') return null;
  const candidate = images.en ?? Object.values(images).find((value) => typeof value === 'string') ?? null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && url.hostname === 'images.openfoodfacts.org' ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanText(value, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

const PACKAGE_UNIT_FACTORS = {
  g: { factor: 1, unit: 'g' },
  kg: { factor: 1, unit: 'kg' },
  ml: { factor: 1, unit: 'ml' },
  cl: { factor: 10, unit: 'ml' },
  l: { factor: 1, unit: 'L' },
};

export function getPackageMeasure(product) {
  const normalizedQuantity = Number(product?.product_quantity);
  const normalizedUnit = cleanText(product?.product_quantity_unit, 12).toLocaleLowerCase();
  const normalizedRule = PACKAGE_UNIT_FACTORS[normalizedUnit];
  if (Number.isFinite(normalizedQuantity) && normalizedQuantity > 0 && normalizedRule) {
    return { quantity: normalizedQuantity * normalizedRule.factor, unit: normalizedRule.unit };
  }

  const match = cleanText(product?.quantity, 80).toLocaleLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|cl|ml|g|l)\b/u);
  if (!match) return { quantity: null, unit: null };
  const rule = PACKAGE_UNIT_FACTORS[match[2]];
  return { quantity: Number(match[1].replace(',', '.')) * rule.factor, unit: rule.unit };
}

export function isProductNotFound(body) {
  return body?.result?.id === 'product_not_found' || body?.status === 'failure' || body?.status === 0;
}

function cacheResult(barcode, value) {
  if (resultCache.size >= MAX_CACHE_ENTRIES) resultCache.delete(resultCache.keys().next().value);
  resultCache.set(barcode, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export function normalizeOpenFoodFactsProduct(barcode, product) {
  const name = cleanText(product?.product_name, 120) || cleanText(product?.product_name_en, 120);
  if (!name) return null;
  const categoryCode = mapCategory(Array.isArray(product.categories_tags) ? product.categories_tags : []);
  const quantity = cleanText(product.quantity, 80);
  const packageMeasure = getPackageMeasure(product);

  return {
    barcode,
    brand: cleanText(product.brands, 120) || null,
    categoryCode,
    conservationConditions: cleanText(product.conservation_conditions, 500) || null,
    imageUrl: pickImage(product.selected_images),
    name,
    packageLabel: quantity || (packageMeasure.quantity && packageMeasure.unit
      ? `${packageMeasure.quantity} ${packageMeasure.unit}`
      : null),
    packageQuantity: packageMeasure.quantity,
    packageUnit: packageMeasure.unit,
    source: 'open_food_facts',
    storageZone: /milk|yogurt|yoghurt|dairy|cheese|chilled|refrigerat/u.test((product.categories_tags ?? []).join(' ').toLocaleLowerCase())
      ? 'chilled'
      : 'pantry',
  };
}

// Arthur: NarIyirm
// 中文：条码查询只把 Open Food Facts 当作可编辑预填来源；响应经白名单清洗，第三方异常不会直接进入库存写入链路。
// EN: Barcode lookup treats Open Food Facts only as an editable prefill source; allow-listed normalization keeps third-party failures out of inventory writes.
barcodeProductsRouter.get('/barcode-products/:barcode', async (request, response) => {
  const barcode = request.params.barcode?.trim();
  if (!isValidGtin(barcode)) return response.status(400).json({ error: 'invalid_barcode' });

  const cached = resultCache.get(barcode);
  if (cached && cached.expiresAt > Date.now()) return response.json(cached.value);

  try {
    const url = new URL(`https://world.openfoodfacts.org/api/v3.6/product/${barcode}.json`);
    url.searchParams.set('fields', OPEN_FOOD_FACTS_FIELDS);
    const upstream = await fetch(url, {
      headers: { 'User-Agent': process.env.OPEN_FOOD_FACTS_USER_AGENT ?? 'KitchMemo/1.0 (contact: kitchmemo-app)' },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await upstream.json().catch(() => null);
    if (!body) return response.status(502).json({ error: 'barcode_lookup_unavailable' });

    // Arthur: NarIyirm
    // 中文：Open Food Facts 会用非 2xx 返回结构化的 product_not_found；先识别业务未命中，避免把它误报成网络故障。
    // EN: Open Food Facts can return structured product_not_found data with a non-2xx status; classify that business miss before reporting connectivity trouble.
    if (isProductNotFound(body)) {
      const value = { barcode, found: false, product: null };
      cacheResult(barcode, value);
      return response.json(value);
    }
    if (!upstream.ok) return response.status(502).json({ error: 'barcode_lookup_unavailable' });

    const product = body.status === 'success' ? normalizeOpenFoodFactsProduct(barcode, body.product) : null;
    const value = product ? { found: true, product } : { barcode, found: false, product: null };
    cacheResult(barcode, value);
    return response.json(value);
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error('Barcode product lookup failed:', timedOut ? 'upstream timeout' : error.message);
    return response.status(502).json({ error: timedOut ? 'barcode_lookup_timeout' : 'barcode_lookup_unavailable' });
  }
});

export { barcodeProductsRouter };
