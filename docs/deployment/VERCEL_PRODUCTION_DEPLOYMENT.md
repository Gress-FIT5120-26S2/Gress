# KitchMemo Vercel 生产部署手册

> 状态：已记录，尚未执行生产部署。最后核对日期：2026-09-02。
>
> 本文用于后续把 `server/` 中的 Express API 部署到 Vercel。执行前必须再次确认 Vercel、Gemini、Cloudflare 和 Supabase 的当前限制与价格。

## 1. 部署边界

- Vercel 只托管 `server/` 中的 Express API；在 Vercel 项目设置中将 **Root Directory** 设为 `server`。
- Expo App 只保存 `EXPO_PUBLIC_API_URL`，指向 Vercel 后端域名。
- Gemini、Cloudflare Workers AI 和 Supabase Secret Key 只能存在于 Vercel 服务端环境变量中，不能使用 `EXPO_PUBLIC_` 前缀。
- Preview 环境不得连接生产 Supabase，避免预览分支写入正式库存和 preset。
- Vercel 会把 Express 应用作为一个无状态 Function 运行；不要依赖进程内缓存、定时器或本地文件持久化。

当前 `server/src/index.js` 位于 Vercel 可识别的 Express 入口位置，并使用端口监听模式。首次部署仍需在 Preview 中验证全部路由。官方参考：[Express on Vercel](https://vercel.com/docs/frameworks/backend/express)。

## 2. 生产凭证准备

生产环境使用与开发环境分离的凭证：

1. 在 [Google AI Studio API Keys](https://aistudio.google.com/apikey) 创建生产专用 Gemini Auth Key，关联独立的 Google Cloud 项目。
2. 在 Cloudflare Dashboard 的 **Workers AI → Use REST API** 创建生产专用 API Token。
3. Cloudflare Token 只授予目标 Account 的 `Workers AI: Read` 和 `Workers AI: Edit/Write` 权限，不使用 Global API Key。
4. 从生产 Supabase 项目的 **Project Settings → API** 取得 Project URL、Secret Key 和 Publishable Key。
5. 所有凭证只保存到对应平台的 Secret/Environment Variables，不写入 Git、聊天、截图或 Expo 构建变量。

参考文档：

- [Gemini API Key 安全说明](https://ai.google.dev/gemini-api/docs/api-key)
- [Cloudflare Workers AI REST API 凭证](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
- [Vercel 环境变量管理](https://vercel.com/docs/environment-variables/managing-environment-variables)

## 3. 创建 Vercel 项目

1. 在 Vercel 导入 KitchMemo Git 仓库。
2. 创建独立的后端项目，例如 `kitchmemo-api`。
3. 设置 **Root Directory** 为 `server`。
4. 使用 Node.js 20 或更新的受支持版本。
5. 保持 Vercel 的 Express 自动检测；首轮不设置自定义 Output Directory。
6. 先创建 Preview Deployment，不立即绑定 App 的生产 API 地址。
7. 在 Preview 验证通过后，再将生产分支部署到 Production。

Vercel Express 自动检测或仓库布局后续发生变化时，再添加 `vercel.json`；不要为了首次部署预先加入旧式 `builds`/`routes` 配置。

## 4. Vercel 环境变量

在 **Project → Settings → Environment Variables** 中配置。密钥类变量应标记为 Sensitive；修改任意变量后必须重新部署，因为旧 Deployment 不会自动读取新值。

### Production

```env
NODE_ENV=production

SUPABASE_URL=https://<production-project-ref>.supabase.co
SUPABASE_SECRET_KEY=<production-secret-key>
SUPABASE_PUBLISHABLE_KEY=<production-publishable-key>

FOOD_RECOGNITION_API_URL=https://d12q94a0v4ih7q.cloudfront.net/predict

GEMINI_API_KEY=<production-gemini-auth-key>
GEMINI_PRESET_MODEL=gemini-3.5-flash-lite

CLOUDFLARE_ACCOUNT_ID=<cloudflare-account-id>
CLOUDFLARE_AI_API_TOKEN=<production-workers-ai-token>
CLOUDFLARE_ICON_MODEL=@cf/black-forest-labs/flux-1-schnell
```

不要在 Vercel 中手动设置 `PORT`，由平台提供运行端口。

### Preview

Preview 使用独立的开发或测试 Supabase 项目、Gemini Key 和 Cloudflare Token。不要把 Production Secret 同时勾选给 Preview，除非部署负责人已经明确评估并批准。

### Expo / EAS Production

Expo 生产环境只配置：

```env
EXPO_PUBLIC_API_URL=https://<production-api-domain>
```

禁止配置 `EXPO_PUBLIC_GEMINI_API_KEY`、`EXPO_PUBLIC_CLOUDFLARE_AI_API_TOKEN` 或任何 Supabase Secret Key。

## 5. 上线顺序

严格按以下顺序执行：

1. 确认最新 migration 已先在开发/测试 Supabase 应用并验证。
2. 将 CLI 链接到准确的生产 Supabase project ref，复核项目名称和 URL。
3. 先执行 `npx supabase db push --dry-run`，人工检查待应用 migration。
4. 执行 `npx supabase db push`，禁止对生产执行 reset。
5. 执行 `npx supabase db lint --linked --level warning`。
6. 创建 Vercel Preview Deployment，并配置 Preview 专用变量。
7. 验证 Preview 后端及 AI 流程。
8. 配置 Production 变量并部署 Vercel Production。
9. 验证生产后端，再更新 EAS 的 `EXPO_PUBLIC_API_URL` 并发布 App。
10. 最后按需对已有 preset 执行一次 icon 回填。

## 6. 验收清单

- `GET https://<api-domain>/api/health` 返回数据库已连接。
- App 可以注册/恢复设备，并正常读取冰箱、库存、购物车和通知。
- 输入已有食材或别名时命中同一个 `food_presets.uid`。
- 输入未知食材并点击“AI 一键生成”后，能够得到名称、别名、储存建议和标准化 PNG icon。
- 生成记录写入 `food_presets`，icon 写入 `food-preset-icons` Storage bucket。
- 再次输入相同名称或别名时不重复调用 AI。
- `inventory_batches.preset_uid` 正常指向命中的 preset。
- Vercel 日志中没有打印 API Key、Token、完整用户数据或 AI 原始敏感响应。
- 在真实移动网络下验证 CORS、请求超时和图片加载。

图标生成当前允许约 45 秒的上游等待时间。上线前确认 Vercel 当前 Function 时长限制能够覆盖该请求；如不满足，应把 icon 生成改为异步任务，而不是单纯继续提高客户端超时。

## 7. 生产 preset icon 回填

回填脚本会连接环境变量指定的 Supabase，并消耗 Cloudflare Workers AI 配额。执行前必须打印并人工核对目标 `SUPABASE_URL` 的项目 ref，且不要输出 Secret Key。

推荐从已链接的 `server/` Vercel 项目目录运行一次性命令，使进程临时读取 Production 环境变量而不把密钥写入仓库：

```powershell
vercel env run -e production -- npm run backfill:preset-icons
```

脚本只处理启用且 `icon_path` 仍为空的 preset，每条成功后立即保存，可以在中断后安全重跑。首次执行应先观察少量日志和 Cloudflare 用量，再决定是否完成整批。

## 8. 上线前必须补充的保护

- 当前 AI 生成限流是进程内限流；Vercel 多实例之间不共享。公开上线前应增加 Vercel Firewall、网关或数据库级全局限流。
- 为 Gemini、Cloudflare 和 Vercel 设置用量/预算告警。
- 保留手动填写库存建议及 Emoji fallback，使免费额度耗尽或 AI 服务失败时仍可保存食材。
- 监控 AI 请求成功率、延迟、429、上游 5xx 和 icon Storage 上传失败，但不要记录密钥或完整设备凭证。

## 9. 凭证轮换

1. 在 Gemini 或 Cloudflare 创建新凭证，暂不撤销旧凭证。
2. 更新 Vercel Production Environment Variable。
3. 重新部署 Production，并完成健康检查和一次 AI 生成验证。
4. 验证成功后再撤销旧凭证。
5. 如果凭证疑似泄露，检查对应平台的用量记录，并同时检查 Preview 和旧 Deployment。

Vercel 环境变量只对新 Deployment 生效；轮换后必须重新部署。官方参考：[Rotating environment variables](https://vercel.com/docs/environment-variables/rotating-secrets)。
