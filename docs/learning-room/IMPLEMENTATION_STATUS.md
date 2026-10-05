# Learning Room 实际进度与继续位置

最后更新：2026-10-05（Australia/Sydney）。当前阶段：**P0 已完成；P1 内容与技术验证已完成、独立校对待完成；P2 五页组件／导航／开发预览已实现，原生视觉验收待完成；P3 个人数据与考试 API 已在开发库完成验证；P4 真实适配器／入口／视频／practice 已实现并完成开发验证；下一步 P5 真机验收与独立审核。**

## 1. 已完成的真实工作

- [x] 检查现有教育动画、分类答题、导航、Profile 和设备身份／恢复接入点。
- [x] 制作并保存五张 v2 最终效果图。
- [x] 用户明确认可 v2，要求后续严格还原。
- [x] 修正项目目标为 SDG 13／13.3。
- [x] 从当前 Fridge／Achievements 代码核对视觉配色；不依赖旧山峰设计文档的颜色。
- [x] 写总体实施计划、逐页视觉规格、内容目录、交接提示词与本状态文件。
- [x] 完整阅读后端数据上下文，并识别共享 sorting attempts 与独立个人 Quiz 的边界。
- [x] 用户授权开始第一步，核对五张最终图并登记 hash。
- [x] 制作 8 张独立图片，取得中英官方 SDG 13 图标；原图与运行时资产已保存项目。
- [x] 建立 learningTheme、静态 learningAssets、资产重建脚本、来源／提示词／hash 清单。
- [x] 记录 Home／Profile 实际接入点，验证图片透明性、静态路径、尺寸和 TypeScript。
- [x] 制作三门双语课程、9 个学习活动、12／16／20 道题和 topic blueprint。
- [x] 制作 6 条指南／数据、3 条真实新闻，登记 18 个官方来源、日期和范围。
- [x] 建立公开内容类型、私有题库、显式投影、内容 validator、manifest 和发布审核门槛。
- [x] 完成作者来源核对与第二遍文字检查，保存逐题审核清单。
- [x] 通过 14 项新内容测试、8 项既有分类测试及全项目 TypeScript。
- [ ] 完成真正的独立内容校对；当前 review.json 仍 pending，发布检查按预期失败。
- [x] 实现五页 RN 组件、局部导航、双语、资料筛选、错误／重试和首答冻结的反馈视图。
- [x] 建立明确开发预览、公开快照 exporter；正常 App 和生产 bundle 不暴露 fixture。
- [x] 通过 8 项导航／预览隔离测试、既有 22 项测试、TypeScript、Android 开发与正常模式 bundle 导出。
- [x] 留存 390×844 英文五页与 320×667 中文浏览器截图，验证主要交互。
- [ ] 补 Android／iOS 真机截图、手势、读屏、动态字体与 Reduce Motion 验收。
- [x] 新增并提交两份 Learning Room migration，开发库应用成功，远程共 49 份且 lint 无错误。
- [x] 七张个人学习表、稳定 learner／恢复 trigger、首答冻结／游标／原子判分和永久解锁事务。
- [x] 12 个鉴权 learning API、服务器 blueprint 抽样、已答反馈白名单和版本快照。
- [x] 38 项相关测试、TypeScript、298 次真实 HTTP 请求、版本／撤回／发布门槛 SQL 回滚验证。
- [x] 随机测试数据已精确清理；真实参考版本仍 draft／pending，普通服务默认不可用草稿。
- [x] P4 learningApi／本人缓存与恢复、视频、独立 practice、Home／Profile 入口，54 项自动测试、123 次真实 HTTP 和 Web practice／视频检查。
- [ ] P5 实际设备入口、系统生命周期、拖拽与无障碍验收；独立内容审核和发布准备。

## 2. 实施阶段状态

| 阶段 | 当前状态 | 尚需做的工作 |
| --- | --- | --- |
| P0 基准与独立素材 | 已完成 | 见 verification/2026-10-05/P0_VERIFICATION.md；后续页面阶段需真机对照 |
| P1 内容契约 | 内容／作者核对／技术验证完成；独立校对 pending | 通过独立校对后才可发布；详见 CONTENT_REVIEW.md 与 P1_VERIFICATION.md |
| P2 五页 UI | 组件／导航／开发预览／Web 验证完成；原生视觉门槛 pending | 真机五页图、返回手势、安全区、读屏与字体缩放；见 P2_VERIFICATION.md |
| P3 数据与服务端 | 开发环境完成 | 已提交迁移／七表／RPC／恢复／API；见 P3_VERIFICATION.md；独立内容发布仍 pending |
| P4 全链路集成 | 代码／开发适配器全链路验证完成 | 见 P4_VERIFICATION.md；实际设备页面验收交 P5 |
| P5 真机与发布 | 待开始 | 双语／无障碍／离线／回归、真机证据、获授权后的生产发布 |

## 3. 下一条具体任务

**下一步是 P5 真机验收与发布准备。** 先读 P4_VERIFICATION.md，在真实 Android／iOS 用指定开发 API 验收 Home／Profile 入口、五页、动画、分类 tap／drag、断网重试、后台／杀进程恢复、返回、字体与读屏。浏览器鼠标拖拽未确认提交，必须在设备上核对，不能勾选已通过。同步完成真正的独立内容校对。当前生产未发布，正常服务不接受未审核草稿，开发测试需显式双开关及开发域名。用户已认可的五页布局、SDG 13 与 palette 保留。

目前不需要再确认总体方向、SDG、配色、题数或等级门槛。技术命名和普通布局尺寸可按计划与实际仓库自行落实。

## 4. 当前已保存文件

- `docs/learning-room/IMPLEMENTATION_PLAN.md`
- `docs/learning-room/VISUAL_SPEC.md`
- `docs/learning-room/CONTENT_PLAN.md`
- `docs/learning-room/HANDOFF.md`
- `docs/learning-room/IMPLEMENTATION_STATUS.md`
- `docs/learning-room/CONTENT_CONTRACT.md`、`CONTENT_REVIEW.md`
- `server/data/learning-room/v1/`：内容、私有题库、待独立审核记录、manifest 与 README
- `server/src/services/learningContent.js`、`server/scripts/validate-learning-content.js`、`server/test/learningContent.test.js`
- `src/types/learningContent.ts`
- `src/types/learningRoom.ts`、`src/components/learning/`、`src/i18n/learning.ts`
- `scripts/start-learning-preview.mjs`、`scripts/test-learning-room.mjs`、`server/scripts/export-learning-preview.js`
- `docs/learning-room/verification/2026-10-05/P2_VERIFICATION.md`、`p2-web/` 截图与 manifest
- `docs/learning-room/verification/2026-10-05/P4_VERIFICATION.md`、`p4-web/` 截图及 manifest
- `src/services/learningApi.ts`、`learningGateway.ts`、`LearningPracticeScreen.tsx`、`WasteSortingInteraction.tsx`
- `scripts/test-learning-gateway.mjs`、`server/scripts/verify-learning-gateway.js`、`start-learning-development.js`
- `docs/learning-room/API_CONTRACT.md`、`verification/2026-10-05/P3_VERIFICATION.md`
- `server/src/routes/learning.js`、`services/learningAssessment.js`、`services/learningRoom.js`、assessment test
- `server/scripts/generate-learning-migration.js`、`prepare-learning-preflight.js`、`verify-learning-room.js`；`supabase/tests/learning_room.sql`
- `supabase/migrations/20261005010000_learning_room_assessment.sql`、`20261005011000_learning_room_draft.sql`
- 批准图片、视觉说明、完整图片生成提示词：`docs/art-direction/learning-room/2026-10-05-app-palette-v2/`
- 原 v1 图片保留在旧文件夹作历史比较，标记 superseded。

## 5. 数据、代码和部署事实

| 项目 | 当前事实 |
| --- | --- |
| 新 learning 业务代码 | 内容工具＋五页组件／预览，真实考试 API／持久进度已完成开发库验证；页面 gateway 已连真实 API，开发端到端验证通过 |
| 学习室基础样式／图片代码 | learningTheme.ts、learningAssets.ts 已用于五页 RN 组件；Home／Profile 入口已接入，真机位置待验收 |
| 正式独立 UI 图片资产 | 10 张已制作／取得；8 张生成图片＋中英官方 SDG 13，运行时合计 2,653,475 bytes |
| learning API | 12 个鉴权路由，显式投影，不接受用户分数／passed |
| learning 新表／RPC／trigger | 7 表、6 函数、3 trigger，RLS 与服务端写入权限已验证 |
| 本功能 migration | 两份新文件已提交（6d0af20），开发库已应用；文件／内容 hash 见 P3_VERIFICATION.md |
| 远程数据库检查 | 开发 ref 已核对，49 migrations；lint PASS；真实 v1 draft／pending，测试 learner／attempt 均 0 |
| Android／iOS 功能验收 | P4 Android 正常 bundle 导出通过；原生设备 UI／手势／读屏尚未验收，iOS 未运行 |
| 生产发布 | 未进行 |
| App／Express 改动 | P2 preview 与双语保留；P3 挂载 learning router；App.tsx、Home／Profile 入口与暂停／返回已接入 |

不要将后端上下文中 existing waste learning 已在开发库验证，误记为 Learning Room 已经可用。

## 6. 验证记录

规划阶段只验证文档。P0 额外通过全项目 TypeScript、10 张资产 hash／尺寸／透明性和 10 个静态 require 路径检查；尚未建立屏幕，不把这些检查当作原生页面验收。

| 日期 | 验证类型 | 结果与证据 |
| --- | --- | --- |
| 2026-10-05 | 计划与资料引用检查 | PASS：五份规划文档的本地 Markdown 链接均可解析，五张批准 PNG 均存在；Git 变化范围仅为学习室设计／规划文档目录 |
| 2026-10-05 | P0 静态基准与素材 | PASS：TypeScript 无错误；10 张素材 hash／尺寸一致；4 张透明素材 alpha 保留；10 个静态 require 路径存在；完整记录见 P0_VERIFICATION.md |
| 2026-10-05 | P1 草稿内容与契约 | PASS：3 课程／9 活动／9 资料／48 题／18 来源；22 项测试、TypeScript；发布检查因独立校对 pending 按预期失败；见 P1_VERIFICATION.md |
| 2026-10-05 | P2 UI 与开发隔离 | PASS：30 项相关测试、TypeScript、两种 Android bundle、Web 交互／截图；原生截图待完成，见 P2_VERIFICATION.md |
| 2026-10-05 | P3 个人进度／考试服务 | PASS：38 项测试、TypeScript、298 次 HTTP、开发迁移／lint、版本与恢复回滚；真实内容仍 pending，见 P3_VERIFICATION.md |

## 7. 后续每阶段的更新模板

在下面追加真实记录，完成后同时更新上面的阶段状态，不把整个历史覆盖成「已完成」。

### 运行记录模板

- 日期／执行环境：
- 当前阶段与完成任务：
- 修改／新增文件：
- Git 提交（如有）：
- Migration 文件、hash、应用环境（如有）：
- 检查命令与结果：
- 原生设备／截图路径（如有）：
- 尚未验证或阻塞的事项：
- 下次从哪一个具体任务继续：

## 8. 仍需制作，但不妨碍开始开发的事项

真正独立校对、页面真实 API 接入和正式真机截图尚未完成。五页组件与后端服务已实现并分别验证；正式入口、动画／practice 与 gateway 留待 P4。发布不得绕过独立审核，不需要重新选择视觉方向。

### P0 执行记录 — 2026-10-05

- 范围：只完成用户要求的第一步；未做 P1–P5、未开正式入口、未连接数据库。
- 文件：assets/learning-room/；src/components/learning/learningTheme.ts 与 learningAssets.ts；scripts/prepare-learning-assets.mjs；ENTRY_INTEGRATION.md；P0_VERIFICATION.md；相关交接文档。
- Git 提交：尚未提交；无 migration。
- 检查：node scripts/prepare-learning-assets.mjs；node node_modules/typescript/bin/tsc --noEmit；资产 hash／尺寸／静态 require 一致性检查均通过。
- 视觉：独立素材已按五张图核对主体／构图；没有原生页面或真机截图。
- 特别记录：批准原色保留，新增可读文字／按钮色变体；SDG 标识使用官方原色并登记来源声明要求。
- 下次具体任务：P1 双语公开 catalog 与私有 question bank 的内容 schema 和 validator，随后逐题制作并审核来源。

### P1 执行记录 — 2026-10-05

- 范围：完成用户授权的下一步内容制作与技术验证；没有进入 P2 UI 或 P3 数据发布。
- 产物：3 课程、9 活动、48 道双语题、6 指南／数据＋3 新闻、18 官方来源；公开类型／私有题库与离线 validator、manifest、审核文档。
- 规则：SDG 13／13.3；正式题数 6／8／10 与最低正确 5／7／8；练习不改变库存、共享 XP 或升级；首答冻结与服务端判分保留为未来服务契约。
- 内容 hash：0736124795fd1dbc5e5b82521f919162ea82692c27a3f127b850410ce31f6054。
- 检查：草稿 validator PASS；14 新测试＋8 既有分类测试 PASS；tsc --noEmit PASS；客户端代码未引入服务端私有题库。
- 审核：作者来源核对及第二遍文字检查完成；没有独立审核人，release 验证按预期失败。测试审批只存在于内存副本，不写回内容。
- Git 提交：未提交；无 migration／数据库连接／HTTP route／生产发布／原生 UI 验收。
- 下次具体任务：P2 局部原生容器、共享组件与五页布局；先读 CONTENT_CONTRACT.md、CONTENT_REVIEW.md 与 P1_VERIFICATION.md，草稿不伪装成已发布内容。

### P2 执行记录 — 2026-10-05

- 范围：用户再次要求继续，完成五页组件、局部容器／导航、双语、开发 preview 与公开内容快照；没有进入 P3/P4 正式集成。
- 验证：全项目 TypeScript；8 项新导航／fixture 隔离＋22 项内容／既有分类测试；Android 开发及正常 bundle 导出；正常 bundle 无预览题／attempt／草稿 catalog。Web 主要交互通过，截图及差异详见 P2_VERIFICATION.md。
- 样式：复用 P0 素材、颜色／可读变体；小屏自然滚动，固定 CTA 不盖正文；标准 Web 下课程 checkpoint、结果续学提示与阅读后半段需要滚动，仍待原生逐页对照。
- 数据：gateway 为前端注入契约，只有独立开发适配器；fixture 不能用于真实成绩。视频摘要和 practice 待 P4 接入；正常 App 没有学习入口。
- 尚未完成：P1 独立审核、P2 原生截图／字体／手势／读屏、P3 数据／服务、P4 集成、P5 发布。
- Git／远程：未提交；没有 migration、远程数据库连接或部署。
- 下次具体任务：P3 开发环境个人学习进度与考试事务；有设备时补 P2 原生验收，所有 pending 门槛保持明确记录。

### P3 执行记录 — 2026-10-05

- 完成：七表、内容版本／发布 gate、首答与 snapshot、幂等创建／恢复／游标／结算、独立个人进度、恢复合并 trigger、鉴权 Express API 和测试工具。
- 开发：新 SQL 在单事务回滚预演后提交并应用至 Gress-development；本地／远程共 49 migrations，lint 无错误；已应用 migration 不再修改。
- 验证：38 项相关测试／TypeScript，298 次真实 HTTP，追加版本／撤回／审核 upsert 回滚测试通过。库存、共享 XP、原分类统计与通知无学习写入；test learner／attempt 零残留。
- 发布：真实 v1 为 draft／pending；release validator 按预期拒绝。没有生产迁移、部署或 Git push。
- Git：1eb83a8 留存前序 P0–P2 成果，6d0af20 保存 P3 schema 与依赖代码；交接和验证工具另作追加提交。
- 页面：8083 preview 仍开发 fixture，没有真实 gateway。既有五页视觉本轮未改；P1 独立审核／P2 原生门槛仍 pending。
- 下次具体任务：P4 learningApi＋个人数据管理与重试，教育视频／独立 Bin Action practice，Home／Profile 接入；按 API_CONTRACT.md 映射 quiz／result／失效状态。
