import cors from 'cors';
import express from 'express';
import { inventoryRouter } from './routes/inventory.js';
import { recognitionRouter } from './routes/recognition.js';
import { supabase } from './supabase.js';
import cartRouter from './routes/cart.js';
import restockRouter from './routes/restock.js';
import notificationsRouter from './routes/notifications.js';
import profileRouter from './routes/profile.js';
import sharingRouter, { recoverDeviceRoute } from './routes/sharing.js';
import syncRouter from './routes/sync.js';
import { requireDevice } from './middleware/requireDevice.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_request, response) => {
  // Arthur: NarIyirm
  // 中文：使用管理员鉴权验证 Express 能连到 Supabase，但不向 App 返回记录或密钥。
  // EN: Verify Express can reach Supabase with admin auth without returning records or keys to the app.
  const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

  if (error) {
    console.error('Supabase health check failed:', error.message);
    return response.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }

  return response.json({ status: 'ok', database: 'connected' });
});

// Arthur: NarIyirm
// 中文：恢复入口在常规鉴权前用一次性恢复码自证，兼容 Android 重装后 ID 相同但 SecureStore 凭证已丢失；其它 API 仍必须验证设备凭证。
// EN: Recovery self-authenticates with a one-time code before normal auth, covering Android reinstalls where the ID remains but SecureStore is lost; all other APIs verify device credentials.
app.post('/api/devices/recover', recoverDeviceRoute);
app.use('/api', requireDevice);
app.use('/api', inventoryRouter);
app.use('/api', cartRouter);
app.use('/api', restockRouter);
app.use('/api', notificationsRouter);
app.use('/api', profileRouter);
app.use('/api', recognitionRouter);
app.use('/api', sharingRouter);
app.use('/api', syncRouter);

// 中文：必须绑 0.0.0.0，Expo Go 才能用局域网 IP 访问；只绑 localhost 时电脑 curl 通、手机保存会失败。
// EN: Bind 0.0.0.0 so Expo Go can reach the API over LAN; localhost-only binds work in curl but fail when saving from a phone.
const server = app.listen(port, '0.0.0.0', (error) => {
  if (error) {
    console.error('Failed to start KitchMemo API:', error.message);
    if (error.code === 'EACCES') {
      console.error(`Port ${port} is blocked on this machine. Pick another PORT in server/.env.development and match it in EXPO_PUBLIC_API_URL.`);
    }
    process.exit(1);
  }

  console.log(`KitchMemo API listening on http://0.0.0.0:${port} (phone: http://<this-pc-lan-ip>:${port})`);
});

server.on('error', (error) => {
  console.error('KitchMemo API server error:', error.message);
});
