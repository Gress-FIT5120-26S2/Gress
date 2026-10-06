# Learning Room — 新对话接手入口

更新时间：2026-10-06（Australia/Sydney）。

最新用户修订：独立「学堂 / Learn」主 Tab 已替代 Home／Profile 学习入口与全屏学习 Modal。默认 `npm start`／`npm run server` 已使用指定开发库草稿启动器；`npm run server:start` 和生产仍仅接受 published。请先读 [NAVIGATION_UPDATE.md](verification/2026-10-06/NAVIGATION_UPDATE.md)，不要照旧文档还原五 Tab 或误判 content_unavailable 为路由未挂载。

## 1. 三句话说明当前任务

用户已认可 `docs/art-direction/learning-room/2026-10-05-app-palette-v2/` 的五张效果图，并要求后续严格按图实现。项目主线是 **SDG 13 Climate Action**，配色匹配现有 Fridge／Achievements。**P0、P1 内容／技术验证、P2 五页组件／预览、P3 个人数据与考试 API、P4 真实适配器／入口／视频／practice 已完成开发验证**；独立内容审核与 P5 原生验收仍待完成。

用户依次授权各阶段，本轮完成 P4，54 项自动测试、123 次真实适配器 HTTP、Web practice 与视频检查通过。未来用户说继续时从 **P5 真机验收与发布准备** 接手，有设备时同时补 P2 原生验收；保留 P1／P2 pending 门槛，不必重新询问已经确定的页面方向。

## 2. 必须读取的顺序

1. 仓库 `AGENTS.md`。
2. [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)：先知道真实完成了什么，以及下一步是什么。
3. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)：完整读取产品规则、依赖、数据／接口和验证计划。
4. [VISUAL_SPEC.md](VISUAL_SPEC.md)：查看五张批准 PNG，逐页布局与色值是实现基准。
5. [CONTENT_PLAN.md](CONTENT_PLAN.md)：课程、题库数量、来源、双语和发布方法。
   同时读 [CONTENT_CONTRACT.md](CONTENT_CONTRACT.md)、[CONTENT_REVIEW.md](CONTENT_REVIEW.md) 与 [P1_VERIFICATION.md](verification/2026-10-05/P1_VERIFICATION.md)：实际字段、48 题和来源、测试与待审事实。
   再读 [P2_VERIFICATION.md](verification/2026-10-05/P2_VERIFICATION.md)：现有页面／gateway、运行预览、截图差异及原生 pending。
   再读 [API_CONTRACT.md](API_CONTRACT.md)、[P3_VERIFICATION.md](verification/2026-10-05/P3_VERIFICATION.md)：真实 API 字段、迁移／开发验证、版本／审核 gate 与恢复。
   再读 [P4_VERIFICATION.md](verification/2026-10-05/P4_VERIFICATION.md)：真实适配器、入口／媒体／独立 practice、测试、草稿启动命令和原生待验项。
6. 任何代码之前，读取 [Expo SDK 57 的确切版本文档](https://docs.expo.dev/versions/v57.0.0/)。使用特定 Expo API 时再读该版本对应模块文档。
7. 任何 Supabase、Express、设备恢复、共享／库存／成就相关改动前，完整读取 `docs/data-architecture/BACKEND_DATA_CONTEXT.md`，并检查相关最新 migration。

检查当前 Git status 和新对话中的用户修订；本文件不是当前远程环境的证明。若状态文件过期，基于实际代码／migration／测试记录核对后更新，不能直接勾选完成。

## 3. 已决定，不要重新设计

- SDG 13，特别是 13.3 的气候教育；不是 SDG 12。
- UI 采用批准的五页 v2：学习室、课程、Quiz、通关、气候阅读。
- 背景 `#F7FBFA`、标题 `#173D31`、状态 `#2A8A61`、CTA `#F58220`、少量浅蓝 `#EAF7FD`。
- 主学习结构 Learn／My path／Library；独立「学堂 / Learn」底部 Tab，位于 Fridge 与 Achievements 之间。
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
| 为新功能重构整个 App 导航 | 沿用本地 tab state，新增 Learn 主 Tab，课程／测验保留局部栈 |
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

P0–P4 已完成代码与各自开发验证；P1 独立校对、P2 原生视觉与 P5 设备验收 pending。下一步从 **P5** 开始，保留批准五页，不重新生成图或题库。

先读 NAVIGATION_UPDATE 与 P4_VERIFICATION。真实 gateway 位于 src/services/learningGateway.ts，原生 adapter 位于 learningApi.ts；LearningRoomEntry 每次打开创建本人实例。当前入口为独立学堂 Tab；视频重用现有 LinearFoodWasteStory；practice 与库存 overlay 共用 WasteSortingInteraction，但各自保存。54 项自动测试与实际开发启动器的 123 次 API 请求通过。My path 有服务器历史，状态／答案／next／finish 重试与身份隔离已处理。不要把 UI fixtures 或 Web 截图当成真实考试／原生证据。

P5 首先检查实际设备的入口遮挡、GL 暂停／恢复、返回、视频嵌套 Modal、分类 tap／drag、网络失败／后台／杀进程恢复、字体 1.3／1.6、读屏与 Reduce Motion。浏览器鼠标拖拽尝试没有确认提交，不能勾选拖拽通过；tap／纠错与视频播放／暂停／关闭有 Web 证据。当前没有 adb／原生控制界面，设备证据仍需补齐。

开发 Supabase ref 为 thmbtsssvnslotoexntz，49 migrations 最新 20261005011000，生产未应用本轮 schema；不得改已应用 SQL。真实参考内容 learning-room-v1 仍 draft／pending。普通服务仅 published，开发测试须双草稿开关＋开发域名＋非 production；后续正式发布需真实独立审核、生成追加 reference migration，不能直接伪造 review.json 或绕过 gate。P3 提交 6d0af20／b63584f，前序成果 1eb83a8；P4 提交查当前 Git log，测试数据已清理。重跑数据库断言用 prepare-learning-preflight.js --applied。

`npm run learning:preview -- --web --port 8083` 可独立预览，不启动 Express；URL 加 nav=1 可检查真实底栏组件，但其他 Tab 只显示预览菜单。`node server/scripts/export-learning-preview.js` 更新公开草稿快照。正常 Android bundle 不包含预览题／attempt／私有 bank；通用 i18n 的预览文案保留。不要重新生成素材或重写题库；客户端只能使用公开投影。根目录 `npm start`／`npm run server` 已自动调用指定开发域名的草稿启动器，`server:start`／生产继续只读 published。后续明确按任务拆分提交；用户未要求代理并行时不要自行派子代理。

每次结束对话前更新状态文件，记录到具体任务、文件、测试和 migration 环境。写代码时对非显然 intent／data flow 按 AGENTS.md 添加 Arthur 标识与中英双语注释；不要给 trivial syntax 加重复注释。

## 6. 可直接粘贴到新对话的提示词

> 继续 KitchMemo 学堂的 P5 真机验收与发布准备。先读 HANDOFF、状态／计划／视觉规格、API_CONTRACT、P1–P4 验证记录、2026-10-06/NAVIGATION_UPDATE 与 AGENTS.md。用户已修订为独立「学堂 / Learn」主 Tab，Home／Profile 学习入口已移除；沿用批准的 app-palette-v2 五页、SDG 13／13.3 和冰箱／成就配色。真实本人状态／首答／重试／恢复、视频和独立 practice 已接入；54 项自动测试、实际开发启动器 123 次 HTTP 与 Android 导出通过，六项导航的小屏／错误页有 Web 证据。npm start／npm run server 自动启用指定开发库草稿；server:start／生产仍仅读 published。开发库 thmbtsssvnslotoexntz 仍 49 migrations，v1 draft／独立审核 pending，生产未发布；不可修改已应用 SQL。8083 是明确标注的 fixture，不是成绩。原生入口／手势／生命周期／读屏／动态字体／Reduce Motion 与独立校对仍待完成。先补真实设备证据和独立审核，再生成追加发布 migration，开发验证后按用户授权处理生产。代码前读 Expo v57，数据前完整读 BACKEND_DATA_CONTEXT 与 migrations。每阶段更新状态，不伪造审核或真机验证。

## 7. 完成后的交接报告要点

说明实际实现阶段、批准图对照结果、真实 API 接入、迁移在哪个环境应用、检查结果、真机未验证项、生产是否发布。提供下一项具体工作；不要以「接下来可以完善」代替状态记录。
