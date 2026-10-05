# Learning Room — v2 逐页视觉与交互规格

更新时间：2026-10-05。用户已经认可本版，后续开发的目标是还原，不重新选择审美方向。

配套：[实施计划](IMPLEMENTATION_PLAN.md)、[实际状态](IMPLEMENTATION_STATUS.md)、[内容计划](CONTENT_PLAN.md)。

## 1. 唯一批准的五张参考图

| 编号 | 参考图片 | 验收情景 |
| --- | --- | --- |
| 01 | [学习室首页](../art-direction/learning-room/2026-10-05-app-palette-v2/01-learning-room.png) | Beginner，1/3，下一课为 Lesson 2 |
| 02 | [课程详情](../art-direction/learning-room/2026-10-05-app-palette-v2/02-course-detail.png) | 三个课程活动，第一课已完成 |
| 03 | [Quiz](../art-direction/learning-room/2026-10-05-app-palette-v2/03-quiz-question.png) | 第 2/6 题，Recycling 已选，未提交 |
| 04 | [通关与进阶](../art-direction/learning-room/2026-10-05-app-palette-v2/04-quiz-progression.png) | 5/6，83%，Intermediate 解锁 |
| 05 | [气候阅读页](../art-direction/learning-room/2026-10-05-app-palette-v2/05-reading-sdg.png) | UNFCCC 8–10% 数据，SDG 13.3 |

不要使用 `2026-10-05-apple-concept` 的旧图做最终实现基准。不要用未修复的通关中间图；当前 04 图片已经修正课程名为 Waste basics 与 Packaging & recycling。

## 2. 全局设计约束

### 2.1 配色

| Token 建议名 | 固定值 | 使用范围 |
| --- | --- | --- |
| background | `#F7FBFA` | 所有学习室页面 |
| surface | `#FFFFFF` | 普通选项、列表、内容表面 |
| textPrimary | `#173D31` | 标题、正文重点、题干、分数 |
| textSecondary | `#70827A` | 副标题、时间、来源等 |
| border | `#DDECE6` | 细分隔线和普通边框 |
| learningGreen | `#2A8A61` | segment 选中、已完成、radio 和进度 |
| mintSurface | `#EAF6F1` | 图标底、已选选项、轻量提示 |
| mintStrong | `#E0F3EA` | 进度标记、复习提示 |
| actionOrange | `#F58220` | 唯一主 CTA，与冰箱操作一致 |
| skySurface | `#EAF7FD` | 首页 continuation hero、完成徽章底、SDG 教学块 |
| skyText | `#24566E` | 必要的浅蓝块辅助说明 |

实际 App tokens 固定取上述 hex，不从位图抗锯齿／生成渐变像素反推。橙色是操作色，绿色是状态色；未通过错误信息沿用 App 已有红色语义，不能把错误变成绿色完成。

### 2.2 字体、尺寸和布局

尺寸为逻辑 dp/pt，作为首轮实现的具体默认值；以真实原生截图对照微调。不是把 1024×1536 位图坐标直接当屏幕尺寸。

| 项目 | 初始规格 |
| --- | --- |
| 排版 | 系统 sans，iOS 系统字体、Android 系统 sans；字重清晰，禁用另加衬线／手写字体 |
| 页面横向 gutter | 24；窄屏最低 18，不叠加多层外边距 |
| 页面主标题 | 32–34／lineHeight 38–41，weight 800 |
| 章节标题 | 21–23／28，weight 800 |
| 题干 | 27–29／34–36，weight 800 |
| 正文／选项 | 16–17／23–25，weight 500–600 |
| 副标题 | 15／21，weight 500 |
| 辅助说明／来源 | 12–13／18–20，避免低于 12 |
| 大分数／数据 | 52–58，weight 800；小屏允许主动断行或调整，不缩正文 |
| eyebrow | 11–12，weight 700，轻字距 |
| 主按钮 | 高度至少 52，文字 17–18／bold，圆角 16–18 |
| 选项 | 高度至少 56，横向 padding 16，纵向 14，圆角 14 |
| 主要卡片 | radius 16–18；不做极大圆角或多层盒子 |
| 微图标底 | 34–42 见屏幕用途；一致 stroke／fill，不混多种风格 |
| spacing scale | 4、8、12、16、18、24、32、40 |
| safe area | 使用 safe-area-context；顶栏和底部 CTA 在安全区内 |

按钮可采用参考图中的柔和橙色质感，但真实代码优先纯色，禁止高饱和重渐变。纯色按钮仍需达到真实可读性要求；若字体对比度需要微调，在现有橙色体系内处理并记录。

P0 实测可读性修正：批准原色在 learningColors 中保留。白字主按钮的填充使用同色系 `#BE570A`（白字对比度 4.61:1）；小字号次要文字使用 `#64756D`（背景上 4.67:1）；绿色小字链接使用 `#237B55`（背景上 4.99:1）。原橙 `#F58220` 可用于装饰与无白色小字的品牌强调；原灰绿 `#70827A` 不用于小字正文。原生 P2 对照时核对这些已登记差异，不自行换色系。

参考图带 iPhone 框、9:41 和 Dynamic Island；它们属于展示 mockup，不要画进真实 App。真实页面采用操作系统状态栏和 Safe Area。平台可以有原生差异，内容布局与层级必须一致。

页面内容用 ScrollView；必要的底部 CTA 在独立安全区 action bar，不盖住末尾内容。常规屏幕努力保留参考图的首屏节奏；小屏、大字体时允许滚动。不要靠 fontScale 禁用或整体缩小换取一屏塞下。

### 2.3 图像与动效

图片是批准设计的重要组成部分：保留食品／包装静物、自然光和浅色厨房背景。不能替换成通用环保地球图、卡通垃圾堆或 Emoji。

不要把五张整屏图当背景，再叠几个可点击区域；文字、选项、目录、按钮和状态全部使用真实 RN 组件。独立图片资产只有静物、封面、铝罐、完成徽章等视觉部分。

P0 已制作正式独立 App 资产，见 `assets/learning-room/SOURCE.md`。使用内置 image_gen，以批准图为参考生成独立资产并核对构图。中英 SDG 13 图标已从官方获取，保持官方原色／比例，阅读来源区显示声明与 UN 链接；不要手绘 SDG 12 的无限符号替代气候图标。

动效使用 150–240ms 的小幅淡入、按压反馈和选中切换；不加大段弹跳／漫天彩纸／发光轨迹。Reduce Motion 时保留静态状态和完整可操作性。

## 3. 图 01：学习室首页 Learn

从上到下的结构不能重排：

1. 顶栏左侧返回来源，Home 入口显示 Home；右侧小 KitchMemo 品牌标识。
2. 大标题 Learning Room；副标题 Small lessons. Less waste.
3. 横向三个 segment：Learn／My path／Library，Learn 默认绿色选中。
4. 一张浅蓝课程 continuation hero：左侧内容、右侧食品包装静物。
5. Your next steps 与三条扁平课程活动。
6. Food waste & SDG 13 延伸阅读入口，浅薄荷底、绿色 13 badge 和植物点缀。

hero 文案：CONTINUE LEARNING、Waste basics、Lesson 2 of 3 · 4 min、进度 1/3、橙色 Continue lesson。真实数据决定标题、课序和进度；未开始显示 Start learning，全部学完指向 checkpoint，已有 active attempt 指向 Continue quiz。

静物包含棕色纸盒、银色铝罐、番茄和叶片；右侧 image 不侵占按钮或盖字。hero 初始高度约 185–210，内部 padding 18。窄屏可缩静物但保留这一左右结构。

三条活动依次为 Why food gets wasted（Animation · 1 min）、Know your materials（Short lesson · 4 min）、Practise with Bin Action（Hands-on · 2 min）。每条有左图标、中标题／时间、右 chevron；第一条完成才显示绿色 check。

行为：segment 只切 hub 内区域；Continue 根据 server resumeTarget 打开对应 route；活动行到课程活动；SDG teaser 到图 05 文章。Profile 打开时顶栏返回 Profile，不能错误返回 Home。

空／失败状态：首次加载保留标题和合理 skeleton；读取 state 失败显示重试，不自动展示 1/3。已缓存 catalog 可显示，但不得伪造本人解锁。

## 4. 图 02：课程详情

顺序：返回 Learning Room → Waste basics → Beginner · 3 lessons → 一句话课程目标 → 宽幅厨房静物封面 → 浅薄荷学习目标条 → Course outline 三步 → Beginner checkpoint → related reading → 底部橙色 Continue lesson 2。

封面中有蔬菜、水果、罐、玻璃容器、饮品和蛋盒；高约 145–175，宽占可用内容区，圆角 16。学习目标条不是一个新统计卡片：仅简洁图标和一句 By the end, you can identify waste materials.

课程目录用细竖线连接 01、02、03：已完成绿色 check，当前步骤绿色实心点＋浅 mint halo，未完成空圈。标题不折成三四行；中文长文案允许两行和更高 row。

checkpoint 行保留 v2 图中的小 SDG 13 标识，文字 Beginner checkpoint／6 questions · Pass with 80%，右 chevron。它指向实际正式测验，不能直接写通过。相关阅读：Related reading: food waste & climate action。

底部主 CTA 随真实活动改变；能自由阅读当前未解锁课程知识，但锁定 checkpoint 必须显示原因。统一在这里保留课程信息，不能把 checkpoint 入口隐藏在另一套 dashboard。

## 5. 图 03：Quiz 答题

顺序：返回 Learning Room／关闭 → 细绿色进度条 → Beginner checkpoint 与 2 of 6 → Practice guide · Victoria, Australia → 大题干 → 居中银色铝罐 → 三个 radio 选项 → council 提醒 → 橙色 Check answer → No time limit。

标准题干：Where should an empty aluminium can go? 三选项 Recycling、Food organics、General waste。截图情景选中 Recycling，但未提交；因此没有正确 check、解释或加分状态。

radio 为明确单选，整行可点。已选为浅 mint、绿色边框、填充绿色圆点；未选为白底浅边。材质图区域约 135–160 平方，不要放巨型垃圾桶替换铝罐。

进度条按页面序号 2/6 显示，服务端答案进度另行保存；界面不得为了进度视觉伪造已答题数。选项提交后不允许在正式模式改答。

反馈状态继续用同一屏幕：题干与所选项不跳走，补充正确答案、解释与源链接，底部操作改为 Next question／See results。错误用文字＋图标＋语义色共同表示。未通过 checkpoint 不降级。

网络失败保留题目和已选项，原位置显示重试。顶部返回默认保存已提交答案，关闭后回学习室；显式 Restart 才重新创建题序。

## 6. 图 04：通过与进阶

顺序：返回 Learning Room → 小植物 check 完成徽章（浅蓝圆底）→ Beginner complete → You passed your checkpoint. → 5 / 6 → 83% · Pass mark 80% → Review your 1 missed question → Your learning path → 三阶段竖向路径 → 下次继续提示 → 橙色 Start Intermediate → Review Beginner。

完成徽章不是共享冰箱奖章：不用现有 first-rescue medal 当成 Quiz 奖励，不新增 XP 字样。徽章视觉尺寸约 110–125，保留植物、浅蓝与绿色 check。

固定三阶段名称与副标题：

- Beginner：Waste basics · Completed。
- Intermediate：Packaging & recycling · Unlocked。
- Advanced：Preventing waste · Pass Intermediate to unlock。

已完成绿色 check、当前解锁绿色圆环、锁定灰色 lock，线条细而轻。不要替换为地图、山峰游戏关卡或大型 badge 墙。

结果和路径来自 finish 响应／GET state，不能仅用客户端选择情况决定。重新打开已经提交的 attempt 必须仍显示同一结果。

变体：中级通过后突出 Advanced；高级通过后显示完整三节点与 Mixed review；未通过页沿用结构，减少完成徽章，显示 Review missed questions／Try again，不把锁定阶段变解锁。

## 7. 图 05：Waste & climate 阅读页

顺序：返回 Learning Room → WASTE & CLIMATE → Less waste. More climate action. → 食物纸袋照片 → 8–10% → 排放口径 → UNFCCC · 30 Sep 2024 链接 → 简短解释 → 浅蓝 SDG 13.3 教学块 → 浅薄荷 One action this week → 橙色 Mark as read → Explore waste & climate news。

排放口径使用 approved 文案：of global greenhouse gas emissions are linked to food loss and waste. 内容模型另外保留 annual、global、food loss and waste 三个范围，来源全文可展开核对；不要改成 household waste 或个人减排。

解释：Producing food uses energy. Wasting it wastes those resources too.

SDG 块：绿色 13 Climate Action badge；SDG 13.3；Learn. Understand. Take action.；Climate education and awareness. 别加入 12.3／12.5 或把全球数据与 Quiz 得分并排形成收益暗示。

反思：One action this week／Plan one meal using what you already have. 反思动作是学习建议，不是自动完成库存任务。

正文自然滚动，Mark as read 为明确完成动作；网络确认后显示已读状态。新闻入口到本地精选 Library News，不自动把用户送往不受控信息流。来源箭头可以打开系统浏览器，失败有可重试提示。

## 8. 未单独出图的页面

| 页面 | 约束 |
| --- | --- |
| My path | 复用图 04 路径、阶段标识和课程名称，列表化本人最近结果；无大型山峰或排行榜 |
| Library | 复用图 01 segment 和扁平条目；按主题＋Guides／Data／News，缩略图比例一致，最多一条重点推荐 |
| Lesson | 复用图 05 的标题／内容块／反思；动画与练习入口在对应活动内 |
| Missed question review | 复用图 03 的题目／选项显示；明确标记已提交答案和正确答案，无重复考试评分 |
| Practice | Bin Action 原有桶与拖拽互动放入学习容器，周边 chrome 统一；不展示库存丢弃和真实投放确认 |
| Loading／error | 保留页面信息架构，固定主区域 skeleton／重试；禁止一张深色全屏错误页改变色系 |

## 9. 独立资产制作清单

目录 `assets/learning-room/` 已建立，下表全部资产已完成；资产 key／源文件映射见 learningAssets.ts，具体格式／hash 见 ASSET_MANIFEST.json：

| asset key／文件 | 用途 | 制作要求 |
| --- | --- | --- |
| waste-basics-still-life | 图 01 hero | 纸盒、铝罐、番茄、叶；透明或与浅蓝正确融合，禁止附文字 |
| waste-basics-course-cover | 图 02 封面 | 保留厨房食品／包装静物构图，无 UI 框 |
| empty-aluminium-can | 图 03 题目 | 银色无品牌空铝罐，透明或干净底；不得与 AI 产品图猜材质 |
| learning-complete-seal | 图 04 | 植物＋check；透明主体或浅蓝圆底；和共享成就区分 |
| waste-climate-cover | 图 05 | 食物纸袋与蔬菜，浅色厨房台面 |
| sdg-13-climate-action | SDG 块 | 优先官方图标，记录来源和许可／使用指引 |
| course topic thumbnails | 中／高级、Library | 同一自然光和色温，尺寸／比例一致 |

另复用 `assets/waste-bins/` 原静态开／闭桶图和现有动画资产。将所有运行时用的最终素材复制进项目，不能依赖 `.codex/generated_images` 的机器本地路径。

## 10. 视觉验收的记录方式

五个标准情景各保留英文原生截图，与对应批准图做并排对照，记录实际 device／viewport／font scale／平台。对照页面区域而不是外部手机壳。每页记录：布局顺序、主要块占比、标题字号、色值、图片构图、按钮位置、safe area、动态状态。

验收记录可用 PASS／差异＋待修复项。标题重排、主要图片被替换、按钮主色改变、缺少一整个模块、出现假进度均不算通过。小屏需要滚动、字体无障碍放大、Android 系统栏差异可以接受，必须记录原因。

后续对话不要用「颜色差不多」「已经有卡片了」当作严格还原的证据。通过类型检查也不代表通过视觉验收。

### P2 对照进度

五页 RN 实现、浏览器五情景与中文窄屏图已保存：[P2_VERIFICATION.md](verification/2026-10-05/P2_VERIFICATION.md)。这是 Web 证据，原生设备对照仍 pending。实际模块顺序保留；当前 390×844 Web 下课程 checkpoint／相关阅读、结果续学提示、阅读 SDG／反思后半段需要滚动，固定 CTA 在正文外。不得为强行一屏展示而截断正文或关闭字体缩放。

继续沿用 P0 的品牌色与已登记的可读变体，不重新选择配色；原生平台字体、图片主体位置、状态栏、安全区和无障碍仍需逐项核对，不宣称像素级一致。
