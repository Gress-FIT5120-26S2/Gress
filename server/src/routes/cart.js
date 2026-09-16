// server/src/routes/cart.js  (ESM)
// Shopping cart endpoints. Membership is verified by requireFridge, which
// reads the 'Device-ID' header. Mounted under /api in index.js.
import express from 'express';
import { supabase } from '../supabase.js';
import { requireFridge } from '../middleware/requireFridge.js';

const router = express.Router();

const MAX_NAME_LENGTH = 120;
const UNIT_ALLOWLIST = ['item', 'g', 'kg', 'ml', 'L', 'bag', 'bottle', 'box'];

// 中文：跟 inventory_batches 的护栏保持一致，先拦一次给出清楚的错误码。
// EN: Mirrors the inventory_batches guardrails, catching bad input with a clear error code.
function validateName(rawName) {
  if (typeof rawName !== 'string') return { error: 'name_required' };
  const name = rawName.trim();
  if (!name) return { error: 'name_required' };
  if (name.length > MAX_NAME_LENGTH) return { error: 'name_too_long' };
  return { name };
}

function validateQuantity(rawQuantity, unit) {
  const quantity = Number(rawQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'invalid_quantity' };
  const max = unit === 'g' || unit === 'ml' ? 1_000_000 : 1_000;
  if (quantity >= max) return { error: 'quantity_too_large' };
  return { quantity };
}

function validateUnit(rawUnit) {
  if (typeof rawUnit !== 'string') return { error: 'invalid_unit' };
  const unit = rawUnit.trim();
  if (!UNIT_ALLOWLIST.includes(unit)) return { error: 'invalid_unit' };
  return { unit };
}

// GET /api/cart -- the whole shared list, unchecked items first
// Arthur: NarIyirm
// 中文：ShoppingScreen 的 CartView 从此读取整个 fridgeUid 共享清单；未购买项优先返回。
// EN: ShoppingScreen's CartView reads the entire fridgeUid-shared list here, with unchecked items returned first.
router.get('/cart', requireFridge, async (req, res) => {
  const { data, error } = await supabase
    .from('shopping_cart_items')
    .select('*')
    .eq('fridge_uid', req.fridgeUid)
    .order('is_checked', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/cart -- add an item
// Arthur: NarIyirm
// 中文：手动和补货建议都从此添加购物项；手动来源保存 owner_device_id，派生来源保持冰箱共同所有。
// EN: Manual and restock suggestions add items here; manual sources keep owner_device_id while derived sources remain fridge-owned.
router.post('/cart', requireFridge, async (req, res) => {
  const { category_uid, preset_uid, quantity, unit, source } = req.body;
  const nameResult = validateName(req.body.name);
  if (nameResult.error) return res.status(400).json({ error: nameResult.error });
  const name = nameResult.name;

  // quantity/unit are optional on this route, but if either is given both must
  // pass the same guardrails cart edits use -- no silently storing a bad pair
  let cleanQuantity = null;
  let cleanUnit = null;
  if (unit !== undefined && unit !== null) {
    const unitResult = validateUnit(unit);
    if (unitResult.error) return res.status(400).json({ error: unitResult.error });
    cleanUnit = unitResult.unit;
  }
  if (quantity !== undefined && quantity !== null) {
    const quantityResult = validateQuantity(quantity, cleanUnit);
    if (quantityResult.error) return res.status(400).json({ error: quantityResult.error });
    cleanQuantity = quantityResult.quantity;
  }

  const src = source ?? 'manual';
  const { data, error } = await supabase
    .from('shopping_cart_items')
    .insert({
      fridge_uid: req.fridgeUid,
      name,
      category_uid: category_uid ?? null,
      preset_uid: preset_uid ?? null,
      quantity: cleanQuantity,
      unit: cleanUnit,
      source: src,
      added_by_device_id: req.deviceId,
      owner_device_id: src === 'manual' ? req.deviceId : null,
    })
    .select()
    .single();

  // Arthur: NarIyirm
  // 中文：非手动来源受 idx_cart_dedupe 约束，同名项已在清单里时 23505 会命中；
  //       这时把已有行的数量/单位刷新为最新的补货差值，而不是让请求失败。
  // EN: Non-manual sources hit idx_cart_dedupe (23505) when the item is already listed;
  //     refresh the existing row's quantity/unit with the latest restock delta instead of failing.
  if (error?.code === '23505' && src !== 'manual') {
    const { data: updated, error: updateError } = await supabase
      .from('shopping_cart_items')
      .update({
        quantity: cleanQuantity,
        unit: cleanUnit,
        preset_uid: preset_uid ?? null,
        is_checked: false,
      })
      .eq('fridge_uid', req.fridgeUid)
      .eq('source', src)
      .ilike('name', name)
      .select()
      .single();
    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.status(200).json(updated);
  }
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/cart/:id/quantity -- change quantity (US5.2 edit)
router.patch('/cart/:id/quantity', requireFridge, async (req, res) => {
  // the ceiling scales by unit (g/ml allow much larger numbers), so look up
  // this row's current unit before validating -- to remove an item use DELETE instead
  const { data: existing, error: lookupError } = await supabase
    .from('shopping_cart_items')
    .select('unit')
    .eq('item_uid', req.params.id)
    .eq('fridge_uid', req.fridgeUid)
    .single();
  if (lookupError) return res.status(404).json({ error: 'not_found' });

  const quantityResult = validateQuantity(req.body?.quantity, existing.unit);
  if (quantityResult.error) return res.status(400).json({ error: quantityResult.error });

  const { data, error } = await supabase
    .from('shopping_cart_items')
    .update({ quantity: quantityResult.quantity })
    .eq('item_uid', req.params.id)
    .eq('fridge_uid', req.fridgeUid)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/cart/:id -- edit name/quantity/unit together (tap a row to reopen the add-to-cart form)
// 中文：只更新请求里出现的字段。
// EN: Only updates the fields present in the body.
router.patch('/cart/:id', requireFridge, async (req, res) => {
  const patch = {};
  if (req.body?.name !== undefined) {
    const nameResult = validateName(req.body.name);
    if (nameResult.error) return res.status(400).json({ error: nameResult.error });
    patch.name = nameResult.name;
  }
  if (req.body?.unit !== undefined) {
    const unitResult = validateUnit(req.body.unit);
    if (unitResult.error) return res.status(400).json({ error: unitResult.error });
    patch.unit = unitResult.unit;
  }
  if (req.body?.quantity !== undefined) {
    // validate against whichever unit this edit lands on -- the new one if it's
    // being changed in the same request, otherwise the row's current unit
    let unitForQuantity = patch.unit;
    if (unitForQuantity === undefined) {
      const { data: existing, error: lookupError } = await supabase
        .from('shopping_cart_items')
        .select('unit')
        .eq('item_uid', req.params.id)
        .eq('fridge_uid', req.fridgeUid)
        .single();
      if (lookupError) return res.status(404).json({ error: 'not_found' });
      unitForQuantity = existing.unit;
    }
    const quantityResult = validateQuantity(req.body.quantity, unitForQuantity);
    if (quantityResult.error) return res.status(400).json({ error: quantityResult.error });
    patch.quantity = quantityResult.quantity;
  }
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'no_fields' });

  const { data, error } = await supabase
    .from('shopping_cart_items')
    .update(patch)
    .eq('item_uid', req.params.id)
    .eq('fridge_uid', req.fridgeUid)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/cart/:id/toggle -- mark bought / not bought (shared)
// Arthur: NarIyirm
// 中文：购物完成状态属于共享行；此路由同时记录 checked_by_device_id 和 checked_at 供审计。
// EN: Purchase completion belongs to the shared row, and this route records checked_by_device_id plus checked_at for audit.
router.patch('/cart/:id/toggle', requireFridge, async (req, res) => {
  const isChecked = !!req.body.is_checked;
  const { data, error } = await supabase
    .from('shopping_cart_items')
    .update({
      is_checked: isChecked,
      checked_by_device_id: isChecked ? req.deviceId : null,
      checked_at: isChecked ? new Date().toISOString() : null,
    })
    .eq('item_uid', req.params.id)
    .eq('fridge_uid', req.fridgeUid)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/cart/:id
router.delete('/cart/:id', requireFridge, async (req, res) => {
  const { error } = await supabase
    .from('shopping_cart_items')
    .delete()
    .eq('item_uid', req.params.id)
    .eq('fridge_uid', req.fridgeUid);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

export default router;
