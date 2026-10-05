# P2 页面实现与验证记录

日期：2026-10-05，Windows／Expo SDK 57／React Native 0.86.3。

**状态：五页原生组件、局部导航与开发预览已实现；类型检查、离线测试、浏览器交互与 Android bundle 导出通过。原生设备截图／手势／读屏验收仍待完成，不能把本记录当作 P2 原生视觉验收完成。** 没有修改数据库、Express 路由、App.tsx、Home／Profile 正式入口或部署生产。

## 实际产物

| 文件 | 职责 |
| --- | --- |
| `src/components/learning/LearningRoomFlow.tsx` | 注入 gateway、局部 route stack、加载／错误／重试、统一返回、首答反馈、课程／阅读操作 |
| `LearningHub.tsx` | Learn／My path／Library，继续学习、活动列表、主题／内容类型筛选 |
| `LearningCourseScreen.tsx` | 封面、学习目标、三活动目录、checkpoint 资格、相关阅读、固定 CTA |
| `LearningQuizScreen.tsx` | 待答／反馈／错题视图、来源与收集条件、选项冻结、无倒计时 |
| `LearningResultScreen.tsx` | 通过／未通过／高级完成／复习结果，沿用返回的等级状态 |
| `LearningResourceScreen.tsx` | 气候资料与通用资料阅读、SDG 13.3、反思、来源／日期／数据范围、UN 声明 |
| `LearningUi.tsx`、`learningViewport.ts` | 可复用 RN 控件、静态独立图片、安全区、滚动内容、当前容器宽度与字体缩放 |
| `learningNavigation.ts` | 纯导航 reducer；不能累计分数或解锁阶段 |
| `src/types/learningRoom.ts` | 页面视图与注入服务契约；真实 HTTP 映射留待 P3/P4 |
| `src/i18n/learning.ts` | 中英界面文案，挂到现有 i18n |
| `dev/` | 公开草稿快照、内存适配器、11 个明确标注的开发情景 |
| `server/scripts/export-learning-preview.js` | 从显式公开投影生成草稿快照；先验证 manifest hash |
| `scripts/start-learning-preview.mjs` | 给独立 Metro 子进程设置开发标志，不启动 Express、不修改 .env |
| `scripts/test-learning-room.mjs` | 8 项导航历史／首答／重试／复习隔离测试 |

`src/types/learningContent.ts` 的 `dateNote` 修正为 `string | null`，匹配 P1 实际公开数据。P1 内容 hash 没有变化：`0736124795fd1dbc5e5b82521f919162ea82692c27a3f127b850410ce31f6054`。独立内容审核仍 pending。

## 运行预览

```powershell
node server/scripts/export-learning-preview.js
npm run learning:preview -- --web --port 8083
```

打开 `http://localhost:8083/?screen=hub`；画布外的 Preview menu 切换情景，EN／中文切换语言。可以把 `screen` 改为 `course`、`quiz`、`result`、`resource`、`new-user`、`failed`、`complete`、`loading`、`error`、`answer-error`。`origin=profile` 验证副入口返回文案；`width=320&height=667` 验证窄屏。

原生预览：`npm run learning:preview`，用兼容 SDK 57 的设备／开发客户端连接该 Metro，再通过菜单选择情景。不要使用只在 Web 读取的 query 参数作为原生深链功能。

开发适配器只有一题公开批准的铝罐情景，提交后展示固定反馈，并跳转到最后一题以覆盖布局状态。5/6、7/8、8/10 是固定响应，没有真实抽题／累计分数／保存／升级。复习与混合复习返回原等级；未通过情景不能解锁；重开情景清空内存。此代码不能替代 P3 考试服务。

`LearningRoomFlow` 必须传入 gateway，没有 fixture 默认回退。`index.ts` 只有 `__DEV__ && EXPO_PUBLIC_LEARNING_PREVIEW === '1'` 才进入预览，正常 App 保持原入口。预览语言不读取或写入正常 App 的 AsyncStorage 偏好；学习预览不启动设备身份或库存服务。

## 检查结果

| 检查 | 结果 |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node scripts/test-learning-room.mjs` | PASS，8 项；返回原资料库 segment、替换答案不增加历史、新闻重置栈、0/3、锁定、首答冻结、错误重试、失败／复习不解锁、已读幂等 |
| `node --test server/test/learningContent.test.js server/test/wasteQuestionCatalog.test.js` | PASS，14 项内容＋8 项既有分类 |
| `node server/scripts/export-learning-preview.js` | PASS，公开投影及 manifest hash 一致 |
| Android 开发 bundle 导出 | PASS，2,188 modules；`.codex-build/learning-room-p2/android-preview` |
| 正常 Android 生产模式 bundle 导出 | PASS，2,017 modules；`.codex-build/learning-room-p2/android-release-check` |
| 正常 bundle 隔离 | 未包含 `preview-can-question`、`ui-preview-attempt`、`learning-room-v1`；49 个资产，无 learning-room 预览图片 |
| 浏览器运行时 | 没有 error 日志；Expo 开发工具提示不视为 App 错误 |

Android 导出命令使用 `--no-bytecode` 以检查 JS 模块内容，**不是 APK、设备启动或正式 release build**。开发导出额外设置 `$env:EXPO_PUBLIC_LEARNING_PREVIEW='1'` 并使用 `--dev`；正式模式不设置该标志。两个命令均为 `node node_modules/expo/bin/cli export --platform android --no-bytecode --max-workers 2 --output-dir <上述目录>`，开发命令加 `--dev`。生成目录已忽略，不提交 bundle。

## 实际浏览器交互

在 Codex IAB 以 React Native Web 渲染，以下操作已执行并观察结果：

- 首页打开课程／继续第二课，完成后目录变为 Completed；中英切换保持当前课程与内存完成状态。
- 已选 Recycling；换选 General waste 提交后显示错误反馈、正确选项与来源，三个选项全部冻结。下一题返回无选择，固定结算返回 5/6 与 Intermediate unlocked。
- 结果打开错题，首答冻结；返回保留原结果；Start Intermediate 打开中级课程且 checkpoint 可用。
- `answer-error` 首次检查失败后保留所选答案，重试显示反馈并冻结。
- `error` 重试到首页；`loading` 保持加载状态，返回可退出到预览菜单，没有展示假进度。
- `new-user` 为 0/3、Start learning，Profile origin 显示 Profile；`failed` 为 4/6、中级锁定；`complete` 为 8/10、三级均完成、提供混合复习。
- 阅读展开完整数据范围与 UN 声明；Mark as read 后 Read 按钮禁用；Explore news 打开资料库并自动选择 News，显示三篇有日期与教学关联说明的文章。
- 中文 320×667：内容可滚动，底部 CTA 在正文外；三个选项均宽 284、高 56，画布 scrollWidth 为 320，没有横向溢出。
- Web 的 radio、tab、progressbar 使用显式 ARIA，避免当前 react-native-web 对旧 accessibilityState 映射缺失；原生仍提供 RN accessibilityState。

## 图像证据与仍待对照的差异

截图目录：[p2-web](p2-web/SCREENSHOT_MANIFEST.json)。五页概览：[five-screen-preview.jpg](p2-web/five-screen-preview.jpg)。保存原始 430×960 浏览器截图，以及裁去预览工具栏后的页面截图；manifest 登记裁图 hash。标准内容画布 390×844，模拟 top 44／bottom 24 inset，默认浏览器字体，**没有模拟手机状态栏／边框，也没有伪装成真机截图**。

| 批准页 | 实际截图 | 对照与差异 |
| --- | --- | --- |
| 01 学习室 | [首页](p2-web/01-hub.jpg) | 标题、三段导航、浅蓝继续学习、1/3、三行活动、SDG 13 入口按批准顺序；图片与文字不重叠 |
| 02 课程 | [首屏](p2-web/02-course.jpg)、[下半页](p2-web/02-course-scrolled.jpg) | 封面、目标、三活动、SDG checkpoint、阅读、固定 CTA 均保留；当前标准 Web 字体下需滚动才能看到 checkpoint／相关阅读 |
| 03 Quiz | [题目](p2-web/03-quiz.jpg) | 2/6、地区、铝罐、三选项、已选状态与固定 CTA；完整服务假设在正文下方保留 |
| 04 结果 | [首屏](p2-web/04-result.jpg)、[下半页](p2-web/04-result-scrolled.jpg) | 徽章、5/6、83%、错题链接、三级路径与 CTA；明确锁定说明／下次继续提示需要滚动 |
| 05 阅读 | [首屏](p2-web/05-resource.jpg)、[范围与 SDG](p2-web/05-resource-scrolled.jpg) | 气候封面、8–10%、日期、SDG 13.3、反思及来源声明；后半段需滚动，CTA 保持可见 |

与批准生成图的字形、照片主体位置和文字换行仍有平台差异，不能宣称像素级一致。沿用 P0 已登记的可读色变体：白字按钮 `#BE570A`、小字号辅助 `#64756D`、绿色链接 `#237B55`；品牌原色仍在 tokens，SDG 图标使用官方原色。320 宽或放大字体时首页隐藏非信息性静物图，保留完整文字，避免图文挤压。原生动效为 200ms opacity，Reduce Motion 时静态；Web 为静态以避免截图落在过渡中。

课程下半页截图是在操作「完成第二课」后保留的状态，因此目录显示前两课 Completed；标准首屏仍为仅第一课完成。Quiz 最终截图已在图片与图标字体加载完成后重新保存，避免将加载中的空图误当最终布局。

**待补：** Android 实际设备／模拟器五页截图，iOS 字形和返回手势，系统返回、VoiceOver／TalkBack、动态字体 1.3／1.6、Reduce Motion、安全区与键盘／后台恢复。当前工具无原生应用控制，环境未找到可用 Android SDK／设备，因此没有这些证据。

## 下次继续

先补 P2 可用设备上的视觉／无障碍验收；若暂无设备，可以独立推进 **P3 开发环境数据与服务**，但上述 P2 门槛继续保持 pending。P3 开始前完整读取后端上下文与 migrations，落实个人 learner、已发布内容／考试版本、服务端首答与事务结算、设备恢复迁移，写新 timestamped migration 并在开发库验证。P1 独立内容审核 pending，不能发布草稿或向生产开放入口。

P4 再接入真实 learningApi、Home／Profile、动画播放和独立 Bin Action practice。当前视频页只有课程摘要；practice 明确显示待集成，不伪造练习完成，也不会改变库存或共享 XP。

本轮未创建 Git 提交／migration／数据库连接／生产部署。
