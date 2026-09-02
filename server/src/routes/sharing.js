import { createHash, randomInt } from 'node:crypto';
import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();
const INVITE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const recoveryAttempts = new Map();

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function randomReadableCode(groupCount, groupLength) {
  const groups = [];
  for (let group = 0; group < groupCount; group += 1) {
    let value = '';
    for (let index = 0; index < groupLength; index += 1) {
      value += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
    }
    groups.push(value);
  }
  return groups.join('-');
}

function normaliseCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

// Arthur: NarIyirm
// 中文：数据库 RPC 的稳定异常在此转换为 HTTP 状态和错误码；前端 SharedFridgeFlowModal 再负责本地化展示。
// EN: Stable database RPC exceptions become HTTP statuses and codes here before SharedFridgeFlowModal localizes them.
function sharingError(response, error) {
  const message = error?.message ?? 'sharing_failed';
  if (message.includes('invalid_fridge_name')) return response.status(400).json({ error: 'invalid_fridge_name' });
  if (message.includes('invite_not_found')) return response.status(404).json({ error: 'invite_not_found' });
  if (message.includes('invite_expired')) return response.status(410).json({ error: 'invite_expired' });
  if (message.includes('invite_used')) return response.status(410).json({ error: 'invite_used' });
  if (message.includes('invite_revoked')) return response.status(410).json({ error: 'invite_revoked' });
  if (message.includes('invite_unavailable')) return response.status(410).json({ error: 'invite_unavailable' });
  if (message.includes('already_in_fridge')) return response.status(409).json({ error: 'already_in_fridge' });
  if (message.includes('source_must_be_personal')) return response.status(409).json({ error: 'source_must_be_personal' });
  if (message.includes('source_must_have_one_member')) return response.status(409).json({ error: 'source_must_have_one_member' });
  if (message.includes('target_fridge_unavailable')) return response.status(410).json({ error: 'target_fridge_unavailable' });
  if (message.includes('no_fridge')) return response.status(409).json({ error: 'no_fridge' });
  if (message.includes('not_in_shared_fridge')) return response.status(409).json({ error: 'not_in_shared_fridge' });
  if (message.includes('recovery_code_not_found')) return response.status(404).json({ error: 'recovery_code_not_found' });
  if (message.includes('recovery_same_device')) return response.status(409).json({ error: 'recovery_same_device' });
  console.error('Shared fridge operation failed:', message);
  return response.status(503).json({ error: 'sharing_unavailable' });
}

// Arthur: NarIyirm
// 中文：所有共享成功响应复用此读取器，返回冰箱、有效邀请、匿名成员顺序和当前设备恢复配置。
// EN: Sharing success responses reuse this reader for fridge, active invite, anonymous member order, and current-device recovery configuration.
async function readContext(deviceId, fridgeUid) {
  const now = new Date().toISOString();
  const [fridgeResult, membersResult, inviteResult, recoveryResult] = await Promise.all([
    supabase.from('fridges').select('fridge_uid, name, mode').eq('fridge_uid', fridgeUid).single(),
    supabase.from('fridge_members').select('device_id, joined_at').eq('fridge_uid', fridgeUid).order('joined_at', { ascending: true }),
    supabase.from('fridge_invites').select('code, expires_at').eq('fridge_uid', fridgeUid).eq('status', 'active').gt('expires_at', now).order('created_at', { ascending: false }).limit(1),
    supabase.from('device_recovery_credentials').select('device_id').eq('device_id', deviceId).maybeSingle(),
  ]);
  const failed = [fridgeResult, membersResult, inviteResult, recoveryResult].find((result) => result.error);
  if (failed?.error) throw failed.error;
  const memberIds = (membersResult.data ?? []).map((member) => member.device_id);
  const profilesResult = memberIds.length > 0
    ? await supabase
      .from('device_profiles')
      .select('device_id, display_name, avatar_key')
      .in('device_id', memberIds)
    : { data: [], error: null };
  if (profilesResult.error) throw profilesResult.error;
  const profileByDevice = new Map((profilesResult.data ?? []).map((profile) => [profile.device_id, profile]));

  // Arthur: NarIyirm
  // 中文：成员摘要只返回昵称、头像令牌和顺序，不把真实 device_id 暴露给同一冰箱的其他设备。
  // EN: Member summaries expose only names, avatar tokens, and order without leaking real device IDs to other devices in the fridge.
  const members = (membersResult.data ?? []).map((member, index) => ({
    avatarKey: profileByDevice.get(member.device_id)?.avatar_key ?? 'sage',
    displayName: profileByDevice.get(member.device_id)?.display_name ?? null,
    index: index + 1,
    isCurrent: member.device_id === deviceId,
    joinedAt: member.joined_at,
  }));
  const activeInvite = inviteResult.data?.[0] ?? null;
  return {
    activeInvite: activeInvite ? { code: activeInvite.code, expiresAt: activeInvite.expires_at } : null,
    fridge: {
      memberCount: members.length,
      mode: fridgeResult.data.mode,
      name: fridgeResult.data.name,
      uid: fridgeResult.data.fridge_uid,
    },
    members,
    recoveryConfigured: Boolean(recoveryResult.data),
  };
}

// Arthur: NarIyirm
// 中文：创建家庭冰箱和轮换邀请码共用此流程；随机码冲突最多重试四次，事务 RPC 会撤销旧码。
// EN: Family-fridge creation and invite rotation share this flow; random-code collisions retry four times and the transactional RPC revokes the old code.
async function issueInvite(response, deviceId, fridgeName = null) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Arthur: NarIyirm
  // 中文：创建与轮换共用同一事务 RPC；名称为空时保留当前名称，任何新码都会立即撤销旧码。
  // EN: Creation and rotation share one transactional RPC; a blank name preserves the current name and every new code immediately revokes the old one.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = randomReadableCode(2, 4).replace('-', '');
    const { data, error } = await supabase.rpc('configure_shared_fridge', {
      p_code: code,
      p_device_id: deviceId,
      p_expires_at: expiresAt,
      p_fridge_name: fridgeName,
    });
    if (!error) {
      const configured = Array.isArray(data) ? data[0] : data;
      try {
        const context = await readContext(deviceId, configured?.fridge_uid);
        return response.status(201).json(context);
      } catch (contextError) {
        return sharingError(response, contextError);
      }
    }
    if (!error.message.includes('duplicate key')) return sharingError(response, error);
  }

  return response.status(503).json({ error: 'invite_generation_failed' });
}

router.get('/fridges/context', async (request, response) => {
  try {
    return response.json(await readContext(request.deviceId, request.fridgeUid));
  } catch (error) {
    return sharingError(response, error);
  }
});

router.post('/fridges/invites', async (request, response) => {
  return issueInvite(response, request.deviceId);
});

router.post('/fridges/share', async (request, response) => {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  if (!name || name.length > 80) return response.status(400).json({ error: 'invalid_fridge_name' });
  return issueInvite(response, request.deviceId, name);
});

router.patch('/fridges/current', async (request, response) => {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  if (!name || name.length > 80) return response.status(400).json({ error: 'invalid_fridge_name' });
  const { data: fridgeUid, error } = await supabase.rpc('rename_current_fridge', {
    p_device_id: request.deviceId,
    p_fridge_name: name,
  });
  if (error) return sharingError(response, error);

  try {
    const context = await readContext(request.deviceId, fridgeUid);
    return response.json(context);
  } catch (contextError) {
    return sharingError(response, contextError);
  }
});

// Arthur: NarIyirm
// 中文：前端输入或扫码后进入此路由；join_shared_fridge RPC 锁定邀请和冰箱，在一个事务中完成数据合并与成员切换。
// EN: Typed or scanned invites enter here; join_shared_fridge locks invite and fridges and completes data merge plus membership switch in one transaction.
router.post('/fridges/join', async (request, response) => {
  const code = normaliseCode(request.body?.code).replaceAll('-', '');
  if (code.length < 6 || code.length > 64) return response.status(400).json({ error: 'invalid_invite_code' });

  const { data: fridgeUid, error } = await supabase.rpc('join_shared_fridge', {
    p_code: code,
    p_device_id: request.deviceId,
  });
  if (error) return sharingError(response, error);

  try {
    const context = await readContext(request.deviceId, fridgeUid);
    return response.json(context);
  } catch (contextError) {
    return sharingError(response, contextError);
  }
});

// Arthur: NarIyirm
// 中文：共享管理页确认退出后进入此路由；leave_shared_fridge 创建个人容器并按 owner_device_id 迁移当前设备数据。
// EN: Confirmed leave enters here; leave_shared_fridge creates a personal container and moves current-device data by owner_device_id.
router.post('/fridges/leave', async (request, response) => {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : 'My Fridge';
  const { data: fridgeUid, error } = await supabase.rpc('leave_shared_fridge', {
    p_device_id: request.deviceId,
    p_personal_fridge_name: name || 'My Fridge',
  });
  if (error) return sharingError(response, error);

  try {
    const context = await readContext(request.deviceId, fridgeUid);
    return response.json(context);
  } catch (contextError) {
    return sharingError(response, contextError);
  }
});

router.post('/devices/recovery-code', async (request, response) => {
  const recoveryCode = randomReadableCode(5, 5);
  const { error } = await supabase.rpc('set_device_recovery_code', {
    p_device_id: request.deviceId,
    p_recovery_digest: digest(recoveryCode.replaceAll('-', '')),
  });
  if (error) return sharingError(response, error);
  return response.status(201).json({ recoveryCode });
});

// Arthur: NarIyirm
// 中文：这是唯一在 requireDevice 前挂载的恢复入口；用一次性码和速率限制自鉴权，成功后撤销旧设备凭证。
// EN: This is the only recovery route mounted before requireDevice; a one-time code and rate limit self-authenticate before revoking the old credential.
export async function recoverDeviceRoute(request, response) {
  const deviceId = request.get('Device-ID')?.trim();
  const deviceCredential = request.get('Device-Credential')?.trim();
  const recoveryCode = normaliseCode(request.body?.recoveryCode).replaceAll('-', '');
  if (!deviceId || deviceId.length < 3 || deviceId.length > 200
      || !deviceCredential || !/^[0-9a-f]{64}$/i.test(deviceCredential)
      || recoveryCode.length < 20 || recoveryCode.length > 64) {
    return response.status(400).json({ error: 'invalid_recovery_code' });
  }

  // Arthur: NarIyirm
  // 中文：恢复码是唯一绕过旧设备凭证的入口；按来源与新设备限制尝试次数，成功后立即清除计数并轮换恢复码。
  // EN: Recovery is the only route bypassing the old device credential; attempts are limited per source and new device, then cleared and rotated on success.
  const attemptKey = `${request.ip}:${deviceId}`;
  const now = Date.now();
  const attempt = recoveryAttempts.get(attemptKey);
  const currentAttempt = !attempt || attempt.resetAt <= now
    ? { count: 0, resetAt: now + RECOVERY_WINDOW_MS }
    : attempt;
  if (currentAttempt.count >= 5) return response.status(429).json({ error: 'recovery_rate_limited' });
  currentAttempt.count += 1;
  recoveryAttempts.set(attemptKey, currentAttempt);

  const nextRecoveryCode = randomReadableCode(5, 5);
  const { data: fridgeUid, error } = await supabase.rpc('recover_device', {
    p_new_credential_digest: digest(deviceCredential),
    p_new_device_id: deviceId,
    p_next_recovery_digest: digest(nextRecoveryCode.replaceAll('-', '')),
    p_recovery_digest: digest(recoveryCode),
  });
  if (error) return sharingError(response, error);

  try {
    const context = await readContext(deviceId, fridgeUid);
    recoveryAttempts.delete(attemptKey);
    return response.json({ ...context, recoveryCode: nextRecoveryCode });
  } catch (contextError) {
    return sharingError(response, contextError);
  }
}

export default router;
