import express from 'express';
import { requireFridge } from '../middleware/requireFridge.js';
import { supabase } from '../supabase.js';

const router = express.Router();

// Arthur: NarIyirm
// 中文：设备只能读取当前已鉴权冰箱的成就；数据库在返回前以唯一来源键幂等补齐 XP 与解锁记录。
// EN: A device can read only its authenticated fridge; the database idempotently reconciles XP and unlocks from unique source keys before returning.
router.get('/achievements', requireFridge, async (request, response) => {
  const [{ data, error }, { data: levelRows, error: levelsError }] = await Promise.all([
    supabase.rpc('get_achievement_dashboard', { p_device_id: request.deviceId }),
    supabase
      .from('achievement_levels')
      .select('level, code, title_key, minimum_xp, mountain_key, theme_key')
      .eq('is_enabled', true)
      .order('level', { ascending: true }),
  ]);

  if (error || levelsError) {
    console.error('Achievement dashboard read failed:', error?.message ?? levelsError?.message);
    return response.status(503).json({ error: 'achievement_dashboard_unavailable' });
  }

  // Arthur: NarIyirm
  // 中文：预览等级所需阈值直接来自 migration 管理的等级表，客户端只计算“还差多少 XP”的展示值。
  // EN: Preview thresholds come directly from the migration-managed level table; the client only formats the remaining-XP display value.
  const levelCatalog = (levelRows ?? []).map((row) => ({
    level: row.level,
    code: row.code,
    titleKey: row.title_key,
    minimumXp: row.minimum_xp,
    mountainKey: row.mountain_key,
    themeKey: row.theme_key,
  }));

  return response.json({ ...data, levelCatalog });
});

export default router;
