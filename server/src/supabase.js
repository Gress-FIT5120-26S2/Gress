import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) in server/.env',
  );
}

// Arthur: NarIyirm
// 中文：此客户端仅在 Express 运行；秘密密钥绝不能打包进 Expo App。
// EN: This client runs only in Express; its secret key must never be bundled into Expo.
export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
