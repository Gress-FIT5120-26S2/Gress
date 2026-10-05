# P3 个人学习数据库与考试服务验证

日期：2026-10-05，Windows／Australia/Sydney。P3 开发环境完成；P4 真实页面接入尚未开始。没有更改五页视觉、Home／Profile 正式入口或已有 env 文件。独立内容校对、原生页面验收、生产发布继续 pending。

## 实现与环境

七表、六个事务／辅助函数及三个 trigger，详见两份新迁移；Express 12 个 learning 路由经既有凭证鉴权，明确 allowlist 和答案投影。实际请求／响应见 [API_CONTRACT.md](../../API_CONTRACT.md)。状态／进度只按本人 learner 保存，共享冰箱不合并等级。恢复使用既有 recover_device 内的 membership trigger，保留旧稳定 learner 和全部合法成绩。

| 项目 | 实测结果 |
| --- | --- |
| CLI 目标 | Gress-development，thmbtsssvnslotoexntz；链接文件与项目列表已核对 |
| PostgreSQL | 17.6，开发项目 ACTIVE_HEALTHY |
| 迁移 | 原 47 份全部匹配，dry-run 仅两份新文件；提交后 db push 成功；远程共 49 份，最新 20261005011000 |
| Schema | public 44 张普通表，其中 learning 七表；七表 RLS，anon／authenticated 无权限 |
| 私有边界 | service role 只直接 SELECT，写入经 action RPC；helper 不授权 service role；HTTP 不展开私有快照 |
| 草稿 | 唯一实际版本 learning-room-v1，status=draft、independentReview=pending；没有真实 published 版本 |
| 清理 | HTTP 测试精确清理随机设备及其冰箱；最终 test_learning learner=0、attempt=0 |
| 生产 | 本轮未连接或应用生产迁移，未推送代码、未部署 Express／App |

实施提交：1eb83a8 保存 P0–P2 已完成成果；6d0af20 保存 P3 迁移及依赖后端代码。后续交接／测试工具改进为追加提交；已应用两份迁移未再修改。

## 迁移与内容 hash

| 文件／内容 | SHA-256（应用时工作文件 bytes） |
| --- | --- |
| 20261005010000_learning_room_assessment.sql | fdd2ea09ed3d320cf38f7c75571d8e39d2b3b414ca4e19f6d49cf50c34caa9e4 |
| 20261005011000_learning_room_draft.sql | e34b7aa8658f202ba56d4876437d35157efc12fa9e7cdcc92ed964953aa5cc54 |
| learning-room-v1 规范化内容 | 0736124795fd1dbc5e5b82521f919162ea82692c27a3f127b850410ce31f6054 |

SQL 文件 hash 与规范化教学内容 hash 含义不同；Git checkout 的换行转换可能改变文件 byte hash，不能因此重写已应用迁移。

## 检查与证据

| 检查 | 结果 |
| --- | --- |
| Expo SDK 57 确切文档、完整 backend context | 代码前已读；本轮仅写 Node／SQL 后端，不新增 Expo API |
| node --test server/test/learningAssessment.test.js server/test/learningContent.test.js server/test/wasteQuestionCatalog.test.js scripts/test-learning-room.mjs | 38／38 PASS；8 新后端、14 内容、8 既有分类、8 UI 导航／隔离 |
| node node_modules/typescript/bin/tsc --noEmit | PASS |
| node server/scripts/prepare-learning-preflight.js＋CLI db query --linked --file .codex-build/learning-room-p3/preflight.sql | PASS：新迁移＋参考内容＋真实 SQL 断言在单事务预演后 ROLLBACK |
| CLI db push --dry-run，再 db push --yes | PASS，仅上述两份文件，无 seeds／roles |
| CLI db lint --linked --level warning | PASS，No schema errors found |
| cd server；node scripts/verify-learning-room.js | PASS，298 次真实 HTTP 请求；六组验证及清理成功，凭证撤销的 401 是预期场景 |
| node server/scripts/prepare-learning-preflight.js --applied＋CLI db query | PASS：已应用 schema 的恢复、版本快照、撤回及审核发布 SQL，全程 ROLLBACK；测试审核替身不持久化 |
| 远程 metadata 只读核对 | 49 migrations／7 learning tables，唯一真实 v1 draft／pending，test learners／attempts 均 0 |
| node server/scripts/validate-learning-content.js --release | 按预期 FAIL：独立审核 pending，不是已发布题库 |

HTTP 验证使用同一个 requireDevice、learning router／service、sharing／recovery handlers 和真实开发数据库。临时 localhost 测试 App 不挂生产 CORS／速率外围限制；这些已有全局代码未改变，本轮不宣称重新验收其完整部署行为。测试只在服务端读取自己的私有快照控制目标分数，客户端收到的题目投影始终检查无答案键／解释。

验证场景：

- 新用户 0 活动、初级 unlocked、中高 locked；公开 catalog 不含题库；普通服务不开双开关时拒绝 draft。
- 4/6、6/8、7/10 不通过；5/6、7/8、8/10 通过。服务端整数门槛，不用显示四舍五入判断。
- 同键并发 create 同考试；不同 createKey 恢复同 active 后，完成重发仍绑定原结果。
- 同首答并发只有一条；换选项 409；未答先 next／finish、跳答下一题均 409；游标 GET 恢复反馈，同键 next 不跨题。
- 并发 finish 同一状态版本和成绩；错题数量精确；高级混合复习十二题不改永久资格。
- lesson/resource 自然幂等；review 满分不升级；practice 三题完成活动，不能用 completion 接口伪造。
- 同一冰箱的另一个成员读考试仍 404；join／leave 保留 learner UUID，个人等级与活动不被共享成员改变。
- 原 learner 与临时 learner 恢复事务合并，临时已通过初级保留、旧 practice 保留；冲突 active 标 abandoned，旧凭证失效，显式 abandon 后可新考试。
- 正式和练习操作前后 inventory_batches／events、waste_sorting_attempts、fridge_xp_events、fridge_achievements、notifications 数量不变。
- 新内容版本出现后旧考试 contentVersion、题目／选项／来源快照保持一致，已通关等级不回退；撤回使旧 active invalidated，已结算结果可复习。
- 数据库拒绝改不可变内容、缺独立审核发布、published 退回 draft；同内容草稿的合格审核 upsert 可发布（仅回滚测试替身）。

## 重复运行与下一步

开发 schema 已应用后，SQL 断言用 `prepare-learning-preflight.js --applied`；不要运行不带参数的 DDL 预演去重复 CREATE。输出目录 .codex-build 不进入 Git。HTTP 脚本强制检查开发 ref／域名和非生产环境，并使用进程内显式草稿开关；不要求更改 env 文件。

内容生成器 `node server/scripts/generate-learning-migration.js <新timestamp>_learning_room_content.sql` 默认走 release 校验，当前会拒绝 pending。真实独立审核完成后可生成追加 migration 发布完全相同的 draft；若改内容，须先新 contentVersion／manifest 并重新审核。生成器禁止覆盖已有文件。生产发布仍需开发先验及明确发布授权。

下一步 P4：实现 learningApi gateway 与本人数据管理，保留请求重试键和失效考试处理；接教育视频与独立 Bin Action practice；接 Home／Profile 入口；用真实初级→中级→高级路径验收。学习室预览目前仍 fixture，不应描述为页面已接上真实持久数据。
