# Spoonie 教学接口与实现基线

2026-10-08，A0 冻结。沿用设备鉴权与 Express，个人归属只由 device → learner 解析。

公共路径 `/api/learning/tutor`；所有 mutation 拒绝未知字段。context 类型见 `src/types/learningTutor.ts`：general、course、activity、resource、submitted-question、practice-question、practice-template，全部绑定 contentVersion。单题 context 绑定本人 attemptUid + questionUid。未答正式题绝不进入模型；practice-question 仅允许本人当前 practice 的固定 hint。

messages 接收 context、language、requestKey、可选 conversationUid，以及 message 或 intent 二选一。任何 active checkpoint 使自由问答暂停，submitted-question 仅 explain/simplify/example，不接受 message。开始生成与保存回复均重新检查身份、全部 active checkpoint、内容版本及 lease。

输出 TutorReply：answer、服务端证据中的 sources、最多三个注册导航动作、contextLabel、内容/manifest 版本、answerStatus、fallback。模型只产生文字、范围判断及 sourceCode；导航目标由服务端映射。模型无库存、评分或解锁工具。

六表：manifests（绑定 contentHash、审核/不可变）、conversations（learner/context/30天）、messages（复合 learner 外键/评价）、requests（同键 hash/租约/response/usage/练习提示状态）、preferences（三开关/时区）、interventions（规则/去重/冷却）。服务角色只读，写通过 `learning_tutor_action`；公开 catalog 和单题反馈由 `learning_tutor_context` 投影。清理 RPC 删除过期正文，保留90天无正文 tombstone；定时清理注册在 migration 中。

恢复：扩展原 transfer_learning_with_membership，在删除临时 learner 前迁移六表的个人数据；复合外键延后检查，幂等键冲突使用 recovery namespace，所有进行中请求失效，原身份偏好优先，保留提示更严格冷却。join/leave 不合并教学身份。

接口：POST messages；GET conversations（before创建时间/context，固定20条）；GET/DELETE conversations/:uid；DELETE history；PUT messages/:uid/feedback；GET/PATCH preferences；GET recommendations；GET practice/:code（contentVersion）；POST practice/:code/answer（contentVersion/optionId/requestKey）；POST hints（context/requestKey，仅本人当前practice）；POST interventions/claim（context/visitKey/reason/可选attemptUid）；POST interventions/:uid/respond（status）。来源GET sources/:code（contentVersion/可选context）重新验版本/归属，允许考试期间本人已答题冻结来源；没有任意URL输入。

主动提示由服务端统计驱动，接受提示不调用模型；用户点击发送才生成。每visit一次、topic拒绝24h、跨页5min、每日3次；停留实验默认关闭，客户端前台连续90秒且屏幕阅读器关闭才候选。个人推荐关闭后停止历史统计。额外模板由服务端固定判分，不写正式成绩/库存/XP。

UI：沿用 learningTheme 和 44pt 目标，顶部轻入口 + 独立 Modal 面板，键盘避让、可滚动历史/来源、固定输入、返回先关面板。保留课程滚动/选择；视频播放不显示导师。使用现有 Modal/safe-area，不新增依赖。错误保留输入和 requestKey；超过8秒提示等待，40秒客户端中止，迟到响应仅在对应会话恢复。

实施后：新增七条migration至20261008016000，开发56份与本地一致；生产只读最新20260914010000，未变更。导师v2最新草稿63公开块/12待审模板；历史会话经learning_tutor_conversation_context绑定原manifest并再次验证身份/内容/考试。三开关分别控制问答/辅导/主动，开发默认1但保留显式0；原P5/内容独立审核继续pending。开发gate不改变发布审核。
