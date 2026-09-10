// server/src/routes/cart.js  (ESM)
// Shopping cart endpoints. Membership is verified by requireFridge, which
// reads the 'Device-ID' header. Mounted under /api in index.js.
import express from 'express';
import { supabase } from '../supabase.js';
import { requireFridge } from '../middleware/requireFridge.js';

const router = express.Router();

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
  const { name, category_uid, preset_uid, quantity, unit, source } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name_required' });
  const src = source ?? 'manual';
  const { data, error } = await supabase
    .from('shopping_cart_items')
    .insert({
      fridge_uid: req.fridgeUid,
      name: name.trim(),
      category_uid: category_uid ?? null,
      preset_uid: preset_uid ?? null,
      quantity: quantity ?? null,
      unit: unit ?? null,
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
        quantity: quantity ?? null,
        unit: unit ?? null,
        preset_uid: preset_uid ?? null,
        is_checked: false,
      })
      .eq('fridge_uid', req.fridgeUid)
      .eq('source', src)
      .ilike('name', name.trim())
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
  const quantity = Number(req.body?.quantity);
  // quantity must be a positive number; to remove an item use DELETE instead
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'invalid_quantity' });
  }
  const { data, error } = await supabase
    .from('shopping_cart_items')
    .update({ quantity })
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
