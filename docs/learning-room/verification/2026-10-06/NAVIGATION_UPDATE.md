# 学堂导航与 Expo Go 开发加载修复

日期：2026-10-06（Australia/Sydney）。用户本轮要求：修复 Expo Go 学习加载失败，将入口移到主导航成为独立一页，并改名。本记录优先于 P0–P4 中旧的 Home／Profile／五 Tab／学习 Modal 决定。五页内容结构、素材与配色继续沿用批准版本。

## 失败原因与修复

截图中的 GET /api/learning/state、catalog 返回 content_unavailable，并非路由未挂载：index.js 已注册 createLearningRouter。数据库参考版本仍是 draft／独立审核 pending，普通服务只读取 published。旧根目录 npm start → npm run server → server dev 直接启动 index.js，没有经过草稿开发启动器。

根目录 server 现改为调用 dev:learning；因此 npm start、start:clear 和 npm run server 都使用 start-learning-development.js，设置两项草稿开关并强制校验非 production 和指定开发域名。未编辑 env 文件、未改 schema／RPC、未伪造审核或发布。npm run server:start、server 的 start／dev 和生产仍直接运行 index.js，保留 published-only gate。

启动脚本的变更不会作用于已经运行的旧 API 进程。停止旧根目录开发任务后，在根目录运行：

```powershell
npm start
```

随后在 Expo Go Reload。根目录 .env.development 仍使用现有电脑局域网 API 地址；如果电脑 IP 改变，再同步 EXPO_PUBLIC_API_URL。本次日志表明请求已到 API，故没有随意改地址。

## 导航与生命周期

- 名称：中文「学堂」，英文「Learn」；底部书本图标，位于 Fridge 与 Achievements 之间。
- Home 教育按钮与 Profile 学习行已移除。原首页视频／3D 热点保留。
- activeTab=learn 时按需加载 LearningRoomEntry，Flow 嵌入页面；加载与失败界面也在页面内，底栏可切换。
- 根页只显示品牌与标题，不再显示错误的 Home／Profile 返回按钮。内部返回走局部栈，根页 Android Back 回到进入前的主 Tab。后续同日手势修复禁用主 Tab 根页的 iOS 滑动返回，详见 GESTURE_ISOLATION.md；原生交互仍待验收。
- 内容预留统一 dock 高度（Android 104、iOS 118）；学习页不重复增加底部安全区。提交按钮位于底栏上方。
- 进入关闭助手／首页故事，厨房自然随主 Tab 暂停。切离卸载本人适配器，重新进入从真实服务器恢复；视频仍用全屏 Modal。
- Tablist 和 selected 语义已补齐；六项短标签适应小屏。

## 验证记录

| 检查 | 实际结果 |
| --- | --- |
| TypeScript | 全项目 --noEmit PASS |
| 自动回归 | 54/54：gateway 16、局部导航 8、内容 14、判分／HTTP 边界 8、原分类 8 |
| 实际启动器全链路 | npm --prefix server run verify:learning-gateway -- --development-startup：PASS，123 次 HTTP、4 次保存后丢响应；子进程运行实际开发启动器和完整 index.js，使用本轮临时端口 |
| 成绩与隔离 | practice 0/3 完成活动但不解锁；4/6 不通过；5/6、7/8、8/10 逐级通过；混合复习 12/12；重进恢复、首答重试、历史与库存／XP／通知隔离通过 |
| 草稿门槛 | published-only 服务仍拒绝 draft；非指定主机／production 无法打开草稿例外 |
| 测试清理 | 每轮 finally 删除本轮随机设备及其临时冰箱，确认该设备 learner／attempt 为 0；启动子进程已结束 |
| 正常 Android 导出 | PASS，.codex-build/learning-room-tab/android，59 assets／2045 modules；最终 index-eeda725d3dfeb0a2a09c52b122fc47d5.hbc（13,196,113 bytes）；这是 Hermes bundle，不是 APK／真机启动 |
| 正常 bundle 隔离 | 实际读取最终 HBC：含 /api/learning/catalog；不含 ui-preview-attempt、preview-can-question、private_question_bank |
| Web 小屏导航 | nav=1 独立 fixture 画布使用实际 FloatingTabBar；320px 中英六项各约 45.66px，无横向溢出（320/320），selected 标记正确 |
| Web Quiz 固定按钮 | 320×667 中文画布：检查答案 bottom=579，底部 tab top=640，无遮挡 |
| Web 错误界面 | error fixture 保留重试与六项导航，点击首页成功离开错误页；其他主 Tab 在独立预览中仅显示情景选择器，不模拟业务页面 |

本次首次普通 loopback 回归遇到开发环境已知的 JWT issued at future；该轮随机数据已清理。随后实际启动器的完整 123 请求通过。未修改身份凭证、鉴权或数据库。

Web 截图在本目录：learn-tab-zh-320.png、learn-tab-error-320.png、learn-tab-quiz-320.png（有明确预览提示）。它们验证布局／展示与开发预览交互，不是 Expo Go 或真实个人成绩。

## 接下来

P5：真实 Android／iOS 核对六项导航、安全区、内部／系统返回、离开后恢复、视频／GL 生命周期、分类 tap／drag、离线、字体 1.3／1.6、读屏与 Reduce Motion；完成真正的独立内容审核。生产迁移／发布仍未执行。后续无需再次确认 SDG 13、五页视觉方向或导航修订。
