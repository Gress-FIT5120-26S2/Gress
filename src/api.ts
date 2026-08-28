import { getDeviceId } from './services/deviceId';
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export async function getApiHealth(): Promise<void> {
  // Arthur: NarIyirm
  // 中文：客户端只保存 Express 地址；Supabase 密钥始终只在后端使用。
  // EN: The client stores only the Express URL; Supabase keys remain server-only.
  if (!apiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured');
  }

  const deviceId = await getDeviceId();

  const response = await fetch(`${apiUrl}/api/health`, {
    headers: {
      'Device-ID': deviceId,
    },
  });
  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`);
  }

  // Arthur: NarIyirm
  // 中文：后端只返回连接状态，不把用户或数据库内容发送到 App。
  // EN: The API returns connection status only, never user or database data to the app.
  const result: { database?: string } = await response.json();
  if (result.database !== 'connected') {
    throw new Error('Supabase is not connected');
  }
}
