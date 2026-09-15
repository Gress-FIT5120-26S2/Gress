import express from 'express';
import { requireFridge } from '../middleware/requireFridge.js';
import { supabase } from '../supabase.js';

const router = express.Router();
const DISPLAY_NAME_MAX_LENGTH = 32;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

function serializeProfile(row) {
  return {
    avatarKey: row?.avatar_key ?? 'sage',
    displayName: row?.display_name ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

// Arthur: NarIyirm
// 中文：个人页只读取当前已鉴权设备的资料，不接受客户端传入任意 device_id。
// EN: The profile screen reads only the authenticated device profile and never accepts a client-selected device_id.
router.get('/profile', requireFridge, async (request, response) => {
  const { data, error } = await supabase
    .from('device_profiles')
    .select('display_name, avatar_key, updated_at')
    .eq('device_id', request.deviceId)
    .maybeSingle();

  if (error) return response.status(500).json({ error: error.message });
  return response.json(serializeProfile(data));
});

// Arthur: NarIyirm
// 中文：昵称由 Express 和数据库双重校验；写入后 profile trigger 会通知同一共享冰箱的其他成员刷新摘要。
// EN: Express and Postgres both validate display names; the profile trigger then tells shared-fridge members to refresh their summaries.
router.patch('/profile', requireFridge, async (request, response) => {
  const displayName = typeof request.body?.displayName === 'string'
    ? request.body.displayName.trim()
    : '';
  const displayNameLength = Array.from(displayName).length;

  if (!displayName
      || displayNameLength > DISPLAY_NAME_MAX_LENGTH
      || CONTROL_CHARACTER_PATTERN.test(displayName)) {
    return response.status(400).json({ error: 'invalid_display_name' });
  }

  const { data, error } = await supabase
    .from('device_profiles')
    .update({ display_name: displayName })
    .eq('device_id', request.deviceId)
    .select('display_name, avatar_key, updated_at')
    .single();

  if (error) return response.status(500).json({ error: error.message });
  return response.json(serializeProfile(data));
});

export default router;
