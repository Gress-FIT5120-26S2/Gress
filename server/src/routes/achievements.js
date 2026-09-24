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
// 中文：阶段报告由数据库按冰箱时区汇总；沿用设备鉴权与成员校验，客户端不读取原始库存流水。
// EN: The database aggregates the stage report in fridge time, behind the existing device and membership checks.
router.get('/achievements/report', requireFridge, async (request, response) => {
  const { data, error } = await supabase.rpc('get_fridge_stage_report', { p_device_id: request.deviceId });
  if (error) {
    console.error('Achievement stage report read failed:', error.message);
    return response.status(503).json({ error: 'achievement_report_unavailable' });
  }
  return response.json(data);
});

// Arthur: NarIyirm
// 中文：任一每日/每周任务都可按分配 ID 更换；数据库统一校验归属、次数与候选可完成性。
// EN: Any daily or weekly slot can reroll by assignment ID; the database validates ownership, quota, and replacement eligibility.
router.post('/achievements/quests/reroll', requireFridge, async (request, response) => {
  const assignmentUid = typeof request.body?.assignmentUid === 'string' ? request.body.assignmentUid : '';
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(assignmentUid)) {
    return response.status(400).json({ error: 'invalid_quest_assignment' });
  }
  const { data, error } = await supabase.rpc('reroll_quest', { p_device_id: request.deviceId, p_assignment_uid: assignmentUid });
  if (error) {
    const message = error.message ?? '';
    if (message.includes('quest_reroll_exhausted')) {
      return response.status(409).json({ error: 'quest_reroll_exhausted' });
    }
    if (message.includes('quest_not_rerollable')) {
      return response.status(409).json({ error: 'quest_not_rerollable' });
    }
    if (message.includes('quest_reroll_unavailable')) {
      return response.status(409).json({ error: 'quest_reroll_unavailable' });
    }
    console.error('Quest reroll failed:', message);
    return response.status(503).json({ error: 'quest_reroll_unavailable' });
  }
  return response.json({ quests: data });
});

export default router;
