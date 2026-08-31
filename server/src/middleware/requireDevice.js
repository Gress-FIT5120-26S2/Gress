import { createHash } from 'node:crypto';
import { supabase } from '../supabase.js';

const DEVICE_ID_PATTERN = /^.{3,200}$/u;
const DEVICE_CREDENTIAL_PATTERN = /^[0-9a-f]{64}$/i;

function digestCredential(credential) {
  return createHash('sha256').update(credential, 'utf8').digest('hex');
}

export async function authenticateDeviceCredentials(deviceId, credential) {
  if (!deviceId || !DEVICE_ID_PATTERN.test(deviceId) || !credential || !DEVICE_CREDENTIAL_PATTERN.test(credential)) {
    return { error: 'invalid_device', fridgeUid: null };
  }

  // Arthur: NarIyirm
  // 中文：设备鉴权集中在一个函数中，普通业务请求和轻量同步探针使用完全相同的权限边界。
  // EN: Device authentication stays centralized so domain requests and lightweight sync probes use the exact same authorization boundary.
  const { data: fridgeUid, error } = await supabase.rpc('authenticate_device', {
    p_credential_digest: digestCredential(credential),
    p_device_id: deviceId,
  });

  if (error || !fridgeUid) {
    if (error && !error.message.includes('invalid_device_credential')) {
      console.error('Device authentication failed:', error.message);
    }
    return { error: 'invalid_device_credential', fridgeUid: null };
  }

  return { error: null, fridgeUid };
}

export async function requireDevice(request, response, next) {
  const deviceId = request.get('Device-ID')?.trim();
  const credential = request.get('Device-Credential')?.trim();
  const authenticated = await authenticateDeviceCredentials(deviceId, credential);

  if (!authenticated.fridgeUid) {
    return response.status(401).json({ error: authenticated.error });
  }

  request.deviceId = deviceId;
  request.fridgeUid = authenticated.fridgeUid;
  return next();
}
