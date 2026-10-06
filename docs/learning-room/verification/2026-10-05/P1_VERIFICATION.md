# P1 内容与契约验证记录

日期：2026-10-05。环境：本地 Windows／Node；用户授权继续 P0 后的下一步。代码前读取 Expo v57 文档。没有修改 Express route、设备身份、库存、成就或数据库契约。

## 已完成范围

| 项目 | 数量／状态 |
| --- | --- |
| 双语课程／活动 | 3／9 |
| 私有双语题库 | 初级 12、中级 16、高级 20，共 48 |
| Library | 6 指南／数据＋3 真实新闻 |
| 官方来源 | 18，记录日期、地理范围与逐题引用 |
| 正式抽题 blueprint | 6／8／10，topic 数量已验证；抽题服务未实现 |
| 可发布状态 | 否；独立校对 pending |

SHA-256：`0736124795fd1dbc5e5b82521f919162ea82692c27a3f127b850410ce31f6054`。覆盖全部公开教学内容及私有题库，排除审核元数据。对应 manifest 与 CONTENT_REVIEW.md 相同。

## 实际检查

| 命令／检查 | 结果 |
| --- | --- |
| node server/scripts/validate-learning-content.js --write-manifest | PASS，明确更新最终草稿 hash |
| node server/scripts/validate-learning-content.js | PASS，manifest 与实际内容一致 |
| node --test server/test/learningContent.test.js server/test/wasteQuestionCatalog.test.js | PASS，14 新内容测试＋8 既有分类测试，总计 22，0 失败 |
| node node_modules/typescript/bin/tsc --noEmit | PASS，无错误 |
| node server/scripts/validate-learning-content.js --release | **预期拒绝**，exit 1；没有独立 reviewer、审核日期或批准 hash；全部题目独立状态 pending |
| rg 检查 src／App.tsx 的 question-bank、server/data/learning-room、correctOptionId | 无匹配；私有题库未引入客户端 |

测试覆盖：真实内容与媒体路径、缺失中文、重复题干／ID／选项、不存在答案、topic 缺口、错误门槛与客户端判分、练习／共享数据隔离、恶意 URL／越界路径、未知正文块与执行字段、日期和统计范围、公开答案泄漏、自我审核、缺失逐题审核、内容改动使旧审批失效、确定性 hash。

审批通过路径仅使用测试内存副本；未改变 review.json 的 pending，也没有模拟真人批准记录。validator 不能证明来源仍可访问、真实审核人身份或教育难度，独立内容审核仍需阅读实际来源与正文。

## 作者内容检查

18 个官方页面核对，逐题记录答案解释／具体来源；第二遍检查 48 题与 9 活动／9 资料。补齐分类服务条件、事实卡中文、玻璃盖／可见储存来源，并改善部分干扰项。完整清单在 CONTENT_REVIEW.md；这仍是作者检查，不是独立审核。

两条 2026 新闻：UNEP 2026-03-30、Victoria Premier 2026-04-04。FSANZ 2024-10-31 作为历史新闻，避免重复 UNFCCC 数据文章。没有自动新闻抓取、虚构日期或原文长篇转载。

## 交付边界与接续

- 没有新增页面／Home 入口、API、考试判分／等级恢复、SQL migration、远程操作、生产发布或 Git commit。
- 没有真机截图和 UI 对照；P1 不能当成 Learning Room 已能使用。
- 下一步 P2：局部原生容器与五页 UI，使用批准图、P0 资产及公开类型。开发允许草稿公开内容；发布前完成独立校对。P3 接数据时重新完整读取后端上下文。
