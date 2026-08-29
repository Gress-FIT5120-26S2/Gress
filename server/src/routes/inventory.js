import { Router } from 'express';
import { supabase } from '../supabase.js';

const inventoryRouter = Router();
const CATEGORY_CODES = new Set(['meat', 'vegetables', 'fruit', 'staples', 'condiments', 'drinks', 'other']);
const STORAGE_ZONES = new Set(['chilled', 'frozen', 'pantry']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function getInventorySnapshot(deviceId) {
  const fridgeUid = await resolveFridge(deviceId);
  const [fridgeResult, categoriesResult, batchesResult, rulesResult] = await Promise.all([
    supabase.from('fridges').select('fridge_uid, name, mode').eq('fridge_uid', fridgeUid).single(),
    supabase.from('food_categories').select('category_uid, name, system_code, colour, icon').eq('fridge_uid', fridgeUid).order('created_at'),
    supabase.from('inventory_batches').select('batch_uid, category_uid, name, storage_zone, remaining_quantity, unit, purchase_price, currency, stocked_at, expires_at').eq('fridge_uid', fridgeUid).eq('lifecycle_state', 'active').order('expires_at', { ascending: true, nullsFirst: false }),
    supabase.from('restock_rules').select('normalized_item_name, unit, minimum_quantity, is_enabled').eq('fridge_uid', fridgeUid).eq('is_enabled', true),
  ]);

  const failed = [fridgeResult, categoriesResult, batchesResult, rulesResult].find(({ error }) => error);
  if (failed?.error) throw failed.error;

  const categories = categoriesResult.data ?? [];
  const batches = batchesResult.data ?? [];
  const categoryByUid = new Map(categories.map((category) => [category.category_uid, category]));
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
      return {
        categoryCode: categoryByUid.get(batch.category_uid)?.system_code ?? 'other',
        currency: batch.currency,
        expiresAt: batch.expires_at,
        id: batch.batch_uid,
        name: batch.name,
        needsRestock: Boolean(rule && totalByNameAndUnit.get(key) <= Number(rule.minimum_quantity)),
        purchasePrice: batch.purchase_price === null ? null : Number(batch.purchase_price),
        remainingQuantity: Number(batch.remaining_quantity),
        stockedAt: batch.stocked_at,
        storageZone: batch.storage_zone,
        unit: batch.unit,
      };
    }),
  };
}

async function getInventoryBatchDetail(deviceId, batchUid) {
  // Arthur: NarIyirm
  // 中文：列表接口保持轻量；只有打开卡片时才读取批次版本、初始数量和名称级补货规则。
  // EN: Keep the list response light and load the batch version, stocked quantity, and name-level restock rule only when a card opens.
  const fridgeUid = await resolveFridge(deviceId);
  const batchResult = await supabase
    .from('inventory_batches')
    .select('batch_uid, category_uid, name, storage_zone, initial_quantity, remaining_quantity, unit, purchase_price, currency, stocked_at, expires_at, opened_at, lifecycle_state, version')
    .eq('fridge_uid', fridgeUid)
    .eq('batch_uid', batchUid)
    .eq('lifecycle_state', 'active')
    .maybeSingle();

  if (batchResult.error) throw batchResult.error;
  if (!batchResult.data) return null;

  const batch = batchResult.data;
  const [categoryResult, ruleResult] = await Promise.all([
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
  ]);

  const failed = [categoryResult, ruleResult].find(({ error }) => error);
  if (failed?.error) throw failed.error;

  const rule = ruleResult.data;
  return {
    categoryCode: categoryResult.data?.system_code ?? 'other',
    categoryName: categoryResult.data?.name ?? 'Other',
    currency: batch.currency,
    expiresAt: batch.expires_at,
    id: batch.batch_uid,
    initialQuantity: Number(batch.initial_quantity),
    lifecycleState: batch.lifecycle_state,
    name: batch.name,
    openedAt: batch.opened_at,
    purchasePrice: batch.purchase_price === null ? null : Number(batch.purchase_price),
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

inventoryRouter.get('/food-presets/suggestion', async (request, response) => {
  const deviceId = getDeviceId(request);
  const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  if (!deviceId) return sendInvalidRequest(response, 'A valid Device-ID header is required.');
  if (!query) return response.json({ suggestion: null });

  try {
    // Arthur: NarIyirm
    // 中文：预设是跨冰箱共享的参考数据，但仍经由 Express 返回；别名在服务端统一做大小写和空白规范化匹配。
    // EN: Presets are global reference data but still return through Express; aliases are matched server-side after case and whitespace normalisation.
    const { data, error } = await supabase
      .from('food_presets')
      .select('canonical_name, aliases, suggested_storage_zone, suggested_shelf_life_days, suggested_category_code')
      .eq('is_enabled', true);
    if (error) throw error;

    const preset = findPresetMatch(data ?? [], query);
    if (!preset || !CATEGORY_CODES.has(preset.suggested_category_code)) {
      return response.json({ suggestion: null });
    }
    return response.json({
      suggestion: {
        canonicalName: preset.canonical_name,
        categoryCode: preset.suggested_category_code,
        shelfLifeDays: preset.suggested_shelf_life_days,
        storageZone: preset.suggested_storage_zone,
      },
    });
  } catch (error) {
    console.error('Food preset lookup failed:', error.message);
    return response.status(503).json({ message: 'Food suggestions are unavailable.' });
  }
});

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

  try {
    const { data, error } = await supabase.rpc('create_inventory_batch', {
      p_category_code: body.categoryCode,
      p_currency: 'AUD',
      p_device_id: deviceId,
      p_expires_at: body.expiresAt ?? null,
      p_initial_quantity: quantity,
      p_name: name,
      p_purchase_price: purchasePrice,
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
    console.error('Inventory write failed:', error.message);
    return response.status(503).json({ message: 'The item could not be saved.' });
  }
});

export { inventoryRouter };
