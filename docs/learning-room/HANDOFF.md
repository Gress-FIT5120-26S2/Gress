# Learning Room — 新对话接手入口

更新时间：2026-10-05（Australia/Sydney）。

## 1. 三句话说明当前任务

用户已认可 `docs/art-direction/learning-room/2026-10-05-app-palette-v2/` 的五张效果图，并要求后续严格按图实现。项目主线是 **SDG 13 Climate Action**，配色匹配现有 Fridge／Achievements。**P0、P1 内容／技术验证、P2 五页组件／预览、P3 个人数据与考试 API 已完成开发验证**；独立内容审核、原生视觉验收和 P4 页面真实接入仍待完成。

用户依次授权各阶段，本轮完成 P3 开发库迁移与真实 HTTP 验证。未来用户说继续时从 **P4 learningApi 与全链路整合** 接手，有设备时同时补 P2 原生验收；保留 P1／P2 pending 门槛，不必重新询问已经确定的页面方向。

## 2. 必须读取的顺序

1. 仓库 `AGENTS.md`。
2. [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)：先知道真实完成了什么，以及下一步是什么。
3. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)：完整读取产品规则、依赖、数据／接口和验证计划。
4. [VISUAL_SPEC.md](VISUAL_SPEC.md)：查看五张批准 PNG，逐页布局与色值是实现基准。
5. [CONTENT_PLAN.md](CONTENT_PLAN.md)：课程、题库数量、来源、双语和发布方法。
   同时读 [CONTENT_CONTRACT.md](CONTENT_CONTRACT.md)、[CONTENT_REVIEW.md](CONTENT_REVIEW.md) 与 [P1_VERIFICATION.md](verification/2026-10-05/P1_VERIFICATION.md)：实际字段、48 题和来源、测试与待审事实。
   再读 [P2_VERIFICATION.md](verification/2026-10-05/P2_VERIFICATION.md)：现有页面／gateway、运行预览、截图差异及原生 pending。
   再读 [API_CONTRACT.md](API_CONTRACT.md)、[P3_VERIFICATION.md](verification/2026-10-05/P3_VERIFICATION.md)：真实 API 字段、迁移／开发验证、版本／审核 gate 与恢复。
6. 任何代码之前，读取 [Expo SDK 57 的确切版本文档](https://docs.expo.dev/versions/v57.0.0/)。使用特定 Expo API 时再读该版本对应模块文档。
7. 任何 Supabase、Express、设备恢复、共享／库存／成就相关改动前，完整读取 `docs/data-architecture/BACKEND_DATA_CONTEXT.md`，并检查相关最新 migration。

检查当前 Git status 和新对话中的用户修订；本文件不是当前远程环境的证明。若状态文件过期，基于实际代码／migration／测试记录核对后更新，不能直接勾选完成。

## 3. 已决定，不要重新设计

- SDG 13，特别是 13.3 的气候教育；不是 SDG 12。
- UI 采用批准的五页 v2：学习室、课程、Quiz、通关、气候阅读。
- 背景 `#F7FBFA`、标题 `#173D31`、状态 `#2A8A61`、CTA `#F58220`、少量浅蓝 `#EAF7FD`。
- 主学习结构 Learn／My path／Library；Home 主入口与 Profile 副入口，不加第六个底部 Tab。
- Beginner Waste basics、Intermediate Packaging & recycling、Advanced Preventing waste。
- 正式题数 6／8／10，80% 门槛，对应最低正确 5／7／8。
- 持久化个人进度，考试由服务端判分，结束事务原子解锁；共享家人不能代升级。
- 可以自由阅读课程与资料；只按阶段资格锁正式 checkpoint；没有考试倒计时。
- 旧级复习、错题解释、未完成考试恢复、高级通过后的混合复习均在范围内。
- Bin Action 在学习室必须是独立练习模式，不要求消耗真实库存。
- 双语沿用现有 i18n；英文截图用来验收；生成图片不是原生 UI。

## 4. 接手时最容易误做的事情

| 易错点 | 正确处理 |
| --- | --- |
| 找到旧 warm-white／SDG 12 图直接实现 | 只用 app-palette-v2 的最终五张图 |
| 把效果图的 1/3、5/6 当默认数据 | 真实新用户 0/3；固定情景只给开发验收 |
| 用整张 mockup 做可点击页面 | 真正 RN 字体、列表、按钮和状态＋独立视觉资产 |
| 为新功能重构整个 App 导航 | 用当前模式添加局部功能容器，主五 Tab 不变 |
| 把 existing sorting stats 当个人等级 | 它按冰箱聚合；另做个人 learning contract |
| 用虚假 consume event 让 Bin Action 能运行 | 分离纯交互组件和独立 learning practice adapter |
| 只凭前端答对数量设置 Intermediate | POST finish 的数据库事务决定等级 |
| 回答错误后同题改答刷正式分数 | 首次答案冻结，纠错属于解释／复习 |
| 两次 HTTP 写入分别成绩和解锁 | 一次 RPC 事务完成，带幂等约束 |
| 共享加入把个人课程记录合并 | fridge 变化不改变 learner；恢复码才转移身份 |
| 修改已应用 migration／生产 Dashboard 改完即结束 | 新 timestamped migration，开发先验，再应用同文件生产 |
| 新版本将旧用户等级重新锁住 | 永久解锁与考试版本快照分离 |
| 用 Quiz 奖励宣布个人 CO₂ 减排 | Quiz 只表学习成绩，环境事实另有来源与范围 |
| 把 node 类型检查当真机／视觉验收 | 分别留截图、原生操作和服务端验证证据 |

## 5. 下一步执行方式

P0 已完成；P1 内容／技术验证完成、独立校对 pending；P2 五页组件／预览／Web 验证完成、原生验收 pending；P3 已提交并在开发库应用两份 migration，七表／API／判分／恢复通过 298 次 HTTP 与 SQL 版本验证。用户要求继续时从 **P4 learningApi／个人数据管理／动画与 practice／正式入口** 开始。发布前必须完成独立审核和原生门槛，不得让生产入口暴露 fixture 假成绩。

先查看 P0–P3 验证记录、`assets/learning-room/SOURCE.md`、`ENTRY_INTEGRATION.md`、`src/types/learningRoom.ts` 与 `LearningRoomFlow.tsx`。真实 HTTP 与前端视图字段已匹配，按 API_CONTRACT.md 实现 gateway 并补 practice activityCode、abandon、来源与异常处理。网络重试复用同一键，UI 不推算分数／升级。`dev/` 只回放一题和固定结果；8083 preview 仍 fixture。视频只有摘要、Bin Action practice 待集成，主 App 无学习入口。

开发 Supabase ref 为 thmbtsssvnslotoexntz，49 migrations 最新 20261005011000，生产未应用本轮 schema；不得改已应用 SQL。真实参考内容 learning-room-v1 仍 draft／pending。普通服务仅 published，开发测试须双草稿开关＋开发域名＋非 production；后续正式发布需真实独立审核、生成追加 reference migration，不能直接伪造 review.json 或绕过 gate。P3 提交 6d0af20，前序成果 1eb83a8，测试数据已清理。重跑数据库断言用 prepare-learning-preflight.js --applied。

`npm run learning:preview -- --web --port 8083` 可独立预览，不启动 Express；`node server/scripts/export-learning-preview.js` 更新公开草稿快照。正常 bundle 已检查不含预览题／attempt／草稿 catalog。不要重新生成素材或重新写题库；客户端只能使用公开投影，不得导入私有答案。后续明确按任务拆分提交；用户未要求代理并行时不要自行派子代理。

每次结束对话前更新状态文件，记录到具体任务、文件、测试和 migration 环境。写代码时对非显然 intent／data flow 按 AGENTS.md 添加 Arthur 标识与中英双语注释；不要给 trivial syntax 加重复注释。

## 6. 可直接粘贴到新对话的提示词

> 继续实现 KitchMemo 的 Learning Room。先读 HANDOFF、状态／计划／视觉规格、API_CONTRACT 和 P1–P3 验证记录。严格保留 app-palette-v2 五页布局与冰箱／成就配色，SDG 13／13.3，不加第六个 Tab。P0 素材、P1 内容、P2 五页组件／预览、P3 七表／个人考试 API 已实现。当前从 P4 learningApi gateway＋个人数据管理开始，再接教育视频、独立 Bin Action practice、Home／Profile 入口。开发库 ref thmbtsssvnslotoexntz，49 migrations，298 次 HTTP 验证通过；已应用两份新 SQL 不可改。真实 v1 draft／独立审核 pending，P2 原生验收 pending，生产未发布。8083 仍 fixture；真实客户端只能读 API 投影并使用服务器分数／等级，不能导入题库。保留请求键重试、失效考试处理、旧快照与恢复身份规则。代码前读 Expo v57，数据前完整读 BACKEND_DATA_CONTEXT 与 migrations。每阶段更新状态，保留未完成门槛。

## 7. 完成后的交接报告要点

说明实际实现阶段、批准图对照结果、真实 API 接入、迁移在哪个环境应用、检查结果、真机未验证项、生产是否发布。提供下一项具体工作；不要以「接下来可以完善」代替状态记录。
