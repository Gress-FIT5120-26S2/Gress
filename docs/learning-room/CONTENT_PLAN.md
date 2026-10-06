# Learning Room 课程、Quiz 与资料内容计划

更新时间：2026-10-05。P1 已制作三课程、9 活动、48 道双语题和 9 条资料，完成作者来源核对与结构验证；独立校对仍 pending，尚未发布。实际字段见 [CONTENT_CONTRACT.md](CONTENT_CONTRACT.md)，完整题目与依据见 [CONTENT_REVIEW.md](CONTENT_REVIEW.md)。

## 1. 教育主线

用户首先理解浪费是什么，练习辨识和处理日常材料，再学习如何避免浪费及其气候关联。SDG 为 **13 Climate Action**，重点解释 13.3 的气候教育和意识提升。不要把课程做成百科词条集合或只教三个桶颜色。

每课有：一个清晰学习目标、1–4 分钟内容、一个生活例子、可靠来源、一项简短 reflection、明确下一步。每个阶段的正式 checkpoint 评估该阶段知识，而不是考用户记住新闻发布日期。

## 2. 三阶段课程目录

英文名称要与图 01、02、04 一致；中文为首版拟定翻译，可在不改意图的前提下润色。

| courseCode | 英文／中文 | 活动 code | 活动类型与学习目标 | 时长 |
| --- | --- | --- | --- | --- |
| waste-basics | Waste basics／浪费基础 | beginner-why-waste | Why food gets wasted／食物为什么被浪费；复用现有线性动画，识别遗忘和过量购买 | 1 min |
| waste-basics | 同上 | beginner-materials | Know your materials／认识材料；区分食物残余、铝、塑料、纸和未知混合包装 | 4 min |
| waste-basics | 同上 | beginner-bin-action | Practise with Bin Action／分类练习；根据题目明确上下文选择，知道查当地规则 | 2 min |
| packaging-recycling | Packaging & recycling／包装与回收 | intermediate-components | One item, several materials／一件物品，多种材料；分离食品、容器和包装部件 | 3 min |
| packaging-recycling | 同上 | intermediate-clean-streams | Keep recycling useful／避免回收污染；根据当地收集规则处理残留物与混合材质 | 4 min |
| packaging-recycling | 同上 | intermediate-local-guide | Find the right collection／找到正确收集方式；理解专门收集、退费点与 council 差异 | 3 min |
| preventing-waste | Preventing waste／减少浪费 | advanced-plan-first | Use what you have／先用已有食物；购物前查看冰箱和计划餐食，减少重复购买 | 3 min |
| preventing-waste | 同上 | advanced-storage | Store with care／合理储存；减少品质损失，安全期限与品质期限不能混为一谈 | 4 min |
| preventing-waste | 同上 | advanced-climate | Waste & climate action／浪费与气候行动；了解资源投入、排放、证据范围和 SDG 13.3 | 4 min |

时长是内容制作的目标估计，发布时应按实际长度校正，不声称实时测量用户阅读速度。checkpoint 不算第四节课，因此 Beginner 保持图中的 3 lessons。

Beginner 第一课来自现有 OzHarvest 2025 调查动画；不得去掉它对「有 35 岁以下成员的澳洲家庭」的统计范围。新气候阅读内容不能把该动画调查值转换为所有人的个人浪费量。

## 3. 题库蓝图

| 等级 | 题库最少数 | 一次抽题 | 建议覆盖比例 |
| --- | --- | --- | --- |
| Beginner | 12 | 6 | 2 个材料识别、2 个有明确上下文的分类、1 个浪费成因、1 个减废／气候基础 |
| Intermediate | 16 | 8 | 2 个部件分离、2 个污染／包装规则、2 个地方／专门收集、2 个复用与资源 |
| Advanced | 20 | 10 | 3 个购物／预防、2 个储存与安全边界、2 个循环利用／优先次序、3 个气候／数据／SDG |

抽样必须满足 blueprint，每题同权重、只有一个明确最佳选项。题库不够某 topic 的候选时内容 validator 阻止发布，不能静默复制题目凑数。首版用单选和情景单选，通常 3–4 个短选项；题干不依赖细小图片里的不可见标签。

已制作的教学题方向（作者核对已完成，独立审核待完成）：

- 空铝罐属于哪种材料／在题目规定的服务里去哪里。
- 一份食物与它的外包装是否应作为同一种材料处理。
- 不确定包装材质时，先做什么。
- 没有接受厨余的本地服务时，不能仅凭绿色桶颜色断定投放位置。
- 含多种材料的包装为什么需要查看说明或当地指引。
- 购物前查看已有库存如何帮助减少重复购买。
- use-by 和 best-before 在安全／品质上的边界；答案按审核来源。
- UNFCCC 的 8–10% 包含什么范围，为什么不能当成个人数据。
- SDG 13.3 为什么与学习 waste 的气候影响有关。

题目和解释使用中性教学语言，错误选项是合理误解而不是明显荒唐答案。不要用「所有塑料都进入 recycling」或「绿色桶总能收厨余」之类绝对陈述作正确答案。

## 4. 每题、每课与每篇资料的字段

### 4.1 Question

必填：questionCode、revision、contentVersion、stageCode、topicCode、双语 prompt、options（稳定 optionId＋双语 label）、correctOptionId（仅服务端）、双语 explanation、sourceRefs、reviewedAt、regionCode、双语 serviceAssumptions、relatedActivityCodes、imageAssetKey 可空、status。不另设重复的 language 字段；公开 catalog 登记 en／zh。

questionCode 不含 mutable 英文题干。每个 option ID 必须唯一，correctOptionId 必须来自当前 options。客户端不能用选项位置当答案。只有已回答当前题的反馈可包含正确答案；catalog 不包含私有题库。

首版 regionCode 为 global／AU／AU-VIC／AU-NSW；具体 council 接入需扩展契约。范围要符合来源，不能凭现有用户时区猜所在 council。未知地区显示教学实例，不显示「你当地的规则」。

### 4.2 Course／Activity

Course 定义 courseCode、stageCode、双语 title／summary／objective、coverAssetKey、activityCodes 与 relatedResourceCodes；版本由 catalog 登记。Activity 定义 activityCode、contentVersion、stageCode、type（lesson／video／practice）、双语 title／objective、body、durationEstimate、mediaAssetKey、sourceRefs、relatedActivityCodes、nextActivityCode 和 completionKind；resource 独立于活动表。

正文用 paragraph、bullet-list、fact、image、reflection、source 等受限 block。不能把完整生成图片当课程正文。动画完成由明确课程动作记录；视频早退不自动完成。减少动态效果用户可使用静态摘要完成同一学习目标。

### 4.3 Resource／News

必填：resourceCode、category（guide／data／news）、topicCodes、双语 title／summary／whyItMatters、publisher、sourceUrl、publishedAt、reviewedAt、relatedCourseCodes、coverAssetKey 可空。

数据另外保存 measurementPeriod、populationScope、units、includes／excludes、methodologyNote。文章没有精确发布日期时明确未注明，不伪造日期。自写摘要注明是应用摘要，不冒充媒体原文。

## 5. Library 初版

栏目结构：主题可包含 Waste basics、Recycling、Preventing waste、Waste & climate；类型可选 Guides、Data、News。每篇资料有「读完你会知道什么」，并可回到相关课程。

目标内容：至少 6 条指南／数据资料与 3 条真实新闻。资料可跨类型归类，但不可复制同文让列表看起来丰富。首版不加入 RSS／自动抓取／个性化推荐算法。

| 稳定内容建议 code | 类型 | 教学角色 | 当前制作状态 |
| --- | --- | --- | --- |
| waste-climate-sdg13 | Data + guided reading | 图 05 的 UNFCCC 排放范围＋13.3＋反思 | 双语正文与统计范围已制作，复用 P0 图片 |
| global-food-waste-evidence | Data | UNEP 全球估计，学习年份和统计范围 | 已制作；2022 年、消费端领域与不可食用部分已保留 |
| local-sorting-guide | Guide | Victoria 官方收集说明，说明 council 范围 | 已制作；不推断用户当地规则 |
| materials-and-components | Guide | 食物／包装／多个部件 | 已制作；使用官方 ARL 来源 |
| plan-before-shopping | Guide | 购物与库存使用 | 已制作；使用当前 Victoria Environment 来源 |
| date-labels-and-storage | Guide | 避免浪费但不越过食品安全边界 | 已制作；使用 FSANZ 官方来源 |
| news-zero-waste-2026 | News | 零废弃日聚焦食物浪费 | 已制作；UNEP，2026-03-30 |
| news-cds-vic-2026 | News | Victoria 容器退费里程碑 | 已制作；Victoria Premier，2026-04-04；不是实时总量 |
| news-date-labels-2024 | News／historical | 食品日期标签的公共教育背景 | 已制作；FSANZ，2024-10-31；明确历史背景 |

全部内容均待独立校对。原建议中的 UNFCCC 历史新闻改为 FSANZ 历史新闻，避免与图 05 的同一数据文章重复。两条 2026 新闻已核对真实页面与日期，不表示自动更新或截至今日的最新新闻。

图 05 的「Explore waste & climate news」打开本地精选 News 栏目。新闻未完成时开发版本可显示真实空态；上线前补足真实内容，不能虚构标题、作者或年份。

## 6. 统计与 SDG 文案的固定口径

**批准图中的事实**：UNFCCC 2024-09-30 文章指出 food loss and waste 约占全球年度温室气体排放的 8–10%。必须保留全球、annual、food loss 与 food waste 合计三个限定；不能写成家庭独占、最新 2026 数据或该用户的减排比例。

**SDG 13.3**：教育与气候意识是本功能的对应方向。不要写「本 App 完成联合国指标」或表示联合国认证。不要把 SDG 12 主线重新引入本项目；若 future background article 提及其他 SDG，必须明确次要上下文并遵守用户修订。

**个人行为**：反思建议「用已有食材计划一顿饭」可以推动用户实践，但阅读完成和测验通过都不构成真实食物挽救／减排测量。

## 7. 内容审核与版本发布清单

1. 以官方机构、政府、研究原文为主要事实来源；每题找支持其具体答案的页面。
2. 记录 publication date、review date、measurement year 与地理范围，不混用。
3. 双语语义一致；中文选项不因翻译泄露答案或增加歧义。
4. 至少一轮独立校对题干、唯一最佳答案、解释和来源；维护审核记录，不靠生成模型自己说审核过。
5. 校验 content hash、稳定 ID、schema、blueprint 数量、资产 ID、正文 block、来源 URL 和废弃标记。
6. 当前版本发布后不可覆写；下一次更改新建 content version，保留考试快照。
7. 所有 DB 参考内容写入用新 timestamped migration 记录并提交；开发验证后同文件应用生产。
8. 新内容可使用现有组件渲染；如需要新 block type，先发布兼容 App／API 能力，不能让旧客户端加载未知类型崩溃。

## 8. 已核对的参考链接

- [UN SDG 13 与 13.3](https://sdgs.un.org/goals/goal13)
- [UNFCCC：food loss and waste 与 8–10% 排放](https://unfccc.int/news/food-loss-and-waste-account-for-8-10-of-annual-global-greenhouse-gas-emissions-cost-usd-1-trillion)
- [UNEP Food Waste Index Report 2024 新闻稿](https://www.unep.org/news-and-stories/press-release/world-squanders-over-1-billion-meals-day-un-report)
- [Victoria 家庭垃圾与回收分类说明](https://www.environment.vic.gov.au/household-waste-recycling/sort-waste-recycling)

完整 18 个官方来源、逐题依据和审核状态已登记在 sources.json、review.json 与 CONTENT_REVIEW.md。作者核对不等同于独立校对；发布检查会阻止 pending 的内容上线。
