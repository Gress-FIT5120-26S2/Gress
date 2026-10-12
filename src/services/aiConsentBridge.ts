export const AI_CONSENT_VERSION = '2026-10-12';
const aiPaths = new Set([
  '/api/assistant/messages', '/api/learning/tutor/messages', '/api/photo-recognition',
  '/api/food-presets/generate', '/api/inventory/categories', '/api/waste-learning/profile',
  '/api/waste-learning/materials/prepare',
]);
let handler: ((force: boolean) => Promise<boolean>) | null = null;

// Arthur: NarIyirm
// 中文：业务 API 与 React 弹窗通过单一桥接沟通，只有会调用外部 AI 的写请求触发授权，预加载普通页面不会弹窗。
// EN: One bridge connects API requests to the React prompt; only external-AI writes request permission, keeping normal page preloads silent.
export function registerAiConsentHandler(next: (force: boolean) => Promise<boolean>) {
  handler = next;
  return () => { if (handler === next) handler = null; };
}
export function needsAiConsent(path: string, method = 'GET') {
  return method.toUpperCase() === 'POST' && aiPaths.has(path.split('?')[0]);
}
export async function askAiConsent(force = false) {
  return handler ? handler(force) : false;
}
