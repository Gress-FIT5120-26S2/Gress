# Learning Room 实施计划与跨对话基准

最后更新：2026-10-06（Australia/Sydney）。当前状态：**P0–P4 已完成开发验证；按用户修订将入口移到独立「学堂 / Learn」Tab，并修复默认开发启动的草稿加载；下一步 P5 真机与独立审核。**

## 1. 本次授权与固定基准

用户确认：「这版特别好，我就希望按照这版严格做出了，现在先根据这版效果生成一个详细的计划，这样后面切换对话也能继续做」。最初交付为可接手计划；随后用户逐阶段授权继续开发。按本计划和状态文件推进，已有视觉选择无需重新询问。

后续授权更新（2026-10-05）：P0 素材、P1 内容、P2 五页组件／预览完成；本轮完成 P3 个人学习 schema、考试 API、开发迁移／lint、298 次真实 HTTP 及版本 SQL 验证。独立内容审核与原生视觉验收仍 pending，生产未发布。本轮又完成 P4 gateway／动画与 practice／主入口，54 项自动测试与 123 次真实适配器 HTTP 通过。下一步 P5，实际阶段以 IMPLEMENTATION_STATUS 和各期验证记录为准，预览 fixture 不是真实成绩。

### 1.1 必须保留的决定

2026-10-06 用户修订优先：将学习入口移到导航栏，独立成页并改名。原 Home／Profile 入口、五 Tab 和全屏学习 Modal 决定已被替代；批准的五页内部布局、素材与配色继续沿用。详见 [NAVIGATION_UPDATE.md](verification/2026-10-06/NAVIGATION_UPDATE.md)。

- 项目对应 **UN SDG 13 — Climate Action**。学习室最直接的教育联系是 target **13.3**。
- 主题始终围绕 waste，逐步解释 waste prevention、材料分类、回收和气候之间的关系。
- 主流程为 **短课 → 教育动画／Bin Action 练习 → 阶段 Quiz → 解锁下一阶段**。
- 产品组织为 Learn、My path、Library，呈现教学平台的学习目标、课程目录、进度与下一步。
- 主视觉严格沿用已批准的 **app palette v2**：薄荷白、深绿文字、绿色状态、橙色主操作、少量浅蓝。
- Quiz 按初级、中级、高级推进，达到 80% 后永久解锁下一阶段。重返功能时继续个人当前阶段，旧课与旧阶段可复习。
- 个人学习进度独立于共享冰箱成就。答题不会增加冰箱 XP、挽救金额、实际投放次数或估算个人减排量。
- 新增独立「学堂 / Learn」底部 Tab，位于 Fridge 与 Achievements 之间；课程／测验保留局部导航栈，主导航持续可用。
- 首版同时支持现有英文／中文语言切换；英文用于对照已批准效果图。

### 1.2 文档优先关系

用户后续明确修订 > 项目 AGENTS.md 的适用要求 > 本文的已确认产品决定与逐页视觉规格 > v2 效果图 > 旧探索文档。

数据库当前事实以已部署 migration 为准。本计划中的新表、接口、文件名均是**待实现设计**，不是现有契约。实现时发现命名冲突可调整技术命名，并更新本文；不得因此改变批准的视觉、信息结构和用户流程。

### 1.3 接手入口

- 本文：总体功能、数据方案、开发顺序和验收要求。
- [VISUAL_SPEC.md](VISUAL_SPEC.md)：严格还原五张效果图的逐页规格与资产清单。
- [CONTENT_PLAN.md](CONTENT_PLAN.md)：课程、题库、新闻与资料的内容规划。
- [HANDOFF.md](HANDOFF.md)：新对话阅读顺序、继续开发提示词和易错点。
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)：实际进度、下一步、测试和部署记录。
- 批准的图与原始提示词：`docs/art-direction/learning-room/2026-10-05-app-palette-v2/`。

## 2. 仓库现状与可复用边界

本节核对日期为 2026-10-05。后续接手必须重新检查 Git 和当前文件，避免把规划当成已实现。

| 当前文件／能力 | 已存在事实 | 本功能的接入方式 |
| --- | --- | --- |
| `App.tsx` | 使用本地主 Tab 状态；动画和助手等通过独立入口／Modal 打开 | 按需加载学堂 Tab 内容；底栏上方预留 dock 高度，切离即销毁本人 gateway |
| `src/components/FloatingTabBar.tsx` | Home、Shopping、Fridge、Learn、Achievements、Profile | 新增 Learn 与双语标签；通知仍为二级页 |
| `src/components/LinearFoodWasteStory.tsx` | 一分钟动画，独立 Modal；支持暂停、拖动、静态摘要 | 课程复用现有视频；新增的完成回调不影响首页原调用 |
| `src/components/InteractiveFoodWasteStory.tsx` | 另一个已有互动故事实现 | 不误把它替换成当前首页实际引用的线性动画 |
| `src/components/fridge/WasteSortingOverlay.tsx` | 桶图、材质图、拖拽／点击、反馈；提交函数绑定库存使用事件 | 抽取纯展示交互层，增加独立学习室练习适配层 |
| `src/services/wasteLearningApi.ts` | 材质建议、图标准备、事件答题、共享统计 | 保持现有接口语义；学习室另用 `learningApi.ts` |
| `server/src/routes/wasteLearning.js` | 事件必须属于当前冰箱、当前操作者且为 consume；统计按冰箱 | 不可直接用它提交独立 Quiz，也不能伪造 eventUid |
| `waste_sorting_attempts` | 最新唯一性为 `(event_uid, component_key)`，存在后续包装 migration | 不编辑旧 migration，不把该表改造成个人课程考试表 |
| `src/components/ProfileScreen.tsx` | 有个人资料／收藏／设置入口 | 学习入口迁到主导航，不再保留重复列表行 |
| `src/services/deviceId.ts` | 匿名安装 ID 和凭证；Web 当前不支持 | 进度关联已鉴权设备；不能承诺账号登录或任意跨设备同步 |
| 设备恢复 | `recover_device` 更新成员 device_id，并有个人资料转移 trigger | 规划学习身份随已验证恢复转移，不能只改客户端缓存 |
| `src/i18n.tsx` | 现有双语系统 | 界面文案接入现有系统，课程内容同样有 en／zh |

当前技术栈：Expo `~57.0.23`、React `19.2.3`、React Native `0.86.3`，Express `5.2.1` 与服务端 Supabase。代码前先读版本化 Expo 57 文档，不凭旧 SDK 经验引入新 API。

已完整读取 `docs/data-architecture/BACKEND_DATA_CONTEXT.md`。它含部分历史概述；例如一处写没有跨设备恢复，但后续章节、路由与 migration 已实现恢复。规划依照实际恢复契约，不依据该旧描述否认已有能力。

## 3. 功能范围与导航

### 3.1 入口及容器

当前主入口：底部「学堂 / Learn」Tab，书本图标，位于冰箱与成果之间。Home 教育按钮和 Profile 学习行已移除。首页原有动画直接入口与 3D 场景保留。

学堂以嵌入式页面呈现局部导航栈，加载／失败也在页面内，底部主导航持续可用。内部返回先回上层，根页系统返回回到进入前的主 Tab。切到学堂时暂停 Home 3D，关闭助手／首页故事；切离后卸载本人 gateway，再进时从服务器恢复。视频仍使用原有全屏 Modal。

初版沿用当前项目的本地状态／Modal 方式，局部路由以明确的 route 类型与 reducer 管理。此任务不顺带迁移整个 App 到 Expo Router。后续仓库若已统一导航，适配现有导航即可。

页面集合：hub、course、lesson、practice、quiz、feedback、result、question review、resource。hub 内有 Learn、My path、Library 三个 segment。同一返回处理函数接管顶部返回、iOS 边缘返回和 Android 系统返回，避免状态分叉。

### 3.2 信息组织

| 区域 | 首屏重点 | 深层内容 |
| --- | --- | --- |
| Learn | 当前课程、继续按钮、下一步活动 | 三阶段课程目录和短课详情 |
| My path | 当前等级、完成／解锁／锁定三阶段 | 已提交成绩、旧阶段复习、错题解释 |
| Library | 按主题组织的精选学习资料 | Guides／Data／News，来源、日期、反思与关联课程 |

首次打开的真实状态应是初级、0/3、第一课待开始。效果图里的 1/3、第二课和 5/6 是**视觉验收情景**，不是新用户默认数据。通过专用开发 fixture 重现截图情景，生产界面必须读取实际状态。

课程知识和 Library 资料允许自由阅读；只锁高级阶段的正式 checkpoint。初版不强制看完视频才允许考试，也不把「点开课程」自动认定为完成。对每个活动使用明确完成动作／经过服务端验证的练习完成记录。

### 3.3 补充页面原则

没有效果图的 lesson、My path、Library 列表、答案反馈、未通过页，必须使用同一 tokens、排版和组件，不另起设计方向。Library 是精选教学资料列表；新闻列表必须有「为什么与这节课有关」的说明，不能成为无限瀑布流。

## 4. 学习与 Quiz 的完整状态规则

### 4.1 等级与门槛

| 稳定阶段 code | 固定英文名称 | checkpoint 题数 | 通过最少正确数 | 下一阶段 |
| --- | --- | --- | --- | --- |
| `beginner` | Beginner — Waste basics | 6 | 5 | intermediate |
| `intermediate` | Intermediate — Packaging & recycling | 8 | 7 | advanced |
| `advanced` | Advanced — Preventing waste | 10 | 8 | 完成三阶段，进入混合复习 |

服务端用整数比较 `correctCount × 100 >= totalCount × 80`。显示百分数四舍五入：5/6 显示 83%，但不能拿四舍五入结果判分。第一题正确与否、练习完成和阅读完成均不能单独解锁下一等级。

### 4.2 一次正式考试

1. 开始：服务端校验本人身份与阶段资格，创建或恢复相同阶段未完成 attempt。
2. 抽题：按课程 topic blueprint 从审核题库抽题；同一 attempt 题目、顺序、选项 ID／顺序、解释、来源、内容版本及门槛冻结。
3. 选择：客户端本地选择一个 option；选择前主按钮不可提交。此时不显示正确答案。
4. Check answer：服务端判分并持久化；等待期间禁用重复提交，但保留所选项。
5. 反馈：展示正确／错误、简短解释、来源和「Next question」。首次提交是本题考试得分，不能原题反复改答刷满分。
6. 下一题：由服务端已保存游标继续；本次未答题的正确答案不返回客户端。
7. 最后一题：按钮为「See results」，调用原子 finish；服务器检查所有题已答，然后结算分数并解锁。
8. 通过：显示 score、旧阶段完成、下一阶段解锁，提供 Start next stage 与 Review previous。
9. 未通过：显示实际得分、80% 门槛、需要复习的课程、Review missed questions 和 Try again。无倒计时、降级或惩罚提示。

attempt 生命周期为 `in_progress → submitted`，主动放弃为 `abandoned`，内容因重大错误被撤回时为 `invalidated`。题目内部客户端状态为 unanswered、selected、submitting、checked、moving、error；所有异步结果要检查当前 route／attempt，防止离开后回写另一屏。

### 4.3 中断、重试与复习

- 退出 Quiz：默认保存已经提交的答案，下次继续原 attempt。未提交的当前选项可以丢弃；文案要明确。
- 「Restart」是显式动作，原 attempt 标为 abandoned 后再创建新 attempt。不能因为重启 App 而自动换题。
- 每人每阶段最多一个 `in_progress` 正式 checkpoint；快速双击、多请求与多实例由数据库约束及事务处理。
- 连接中断：重发相同幂等键；如果首请求已保存，返回相同结果。对同一题用不同答案重发返回冲突，不能覆盖第一次答案。
- 所有题已提交但 finish 响应丢失：恢复后自动读取／重试 finish，返回同一结果和解锁记录。
- 低级复习用 `review` 模式，不回退当前等级；错误解释可随时查看本人已回答问题。
- 高级通过后显示「Learning path complete」，主按钮是 Mixed review。不能假装存在第四阶段。
- 没有正式计时器；不得把服务端清理策略显示成考试时间限制。

### 4.4 返回学习室时的默认继续策略

正式未完成 attempt 优先；否则继续当前最高已解锁阶段的未完成课；该阶段课程已学完则推荐其 checkpoint；全部三级通过后推荐混合复习。刚通过初级，下次默认到中级，不重新推初级新考试。用户主动选择低级复习不改变默认阶段。

### 4.5 Bin Action 的独立练习模式

复用桶、材料显示、点击／拖拽和解释，创建 `practice` attempt，不要求冰箱有任何物品，也不调用库存 mutation。默认一组 3 个有明确题目上下文的分类练习；完成并确认三个反馈后记录课程 practice 活动完成。

支持点击作为拖拽替代方式。练习允许再次演示正确投放；首次答案仍保留为练习记录，演示重试不影响 checkpoint 分数。练习的结果不能写入 `waste_sorting_attempts`，也不增加成就页现有共享分类计数。

先抽取纯 `WasteSortingInteraction` 展示组件，库存 overlay 和学习室 adapter 分别负责提交、解释和完成动作。组件 props 用明确的 inventory／learning 模式类型，不能靠有没有 eventUid 的隐式判断混用 API。

未知材料、软塑料、玻璃、复合包装不得全部硬塞进三个桶的通用正确答案。只有题目明确描述的地区／服务接受范围时才可评分，否则使用「检查当地指引／专门收集」的选择或教学指南。

## 5. 课程与内容方案

完整目录、题型比例、来源字段和发布规则见 [CONTENT_PLAN.md](CONTENT_PLAN.md)。首版三个阶段各 3 个活动；优先复用已存在的一分钟故事与 Bin Action 静态资产。

题库首版采用单选／情景单选，以当前 Quiz 效果图的 radio 选项为基准。不要先扩展复杂多选、拖拽考试或开放式 AI 判分。题库至少初级 12、中级 16、高级 20 个审核问题，使重考有合理变化；只随机抽题而不随机生成事实或正确答案。

每题都具备可稳定引用的 code、contentVersion、topicCode、stageCode、双语问题／选项／解释、correctOptionId、来源链接、核对日期、适用地域和相关 lessonCode。评分答案只留在服务端。

课程资料与题库使用版本化参考内容。初版不引入后台 CMS 或自动抓取新闻；通过仓库内容文件和可复现发布 migration 维护。新闻必须是真实、经核对的文章，初版建议 3 条；数据／指南建议至少 6 条，覆盖 waste、回收和气候。

课程中的食品储藏建议只能使用审核官方来源，不把模型猜测写为安全事实。涉及 use-by／best-before 时，遵守已有安全期限契约，不能以减少浪费为理由鼓励食用过了 use-by 的食物。

## 6. 待实现数据模型

### 6.1 身份、内容与权限

所有业务请求保持 `Expo → Express → Supabase`，复用现有设备凭证验证和 requireFridge 的可信上下文。这里虽有当前 fridgeUid，个人学习归属仍由 request.deviceId 映射到 learnerUid；客户端不能提交另一个 deviceId／learnerUid 来指定归属。

建议引入稳定 `learner_uid`，由服务端懒初始化并唯一关联当前 owner_device_id（text）。它只是匿名设备学习档案，不是新登录账号。加入／退出共享冰箱不迁移或合并学习成绩，也不向其他成员广播个人进度。

下表已由 P3 两份新 migration 在开发库落地；实际 SQL 为权威来源，完整证据见 P3_VERIFICATION.md：

| 表 | 主要字段与约束 | 用途 |
| --- | --- | --- |
| `learning_content_versions` | content_version PK；public_catalog jsonb；private_question_bank jsonb；content_hash；published_at；status；冻结后不可修改 | 可复现课程、资料、题库版本；服务端公开投影严格剔除答案 |
| `learning_learners` | learner_uid UUID PK；owner_device_id text UNIQUE FK devices；state_version bigint；created_at／updated_at | 本人身份、并发锁与状态版本 |
| `learning_stage_progress` | learner_uid＋stage_code PK；unlocked_at；passed_at；first_pass_attempt_uid；best_correct／total 的审计字段 | 永久解锁与阶段完成，不受新题库阈值静默回退 |
| `learning_activity_progress` | learner_uid＋activity_code PK；activity_type；first_completed_at；last_completed_at；seen_content_version；completed_attempt_uid 可空 | lesson、practice、resource 已学／已读状态，稳定 activity code 防重复 |
| `learning_quiz_attempts` | attempt_uid UUID PK；learner_uid FK；stage_code；mode；activity_code 可空；content_version FK；question_snapshot jsonb；pass_percent；question_count；status；correct_count；started_at／submitted_at；create_key | 冻结抽题、恢复、正式考试／复习／练习记录 |
| `learning_quiz_answers` | answer_uid UUID PK；attempt_uid＋question_instance_uid UNIQUE；selected_option_id；is_correct；answered_at；request_key | 每题首次答案、幂等与本人错题复习 |
| `learning_attempt_requests` | learner_uid＋create_key PK；original_key；attempt_uid FK | 每个恢复创建键永久绑定原考试，已完成后重试也不另开考试 |

关键约束：未完成 attempt 的部分唯一索引按 learner_uid／stage_code／mode／activity_code，正式 checkpoint 每级至多一份；create_key 在 learner 内唯一；answer 请求键在对应 attempt 内唯一；submitted 状态必须符合题数和时间约束。历史题目快照包括双语解释与来源，题库发布后不能重写历史考试。

解锁、finish 和答案提交都通过仅 service role 有权执行的 RPC 事务完成；不能分成多次 HTTP 数据库写入再由客户端合成结果。所有新表启用 RLS，撤销 public／anon／authenticated 权限；App 不导入 Supabase Data API client。

### 6.2 参考内容发布

仓库新增 `server/data/learning-room/v1/` 下的 catalog、question-bank、resources 文件，经过 schema／双语／来源验证后生成新 timestamped migration，插入不可变 content version。它们是非用户参考内容，保存 Git 中。

题库参考 JSON 到数据库内容的转换必须可重复、带 hash，并明确这是发布 reference data。修改答案／地区规则时新增版本；对已应用 migration 不改动。`supabase/seed.sql` 不保存用户考试、学习身份或进度。暂不要求每篇非评分新闻变化都改变整个 App；新 server content version 可由 Express 提供，资产 ID 需要满足旧 App 可渲染能力。

### 6.3 身份恢复

为学习身份添加单独的 membership device_id 更新 trigger／恢复事务扩展，用**新 migration**连接已有经过凭证验证的恢复机制。普通共享加入只换 fridgeUid，不能触发学习身份转移。

恢复时：旧 learner 的 owner_device_id 转移至新安装；如果新安装已产生临时学习记录，则在同一事务保留其 attempts／answers，归并到旧稳定 learner，活动进度幂等合并，阶段解锁取合法已结算记录的合集。同阶段两个未完成 checkpoint 只保留一个可继续，另一份标 abandoned 并保留恢复冲突原因，不能违反唯一索引或删除历史成绩。

当旧安装没有学习档案时保留新安装档案。旧设备凭证撤销后不能再读写旧学习记录。恢复操作失败时学习数据、成员与凭证必须一起回滚；不能在恢复 HTTP 成功后再异步转移学习成绩。

此设计不提供同一身份同时在多台设备登录的功能。卸载且没有恢复码时，依照当前安装身份机制处理，不能靠昵称找回成绩。

### 6.4 状态与内容更新

每次个人学习 mutation 递增 learner.state_version。前端成功提交后合并服务端状态，并在打开／回前台时 GET state 对账；首版不增加私人学习 Broadcast 频道或共享冰箱同步领域。

新内容版本不让已解锁阶段重新锁定。已有 attempt 按冻结版本恢复；若错误内容必须撤回，服务端 invalidated 后给出明确重新开始提示，不计失败、不抹掉既往合法阶段解锁。

## 7. Express API（P3 实际契约）

接口统一在 `/api/learning` 下，已挂载在既有凭证鉴权之后。P4 已用 learningApi／learningGateway 映射真实 HTTP，开发 preview 仍独立运行。所有文本一次返回 zh／en，不按 language 参数动态裁剪。

| 方法与路径 | 请求重点 | 响应重点 |
| --- | --- | --- |
| GET `/catalog` | 设备鉴权 | `{content}` 公开双语目录、stage／course／activity、resource、assetKey、来源；无私有题库 |
| GET `/state` | 身份来自中间件 | 三阶段 status、已完成活动、resumeTarget、activeAttemptUid、最近本人结果、stateVersion |
| GET `/courses/:courseCode` | 稳定 courseCode | 目标、三活动目录、时间、checkpoint 配置、相关阅读 |
| GET `/activities/:activityCode` | 稳定 activityCode | 结构化 lesson／resource 内容、日期、统计范围、媒体与来源 |
| PUT `/activities/:activityCode/completion` | contentVersion、幂等键；不接收任意用户 ID | read／lesson 已学状态和更新的 state；practice 由有效 practice attempt 结算 |
| POST `/attempts` | stageCode、mode、可选 practice activityCode、createKey | 创建或恢复考试，`quiz`／`result`、`status`、`attemptContentVersion` 和个人 state |
| GET `/attempts/:attemptUid` | attempt 必须属于本人 | status、已答进度、当前题、允许展示的历史反馈、未完成或已结算 state |
| POST `/attempts/:attemptUid/answers` | questionUid、optionId、requestKey | 已持久化首答 feedback 与来源，仍停在该题；不会隐式前进 |
| POST `/attempts/:attemptUid/next` | requestKey | 当前题已答后才前进；重发同键不跨题，最后一题不再推进 |
| POST `/attempts/:attemptUid/finish` | 幂等键 | 分数、passed、首次解锁与否、nextStage、更新的 state |
| POST `/attempts/:attemptUid/abandon` | requestKey | abandoned（learner_restart）或既有终态；不能抹掉结果 |
| GET `/attempts/:attemptUid/review` | 本人 attempt；missedOnly=true 可选 | `{questions,sources}` 本人已答题与解释；未答题不能偷取答案 |

响应要有稳定错误码：invalid_input、learning_stage_locked、attempt_not_found、attempt_not_active、answer_already_submitted、attempt_incomplete、content_unavailable、learning_unavailable。另一个人的 attempt 返回 404，避免泄露是否存在。未通过是正常 200 结果，不当作网络异常。

创建与提交只接受服务端允许的 mode、stage、option 和当前 question instance；quiz mode 由服务端决定能否解锁。客户端传来的 passed、correct、score、nextLevel、question_count 一律不能用于结算。

模式规则：checkpoint 才能解锁；review 不改变等级；practice 只能完成对应活动，不能把 practice 的 3/3 当作 Beginner 通过。完成阅读不改 quiz 分数。

来源使用审核后的 HTTPS 链接；资源正文采用受限结构化段落／列表／事实／来源块，不执行远程 HTML、任意 WebView 脚本或未经验证的 Markdown 插入。GET 返回字段用显式 projection，不能把数据库私有 question_snapshot 整块 spread 到客户端。

## 8. 前端实现结构

建议新增以下文件，实际目录可在不改变边界的前提下调整：

| 目录／文件 | 职责 |
| --- | --- |
| `src/components/learning/LearningRoomFlow.tsx` | 全屏容器、局部 route、统一返回、动画／练习覆盖层管理 |
| `LearningRoomHome.tsx` | Learn hub 与三个 segments |
| `LearningCourseScreen.tsx` | 课程目标、目录、checkpoint、相关阅读 |
| `LearningLessonScreen.tsx` | 短课、媒体入口、解释与明确完成动作 |
| `LearningPathScreen.tsx` | 三阶段进阶和旧级复习 |
| `LearningLibraryScreen.tsx` | 主题与 Guides／Data／News 精选列表 |
| `LearningResourceScreen.tsx` | 图五类型的文章、事实、SDG 与反思 |
| `LearningQuizScreen.tsx` | 单题、所选答案、提交和反馈状态 |
| `LearningResultScreen.tsx` | 通过／未通过／高级全部完成 |
| `LearningReviewScreen.tsx` | 本人已答题及解释 |
| `LearningPracticeScreen.tsx` | Bin Action 学习模式 adapter |
| `learningTheme.ts` | 该功能固定 tokens、type scale、spacing；不顺带全局改配色 |
| `learningAssets.ts` | 本地图片 assetKey 注册与稳定备用资源 |
| `src/services/learningApi.ts` | 全部学习室业务 HTTP 请求，复用 requestApi |
| `src/components/learning/LearningDataProvider.tsx` | 本人 catalog／state 内存快照、失效与恢复 |
| `server/src/routes/learning.js` | 鉴权后输入／输出契约与 RPC 调用 |
| `server/src/services/learningCatalog.js` | 审核 catalog 投影、版本与内容查找 |
| `server/src/services/learningAssessment.js` | 题目 blueprint 抽样、快照准备；不由客户端评分 |

Provider 在学习室首次使用时懒加载即可，不使整个 App 启动等待课程内容。不要把自己的学习状态塞进 Profile 或 Achievement provider。UI 状态和权威状态分离：segment／route／未提交所选项是本地状态，分数／完成／解锁／已提交答案来自 Express。

缓存：catalog 和可公开阅读资源允许按 contentVersion 缓存；个人 state 默认内存保留，App 重启以 GET state 恢复。若保存用于定位的 activeAttemptUid，只存 UID 并按当前安装隔离，恢复必须重新鉴权。身份恢复后清理旧安装相关定位缓存。

离线：可读已缓存资料，显示离线说明；不在离线状态创建正式 checkpoint、判定答案或宣称解锁。网络错误保留当前 UI，给出同一请求重试。首版不开发复杂离线写队列。阅读完成网络失败时允许继续阅读，但界面不能显示已保存完成。

复用 `expo-image` 的 contentFit、已有 `expo-video` 播放逻辑、safe-area-context、现有图标和动画工具。动效只用于选项反馈／页面进入，短而克制；尊重 Reduce Motion。不要引入实时 3D、GSAP、Lottie 或新的导航库来做这五页。

## 9. 开发阶段与每阶段完成定义

按依赖执行，不以预计天数冒充工期承诺。每阶段结束必须更新状态文件、记录实测证据，然后继续下一阶段。

| 阶段 | 工作与主要产物 | 完成标准 |
| --- | --- | --- |
| P0 基准与素材 | 读取计划／版本文档；检查当前代码；登记五张图；整理静物、封面、铝罐、完成徽章和 SDG 13 原始素材；建立 tokens | 资产表与许可／出处完整；能使用独立素材而非把整屏截图当 UI |
| P1 内容契约 | 三课程活动与双语文案；至少 12／16／20 审核问题；资料／新闻；内容 validator；抽题 blueprint；所有规则和错误码 | 必需字段、来源、地区、双语和题目数量验证通过；不发布含占位内容的课 |
| P2 五页视觉实现 | 新功能容器、首页、课程、Quiz、通过页、阅读页；局部返回；开发 fixture 对照批准图 | 五个标准情景的真实 RN 截图完成对照，布局／字体／配色／素材均通过，真实 API 还未接时明确开发模式 |
| P3 数据与服务端 | 新 timestamped migrations、内容版本发布、个人身份／恢复、attempt／answer／finish RPC、Express routes、验证脚本 | 同一 migration 在开发库通过；个人归属、并发／幂等、门槛／版本／恢复验证通过；context 文档已更新 |
| P4 全链路整合 | 接真实 learningApi；Learn／My path／Library；短课；动画与 Bin Action 练习；失败／复习页；主入口／Profile 入口 | 空库存也能学和考；进度可重启恢复；初→中→高完整；开发 fixture 不进入正常运行路径 |
| P5 验收与发布准备 | 双语／字体缩放／小屏／离线／生命周期；原库存、成就、动画回归；开发证据；同 migration 生产发布步骤 | 本文验收清单完成；未验证项如实列出；不把 UI 能打开当作完整交付 |

P2 的 fixture 只供开发或截图验证，使用相同组件和 API 数据类型；不能设生产 fallback 为「假通过」或「固定 1/3」。首次已有数据可用前，正常入口不暴露伪造状态。

### 9.1 Migration 与环境发布顺序

1. 重新确认 Supabase 当前链接的是 development/test；核对 migration list，不能依据旧文档推定生产状态。
2. 编写新 migration，覆盖表／约束／索引／RLS／grants／RPC／trigger／参考内容。函数显式 schema 和空 search_path，保留所需授权。
3. 本地或开发验证，再在已确认开发项目 apply 和 lint；运行独立测试设备的端到端脚本。
4. 更新 BACKEND_DATA_CONTEXT.md，并将 migration 和依赖代码纳入同一个可追踪 Git 提交。
5. 开发 App 指向开发 Express／数据库，完整验收。保留迁移文件、hash 和运行结果。
6. 真正获发布授权后，核对生产未应用前置 migration，按顺序使用已验证的同一 SQL，再部署依赖的新 Express，最后启用 App 功能。
7. 回退应用发布时可以关闭入口／回退 Express/App；保留追加式数据库记录，不重置生产库或删除考试数据。

规划阶段没有迁移；P3 已新增、提交并在 Gress-development 应用 `20261005010000`／`20261005011000`。生产未应用，独立审核 pending，正式发布状态与验证结果见 IMPLEMENTATION_STATUS.md 和 P3_VERIFICATION.md。后续不能修改已应用 SQL。

## 10. 验收与验证计划

### 10.1 五张图的逐页验收

- 五页分别对应批准的 01–05 图，不更换主布局、静物构图、配色或信息顺序。
- 标准数据情景：首页初级 1/3、第二课；课程页三活动；Quiz 第 2/6 题且 Recycling 已选；通过页 5/6、83%、中级解锁；阅读页 8–10%、UNFCCC 日期、SDG 13.3。
- 实现截图保存 `docs/learning-room/verification/<date>/`；同一英文、系统字体默认缩放、相近长宽比逐页对照。图片中的手机框不属于真实 App UI。
- 同时验收真实新用户、未通过、全部通关、加载／无数据／错误状态，避免只有演示数据好看。
- 不能用几个抽象卡片替代批准的高保真图；无法复用素材必须记录并补齐，不以 Emoji 永久占位。

### 10.2 有意义的逻辑／数据库测试

| 场景 | 必须成立的结果 |
| --- | --- |
| 初级 4/6 与 5/6 | 4 未通过；5 通过且中级仅解锁一次 |
| 中级 6/8 与 7/8 | 6 未通过；7 通过 |
| 高级 7/10 与 8/10 | 7 未通过；8 通关 |
| 客户端伪造分数或 nextLevel | 不改变服务器结果 |
| 未答完调用 finish | 409／稳定 incomplete 错误，不能解锁 |
| 同题相同请求重发 | 返回首次结果，无重复答案 |
| 同题换选项重发 | 冲突，无覆盖或补分 |
| 双击开始／最后一题并发 finish | 一个 active 正式 attempt，一份终态，一次解锁 |
| 设备 B 在同冰箱访问设备 A 的 attempt | 404；不能读解释、进度或成绩 |
| 加入／退出共享冰箱 | 个人学习保留；另一成员不升级 |
| 恢复到新安装且新安装已有记录 | 原子归并、成绩保留、冲突 active attempt 有明确终态；旧 credential 失效 |
| 新版本／解释调整 | 旧 attempt 与成绩快照可恢复；等级不回退 |
| 未提交答案网络中断 | 原选项与重试保留，已提交结果可恢复 |
| practice 三题完成 | 课程练习完成；不解锁阶段、不写库存／共享排序统计 |
| lecture/resource read 完成重发 | 一份完成记录；不产生额外环境收益 |

服务端参考验证文件计划：`server/test/learningAssessment.test.js`（Node 原生测试）、`server/scripts/verify-learning-room.js`（开发库端到端）和 `server/scripts/validate-learning-content.js`。新脚本创建带唯一 run ID 的临时设备，只按本次精确 ID 清理；不能递归清空真实表。

### 10.3 设备与回归

重点实测 Android 原生环境和可用 iOS；当前 deviceId 不支持 Web，浏览器预览不能替代原生验收。测试窄屏／常规屏、大字体、长中文、safe area、Android Back、iOS edge back、屏幕阅读器焦点、Reduced Motion、App 回后台和进程重启。

保持点击区域至少 44pt，拖拽有点击替代，选项状态不只用颜色区分。橙色 CTA 使用较大粗体和清晰边界；实施时测量真实文字对比度，如必要在批准的橙色色系内微调文字／按钮亮度并记录理由，不重做整体配色。

回归原库存 consume→Bin Action 流程、包装多部件提示、成就共享排序统计、共享加入／退出／恢复、首页动画独立入口。学习室测验不能改变库存数量、expiry、共享成就或原 learning stats。

检查命令：`node node_modules/typescript/bin/tsc --noEmit`、Node assessment／content／wasteQuestionCatalog／UI 测试、内容 validator、`npm --prefix server run verify:learning-room`（从 server cwd 运行）。P3 已执行相关检查，具体结果见验证记录。需要原生导出时再运行 Expo Android export，产物放独立验证目录。

## 11. 实施风险及可直接采取的处理

| 事项 | 处理 |
| --- | --- |
| 效果图是生成位图，无现成独立素材 | P0 获取／生成独立静物、封面、罐和徽章；UI 用真实组件，资产按批准图对照 |
| 匿名设备不等于账号 | 本人设备＋已有恢复机制；不承诺额外账户系统 |
| 地方回收差异 | 题目带 region/service assumptions 和来源；不以桶颜色当普遍正确答案 |
| 新闻容易过时 | 显示真实发布日期与核对时间；历史内容不可标为 latest；不自动写入未审核资讯 |
| 目前仅五张核心图 | 补充页复用这些组件；不要求新对话重新设计方向 |
| 现有生产迁移落后 | 发布前核对实际 remote migration 状态，先补依赖；不能跳过环境验证 |
| 数字会被误当用户减排 | 阅读页标全球 food loss and waste；Quiz 结果只表学习成绩 |

无需现在再问用户的实现默认值：独立学堂主 Tab、三阶段 6／8／10 题、80% 门槛、单选首版、课程自由阅读、个人成绩、双语支持、可恢复的无倒计时考试、人工审核的版本化内容。

有实质产品分歧时才记录待决策，例如用户后续要求正式账号、多设备同时学习、后台 CMS、自动新闻订阅或 Quiz 奖励共享 XP。这些不是本计划首版依赖，不应阻止当前授权范围的实现。

## 12. 接手与完成报告

每次停止工作前更新 IMPLEMENTATION_STATUS.md：真实已完成项、修改文件、已应用迁移及环境、最后通过的测试、未验证项、下一条具体任务。不要只留「后续继续完善」。

完成报告必须区分：视觉实现、真实数据接入、开发环境验证、真机验收、生产发布。当前只有设计图获认可，不意味着上述后续阶段已完成。新对话从状态文件的下一步继续，不重新生成或重选 v2 设计。

参考：[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)、[UN SDG 13](https://sdgs.un.org/goals/goal13)、[UNFCCC waste 与排放](https://unfccc.int/news/food-loss-and-waste-account-for-8-10-of-annual-global-greenhouse-gas-emissions-cost-usd-1-trillion)、[Canvas 模块要求](https://community.instructure.com/en/kb/articles/660897-how-do-i-add-requirements-to-a-module)。
