import { Router } from 'express';
import { supabase } from '../supabase.js';
import {
  CLOUDFLARE_ICON_MODEL,
  GEMINI_PRESET_MODEL,
  ICON_PROMPT_VERSION,
  generateFoodPresetIcon,
  generateFoodPresetMetadata,
} from '../services/foodPresetAi.js';

const inventoryRouter = Router();
const CATEGORY_CODES = new Set(['meat', 'vegetables', 'fruit', 'staples', 'condiments', 'drinks', 'other']);
const STORAGE_ZONES = new Set(['chilled', 'frozen', 'pantry']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRESET_ICON_BUCKET = 'food-preset-icons';
const AI_GENERATION_WINDOW_MS = 60 * 60 * 1000;
const AI_GENERATION_LIMIT = 5;
const generationAttemptsByDevice = new Map();

function getDeviceId(request) {
  const deviceId = request.get('Device-ID')?.trim();
  return deviceId && deviceId.length >= 3 && deviceId.length <= 200 ? deviceId : null;
}

function normaliseName(value) {
  return value.trim().toLocaleLowerCase();
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findPresetMatch(presets, query) {
  const normalisedQuery = normaliseName(query);
  return presets.find((preset) => (
    normaliseName(preset.canonical_name) === normalisedQuery
    || preset.aliases.some((alias) => normaliseName(alias) === normalisedQuery)
  ));
}

function findPresetCandidateMatch(presets, candidates) {
  return candidates.map((candidate) => findPresetMatch(presets, candidate)).find(Boolean) ?? null;
}

function getPresetIconUrl(iconPath) {
  if (!iconPath) return null;
  return supabase.storage.from(PRESET_ICON_BUCKET).getPublicUrl(iconPath).data.publicUrl;
}

function toPresetSuggestion(preset) {
  return {
    aliases: preset.aliases,
    canonicalName: preset.canonical_name,
    categoryCode: preset.suggested_category_code,
    iconEmoji: preset.icon_emoji,
    iconUrl: getPresetIconUrl(preset.icon_path),
    notes: preset.notes,
    presetUid: preset.preset_uid,
    shelfLifeDays: preset.suggested_shelf_life_days,
    source: preset.source_type,
    storageZone: preset.suggested_storage_zone,
  };
}

async function getEnabledFoodPresets() {
  const { data, error } = await supabase
    .from('food_presets')
    .select('preset_uid, canonical_name, aliases, suggested_storage_zone, suggested_shelf_life_days, suggested_category_code, notes, icon_path, icon_emoji, source_type')
    .eq('is_enabled', true);
  if (error) throw error;
  return data ?? [];
}

// Arthur: NarIyirm
// 中文：免费模型端点仍需防止单个设备反复触发昂贵生成；进程内窗口是第一层保护，生产网关还应配置全局限流。
// EN: Free model endpoints still need protection from repeated generation by one device; this process-local window is the first layer and production gateways should add global rate limiting.
function claimGenerationAttempt(deviceId) {
  const now = Date.now();
  const activeAttempts = (generationAttemptsByDevice.get(deviceId) ?? [])
    .filter((attemptedAt) => now - attemptedAt < AI_GENERATION_WINDOW_MS);
  if (activeAttempts.length >= AI_GENERATION_LIMIT) {
    generationAttemptsByDevice.set(deviceId, activeAttempts);
    return false;
  }
  activeAttempts.push(now);
  generationAttemptsByDevice.set(deviceId, activeAttempts);
  return true;
}

async function resolveFridge(deviceId) {
  // Arthur: NarIyirm
  // 中文：服务端从 Device-ID 决定当前冰箱，客户端不会提交或选择 fridge_uid，从而保持设备隔离边界。
  // EN: The server derives the current fridge from Device-ID; clients never submit or choose a fridge_uid, preserving device isolation.
  const { data, error } = await supabase.rpc('bootstrap_device', {
    p_device_id: deviceId,
    p_fridge_name: 'My Fridge',
  });

  if (error) throw error;
  return data;
}

// Arthur: NarIyirm
// 中文：GET /api/inventory 和 bootstrap 共用此读取器；并行查询冰箱、分类、活跃批次与规则，再组装前端 InventorySnapshot。
// EN: GET /api/inventory and bootstrap share this reader, which queries fridge, categories, active batches, and rules in parallel before building InventorySnapshot.
async function getInventorySnapshot(deviceId) {
  const fridgeUid = await resolveFridge(deviceId);
  const [fridgeResult, categoriesResult, batchesResult, rulesResult] = await Promise.all([
    supabase.from('fridges').select('fridge_uid, name, mode').eq('fridge_uid', fridgeUid).single(),
    supabase.from('food_categories').select('category_uid, name, system_code, colour, icon').eq('fridge_uid', fridgeUid).order('created_at'),
    supabase.from('inventory_batches').select('batch_uid, category_uid, preset_uid, name, storage_zone, remaining_quantity, unit, purchase_price, currency, stocked_at, expires_at').eq('fridge_uid', fridgeUid).eq('lifecycle_state', 'active').order('expires_at', { ascending: true, nullsFirst: false }),
    supabase.from('restock_rules').select('normalized_item_name, unit, minimum_quantity, is_enabled').eq('fridge_uid', fridgeUid).eq('is_enabled', true),
  ]);

  const failed = [fridgeResult, categoriesResult, batchesResult, rulesResult].find(({ error }) => error);
  if (failed?.error) throw failed.error;

  const categories = categoriesResult.data ?? [];
  const batches = batchesResult.data ?? [];
  const presetUids = [...new Set(batches.map((batch) => batch.preset_uid).filter(Boolean))];
  const presetsResult = presetUids.length > 0
    ? await supabase.from('food_presets').select('preset_uid, icon_path, icon_emoji').in('preset_uid', presetUids)
    : { data: [], error: null };
  if (presetsResult.error) throw presetsResult.error;
  const categoryByUid = new Map(categories.map((category) => [category.category_uid, category]));
  const presetByUid = new Map((presetsResult.data ?? []).map((preset) => [preset.preset_uid, preset]));
  const totalByNameAndUnit = new Map();
  for (const batch of batches) {
    const key = `${normaliseName(batch.name)}::${batch.unit}`;
    totalByNameAndUnit.set(key, (totalByNameAndUnit.get(key) ?? 0) + Number(batch.remaining_quantity));
  }
  const ruleByNameAndUnit = new Map((rulesResult.data ?? []).map((rule) => [`${rule.normalized_item_name}::${rule.unit}`, rule]));

  return {
    fridge: {
      uid: fridgeResult.data.fridge_uid,
      name: fridgeResult.data.name,
      mode: fridgeResult.data.mode,
    },
    categories: categories.map((category) => ({
      code: category.system_code,
      colour: category.colour,
      icon: category.icon,
      id: category.category_uid,
      name: category.name,
    })),
    batches: batches.map((batch) => {
      const key = `${normaliseName(batch.name)}::${batch.unit}`;
      const rule = ruleByNameAndUnit.get(key);
      const preset = batch.preset_uid ? presetByUid.get(batch.preset_uid) : null;
      return {
        categoryCode: categoryByUid.get(batch.category_uid)?.system_code ?? 'other',
        currency: batch.currency,
        expiresAt: batch.expires_at,
        id: batch.batch_uid,
        iconEmoji: preset?.icon_emoji ?? null,
        iconUrl: getPresetIconUrl(preset?.icon_path),
        name: batch.name,
        needsRestock: Boolean(rule && totalByNameAndUnit.get(key) <= Number(rule.minimum_quantity)),
        presetUid: batch.preset_uid,
        purchasePrice: batch.purchase_price === null ? null : Number(batch.purchase_price),
        remainingQuantity: Number(batch.remaining_quantity),
        stockedAt: batch.stocked_at,
        storageZone: batch.storage_zone,
        unit: batch.unit,
      };
    }),
  };
}

// Arthur: NarIyirm
// 中文：单批次详情在此补读 version、初始数量、preset 图标和名称级补货规则；调用方是 GET /inventory/batches/:batchUid。
// EN: Single-batch detail adds version, initial quantity, preset icon, and the name-level restock rule for GET /inventory/batches/:batchUid.
async function getInventoryBatchDetail(deviceId, batchUid) {
  // Arthur: NarIyirm
  // 中文：详情按 preset_uid 补读与列表相同的图标，同时加载批次版本、初始数量和名称级补货规则。
  // EN: Detail resolves the same preset icon as the list while loading the batch version, stocked quantity, and name-level restock rule.
  const fridgeUid = await resolveFridge(deviceId);
  const batchResult = await supabase
    .from('inventory_batches')
    .select('batch_uid, category_uid, preset_uid, name, storage_zone, initial_quantity, remaining_quantity, unit, purchase_price, currency, stocked_at, expires_at, opened_at, lifecycle_state, version')
    .eq('fridge_uid', fridgeUid)
    .eq('batch_uid', batchUid)
    .eq('lifecycle_state', 'active')
    .maybeSingle();

  if (batchResult.error) throw batchResult.error;
  if (!batchResult.data) return null;

  const batch = batchResult.data;
  const [categoryResult, ruleResult, presetResult] = await Promise.all([
    supabase
      .from('food_categories')
      .select('name, system_code')
      .eq('fridge_uid', fridgeUid)
      .eq('category_uid', batch.category_uid)
      .maybeSingle(),
    supabase
      .from('restock_rules')
      .select('minimum_quantity, target_quantity, is_enabled')
      .eq('fridge_uid', fridgeUid)
      .eq('normalized_item_name', normaliseName(batch.name))
      .eq('unit', batch.unit)
      .maybeSingle(),
    batch.preset_uid
      ? supabase
        .from('food_presets')
        .select('icon_path, icon_emoji')
        .eq('preset_uid', batch.preset_uid)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const failed = [categoryResult, ruleResult, presetResult].find(({ error }) => error);
  if (failed?.error) throw failed.error;

  const rule = ruleResult.data;
  return {
    categoryCode: categoryResult.data?.system_code ?? 'other',
    categoryName: categoryResult.data?.name ?? 'Other',
    currency: batch.currency,
    expiresAt: batch.expires_at,
    id: batch.batch_uid,
    iconEmoji: presetResult.data?.icon_emoji ?? null,
    iconUrl: getPresetIconUrl(presetResult.data?.icon_path),
    initialQuantity: Number(batch.initial_quantity),
    lifecycleState: batch.lifecycle_state,
    name: batch.name,
    openedAt: batch.opened_at,
    purchasePrice: batch.purchase_price === null ? null : Number(batch.purchase_price),
    presetUid: batch.preset_uid,
    remainingQuantity: Number(batch.remaining_quantity),
    restockRule: rule ? {
      enabled: Boolean(rule.is_enabled),
      minimumQuantity: Number(rule.minimum_quantity),
      targetQuantity: Number(rule.target_quantity),
    } : null,
    stockedAt: batch.stocked_at,
    storageZone: batch.storage_zone,
    unit: batch.unit,
    version: batch.version,
  };
}

function sendInvalidRequest(response, message) {
  return response.status(400).json({ message });
}

function sendInventoryMutationError(response, error) {
  if (error.message.includes('not found')) return response.status(404).json({ message: error.message });
  if (error.message.includes('version conflict')) {
    return response.status(409).json({ message: 'This item changed on another device. Reload it and try again.' });
  }
  console.error('Inventory mutation failed:', error.message);
  return response.status(503).json({ message: 'The inventory change could not be saved.' });
}

inventoryRouter.post('/devices/bootstrap', async (request, response) => {
  const deviceId = getDeviceId(request);
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');

  try {
    const snapshot = await getInventorySnapshot(deviceId);
    return response.status(201).json({ fridge: snapshot.fridge, categories: snapshot.categories });
  } catch (error) {
    console.error('Device bootstrap failed:', error.message);
    return response.status(503).json({ message: 'The inventory service is unavailable.' });
  }
});

inventoryRouter.get('/inventory', async (request, response) => {
  const deviceId = getDeviceId(request);
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');

  try {
    return response.json(await getInventorySnapshot(deviceId));
  } catch (error) {
    console.error('Inventory read failed:', error.message);
    return response.status(503).json({ message: 'The inventory service is unavailable.' });
  }
});

inventoryRouter.get('/inventory/batches/:batchUid', async (request, response) => {
  const deviceId = getDeviceId(request);
  const { batchUid } = request.params;
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');
  if (!UUID_PATTERN.test(batchUid)) return sendInvalidRequest(response, 'A valid batch ID is required.');

  try {
    const batch = await getInventoryBatchDetail(deviceId, batchUid);
    return batch ? response.json({ batch }) : response.status(404).json({ message: 'Inventory batch not found.' });
  } catch (error) {
    console.error('Inventory detail read failed:', error.message);
    return response.status(503).json({ message: 'The inventory item could not be loaded.' });
  }
});

// Arthur: NarIyirm
// 中文：详情弹窗关闭时进入此路由；校验数量和版本后交给 adjust_inventory_batch_quantity 原子更新批次与流水。
// EN: Detail-sheet close enters this route; validated quantity and version flow to adjust_inventory_batch_quantity for atomic batch and event updates.
inventoryRouter.patch('/inventory/batches/:batchUid/quantity', async (request, response) => {
  const deviceId = getDeviceId(request);
  const { batchUid } = request.params;
  const remainingQuantity = asNumber(request.body?.remainingQuantity);
  const expectedVersion = asNumber(request.body?.expectedVersion);
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');
  if (!UUID_PATTERN.test(batchUid)) return sendInvalidRequest(response, 'A valid batch ID is required.');
  if (remainingQuantity === null || remainingQuantity < 0 || !Number.isInteger(expectedVersion)) {
    return sendInvalidRequest(response, 'A non-negative quantity and batch version are required.');
  }

  try {
    const { data, error } = await supabase.rpc('adjust_inventory_batch_quantity', {
      p_batch_uid: batchUid,
      p_device_id: deviceId,
      p_expected_version: expectedVersion,
      p_remaining_quantity: remainingQuantity,
    });
    if (error) throw error;
    const updated = Array.isArray(data) ? data[0] : data;
    return response.json({
      batch: {
        id: updated.batch_uid,
        lifecycleState: updated.lifecycle_state,
        remainingQuantity: Number(updated.remaining_quantity),
        version: updated.version,
      },
    });
  } catch (error) {
    return sendInventoryMutationError(response, error);
  }
});

// Arthur: NarIyirm
// 中文：编辑表单在此更新完整批次资料；expectedVersion 冲突统一转换为 409，前端需重载后重试。
// EN: The edit form updates full batch details here; expectedVersion conflicts become 409 so the client reloads before retrying.
inventoryRouter.patch('/inventory/batches/:batchUid', async (request, response) => {
  const deviceId = getDeviceId(request);
  const { batchUid } = request.params;
  const body = request.body ?? {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const remainingQuantity = asNumber(body.remainingQuantity);
  const purchasePrice = body.purchasePrice === null || body.purchasePrice === undefined ? null : asNumber(body.purchasePrice);
  const expectedVersion = asNumber(body.expectedVersion);
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');
  if (!UUID_PATTERN.test(batchUid)) return sendInvalidRequest(response, 'A valid batch ID is required.');
  if (!name || !CATEGORY_CODES.has(body.categoryCode) || !STORAGE_ZONES.has(body.storageZone)) {
    return sendInvalidRequest(response, 'Name, category, and storage zone are required.');
  }
  if (remainingQuantity === null || remainingQuantity < 0 || typeof body.unit !== 'string' || !body.unit.trim()) {
    return sendInvalidRequest(response, 'A non-negative quantity and unit are required.');
  }
  if (purchasePrice !== null && purchasePrice < 0) return sendInvalidRequest(response, 'Purchase price cannot be negative.');
  if (!Number.isInteger(expectedVersion)) return sendInvalidRequest(response, 'A batch version is required.');
  if (body.expiresAt !== null && body.expiresAt !== undefined && Number.isNaN(Date.parse(body.expiresAt))) {
    return sendInvalidRequest(response, 'Expiry time is invalid.');
  }

  try {
    const { error } = await supabase.rpc('update_inventory_batch_details', {
      p_batch_uid: batchUid,
      p_category_code: body.categoryCode,
      p_device_id: deviceId,
      p_expected_version: expectedVersion,
      p_expires_at: body.expiresAt ?? null,
      p_name: name,
      p_purchase_price: purchasePrice,
      p_remaining_quantity: remainingQuantity,
      p_storage_zone: body.storageZone,
      p_unit: body.unit.trim(),
    });
    if (error) throw error;

    const batch = await getInventoryBatchDetail(deviceId, batchUid);
    return response.json({ batch });
  } catch (error) {
    return sendInventoryMutationError(response, error);
  }
});

// Arthur: NarIyirm
// 中文：详情或编辑表单从此设置名称和单位级补货规则；enabled=false 会关闭规则而不删除库存。
// EN: Detail and edit forms set a name-and-unit restock rule here; enabled=false disables the rule without deleting inventory.
inventoryRouter.put('/inventory/batches/:batchUid/restock-rule', async (request, response) => {
  const deviceId = getDeviceId(request);
  const { batchUid } = request.params;
  const enabled = request.body?.enabled === true;
  const minimumQuantity = enabled ? asNumber(request.body?.minimumQuantity) : null;
  const targetQuantity = enabled ? asNumber(request.body?.targetQuantity) : null;
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');
  if (!UUID_PATTERN.test(batchUid)) return sendInvalidRequest(response, 'A valid batch ID is required.');
  if (enabled && (minimumQuantity === null || targetQuantity === null || minimumQuantity < 0 || targetQuantity <= minimumQuantity)) {
    return sendInvalidRequest(response, 'Restock target must be higher than the minimum quantity.');
  }

  try {
    const { error } = await supabase.rpc('set_inventory_restock_rule', {
      p_batch_uid: batchUid,
      p_device_id: deviceId,
      p_enabled: enabled,
      p_minimum_quantity: minimumQuantity,
      p_target_quantity: targetQuantity,
    });
    if (error) throw error;
    return response.json({
      restockRule: enabled ? { enabled: true, minimumQuantity, targetQuantity } : null,
    });
  } catch (error) {
    return sendInventoryMutationError(response, error);
  }
});

// Arthur: NarIyirm
// 中文：前端“移出冰箱”进入此路由；archive_inventory_batch 执行软归档并保留历史事件。
// EN: The remove action enters this route; archive_inventory_batch soft-archives the row and preserves history events.
inventoryRouter.delete('/inventory/batches/:batchUid', async (request, response) => {
  const deviceId = getDeviceId(request);
  const { batchUid } = request.params;
  const expectedVersion = asNumber(request.body?.expectedVersion);
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');
  if (!UUID_PATTERN.test(batchUid)) return sendInvalidRequest(response, 'A valid batch ID is required.');
  if (!Number.isInteger(expectedVersion)) return sendInvalidRequest(response, 'A batch version is required.');

  try {
    const { error } = await supabase.rpc('archive_inventory_batch', {
      p_batch_uid: batchUid,
      p_device_id: deviceId,
      p_expected_version: expectedVersion,
    });
    if (error) throw error;
    return response.status(204).send();
  } catch (error) {
    return sendInventoryMutationError(response, error);
  }
});

// Arthur: NarIyirm
// 中文：InventoryEntryFlow 的防抖查询进入此路由；只返回参考建议，不创建批次或修改用户数据。
// EN: InventoryEntryFlow's debounced lookup enters here and returns guidance without creating a batch or mutating user data.
inventoryRouter.get('/food-presets/suggestion', async (request, response) => {
  const deviceId = getDeviceId(request);
  const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');
  if (!query) return response.json({ suggestion: null });

  try {
    // Arthur: NarIyirm
    // 中文：预设是跨冰箱共享的参考数据，但仍经由 Express 返回；别名在服务端统一做大小写和空白规范化匹配。
    // EN: Presets are global reference data but still return through Express; aliases are matched server-side after case and whitespace normalisation.
    const preset = findPresetMatch(await getEnabledFoodPresets(), query);
    if (!preset || !CATEGORY_CODES.has(preset.suggested_category_code)) {
      return response.json({ suggestion: null });
    }
    return response.json({ suggestion: toPresetSuggestion(preset) });
  } catch (error) {
    console.error('Food preset lookup failed:', error.message);
    return response.status(503).json({ message: 'Food suggestions are unavailable.' });
  }
});

// Arthur: NarIyirm
// 中文：只有用户明确点击“一键生成”才调用两个免费模型；标准名和别名二次命中时直接复用已有 preset 与图标。
// EN: The two free models run only after an explicit one-click action; a second canonical/alias match reuses the existing preset and icon.
inventoryRouter.post('/food-presets/generate', async (request, response) => {
  const deviceId = getDeviceId(request);
  const inputName = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');
  if (!inputName || inputName.length > 120) {
    return sendInvalidRequest(response, 'A food name between 1 and 120 characters is required.');
  }

  try {
    const existingPreset = findPresetMatch(await getEnabledFoodPresets(), inputName);
    if (existingPreset) return response.json({ generated: false, suggestion: toPresetSuggestion(existingPreset) });
    if (!claimGenerationAttempt(deviceId)) {
      return response.status(429).json({ message: 'AI generation is limited to five new foods per hour.' });
    }

    const metadata = await generateFoodPresetMetadata(inputName);
    const candidates = [inputName, metadata.canonicalName, ...metadata.aliases];
    const secondMatch = findPresetCandidateMatch(await getEnabledFoodPresets(), candidates);
    if (secondMatch) return response.json({ generated: false, suggestion: toPresetSuggestion(secondMatch) });

    const iconBuffer = await generateFoodPresetIcon(metadata.canonicalName);
    const { data, error } = await supabase.rpc('save_generated_food_preset', {
      p_aliases: metadata.aliases,
      p_canonical_name: metadata.canonicalName,
      p_category_code: metadata.categoryCode,
      p_generation_model: GEMINI_PRESET_MODEL,
      p_icon_emoji: metadata.fallbackEmoji,
      p_input_name: inputName,
      p_notes: metadata.notes,
      p_shelf_life_days: metadata.shelfLifeDays,
      p_storage_zone: metadata.storageZone,
    });
    if (error) throw error;
    let preset = Array.isArray(data) ? data[0] : data;

    if (!preset.icon_path) {
      const iconPath = `ai/${preset.preset_uid}/v${ICON_PROMPT_VERSION}.png`;
      const uploadResult = await supabase.storage
        .from(PRESET_ICON_BUCKET)
        .upload(iconPath, iconBuffer, { cacheControl: '31536000', contentType: 'image/png', upsert: false });
      if (uploadResult.error && !uploadResult.error.message.toLowerCase().includes('already exists')) {
        throw uploadResult.error;
      }

      const updateResult = await supabase
        .from('food_presets')
        .update({
          generation_model: `${GEMINI_PRESET_MODEL} + ${CLOUDFLARE_ICON_MODEL}`,
          generation_prompt_version: ICON_PROMPT_VERSION,
          icon_path: iconPath,
          icon_source: 'ai_generated',
        })
        .eq('preset_uid', preset.preset_uid)
        .is('icon_path', null)
        .select('preset_uid, canonical_name, aliases, suggested_storage_zone, suggested_shelf_life_days, suggested_category_code, notes, icon_path, icon_emoji, source_type')
        .maybeSingle();
      if (updateResult.error) throw updateResult.error;
      preset = updateResult.data ?? { ...preset, icon_path: iconPath, icon_source: 'ai_generated' };
    }

    return response.status(201).json({ generated: true, suggestion: toPresetSuggestion(preset) });
  } catch (error) {
    const message = error?.message ?? 'The AI preset could not be generated.';
    console.error('AI food preset generation failed:', message);
    return response.status(503).json({ message: 'AI generation is temporarily unavailable. Check the server AI configuration and try again.' });
  }
});

// Arthur: NarIyirm
// 中文：手动与识别录入共用此创建路由；输入校验后由 create_inventory_batch RPC 原子写批次、stock 流水和规则。
// EN: Manual and recognition entry share this create route; after validation, create_inventory_batch atomically writes the batch, stock event, and rule.
inventoryRouter.post('/inventory/batches', async (request, response) => {
  const deviceId = getDeviceId(request);
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');

  const body = request.body ?? {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const quantity = asNumber(body.initialQuantity);
  const purchasePrice = body.purchasePrice === null || body.purchasePrice === undefined ? null : asNumber(body.purchasePrice);
  const restock = body.restockRule;
  const hasRestock = restock?.enabled === true;
  const restockMinimum = hasRestock ? asNumber(restock.minimumQuantity) : null;
  const restockTarget = hasRestock ? asNumber(restock.targetQuantity) : null;
  const presetUid = body.presetUid === null || body.presetUid === undefined ? null : body.presetUid;

  if (!name || !CATEGORY_CODES.has(body.categoryCode) || !STORAGE_ZONES.has(body.storageZone)) {
    return sendInvalidRequest(response, 'Name, category, and storage zone are required.');
  }
  if (quantity === null || quantity <= 0 || typeof body.unit !== 'string' || !body.unit.trim()) {
    return sendInvalidRequest(response, 'A positive quantity and unit are required.');
  }
  if (purchasePrice !== null && purchasePrice < 0) return sendInvalidRequest(response, 'Purchase price cannot be negative.');
  if (body.expiresAt !== null && body.expiresAt !== undefined && Number.isNaN(Date.parse(body.expiresAt))) {
    return sendInvalidRequest(response, 'Expiry time is invalid.');
  }
  if (hasRestock && (restockMinimum === null || restockTarget === null || restockMinimum < 0 || restockTarget <= restockMinimum)) {
    return sendInvalidRequest(response, 'Restock target must be higher than the minimum quantity.');
  }
  if (presetUid !== null && (typeof presetUid !== 'string' || !UUID_PATTERN.test(presetUid))) {
    return sendInvalidRequest(response, 'A valid food preset ID is required.');
  }

  try {
    const { data, error } = await supabase.rpc('create_inventory_batch', {
      p_category_code: body.categoryCode,
      p_currency: 'AUD',
      p_device_id: deviceId,
      p_expires_at: body.expiresAt ?? null,
      p_initial_quantity: quantity,
      p_name: name,
      p_purchase_price: purchasePrice,
      p_preset_uid: presetUid,
      p_restock_enabled: hasRestock,
      p_restock_minimum_quantity: restockMinimum,
      p_restock_target_quantity: restockTarget,
      p_storage_zone: body.storageZone,
      p_unit: body.unit.trim(),
    });
    if (error) throw error;

    const created = Array.isArray(data) ? data[0] : data;
    return response.status(201).json({ batchUid: created?.batch_uid ?? null });
  } catch (error) {
    const message = error?.message ?? 'The item could not be saved.';
    console.error('Inventory write failed:', message);
    return response.status(503).json({ message });
  }
});

export { inventoryRouter };
