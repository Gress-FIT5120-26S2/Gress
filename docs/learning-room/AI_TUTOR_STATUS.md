# 学堂 AI 导师实际进度

更新：2026-10-12（Australia/Sydney）。**A0–A3 已实现，A4 自动验证和生产发布完成。NarIyirm 确认已审阅并要求直接发布，真机验收按负责人指令 waived。课程 v1 与导师 v3 已 published，生产 API 三开关开启；iOS production build 11 成功并已上传 TestFlight，Android preview APK build 3 成功。** 详见 [发布记录](verification/2026-10-12/RELEASE_VERIFICATION.md)。导师本次是负责人复核，独立审核仍 pending，不记为独立人员验收。

## 阶段状态

| 阶段 | 已完成 | 待验证／下一项 |
| --- | --- | --- |
| A0 契约与基线 | 完整阅读、版本文档、Git／环境、12 topic、面板增量规格 | [A0记录](verification/2026-10-08/A0_VERIFICATION.md)；已进入A1 |
| A1 随堂问答 | learner会话、公开检索、双语模型、引用／导航、历史／清除／评价、恢复／幂等 | [A1记录](verification/2026-10-08/A1_VERIFICATION.md)；原生键盘／焦点／后台待真机 |
| A2 测验辅导 | 全active checkpoint限制、本人已答固定讲解、3级提示、12独立模板、正式复习推荐 | [A2记录](verification/2026-10-08/A2_VERIFICATION.md)；独立模板审核待完成 |
| A3 主动帮助 | 正式／练习信号分开、静态提示、原子限频、偏好／冷却、默认关闭停留实验 | [A3记录](verification/2026-10-08/A3_VERIFICATION.md)；90秒及读屏／视频排除待真机 |
| A4 验收／发布 | 类型、32项server及30项client测试、61次导师API、123次原gateway HTTP、SQL／lint、双平台Hermes、60条真实评估、后端追踪 | [A4记录](verification/2026-10-08/A4_VERIFICATION.md)；真机、独立事实审核／内容发布、生产依赖及部署待完成 |

## 实际实现与边界

- 新客户端类型/API/双语文案及 `src/components/learning/tutor/` 接入原 LearningRoomFlow／LearningUi，保留学堂Tab、布局、learningTheme及SDG13／13.3。未改冰箱／成就配色。
- 新 `/api/learning/tutor` 与 evidence/model/service/input，复用现有 Responses transport 和 assistant共享限流预算。模型无工具，客户端不传learner、分数、答案或导航目标。
- 原正式首答／评分／80%解锁仍由原learning RPC决定。任一active checkpoint期间暂停自由聊天；已答题只允许explain/simplify/example，无任意message；未答正式题无入口；退出页面不abandon。
- 六表归属learner，复合外键保护个人消息/请求；恢复在临时learner删除前合并，原偏好优先、旧pending失效、冲突键保留namespace。共享join/leave不合并导师身份。
- 正文30天；清除立即删除正文/缓存，保留无正文tombstone阻止迟到保存；请求/干预90天清理。daily cron已登记，实际运行历史仍需观察。

详细契约见 [AI_TUTOR_API_CONTRACT.md](AI_TUTOR_API_CONTRACT.md)，后端上下文已追加实际导师数据契约。

## 数据库、教材与环境

新增并提交七条migration：`20261008010000` foundation、`11000` draft v1、`12000` review/help、`13000` support修复、`14000` evidence v2、`15000` versioned context/practice signals、`16000` credential alias修复。全部先在开发库预演并已应用；最终56份本地/开发migration一致，SQL lint无错误。未重写任何已应用migration。

开发Gress-development／`thmbtsssvnslotoexntz`；`npm start`／`npm run server`默认启用三导师开关，保留显式0。普通服务无开关时仍默认关闭；生产 Vercel 已明确配置三个开关为 1。生产 `vcsujjaapchvcnndlhqb` 与开发均已应用 57 份 migration，最新 `20261012050000`，最终 lint 与 production dry-run 通过。

课程 learning-room-v1 已 published，hash `0736124795fd1dbc5e5b82521f919162ea82692c27a3f127b850410ce31f6054`，审核人 NarIyirm，与 AI 作者不同。导师 v1/v2 继续保留原始 draft；新增 v3 已 published，63 块公开证据与 12 模板教学内容未变，仅增加负责人复核记录，hash `665f4a761224842cfadc6143f28e3f92f5374c02a04b8a48eee99159028d12a2`。NarIyirm 也是原作者，因此模板独立审核仍 pending，ownerReview 为 approved。新 guard 例外绑定此次版本／hash／真实授权；历史会话继续绑定原 manifest。

## 真实模型结果

用户明确授权本次60条固定评估。最终gpt-5.6-luna／learning-tutor-p3／v2：60/60结构与引用检查通过、48次供应商调用及12次本地拒绝、0错误；p50 2901ms、p95 9260ms；输入85210/输出7508 tokens。早期失败及修复保留，见 [模型报告](verification/2026-10-08/TUTOR_MODEL_EVALUATION.json)。这**不代表95%教学事实正确率或独立审核通过**。

## 2026-10-08 用户批准的视觉改版

用户批准四张 Spoonie 伴学效果图并要求尽量一致，现已落实随堂欢迎、讲解回答、答后辅导和正文内主动帮助。保留原品牌 token、Spoonie、官方 SDG 13 图标，以及现有 learner/API、评分和主动帮助资格逻辑；不改数据库或冰箱／成就配色。

已完成：新增独立展示层、底部提问区／固定辅导意图、分段讲解、静态食物流程配图、可展开出处、右上会话菜单、课程正文后的主动帮助。390×844 中文、320×667 中文／英文离线预览已检查；类型检查、30 项学堂回归、10 项导师测试及 Android/iOS Hermes 导出通过。实际截图、操作检查与限制见 [视觉改版验证记录](verification/2026-10-08-redesign/UI_REDESIGN_VERIFICATION.md)。

待验证：真实设备键盘／安全区／读屏／后台恢复、1.3／1.6 字体；原课程、模板、模型回答与新增配图的独立内容审核。下一项为这些验收及人工审核，生产发布仍 pending，视觉改版不替代原 A4／P5 验收。

## 2026-10-12 发布决定与后续观察

1. 原生真机验收：负责人表示有 iPhone，随后明确“不需要验收”；记录 waived-by-owner，未执行，不宣称通过。
2. 人工审核：负责人明确表示已审阅并要求发布。课程记录真实独立审核；导师记录负责人复核的单次发布例外。60 条模型回答记录全局负责人批准，没有虚构逐条评分或实测 ≥95% 准确率。
3. 生产 schema／课程／导师／Express／App 构建均已完成；TestFlight 上传 FINISHED，后续 Apple 处理和 App Store 审核状态由 App Store Connect 管理。
4. 开发已验证跨实例、清除竞态、恢复、配额与故障边界。生产 cron 已 active，查询时成功／失败运行均为 0，首次自然运行尚未发生；实际货币账单、生产故障与成本属于后续运行观察，未虚报通过。

## 工作区保护

本轮开始已有FridgeScreen、FridgeFoodCard、快速使用组件/工具/测试、docs/fridge、i18n、BACKEND_DATA_CONTEXT及旧交接修改，未撤销。i18n只增加导师文案入口，后端上下文只追加导师章节；原有修改不顺带纳入导师提交。
