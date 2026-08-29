import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { supabase } from './supabase.js';
import cartRouter from './routes/cart.js';
import restockRouter from './routes/restock.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());
app.use('/api', cartRouter);
app.use('/api', restockRouter);

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

app.listen(port, () => {
  console.log(`KitchMemo API listening on http://localhost:${port}`);
});
