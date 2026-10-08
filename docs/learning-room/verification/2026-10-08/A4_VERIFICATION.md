# A4 整体验收与发布准备

2026-10-08，Gress-development。三步已开发，按证据区分自动验证、真实模型与待验门槛。

| 检查 | 结果 |
| --- | --- |
| 全项目TypeScript | PASS，包含已有冰箱快速使用代码 |
| server学堂22＋导师10 | PASS，32项 |
| client导航14＋gateway16 | PASS，30项 |
| 导师真实Express/Supabase | PASS，61次请求/7次模型spy，两实例/恢复/考试/提示/清除 |
| 原学堂真实gateway | PASS，123 HTTP/4次丢失模拟、完整路径、空库存、隔离 |
| 原assistant scope | PASS，blocked7/allowed4/contextual |
| 原assistant history临时开发服务 | PASS，history-list/turn-restore/feedback-restore/action-link/legacy-action-fallback/device-isolation |
| 导师SQL回滚 | PASS，统计/分离/去重/冷却/配额/保留期/角色权限/原manifest恢复/draft及withdrawn gate |
| 开发SQL lint/migrations | PASS，无schema errors，56份本地/开发一致 |
| Android Hermes | PASS，2053模块、59素材、13MB hbc |
| iOS Hermes | PASS，2047模块、59素材、13MB hbc |
| server node-file-trace | PASS，500文件、导师server模块包含，无前端TS/assets/offline导师manifest；33项现有可选native依赖警告，见TUTOR_SERVER_TRACE.json |

首次沙盒Hermes导出因临时hbc写权限失败，允许本地编译器后成功，未用no-bytecode替代。产物在`.codex-build/learning-tutor/android`与`ios`，不提交大文件。Expo加载production公共API地址仅打包，未发生产业务请求/部署。SQL修复均新增migration，旧文件不变。

## 真实模型评估

用户明确授权60条固定提示及公开格式草稿证据外发到现有OpenAI；无learner、设备凭证、库存、完整bank或未答正式答案。

最终 [TUTOR_MODEL_EVALUATION.json](TUTOR_MODEL_EVALUATION.json)：gpt-5.6-luna、learning-tutor-p3、v2/hash 495079bb614ff51269ae2d183360efe2deb48e0da1ac2ac9a0bc9a76034035ae。60/60结构检查、48供应商调用、12本地越界拒绝、0错误；p50 2901ms/p95 9260ms，本次满足p95<15秒；输入85210/输出7508 tokens。真实账单成本待核对。

保留早期报告：V1 57/60，缺再利用正文及引用错误；P2 56/60、P3早期55/60，因超过6条引用被拒。修复v2公开正文、来源enum/maxItems:6、仅传来源元数据、正文URL拒绝。最终没有放宽校验获取PASS。P3早期文件对应maxItems前诊断构建，不用于放行。

补充正文依据（2026-10-08读取）：[维州Reuse and repair](https://www.environment.vic.gov.au/household-waste-recycling/reduce-waste/reuse-repair)、[Avoid single-use items](https://www.environment.vic.gov.au/household-waste-recycling/reduce-waste/avoid-single-use-items)。双语改写仍为待独立审核开发草稿。

结构/枚举/拒绝检查不代表事实准确率。全部60条humanFactReview、原课程及12模板独立审核仍pending，releaseApproved:false。独立审核需核验年份/地区、8–10%指food loss AND waste、use-by、SDG13.3及引用；达到≥95%且修复关键错误后才能发布。

## 发布门槛与下一项

- 无adb/已连接真机证据；Android/iOS键盘、安全区、底栏、Library横滚、边缘返回、视频、前后台/杀进程/断网、焦点/读屏、1.3/1.6字体待真机。HTML及bundle不能替代。
- 原学堂P5与独立审核继续pending。课程v1/导师v1/v2均draft。生产只读核对最新20260914010000，缺原学堂及导师依赖，未改schema/发布/服务/App。
- 下一项：真机＋独立审核记录审核人/时间/批准hash；核对生产依赖后schema→manifest→Express→App发布，三开关小范围启用。回退关闭开关/应用版本、保留数据，数据库修正新增migration。
- 供应商实际故障/限流、生产跨实例及cron运行待发布前验证。本轮无虚构设备或独立审核证据。

开发cron只读核对：learning-tutor-retention，17 3 * * *（03:17 UTC），active:true；登记可用不代表已观察实际执行历史。
