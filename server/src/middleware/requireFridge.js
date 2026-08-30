// server/src/middleware/requireFridge.js
// Resolves the caller's fridge from the 'Device-ID' header.
// Node lowercases header names, so we read 'device-id'.
import { supabase } from '../supabase.js';

export async function requireFridge(req, res, next) {
  const deviceId = req.headers['device-id']?.trim();
  if (!deviceId || deviceId.length < 3 || deviceId.length > 200) {
    return res.status(401).json({ error: 'no_device' });
  }

  // 中文：通知和购物车也会在首次请求时创建个人冰箱，避免只打开过信箱的设备得到 no_fridge。
  // EN: Notifications and cart bootstrap a personal fridge on first request so a mailbox-only device is not rejected.
  const { data: fridgeUid, error } = await supabase.rpc('bootstrap_device', {
    p_device_id: deviceId,
    p_fridge_name: 'My Fridge',
  });

  if (error || !fridgeUid) {
    return res.status(500).json({ error: error?.message ?? 'no_fridge' });
  }

  req.deviceId = deviceId;
  req.fridgeUid = fridgeUid;
  next();
}
