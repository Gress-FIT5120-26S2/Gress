# Learning Room P1 内容契约

日期：2026-10-05。版本：`learning-room-v1`，schemaVersion：1。P1 是离线内容与校验工具，尚未建立 HTTP 接口、数据库、考试服务或 App 页面。

## 文件与公开边界

| 文件 | 用途 | 可发给客户端 |
| --- | --- | --- |
| server/data/learning-room/v1/catalog.json | 阶段、课程顺序、blueprint、Library 主题、媒体、测验规则和错误码 | 通过显式投影 |
| activities.json | 9 个双语学习活动 | 是 |
| resources.json | 6 条指南／数据＋3 条新闻 | 是 |
| sources.json | 18 个官方来源及日期和地区 | 投影后；内部核对说明不公开 |
| question-bank.json | 48 题、稳定选项 ID、正确答案、解释、来源、练习关联 | **否，服务端私有** |
| review.json | 作者核对记录和待完成的独立校对 | 否 |
| manifest.json | 完整内容 hash、版本、数量、草稿状态 | 内容部署验证用 |

公开类型在 `src/types/learningContent.ts`。`buildPublicLearningContent()` 只选取教学字段，并递归阻止答案、私有题库或考试快照。App 不得 import 服务端目录或 question-bank。当前没有题目 HTTP 投影；P3 必须另外定义只返回当前待答题的契约，判分后才能返回该题解释。

`LearningText` 为 `{ en, zh }`。题干、选项、解释、服务条件，以及课／资料的可见正文全部双语。来源名称、URL、ISO 日期和 statistics 的 measurementPeriod、units、includes／excludes 是来源／机器元数据；界面展示范围时使用双语 fact.scope、populationScope、methodologyNote，不直接呈现英文元数据。未知发布日期使用 null，不能用 reviewedAt 替代。

## 阶段与抽题规则

| stageCode | 题库 | 一次正式题数 | 80% 最低正确 | topicCode／一次数量 |
| --- | --- | --- | --- | --- |
| beginner | 12 | 6 | 5 | materials 2、sorting 2、causes 1、climate-basics 1 |
| intermediate | 16 | 8 | 7 | components 2、clean-streams 2、local-collection 2、reuse-resources 2 |
| advanced | 20 | 10 | 8 | planning 3、storage-safety 2、prevention-priority 2、climate-evidence 3 |

每个 topic 有两倍抽样量的候选。P1 只定义并验证 blueprint，没有实现抽题或判分。P3 按 topic 无放回抽样，再冻结题目／选项顺序和内容版本；不能拿前三题当考试，也不能客户端计算升级。

正式通过用 `correctCount * 100 >= totalCount * 80`，显示整数百分比只用于 UI。首次提交答案冻结；完成事务原子解锁下一阶段。读取课程不需要解锁，不强制读完课才能尝试合资格 checkpoint，无倒计时。

独立 Bin Action practice 使用 beginner-bin-action 的 3 道关联题，只记录练习和课程完成，不消耗库存、不写真实投放记录、不解锁等级。高级通过后的 mixed-review 为 12 题，每阶段 4 题，不改变永久解锁状态。P3 需定义该模式的 topic 选法；P1 未宣称它已实现。

## 受限正文块

| type | 字段 |
| --- | --- |
| paragraph | text: LearningText |
| bullet-list | items: LearningText[] |
| reflection | title、text: LearningText |
| source | sourceRefs: sourceCode[] |
| image | assetKey、alt: LearningText |
| fact | value、text、scope: LearningText；sourceRefs |
| sdg-callout | goal=13、target=13.3、assetKey、title／text／detail 双语、sourceRefs、attributionRequired=true |

每个活动／资料都有 reflection；未知块或额外执行字段校验失败。渲染器只展示原生文字、列表与登记图片，不执行 HTML／脚本。SDG 13 图标按 P0 SOURCE.md 声明来源；不能裁成任意配色或写联合国认证。

video 引用已存在的一分钟动画与 poster，不生成新视频。提供相同学习目标的静态摘要；提前退出不自动完成。1–4 分钟是预计学习时长，durationEstimate 明确是否包括反思，不测用户阅读速度。

## 事实、地区与新闻

- 分类教学以 Victoria 为示例，问题内说明接受材料／服务；不能由设备时区猜 council。地区首版仅 global／AU／AU-VIC／AU-NSW，具体 council 接入需要新契约。
- UNFCCC 的 8–10% 是全球年度 food loss 与 food waste 合计，文章日期 2024-09-30；不是个人节省，也不是新 2026 测量。
- UNEP 的 1.05 billion tonnes 对应 2022 年，涵盖零售、餐饮服务、家庭和不可食用部分，报告 2024 年发布。
- 新闻是原文链接＋应用原创双语摘要，显示真实发布日期。两条 2026 年新闻和一条 2024 年历史食品日期标签新闻，不复制同一文章凑数，不标为实时动态。
- 食品安全内容使用 FSANZ 官方指引：use-by 过期不可食用；best-before 主要是品质，仍需考虑储存与状态。避免把减废目标当作忽略安全期限的理由。

## 审核与不可变版本

作者已完成来源核对和第二遍文字／唯一最佳选项检查；**独立校对尚未完成**。`review.json` 保留 pending，测试中的批准副本不会写回任何文件。

发布门槛必须同时满足：结构通过；每题独立状态 approved；独立 reviewer 非空且不同于作者；有效审核日期；approvedContentHash 等于实际内容 hash。这个门槛是离线记录校验，不能验证 reviewer 的现实身份；真正发布仍需由内容负责人核实审核记录，不可自行填一个名字绕过。

hash 使用 SHA-256，覆盖 catalog、activities、resources、sources 和完整私有 bank；对象 key 排序、数组顺序保留。review 元数据不进入 hash。修改内容、答案或源日期都会使旧批准失效。manifest 与实际内容不一致时只读校验失败。

草稿校验：`node server/scripts/validate-learning-content.js`。明确核对草稿修改后才能运行 `--write-manifest`。发布准备检查：加 `--release`，只读且不能同时写 manifest。当前会按预期失败，因为独立校对 pending。已发布版本不得覆盖；新建内容版本并保留旧考试快照。

技术验证：`node --test server/test/learningContent.test.js`。结构测试不能代替独立校对、原生 UI 验收、抽题服务或真实等级恢复验证。

P3 的数据库内容写入仍必须采用新的 timestamped migration，并遵守 BACKEND_DATA_CONTEXT.md；这些 JSON／manifest 不构成已部署的数据或 seed。

## P2 页面适配契约

`src/types/learningRoom.ts` 新增前端 view types 与 `LearningRoomGateway`：load、start／resume、submit、next、finish、reviewMissed、markActivity／markResource。它们只说明页面消费形状，**不是已有 HTTP 路由／数据库契约**；P3/P4 必须映射真实服务响应并更新后端上下文。

未提交的 `LearningQuestionView` 不包含答案／解释；这些字段只存在于 `LearningAnswerFeedback`。结果必须带服务返回的 `session`／stageStatus／resumeTarget，UI 不累计分数或推算升级。复习结果不能展示新解锁，阅读和课程完成不能改变正式等级。

`server/scripts/export-learning-preview.js` 从公开投影生成 `src/components/learning/dev/learningPreviewContent.ts`，先核对草稿结构和 manifest hash，不包含私有 bank／review。公开 `dateNote` 可为 null，客户端类型与原数据对齐。该草稿仅用于显式开发预览，不是可发布 catalog。
