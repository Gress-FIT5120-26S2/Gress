# 学堂 AI 导师：跨对话接手入口

更新：2026-10-08（Australia/Sydney）。**A0–A3已实现并开发验证；A4自动检查和60条真实模型评估完成，真机／独立审核／生产发布pending。** 先读实际状态，不从A0重做。

## 阅读顺序

1. 项目 AGENTS.md 和用户最新修订；查看 git status，保护他人的未提交工作。
2. [AI_TUTOR_STATUS.md](AI_TUTOR_STATUS.md)：确认实际进度和下一项。
3. [AI_TUTOR_PLAN.md](AI_TUTOR_PLAN.md)：完整读取三步体验、数据、接口、限制、任务与验收。
4. 原学堂 [HANDOFF.md](HANDOFF.md)、[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)、[VISUAL_SPEC.md](VISUAL_SPEC.md)、[API_CONTRACT.md](API_CONTRACT.md)、[CONTENT_CONTRACT.md](CONTENT_CONTRACT.md)、[CONTENT_REVIEW.md](CONTENT_REVIEW.md)。旧 P5 与独立审核仍待完成。
5. [NAVIGATION_UPDATE.md](verification/2026-10-06/NAVIGATION_UPDATE.md) 与 [GESTURE_ISOLATION.md](verification/2026-10-06/GESTURE_ISOLATION.md)：独立学堂主 Tab、真实触摸起点、横滚隔离。
6. 写代码前读取 [Expo SDK v57 精确文档](https://docs.expo.dev/versions/v57.0.0/)；使用具体模块再读版本化模块页。
7. 数据改动前完整读取 `docs/data-architecture/BACKEND_DATA_CONTEXT.md`，核对所有最新相关 migration、真实环境和 device→learner 恢复流程。

## 必须保留的决定

- 三步都在范围内：A1 随堂问答、A2 测验辅导、A3 主动帮助；A0 为准备，A4 为整体验收发布。
- 同一 Spoonie，教学与冰箱使用各自范围和私人数据；复用模型调用和展示组件，不把库存动作权限带入导师。
- SDG 13／13.3、原学堂主 Tab／学习路径／批准五页，以及冰箱／成就同系配色保留。
- 教学持久化归属 learner，不按共享 fridge 合并。不要扩改旧 assistant 会话复合外键。
- 当前 learner 恢复函数会合并并删除临时 learner；新表数据必须在删除前处理，用新 migration 扩展函数。
- 正式测验首答／评分／80% 解锁仍由原服务端事务决定。未答题不开放求解；active checkpoint 期间自由聊天暂停，已答题仅固定讲解意图，结束／明确 abandon 后恢复。
- 模型只能收到公开教学证据、本人已答反馈或允许的聚合统计，不能收到完整 private bank／future snapshot。现有 learningRoom `content()` 返回对象不宜整体传模型。
- 主动帮助先规则触发固定提示，接受后才生成。频率、关闭、地区、来源和版本都有服务端校验；停留提示默认关闭。
- 不自动实时抓新闻，不新增系统推送；额外练习使用独立审核模板，不计升级、库存、XP 或实际减排。
- 六表/API/组件已实现，七条新增migration已提交并仅应用Gress-development；历史会话绑定原manifest。最终60条真实评估结构/引用60/60、p95 9.26秒，事实准确率及独立模板审核仍pending。

## 可粘贴到新对话的提示词

> 继续KitchMemo学堂Spoonie导师的A4剩余验收。先完整读AGENTS、AI_TUTOR_HANDOFF/STATUS/PLAN及API_CONTRACT，核对Git和环境；A0–A3三步已实现，不重做计划。七条20261008010000至16000新增migration已提交并应用Gress-development；生产只读核对仍缺原学堂依赖，未发布。导师v2公开知识63块、12模板仍draft/pending，历史v1会话保留原manifest。61次导师真实API、123次原gateway、SQL/lint、双平台Hermes及60条真实评估结构检查通过，事实准确率未独立审核。下一项是Android/iOS真机及独立内容/模型审核，原P5继续pending；不得用bundle/HTML/spy代替。保留SDG13.3、布局配色、个人learner、服务端正式首答/评分/升级、全active checkpoint限制及未答题答案边界。主动提示静态规则、接受打开面板后发送才生成，停留默认关。新增schema行为必须新增migration、开发先验，不能覆盖已应用文件；不要重跑旧manifest生成覆盖版本。写代码前读Expo v57，数据前完整读后端上下文。保护现有未提交冰箱快速使用改动；每阶段同步状态和证据。

## 阶段结束报告

说明完成工作包、实际文件、迁移保存／应用环境、真实测试／模型／设备证据、审核与发布状态，以及下一项具体任务。计划完成、模拟结果、Web 预览和类型检查不能替代真实功能完成。
