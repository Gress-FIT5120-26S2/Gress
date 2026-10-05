# P4 实际接入与验证记录

日期：2026-10-05（Australia/Sydney）。P4 代码已实现，真实前端适配器的开发库端到端验证通过；Android／iOS 实际页面与系统生命周期验收仍属于 P5。生产未发布，内容独立审核仍 pending。

## 已实现

- `learningApi.ts` 复用既有 requestApi、Device-ID／Device-Credential，25 秒超时，不创建客户端 Supabase 连接。
- `learningGateway.ts` 映射真实 catalog／state／attempt／answer／next／finish／review／completion／abandon。等级、正确数、通过与来源均取服务器；stateVersion 用 BigInt 避免旧响应回滚个人进度。
- 一次写操作保留原 UUID 与首次 payload，合并并发请求；失败后重试相同操作。next 的键绑定当前题目；恢复活动考试后确认创建，避免丢创建响应的旧键在完成后重放旧结果。
- 首次未确认答案锁定选项并提供重试，返回／恢复也保留实例内 pending selection；服务器首答冲突或旧游标会重新读取当前题目。finish 丢响应后可恢复服务器结果。
- 每次打开创建本人适配器，关闭清空内存。响应前后核对设备身份；身份变化拒绝迟到响应，清除缓存。未做本地持久化题目／成绩，重新打开通过服务器恢复。
- AppState 回前台读取 catalog／state 与活动游标；关闭／返回使迟到 UI 更新失效。失效考试显示刷新入口；未发布内容显示审核中，不降级到 fixture。
- My path 增加服务器 recentResults 历史入口；旧考试／错题使用其来源快照。
- 课程接入已有 60 秒动画；支持播放、暂停、关闭、原有 Reduce Motion 摘要。课程依旧通过 explicit-confirmation 完成，阅读摘要亦可完成，不把播放结束当作考试通过。
- `WasteSortingInteraction.tsx` 提取桶／材质／手势呈现，父组件各自保存。原库存 overlay 仍调用 submitWasteAnswer；LearningPracticeScreen 只提交教学 optionId。三题全部提交后由服务器记录活动完成，即使 0/3，也不解锁等级。
- 教学首次答案冻结；答错后可演示正确投放，演示不调用 API、不改首次得分、不生成 inventory event。未来出现三桶之外的选项时回退到 Quiz 选项界面。
- Home 增加书本按钮、Profile medal wall 后增加学习行。保留原五 Tab，打开时暂停 Home GL、关闭助手并隐藏主 chrome，退出保持原入口 Tab；通知导航关闭学习室。
- 懒加载有可关闭的加载／错误／重试界面，重试重建 lazy；内容页面与播放器加载失败不会把整个 App 留在空白屏。

## 实际检查

| 检查 | 结果与范围 |
| --- | --- |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` PASS |
| 适配器离线故障测试 | `node scripts/test-learning-gateway.mjs` 16/16；并发、首答 payload、丢响应、游标恢复、结果、快照、身份变化、内容版本与失效 |
| 导航／开发预览 | `node scripts/test-learning-room.mjs` 8/8；预览 mixed review 修正为 12 题，practice 三步但仍回放一题和固定结果 |
| 学习内容／判分契约 | `node --test server/test/learningContent.test.js server/test/learningAssessment.test.js` 22/22；其中本机 HTTP 需沙盒外运行 |
| 原分类规则 | `node --test server/test/wasteQuestionCatalog.test.js` 8/8 |
| 实际前端适配器＋开发库 HTTP | `cd server; node scripts/verify-learning-gateway.js` PASS；最终一次 123 请求、4 次保存后丢响应模拟 |
| 空库存／升级 | practice 0/3 完成但保持初级；4/6 不通过；5/6→中级、7/8→高级、8/10→完成；12/12 混合复习；新适配器恢复中级、旧结果和 recentResults |
| 重试／重开 | 丢 create／answer／next／finish 响应后恢复或重试成功；原 answer payload 不能改；review abandon 后新 UID |
| 数据隔离 | inventory_batches、inventory_events、waste_sorting_attempts、fridge_xp_events、fridge_achievements、notifications 与测试前计数相等 |
| 清理 | 每次测试 finally 精确清理随机设备和其临时冰箱；确认该设备 learner／attempt 为 0 |
| Android 正常模式导出 | PASS；`.codex-build/learning-room-p4/android`，59 个资产，约 11 MB JS（index-1098e5f140e1ff331c70efe0af53bace.js）；不是 APK 或真机启动 |
| 正常 bundle 隔离 | 含真实 learning API 路径；不含 preview-can-question、ui-preview-attempt、private_question_bank；通用 i18n 的预览文案仍存在，不能据此认定 fixture 代码进入运行路径 |
| Web 课程／practice | IAB 实际打开课程、点桶、错误反馈、正确演示；首答说明保留，演示后显示 Now you know；英文 390×844、中文 320×667，无横向溢出（320/320） |
| Web 视频 | 实际打开，进度到 00:37/01:00，暂停后 Play／Paused 可见，关闭返回原课程 |

54 项上述自动测试通过。真实 HTTP 使用编译后的实际 `learningGateway.ts` 与 requireDevice／requireFridge／真实 RPC；不是仅直接测试路由或 fixture。测试用私有快照只在服务端脚本读取，客户端只收到公开投影。测试 Express 为临时 loopback 服务，不代表生产 CORS／限流部署验收。

开发请求曾间歇遇到 Supabase `JWT issued at future`，每次均清理成功；未修改鉴权或密钥，重跑通过，最终一次也通过。凭证被拒绝时客户端会清空本人缓存并提示刷新，已单独测试。初次 Web 动态模块热更新出现 unknown module，页面重载后视频正常；补了局部错误边界。不要把开发重载或成功 bundle 当作原生崩溃验收。

## 图像证据与限制

见 [p4-web](p4-web/SCREENSHOT_MANIFEST.json)：`practice-en.jpg`、`practice-feedback-en.jpg`、`practice-zh-320.jpg`、`video-paused.jpg`。截图是明确标注“不保存进度”的 React Native Web 预览；真实三题、升级与持久化证据来自上述开发 API 测试。预览仍只回放批准的铝罐场景，不把服务端题库打包进浏览器。

五页基本结构、SDG 13／13.3 与原 palette 保留。新增 practice 沿用浅底、绿色标题和实物桶，未重做批准五页。小屏底部正文需要滚动；固定 CTA 独立于正文。浏览器鼠标 drag 尝试未产生可确认提交，**不能宣称拖拽验收通过**；tap 与纠错已验证，原生拖拽列入 P5 必查。

尚未验证：Home／Profile 原生入口位置与热点遮挡、Home GL 暂停／恢复性能、Android 系统返回、iOS 边缘返回、后台及杀进程后的实际页面恢复、native VideoView 与嵌套 Modal、分类拖拽、TalkBack／VoiceOver、1.3／1.6 字体、系统 Reduce Motion。当前 PATH 未发现 adb，原生控制界面不可用；不将 Web／HTTP 证据替代这些检查。

## 开发运行与后续交接

- UI 预览：`npm run learning:preview -- --web --port 8083`。明确 fixture，不连接本人学习记录。
- 实际开发 Express：`npm --prefix server run dev:learning`，再用正常 Expo App 打开 Home／Profile。先核对 Expo 的 EXPO_PUBLIC_API_URL 指向此开发 Express，且手机能访问。命令在非 production 且指定开发 Supabase hostname 下显式设置两项草稿开关；不改 .env。若已有 server 占用端口，先停该开发 server。
- 普通 `npm run server` 默认仍只接受 published；v1 draft／independentReview.pending 时审核提示是预期行为。Web 正常设备身份原本不支持，未为本功能绕过 SecureStore／鉴权。
- 自动测试：`npm run learning:test`；实际开发 HTTP：`npm --prefix server run verify:learning-gateway`。

下一步 P5：先在 Android／iOS 以实际 API 验收入口、视频、tap／drag、断网／后台／重开与五页截图，再做字体／读屏／Reduce Motion 和库存／成就回归；同时完成真正的独立内容审核。通过后生成新的发布 reference migration，开发验证相同文件，再按用户授权执行生产步骤。P4 未改 schema／SQL／题库／review.json，开发仍 49 migrations，生产未访问或发布。
