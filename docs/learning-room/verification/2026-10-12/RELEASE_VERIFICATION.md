# 2026-10-12 发布记录

负责人 NarIyirm 明确表示已审阅并要求直接发布，跳过真机验收。后续明确指定 **iOS production、Android preview**。审核身份与范围见 [OWNER_RELEASE_APPROVAL.json](OWNER_RELEASE_APPROVAL.json)。真机为 waived，不记录为已测试；导师负责人复核不伪装成独立审核。

## 数据与教材

- 原生产缺少的 17 份迁移已补齐，详细历史基线见 `docs/data-architecture/verification/2026-10-12/PRODUCTION_MIGRATION_VERIFICATION.md`。
- 新增已提交 migration：`20261012050000_publish_owner_reviewed_learning.sql`。开发先应用并验证，再将 SHA-256 完全相同的文件应用生产：`0707b2e60a03421fb83488276a18b685aaf7536505937af6f39e6a1f1068065d`。两端现在各 57 份，最新 `20261012050000`；生产最终 dry-run 无 pending，开发／生产 lint 无错误或警告。未改旧 migration、未 reset／seed／repair。
- 课程 `learning-room-v1` 已 published，hash `0736124795fd1dbc5e5b82521f919162ea82692c27a3f127b850410ce31f6054`。3 课程、9 活动、9 资料、48 题、18 来源；原内容与答案未改，NarIyirm 的真实审核覆盖全部题目。
- 导师 `learning-tutor-v3` 已 published，hash `665f4a761224842cfadc6143f28e3f92f5374c02a04b8a48eee99159028d12a2`。公开证据、12 模板的题目／选项／答案／解释与 v2 完全一致，仅新增负责人复核记录。旧 v1/v2 不改写，旧会话保留版本绑定。
- v3 的发布例外仅允许本次精确版本／hash／授权；原作者和复核人均如实保留 NarIyirm，独立审核 pending。其他版本仍遵守独立审核规则。`release-guard-check.sql` 在开发和生产的回滚事务均通过：移除授权、复用例外版本、修改模板、退回 draft 均被拒绝。

## 验证

| 检查 | 结果 |
| --- | --- |
| 全项目 TypeScript | PASS |
| 客户端导航／gateway 回归 | 30/30 PASS |
| 服务端学习／导师单测 | 32/32 PASS |
| 原教材 release 只读校验 | PASS，hash 不变 |
| 真实开发导师 HTTP | 61 次请求 PASS，7 次模型 spy；两实例、幂等、考试隔离、恢复、清除竞态 |
| 真实开发学堂 HTTP | 298 次请求 PASS；6/8/10 题、80% 阈值、恢复、共享隔离、练习与库存／XP 隔离 |
| 两端 release guard | PASS，全部事务回滚 |
| 两端 SQL lint | PASS，无错误／警告 |
| 生产正式域名 health | HTTP 200，status ok，database connected |
| 原生真机验收 | waived-by-owner，未执行 |

首次导师 HTTP 重跑出现 Supabase `JWT issued at future` 临时错误，随后重跑通过。教材批准后原测试错误地假设真实教材永久 pending，已改为显式 pending fixture；真实 HTTP 校验按数据库发布状态验证普通服务的读取门槛，保留草稿拒绝测试。未放宽课程审核校验。

60 条旧真实模型评估保留不改写；负责人本次全局批准记录绑定该报告 SHA-256，没有伪造逐条事实分数或实测正确率。v3 不改教学证据和模型提示，因此不重复产生同一批模型费用。

## 生产 API

- 现有项目 `nariyirms-projects/kitchmemo-api`，Root Directory `server`，Express，Node 24，函数位于 syd1。
- 新部署 `dpl_2E6GG9MrAYhUfQ3WiQcL9y6rLg38`，构建 Ready；先验证连接，再 promote 正式域名。
- 正式 API：[https://kitchmemo-api.vercel.app](https://kitchmemo-api.vercel.app)。部署详情：[Vercel](https://vercel.com/nariyirms-projects/kitchmemo-api/2E6GG9MrAYhUfQ3WiQcL9y6rLg38)。
- 三个生产环境变量已持久配置为 1：`LEARNING_TUTOR_ENABLED`、`LEARNING_TUTOR_COACHING_ENABLED`、`LEARNING_TUTOR_PROACTIVE_ENABLED`。生产仍只读 published 教材，没有打开 draft override。
- `.vercelignore` 排除移动端／本地媒体工程、环境文件、审核资料与私有参考 JSON；部署输入从约 3.16 GB 降为 369,057 bytes，48 个条目。内容运行时从数据库读取。
- 原前一生产部署为 `kitchmemo-olg00q6g4-nariyirms-projects.vercel.app`。应用回退可 promote 原部署或关闭三开关后重新部署；已发布数据与旧会话不删除。数据库后续修正继续新建 migration。

## 安装包

| 平台 | 配置／版本 | 结果 |
| --- | --- | --- |
| iOS | production，1.0.0 build 11 | FINISHED；App Store 分发签名 |
| Android | preview，1.0.0 build 3 | FINISHED；可安装 APK |

- iOS：[构建详情](https://expo.dev/accounts/gress-fit5120-26s2/projects/kitchmemo/builds/80ab1dc6-2c38-49dd-bfa2-fc68becd4270)，[IPA](https://expo.dev/artifacts/eas/q4EWFBtx88E5PLfj1evvf0ormL_1dL5EoZJY2WFZIBw.ipa)。
- Android：[构建详情](https://expo.dev/accounts/gress-fit5120-26s2/projects/kitchmemo/builds/31933d75-5e19-41ad-b280-50222ba15afb)，[APK](https://expo.dev/artifacts/eas/F8xsXbF2_dE9MCnqsyrWeZTrQkvS7fnCkFU0SdsXldU.apk)。
- 两个构建环境的 `EXPO_PUBLIC_API_URL` 均为 `https://kitchmemo-api.vercel.app`，没有打入本机局域网地址。构建上传时 App 源码是 `57fe833`；此后的变更仅服务端、迁移和发布记录，移动端运行时代码未变，已发布内容通过 API 动态读取。
- iOS 已用现有 App Store Connect API Key 提交至 app `6805763159`；[提交详情](https://expo.dev/accounts/gress-fit5120-26s2/projects/kitchmemo/submissions/de530848-c24b-49c2-9a18-9354399d9b31)，查询提交状态 **FINISHED**，无错误。App Store Connect 的后续处理、测试组分配和 App Store 上架审核不在此状态内。

生产 `learning-tutor-retention` cron active，每日 03:17 UTC；发布时运行历史 0 成功／0 失败，首次自然运行尚未发生。真实费用及自然任务历史保留为后续运行观察。
