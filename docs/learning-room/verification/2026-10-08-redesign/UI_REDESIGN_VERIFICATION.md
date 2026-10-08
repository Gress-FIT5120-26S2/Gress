# Spoonie 伴学视觉改版验证

日期：2026-10-08（Australia/Sydney）。用户已明确批准四张效果图并要求实施。四个场景已接入应用；本文区分实际 Web 开发画布、自动检查与仍未完成的真机／独立审核。

## 设计与实现

基准：[用户批准的四张效果图](../../../art-direction/learning-room/2026-10-08-ai-tutor-redesign/README.md)。写代码前读取 Expo v57 版本首页、Image 和 Safe Area Context 文档；遵循根 AGENTS.md。未新增依赖。

| 场景 | 已实现 | 实际截图（非生成图） |
| --- | --- | --- |
| 随堂欢迎 | 当前课程、原 Spoonie、大标题、三种学习入口、固定输入区 | [390×844 中文](01-welcome-zh.jpg) |
| 随堂讲解 | 用户问题、原服务器段落、短首段突出、食物流程静态图、重点段落、可展开真实出处和反馈 | [课程与问题](02-explanation-zh.jpg)、[新回答阅读位置](02-explanation-answer-zh.jpg) |
| 已提交题辅导 | 已提交状态／题目上下文、编号段落、厨房配图、三种固定意图、返回测验、评分说明 | [首屏](03-submitted-zh.jpg)、[讲解段落](03-submitted-answer-zh.jpg) |
| 主动帮助 | 正文与官方 SDG 图标之后显示 Spoonie 邀请；接受、拒绝、关闭偏好；底栏问 Spoonie／标记已读 | [课程首屏](04-proactive-zh.jpg)、[帮助邀请](04-proactive-help-zh.jpg) |

颜色沿用背景 #F7FBFA、森林 #173D31、薄荷 #EAF6F1、橙 #F58220；系统字体；常规边距24、窄屏18、主要按钮最小52、触控最小44。历史、新对话、设置和版本详情移到菜单。页面进入不自动弹键盘。输入和快捷操作分两行；窄屏缩小角色并纵向排列辅导意图，正文可以正常滚动。

真实文字与参考图有合理差异：不从生成图复制题库、结论或来源；只排版服务器返回文本。首段不是短段时不强行变成标题；单段文本完整保留。流程图只用于已知食物／气候课程且实际回答同时匹配食物、运输与气候／排放的成功回复，答后辅导不展示流程图。配图是打包静态素材，没有运行时 AI 绘图。图片文字和箭头使用原生组件，官方 SDG 标志继续使用原资产。

课程改版保留原统计事实：8–10%、全球年度排放、同时包含食物损失和浪费、UNFCCC 2024-09-30 引用、估计口径均在展开区；没有 statistics 时原 fact 直接展示，避免数据消失。UN 来源与非认可声明保留。

## 检查结果

| 检查 | 结果／证据 |
| --- | --- |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` 通过 |
| 学堂回归 | `npm run learning:test`：14 导航／状态 +16 服务网关，共30通过 |
| 导师逻辑 | `node --test server/test/learningTutor.test.js`：10通过；本轮不重新运行模型评估 |
| 原生构建 | Android/iOS Expo Metro + Hermes 导出通过，见 [最终导出日志](NATIVE_EXPORT.log)；生成文件在忽略目录 `.codex-build/learning-tutor-ui-redesign` |
| 中文 390×844 | 四个场景目视检查，欢迎三入口完整显示；新回答从开头显示，初次恢复会话不跳到回答末尾 |
| 窄屏 320×667 | [英文欢迎](06-welcome-en-320.jpg)、[中文答后辅导](07-submitted-zh-320.jpg)；DOM documentWidth=viewportWidth=320，无横向溢出，三入口滚动可达，固定操作可见 |
| 设置／历史 | 主动帮助开关变化已显示；返回对话保留会话；历史列出当前会话；新对话、确认流程保留原操作 |
| 来源／反馈 | 展开显示真实机构、标题、发布日期和地区；反馈保存后显示薄荷选中样式，按钮 pressed 状态可读 |
| 已提交题 | 页面没有自由 TextInput（数量0）；点击 simplify 新增固定意图讲解；返回测验只关闭面板 |
| 正式测验限制 | 自由输入只读，发送／快捷操作禁用；限制说明和继续／结束入口优先展示；结束仍须原确认流程 |
| 失败 | [失败截图](05-failure-zh.jpg)；原提问保留、输入只读、重试可用；重试沿用原 request key/payload |
| 练习／撤回 | 独立练习提交后选项锁定；使用显式 UI 预览反馈，不代表正式评分；撤回会话无输入区、来源操作禁用 |
| 主动帮助 | 拒绝后卡片数量0；原服务端资格、限频、冷却、偏好、读屏／视频排除逻辑没有改写 |

运行画布由 `EXPO_PUBLIC_LEARNING_PREVIEW=1` + `__DEV__` 显式开启。新增 `LearningTutorPreview` 注入独立内存服务；只有公开课程格式示例，不连接 learner、Supabase、模型或私有题库。以上交互检查不能证明真实网络／数据库行为，本次改动继续复用原服务与 API 检查结果。

本地预览：`npm run learning:preview -- --web --port 8094`；路径示例 `http://127.0.0.1:8094/?tutor=welcome&lang=zh`。tutor 可为 welcome / explanation / submitted / proactive / restricted / failure / practice / withdrawn。`chrome=0` 只隐藏开发工具栏；`width=320&height=667` 用于窄屏画布。

首次沙箱导出失败原因是 Hermes 无法写入沙箱临时目录的 `.hbc`，随后获准运行相同本地导出并成功；不是应用源码编译错误。未部署应用、未改数据库、未重跑60条真实模型评估。

## 仍待验证与下一项

1. Android/iOS 真机键盘、安全区、导航底栏、返回手势、焦点／读屏、1.3／1.6字体、长回复、后台／杀进程／断网恢复。Web 图模拟 top44/bottom24 和 fontScale1，不当作真机验收。
2. 新配图为视觉辅助，独立教学审核待完成；原课程、12模板、60条真实模型回答与来源的独立审核仍 pending。没有宣称事实正确率或内容发布通过。
3. 原学堂 P5、生产依赖、真实限流／成本观察与生产发布仍按 AI_TUTOR_STATUS.md 保留。

## 范围与工作区保护

应用改动位于 LearningTutorView / Panel / Controller / Slot、LearningUi、LearningResourceScreen、导师双语文案，以及显式开发预览。配图记录见 `assets/learning-room/TUTOR_ASSET_MANIFEST.json`。

开始时已存在 FridgeScreen、Kitchen3DPrototype、SpoonieWorldCharacter、FridgeFoodCard、src/i18n.tsx、BACKEND_DATA_CONTEXT、quick-use及docs/fridge未提交修改。本轮未修改、撤销或提交这些内容；未新增 migration，无后端数据契约改动。
