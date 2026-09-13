import express from 'express';
import { requireFridge } from '../middleware/requireFridge.js';
import { supabase } from '../supabase.js';

const router = express.Router();

// Arthur: NarIyirm
// 中文：设备只能读取当前已鉴权冰箱的成就；数据库在返回前以唯一来源键幂等补齐 XP 与解锁记录，并附带当日/当周挑战。
// EN: A device can read only its authenticated fridge; the database reconciles XP/unlocks and attaches the current daily/weekly quests before returning.
router.get('/achievements', requireFridge, async (request, response) => {
  const [{ data, error }, { data: levelRows, error: levelsError }, { data: quests, error: questsError }] = await Promise.all([
    supabase.rpc('get_achievement_dashboard', { p_device_id: request.deviceId }),
    supabase
      .from('achievement_levels')
      .select('level, code, title_key, minimum_xp, mountain_key, theme_key')
      .eq('is_enabled', true)
      .order('level', { ascending: true }),
    supabase.rpc('get_fridge_quests', { p_device_id: request.deviceId }),
  ]);

  if (error || levelsError || questsError) {
    console.error('Achievement dashboard read failed:', error?.message ?? levelsError?.message ?? questsError?.message);
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

  return response.json({ ...data, levelCatalog, quests });
});

// Arthur: NarIyirm
// 中文：每周挑战更换由数据库校验次数与可完成性；Express 只透传结果与稳定错误码。
// EN: Weekly quest rerolls are validated for quota and eligibility in the database; Express only forwards the result and stable error codes.
router.post('/achievements/quests/reroll', requireFridge, async (request, response) => {
  const { data, error } = await supabase.rpc('reroll_weekly_quest', { p_device_id: request.deviceId });
  if (error) {
    const message = error.message ?? '';
    if (message.includes('weekly_quest_reroll_exhausted')) {
      return response.status(409).json({ error: 'weekly_quest_reroll_exhausted' });
    }
    if (message.includes('weekly_quest_not_rerollable')) {
      return response.status(409).json({ error: 'weekly_quest_not_rerollable' });
    }
    if (message.includes('weekly_quest_reroll_unavailable')) {
      return response.status(409).json({ error: 'weekly_quest_reroll_unavailable' });
    }
    console.error('Weekly quest reroll failed:', message);
    return response.status(503).json({ error: 'weekly_quest_reroll_unavailable' });
  }
  return response.json({ quests: data });
});

export default router;
