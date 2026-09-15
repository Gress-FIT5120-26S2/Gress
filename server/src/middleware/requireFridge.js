// server/src/middleware/requireFridge.js
export async function requireFridge(req, res, next) {
  // Arthur: NarIyirm
  // 中文：全局设备中间件已经验证凭证并解析冰箱；业务路由只消费可信上下文，避免再次仅凭 Device-ID 初始化。
  // EN: Global device middleware has already verified the credential and resolved the fridge; domain routes consume that trusted context.
  if (!req.deviceId || !req.fridgeUid) {
    return res.status(401).json({ error: 'no_device' });
  }
  return next();
}
