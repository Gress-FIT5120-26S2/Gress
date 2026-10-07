# 学堂 AI 导师实际进度

更新：2026-10-08（Australia/Sydney）。**A0 完成；A1 随堂问答、A2 测验辅导、A3 主动帮助已实现并通过开发验证；A4 自动验收及真实模型评估完成，真机、独立审核和生产发布仍 pending。**

## 阶段状态

| 阶段 | 已完成 | 待验证／下一项 |
| --- | --- | --- |
| A0 契约与基线 | 完整阅读、版本文档、Git／环境、12 topic、面板增量规格 | [A0记录](verification/2026-10-08/A0_VERIFICATION.md)；已进入A1 |
| A1 随堂问答 | learner会话、公开检索、双语模型、引用／导航、历史／清除／评价、恢复／幂等 | [A1记录](verification/2026-10-08/A1_VERIFICATION.md)；原生键盘／焦点／后台待真机 |
| A2 测验辅导 | 全active checkpoint限制、本人已答固定讲解、3级提示、12独立模板、正式复习推荐 | [A2记录](verification/2026-10-08/A2_VERIFICATION.md)；独立模板审核待完成 |
| A3 主动帮助 | 正式／练习信号分开、静态提示、原子限频、偏好／冷却、默认关闭停留实验 | [A3记录](verification/2026-10-08/A3_VERIFICATION.md)；90秒及读屏／视频排除待真机 |
| A4 验收／发布 | 类型、32项server及30项client测试、61次导师API、123次原gateway HTTP、SQL／lint、双平台Hermes、60条真实评估、后端追踪 | [A4记录](verification/2026-10-08/A4_VERIFICATION.md)；真机、独立事实审核／内容发布、生产依赖及部署待完成 |

## 实际实现与边界

- 新客户端类型/API/双语文案及 `src/components/learning/tutor/` 接入原 LearningRoomFlow／LearningUi，保留学堂Tab、布局、learningTheme及SDG13／13.3。未改冰箱／成就配色。
- 新 `/api/learning/tutor` 与 evidence/model/service/input，复用现有 Responses transport 和 assistant共享限流预算。模型无工具，客户端不传learner、分数、答案或导航目标。
- 原正式首答／评分／80%解锁仍由原learning RPC决定。任一active checkpoint期间暂停自由聊天；已答题只允许explain/simplify/example，无任意message；未答正式题无入口；退出页面不abandon。
- 六表归属learner，复合外键保护个人消息/请求；恢复在临时learner删除前合并，原偏好优先、旧pending失效、冲突键保留namespace。共享join/leave不合并导师身份。
- 正文30天；清除立即删除正文/缓存，保留无正文tombstone阻止迟到保存；请求/干预90天清理。daily cron已登记，实际运行历史仍需观察。

详细契约见 [AI_TUTOR_API_CONTRACT.md](AI_TUTOR_API_CONTRACT.md)，后端上下文已追加实际导师数据契约。

## 数据库、教材与环境

新增并提交七条migration：`20261008010000` foundation、`11000` draft v1、`12000` review/help、`13000` support修复、`14000` evidence v2、`15000` versioned context/practice signals、`16000` credential alias修复。全部先在开发库预演并已应用；最终56份本地/开发migration一致，SQL lint无错误。未重写任何已应用migration。

开发Gress-development／`thmbtsssvnslotoexntz`；`npm start`／`npm run server`默认启用三导师开关，保留显式0。普通/生产启动仍关闭，内容必须published。生产`vcsujjaapchvcnndlhqb`本轮只读核对最新仍为`20260914010000`，缺后续学习依赖，未执行生产变更。

课程learning-room-v1仍draft，hash `0736124795fd1dbc5e5b82521f919162ea82692c27a3f127b850410ce31f6054`。导师v1为62块、v2为63块；12双语独立模板仍pending。v2补足登记官方来源的再利用公开说明，hash `495079bb614ff51269ae2d183360efe2deb48e0da1ac2ac9a0bc9a76034035ae`；历史会话继续绑定原manifest。

## 真实模型结果

用户明确授权本次60条固定评估。最终gpt-5.6-luna／learning-tutor-p3／v2：60/60结构与引用检查通过、48次供应商调用及12次本地拒绝、0错误；p50 2901ms、p95 9260ms；输入85210/输出7508 tokens。早期失败及修复保留，见 [模型报告](verification/2026-10-08/TUTOR_MODEL_EVALUATION.json)。这**不代表95%教学事实正确率或独立审核通过**。

## Pending与下一项

1. Android/iOS真机：键盘、安全区、底栏、Library横滚、边缘返回、视频、后台/杀进程/断网恢复、焦点/读屏、1.3/1.6字体。当前没有adb/连接设备证据；导出和HTML画布不能替代真机验收。
2. 独立人员审核原课程、12模板和60条模型回答，核验来源、地区、统计年份、食品安全及SDG13.3；作者不能自行批准。事实/引用目标≥95%，关键错误全部修复。
3. 原学堂P5及独立审核仍pending。生产先补并验证原学习依赖，再按schema→manifest→Express→App小范围启用；当前未部署。
4. 生产真实限流/故障、跨实例、cron运行及账单成本仍需发布前观察；本轮记录tokens/延迟，不伪报货币成本。

## 工作区保护

本轮开始已有FridgeScreen、FridgeFoodCard、快速使用组件/工具/测试、docs/fridge、i18n、BACKEND_DATA_CONTEXT及旧交接修改，未撤销。i18n只增加导师文案入口，后端上下文只追加导师章节；原有修改不顺带纳入导师提交。
