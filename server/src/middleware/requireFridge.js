// server/src/middleware/requireFridge.js
// Resolves the caller's fridge from the 'Device-ID' header and confirms
// membership. Node lowercases header names, so we read 'device-id'.
// Attaches req.deviceId and req.fridgeUid for downstream handlers.
import { supabase } from '../supabase.js';

export async function requireFridge(req, res, next) {
  const deviceId = req.headers['device-id'];
  if (!deviceId) return res.status(401).json({ error: 'no_device' });

  const { data, error } = await supabase
    .from('fridge_members')
    .select('fridge_uid')
    .eq('device_id', deviceId)
    .single();

  if (error || !data) return res.status(403).json({ error: 'no_fridge' });

  req.deviceId = deviceId;
  req.fridgeUid = data.fridge_uid;
  next();
}