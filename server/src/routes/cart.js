// server/src/routes/cart.js  (ESM)
// Shopping cart endpoints. Membership is verified by requireFridge, which
// reads the 'Device-ID' header. Mounted under /api in index.js.
import express from 'express';
import { supabase } from '../supabase.js';
import { requireFridge } from '../middleware/requireFridge.js';

const router = express.Router();

// GET /api/cart -- the whole shared list, unchecked items first
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
router.post('/cart', requireFridge, async (req, res) => {
  const { name, category_uid, preset_uid, quantity, unit, source } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name_required' });
  const { data, error } = await supabase
    .from('shopping_cart_items')
    .insert({
      fridge_uid: req.fridgeUid,
      name: name.trim(),
      category_uid: category_uid ?? null,
      preset_uid: preset_uid ?? null,
      quantity: quantity ?? null,
      unit: unit ?? null,
      source: source ?? 'manual',
      added_by_device_id: req.deviceId,
      owner_device_id: (source ?? 'manual') === 'manual' ? req.deviceId : null,
    })
    .select()
    .single();
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
