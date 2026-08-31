// server/src/routes/restock.js  (ESM)
// Derived "need to buy" list via the get_restock_suggestions() function.
// Mounted under /api in index.js.
import express from 'express';
import { supabase } from '../supabase.js';
import { requireFridge } from '../middleware/requireFridge.js';

const router = express.Router();

// GET /api/restock -- suggested buys for the caller's fridge
// Arthur: NarIyirm
// 中文：RestockView 从此读取派生建议；get_restock_suggestions 按当前 fridgeUid 聚合活跃库存，不保存结果表。
// EN: RestockView reads derived suggestions here; get_restock_suggestions aggregates active stock for the current fridgeUid without storing a result table.
router.get('/restock', requireFridge, async (req, res) => {
  const { data, error } = await supabase.rpc('get_restock_suggestions', {
    p_fridge: req.fridgeUid,
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
