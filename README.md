# KitchMemo

> Keep your kitchen fresh, organised, and memorable.

[中文](#中文) · [English](#english)

---

## 中文

KitchMemo 是一款以互动式 3D 厨房为核心体验的智能食材管理应用。它将冰箱库存、保质期提醒、购物计划与家庭共享连接在一起，帮助年轻家庭轻松掌握食材状态、减少浪费，并在需要时获得恰到好处的建议。

### 核心功能

- **3D 厨房主页**：通过冰箱、购物车和邮箱等场景入口自然呈现家庭状态。
- **冰箱库存管理**：记录食材数量、分类、购买日期、保质期和储存位置。
- **多种录入方式**：支持手动录入、条码查询和食材照片识别。
- **智能保鲜提醒**：围绕临期食材生成应用内提醒与系统通知。
- **购物辅助**：结合现有库存维护购物车，并在结账后同步库存变化。
- **共享冰箱**：通过邀请机制与家庭成员共享同一份库存数据。
- **Spoonie AI 助手**：基于当前冰箱上下文提供食材与库存建议。
- **成就与任务**：用轻量化的成就、每日任务和每周任务鼓励减少食物浪费。
- **中英双语**：中文为默认语言，并支持完整的英文界面。

### 技术架构

| 层级 | 技术 |
| --- | --- |
| 客户端 | Expo SDK 57、React Native 0.86、React 19、TypeScript |
| 3D 场景 | Three.js、React Three Fiber、Drei、Expo GL |
| 后端 | Node.js、Express 5 |
| 数据与实时同步 | Supabase Postgres、Storage、Realtime Broadcast |
| 外部能力 | OpenAI、Gemini、Cloudflare Workers AI、Open Food Facts、食材图片识别服务 |
| 部署 | EAS（移动端）、Vercel（Express API） |

客户端只通过 Express API 读写业务数据。Supabase Secret Key、AI 密钥及其他私密配置始终保留在服务端；客户端仅接收设备认证后所需的公开 Realtime 连接信息。

### 仓库结构

```text
KitchMemo/
├── App.tsx                 # 应用入口与主要页面编排
├── src/
│   ├── components/         # 页面、3D 场景和可复用组件
│   ├── services/           # API、设备身份、通知与实时同步
│   └── utils/              # 客户端校验与通用逻辑
├── server/
│   ├── src/routes/         # Express 业务路由
│   ├── src/services/       # AI、通知与服务端业务编排
│   └── scripts/            # 数据回填与验证脚本
├── supabase/
│   ├── migrations/         # 数据库 schema 与行为的版本化来源
│   └── seed.sql            # 可复现的非用户参考数据
├── models/                 # 3D 厨房与 Spoonie 模型
├── assets/                 # App 图标及通用静态资源
└── docs/                   # 架构、业务规则、AI 与部署文档
```

### 本地开发

#### 环境要求

- Node.js 20 或更新的受支持版本
- npm
- 一个开发或测试用 Supabase 项目
- Android Emulator、iOS Simulator，或安装了兼容客户端的真机
- 如需维护数据库：Supabase CLI

#### 1. 安装依赖

```powershell
npm install
npm install --prefix server
```

#### 2. 配置环境变量

```powershell
Copy-Item .env.example .env.development
Copy-Item server\.env.example server\.env.development
```

客户端仅需设置 Express API 地址：

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
```

- Android Emulator 使用 `http://10.0.2.2:3001`。
- iOS Simulator 或 Web 使用 `http://localhost:3001`。
- 真机使用开发电脑的局域网 IP，例如 `http://192.168.1.20:3001`。

服务端至少需要以下 Supabase 配置：

```env
SUPABASE_URL=https://your-test-project-ref.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

AI 助手、新食材建议与图标生成还需要 OpenAI、Gemini 和 Cloudflare 凭证。完整字段请以 [`server/.env.example`](server/.env.example) 为准。

> 不要提交本地环境文件或任何真实密钥。不要给服务端密钥添加 `EXPO_PUBLIC_` 前缀。

#### 3. 准备数据库

将 Supabase CLI 链接到开发或测试项目后执行：

```powershell
npx supabase db push
npx supabase db push --include-seed
```

第二条命令会额外写入可复现的参考数据。数据库结构以 [`supabase/migrations`](supabase/migrations) 中按时间排序的 migration 为准。

#### 4. 启动项目

```powershell
npm start
npm run start:clear
```

也可以在不同终端分别运行 `npm run server` 和 `npm run start:expo`。服务端默认监听 `http://localhost:3001`；使用 `GET http://localhost:3001/api/health` 检查 Supabase 连接。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm start` | 同时启动 API 与 Expo 开发服务器 |
| `npm run start:clear` | 清理 Metro 缓存后启动完整开发环境 |
| `npm run android` | 在 Android 环境中启动 Expo |
| `npm run ios` | 在 iOS 环境中启动 Expo |
| `npm run web` | 启动 Web 版本 |
| `npm run server` | 以开发模式启动 Express API |
| `npm --prefix server run verify:api-security` | 执行 API 安全验证 |
| `npm --prefix server run verify:sync` | 验证共享冰箱同步流程 |

更多验证脚本可在 [`server/package.json`](server/package.json) 中查看。

### 数据库变更约定

所有 Supabase schema 或数据库行为变更都必须新增带时间戳的 SQL migration，并提交到 Git。不要修改、删除或重写已经应用到远端项目的 migration，也不要对生产环境执行破坏性的数据库 reset。

涉及 Supabase schema、Express 数据路由、设备初始化、共享冰箱、库存、通知或成就的改动前，请完整阅读 [`docs/data-architecture/BACKEND_DATA_CONTEXT.md`](docs/data-architecture/BACKEND_DATA_CONTEXT.md)。数据契约变化时需同步更新该文档。

### 相关文档

- [产品方向与设计原则](PRODUCT.md)
- [后端数据上下文](docs/data-architecture/BACKEND_DATA_CONTEXT.md)
- [AI 助手实现上下文](docs/ai-assistant/KITCHMEMO_AI_ASSISTANT_IMPLEMENTATION_CONTEXT.md)
- [成就系统业务规则](docs/achievement/ACHIEVEMENT_BUSINESS_RULES.md)
- [Vercel 生产部署手册](docs/deployment/VERCEL_PRODUCTION_DEPLOYMENT.md)
- [Express API 说明](server/README.md)

### 贡献说明

1. 从目标分支创建功能分支。
2. 保持改动聚焦，并同步更新中英文界面文案。
3. 对非模板代码，仅在意图或数据流不明显处按仓库约定添加中英双语注释。
4. 运行与改动范围对应的验证脚本。
5. 提交 Pull Request，并说明功能影响、数据变更和验证结果。

### 许可证

本项目采用 [MIT License](LICENSE)。

---

## English

KitchMemo is a smart food-management app built around an interactive 3D kitchen. It connects fridge inventory, expiry reminders, shopping plans, and household sharing so young households can understand what they have, reduce food waste, and receive timely guidance without turning kitchen management into administration.

### Key features

- **3D kitchen home**: Fridge, shopping-cart, and mailbox hotspots present household information naturally within the scene.
- **Fridge inventory**: Track quantity, category, purchase date, expiry date, and storage location.
- **Flexible item entry**: Add food manually, look up a barcode, or identify ingredients from a photo.
- **Freshness reminders**: Receive in-app reminders and system notifications for food approaching expiry.
- **Shopping assistance**: Manage a shopping cart alongside current inventory and reconcile purchases at checkout.
- **Shared fridges**: Invite household members to work with the same inventory.
- **Spoonie AI assistant**: Get ingredient and inventory guidance grounded in the current fridge context.
- **Achievements and quests**: Encourage lower food waste through lightweight achievements, daily quests, and weekly quests.
- **Chinese and English**: Use the complete interface in either language, with Chinese as the default.

### Technology

| Layer | Technology |
| --- | --- |
| Client | Expo SDK 57, React Native 0.86, React 19, TypeScript |
| 3D scene | Three.js, React Three Fiber, Drei, Expo GL |
| Backend | Node.js, Express 5 |
| Data and live sync | Supabase Postgres, Storage, Realtime Broadcast |
| External services | OpenAI, Gemini, Cloudflare Workers AI, Open Food Facts, food-image recognition service |
| Deployment | EAS for mobile, Vercel for the Express API |

The client reads and writes business data only through the Express API. Supabase secret keys, AI credentials, and other private configuration remain on the server. The client receives only the public Realtime connection details required after device authentication.

### Repository structure

```text
KitchMemo/
├── App.tsx                 # App entry point and primary screen orchestration
├── src/
│   ├── components/         # Screens, 3D scene, and reusable components
│   ├── services/           # APIs, device identity, notifications, and live sync
│   └── utils/              # Client validation and shared logic
├── server/
│   ├── src/routes/         # Express business routes
│   ├── src/services/       # AI, notification, and backend orchestration
│   └── scripts/            # Data backfill and verification scripts
├── supabase/
│   ├── migrations/         # Versioned source of database schema and behaviour
│   └── seed.sql            # Reproducible non-user reference data
├── models/                 # 3D kitchen and Spoonie models
├── assets/                 # App icons and shared static assets
└── docs/                   # Architecture, business rules, AI, and deployment docs
```

### Local development

#### Requirements

- Node.js 20 or a newer supported version
- npm
- A development or test Supabase project
- Android Emulator, iOS Simulator, or a physical device with a compatible client
- Supabase CLI when maintaining the database

#### 1. Install dependencies

```powershell
npm install
npm install --prefix server
```

#### 2. Configure environment variables

```powershell
Copy-Item .env.example .env.development
Copy-Item server\.env.example server\.env.development
```

The client only needs the Express API address:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
```

- Use `http://10.0.2.2:3001` for the Android Emulator.
- Use `http://localhost:3001` for the iOS Simulator or Web.
- On a physical device, use the development computer's LAN address, such as `http://192.168.1.20:3001`.

The server requires at least the following Supabase configuration:

```env
SUPABASE_URL=https://your-test-project-ref.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The AI assistant, new-food suggestions, and generated icons also require OpenAI, Gemini, and Cloudflare credentials. See [`server/.env.example`](server/.env.example) for the complete reference.

> Never commit local environment files or real credentials. Never expose server secrets through an `EXPO_PUBLIC_` variable.

#### 3. Prepare the database

After linking the Supabase CLI to a development or test project, run:

```powershell
npx supabase db push
npx supabase db push --include-seed
```

The second command also loads reproducible reference data. The ordered migrations in [`supabase/migrations`](supabase/migrations) are the source of truth for the database structure.

#### 4. Start the project

```powershell
npm start
npm run start:clear
```

You can also run `npm run server` and `npm run start:expo` in separate terminals. The server listens on `http://localhost:3001` by default; check the Supabase connection with `GET http://localhost:3001/api/health`.

### Common commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the API and Expo development server together |
| `npm run start:clear` | Clear the Metro cache and start the full environment |
| `npm run android` | Start Expo for Android |
| `npm run ios` | Start Expo for iOS |
| `npm run web` | Start the web version |
| `npm run server` | Start the Express API in development mode |
| `npm --prefix server run verify:api-security` | Run the API security verification |
| `npm --prefix server run verify:sync` | Verify the shared-fridge sync flow |

See [`server/package.json`](server/package.json) for additional verification scripts.

### Database change policy

Every change to the Supabase schema or database behaviour must be captured in a new timestamped SQL migration and committed to Git. Never modify, delete, or rewrite a migration that has already been applied to a remote project, and never run a destructive database reset against production.

Before changing the Supabase schema, Express data routes, device bootstrap, fridge sharing, inventory, notifications, or achievements, read [`docs/data-architecture/BACKEND_DATA_CONTEXT.md`](docs/data-architecture/BACKEND_DATA_CONTEXT.md) completely. Update that document whenever the data contract changes.

### Documentation

- [Product direction and design principles](PRODUCT.md)
- [Backend data context](docs/data-architecture/BACKEND_DATA_CONTEXT.md)
- [AI assistant implementation context](docs/ai-assistant/KITCHMEMO_AI_ASSISTANT_IMPLEMENTATION_CONTEXT.md)
- [Achievement business rules](docs/achievement/ACHIEVEMENT_BUSINESS_RULES.md)
- [Vercel production deployment guide](docs/deployment/VERCEL_PRODUCTION_DEPLOYMENT.md)
- [Express API guide](server/README.md)

### Contributing

1. Create a feature branch from the intended base branch.
2. Keep changes focused and update both Chinese and English interface copy together.
3. For non-template code, add the repository's bilingual comments only where intent or data flow is not obvious.
4. Run the verification scripts relevant to the change.
5. Open a pull request describing functional impact, data changes, and verification results.

## License

This project is licensed under the [MIT License](LICENSE).
