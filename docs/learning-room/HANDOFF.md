# Learning Room — 新对话接手入口

更新时间：2026-10-05（Australia/Sydney）。

## 1. 三句话说明当前任务

用户已认可 `docs/art-direction/learning-room/2026-10-05-app-palette-v2/` 的五张效果图，并要求后续严格按图实现。项目主线是 **SDG 13 Climate Action**，配色匹配现有 Fridge／Achievements。**P0、P1 内容／技术验证、P2 五页 RN 组件／局部导航／开发预览已实现**；独立内容审核、原生视觉验收、真实 API／数据库仍待完成。

用户先授权第一步，再依次要求继续，本轮完成 P2 UI 代码与可进行的验证。未来用户说继续时从 **P3 开发环境数据与考试服务** 接手，有设备时同时补 P2 原生验收；保留 P1／P2 pending 门槛，不必重新询问已经确定的页面方向。

## 2. 必须读取的顺序

1. 仓库 `AGENTS.md`。
2. [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)：先知道真实完成了什么，以及下一步是什么。
3. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)：完整读取产品规则、依赖、数据／接口和验证计划。
4. [VISUAL_SPEC.md](VISUAL_SPEC.md)：查看五张批准 PNG，逐页布局与色值是实现基准。
5. [CONTENT_PLAN.md](CONTENT_PLAN.md)：课程、题库数量、来源、双语和发布方法。
   同时读 [CONTENT_CONTRACT.md](CONTENT_CONTRACT.md)、[CONTENT_REVIEW.md](CONTENT_REVIEW.md) 与 [P1_VERIFICATION.md](verification/2026-10-05/P1_VERIFICATION.md)：实际字段、48 题和来源、测试与待审事实。
   再读 [P2_VERIFICATION.md](verification/2026-10-05/P2_VERIFICATION.md)：现有页面／gateway、运行预览、截图差异及原生 pending。
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

P0 已完成；P1 内容／技术验证完成、独立校对 pending；P2 五页组件／导航／双语／开发预览／Web 验证完成、原生验收 pending。用户要求继续时从 **P3 开发环境数据与服务端** 开始；有设备时补 P2，随后 P4 集成、P5 验收。发布前必须完成独立审核和原生门槛，不得让生产入口暴露 fixture 假成绩。

先查看 P0／P1／P2 验证记录、`assets/learning-room/SOURCE.md`、`ENTRY_INTEGRATION.md`、`src/types/learningRoom.ts` 与 `LearningRoomFlow.tsx`。P2 的 gateway 是前端适配契约，P3/P4 实现真实 HTTP 映射时更新实际数据文档；UI 不推算分数／升级。`dev/` 只回放一题和固定结果，不能当考试服务。视频只有摘要、Bin Action practice 明确待集成，主 App 无学习入口。

`npm run learning:preview -- --web --port 8083` 可独立预览，不启动 Express；`node server/scripts/export-learning-preview.js` 更新公开草稿快照。正常 bundle 已检查不含预览题／attempt／草稿 catalog。不要重新生成素材或重新写题库；客户端只能使用公开投影，不得导入私有答案。后续明确按任务拆分提交；用户未要求代理并行时不要自行派子代理。

每次结束对话前更新状态文件，记录到具体任务、文件、测试和 migration 环境。写代码时对非显然 intent／data flow 按 AGENTS.md 添加 Arthur 标识与中英双语注释；不要给 trivial syntax 加重复注释。

## 6. 可直接粘贴到新对话的提示词

> 继续实现 KitchMemo 的 Learning Room。先读 `docs/learning-room/HANDOFF.md`、状态／总体计划／视觉规格／内容契约和 P1、P2 验证记录。设计已确认，严格保留 app-palette-v2 五页布局与冰箱／成就配色，SDG 13／13.3，不加第六个 Tab。P0 素材、P1 的 3 课程／9 活动／48 题／9 资料、P2 五页 RN 组件／局部导航／双语与开发预览已实现。当前从 P3 开发环境个人学习数据与考试服务开始；有设备时补 P2 原生截图与手势／读屏。P1 独立审核、P2 原生验收均 pending，不能发布。读取 src/types/learningRoom.ts 与 LearningRoomFlow.tsx；gateway 需真实 HTTP 映射，dev 只回放固定情景，不能当真实成绩。代码前读 Expo v57，数据前完整读 BACKEND_DATA_CONTEXT.md 与 migrations；数据库变化用新 timestamped migration 并在开发库验证，不能修改已应用 migration。服务端首答冻结、原子结算解锁、个人 learner 与共享 XP 分离、恢复身份转移均保留。P4 再接动画、独立 Bin Action practice、Home／Profile 正式入口。每阶段更新状态，保留未完成门槛。

## 7. 完成后的交接报告要点

说明实际实现阶段、批准图对照结果、真实 API 接入、迁移在哪个环境应用、检查结果、真机未验证项、生产是否发布。提供下一项具体工作；不要以「接下来可以完善」代替状态记录。
