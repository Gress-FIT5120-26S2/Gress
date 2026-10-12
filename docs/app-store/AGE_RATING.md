# 年龄分级事实核对

2026-10-12，根据实际代码及 [Apple 年龄分级定义](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)填写。

Apple 的 Messaging and Chat 指用户可在 App 内直接彼此沟通。KitchMemo 的私人聊天是当前设备与 AI 的一对一对话，不提供用户之间私信、群聊或公开发帖：

- `server/src/routes/assistant.js` 的 `resolveConversation` 按 `creator_device_id === request.deviceId` 限制会话，POST 消息只存当前用户输入及 `runAssistant` 产生的 AI 回答。
- `server/src/services/learningTutorModel.js` 的 `runLearningTutor` 通过 `createOpenAIResponse` 生成导师回答。
- `server/src/services/openaiResponses.js` 仅调用 OpenAI Responses API；不存在把该消息发送给另一用户的逻辑。
- `server/src/routes/learningTutor.js` 的会话读写同样绑定 `req.deviceId`；共享库存不共享私人会话。

因此“信息和聊天”应为否。此结论依据具体定义和代码，不是隐藏实际收集的聊天内容；App Privacy 仍必须申报这些私人用户内容。

没有家长控制、年龄验证、App 内任意网页浏览、公开 UGC 分发、社交媒体或广告。受邀请家庭共享库存／清单不具备广泛内容分发。普通外部支持链接不构成 App 内不受限网页浏览。

动态食品条码和厨房建议可能偶尔提及酒类，选择“偶尔”，而不声明所有动态内容都没有酒类。静态课程未检索到相关内容；此选择反映开放食品库的实际范围。生活方式建议选择“健康或保健主题：是”；医疗诊断／治疗建议属于厨房助手的明确禁止范围，选择无。

无性／裸体、暴力、武器、赌博或抽奖箱；个人练习与成就不提供用户之间竞赛。2026-10-12 问卷已保存，Apple 自动计算评级为 13+，没有自行覆盖成更低分级。
