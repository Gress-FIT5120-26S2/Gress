# 生产数据库迁移核对

核对日期：2026-10-12（Australia/Sydney）。

## 结果

`Gress-production`（`vcsujjaapchvcnndlhqb`）已从 39 份迁移补齐至 56 份，最新为 `20261008016000_fix_learning_tutor_credential_alias.sql`，与本地及 `Gress-development`（`thmbtsssvnslotoexntz`）一致。生产再次 `db push --dry-run` 返回 up to date，待执行迁移、seed、角色变更均为空。

所有迁移均使用现有已提交文件；应用前逐文件 SHA-256 确认生产工作目录副本与源码完全一致。源码基线为 Git `57fe8336da554328ddf17f56e90864d53823a528`。未修改旧迁移、修复登记历史、运行 seed 或 reset。项目主目录仍链接开发库，生产操作使用独立且被 Git 忽略的 `.codex-build/production-migrations`。

## 本次应用清单

按时间顺序应用以下 17 份文件：

1. `20260922010000_fix_shared_join_assistant_scope.sql`
2. `20260923120000_reserve_weekly_quest_rerolls.sql`
3. `20260923121000_clean_weekly_quest_slot_reconciliation.sql`
4. `20260924010000_achievement_stage_report.sql`
5. `20261002010000_waste_sorting_learning.sql`
6. `20261003010000_skip_sync_for_deleted_fridges.sql`
7. `20261003020000_one_sorting_attempt_per_event.sql`
8. `20261004010000_inventory_waste_profiles.sql`
9. `20261005010000_learning_room_assessment.sql`
10. `20261005011000_learning_room_draft.sql`
11. `20261008010000_learning_tutor_foundation.sql`
12. `20261008011000_learning_tutor_draft.sql`
13. `20261008012000_learning_tutor_review_help.sql`
14. `20261008013000_fix_learning_tutor_support.sql`
15. `20261008014000_learning_tutor_evidence_v2.sql`
16. `20261008015000_learning_tutor_versioned_context.sql`
17. `20261008016000_fix_learning_tutor_credential_alias.sql`

## 核对证据

| 检查 | 结果 |
| --- | --- |
| 开发、生产 PostgreSQL lint，warning 级别 | 均无错误或警告 |
| public 表 / 字段 / 约束 | 两端均为 50 / 500 / 364 |
| 非扩展函数 / 索引 / 业务触发器 / 枚举 | 两端均为 79 / 128 / 32 / 7 |
| 结构、默认值、生成列、约束、函数正文及配置、权限、触发器 | 无差异；仅统一 CRLF/LF 换行后比较函数正文 |
| 本次 17 份迁移的远程登记正文指纹 | 开发与生产一致 |
| 既有生产业务数据 | 22 张有记录的业务表，迁移前后行数与排序后的汇总记录指纹一致 |
| public 表 RLS | 全部 50 张启用 |
| anon/authenticated 表权限及 security-definer RPC 执行权 | 均无 |
| 学习表 service role 直接写权限 | 无；维持直接只读、经 RPC 写入 |
| 参考数据 | 8 项成就、5 个等级、14 个每日任务、20 个每周任务、11 种材质 |
| 生产 Data API | 新表可读，Learning Room RPC 对无有效凭证设备返回 `invalid_device_credential`；无写入 |
| 导师清理任务 | `learning-tutor-retention` 已启用，`17 3 * * *`（每日 03:17 UTC），调用 `public.cleanup_learning_tutor()` |

数据指纹覆盖设备、冰箱、成员、邀请、库存批次与事件、分类、补货规则、购物项、通知与阅读、设备资料与凭证、Push Token 与投递、成就、XP、任务分配及助手会话/消息/动作。库存新增包装字段从前后比较中排除；其余原记录整体参加哈希。原始业务记录未导出，汇总指纹仅保存在忽略的本地工作目录。

## 开发先行与生产事务验证

应用前重新运行开发端真实回归：

- `verify:learning-room`：298 次请求通过，覆盖正式考试阈值、首答冻结、幂等、共享身份隔离、恢复及精确清理。
- `verify:learning-tutor`：61 次请求通过，使用验证 spy，覆盖并发租约、请求缓存、考试限制、额外练习、私有历史、恢复与迟到响应。该结果不代表本轮调用真实模型。
- `verify:waste-learning`：旧客户端兼容、包装快照、多部件答题幂等、部分单位与容量清零边界通过。
- `verify:quests`：任务目录和槽位契约通过；真实三次更换额度另由数据库事务验证。
- `verify:sharing`：共享开启、邀请码错误、轮换、改名、助手范围迁移、退出与恢复通过。

`rollback-smoke.sql` 先在开发通过，再在生产以相同文件通过。使用 service role 执行实际 RPC，覆盖设备初始化、三次互不重复的周任务更换与第四次拒绝、v3 入库与使用包装快照、答题唯一约束、阶段报告、正式门禁拒绝课程/导师草稿、导师偏好及删除空冰箱的同步触发器。随机测试数据及所有写入均在显式事务中回滚。

## 旧迁移登记文本差异

`20260830005000` 的旧远程 `statements` 记录仍有差异：开发登记 1 个函数语句，生产登记 4 个语句（购物表、两个索引及函数）。这项差异在本次操作前已存在。当前购物表、索引、RPC、权限与其余实际 schema 全部一致；已保留两端原登记记录，没有重新应用或用 migration repair 覆盖历史。

其余 55 份迁移的远程登记正文指纹在统一换行后完全一致。

## 发布边界

数据库迁移已补齐。课程 `learning-room-v1` 的独立审核仍为 pending，课程及导师 `learning-tutor-v1/v2` 仍为 draft，生产默认门禁继续拒绝它们。此次没有发布课程内容、启用生产草稿例外、部署 Express、构建 App 或摄取助手知识。学堂正式可用仍依赖真实独立内容审核及新增发布 migration；已有草稿迁移不得改写。

清理任务登记与启用已核对，后续实际定时运行结果须在运行后观察。本次未将数据库验证等同于已部署 API 或真机验收。

## 可复用文件

- [schema-audit.sql](schema-audit.sql)：结构、权限及迁移正文指纹。
- [data-baseline.sql](data-baseline.sql)：既有业务数据汇总指纹。
- [security-audit.sql](security-audit.sql)：RLS、角色权限、内容状态及定时任务。
- [rollback-smoke.sql](rollback-smoke.sql)：开发先行及生产事务回滚验证。
- [verification-summary.json](verification-summary.json)：核对摘要、源码提交与 56 份文件的 SHA-256。

回滚验证中的草稿拒绝断言针对本日尚无 published 学习内容的状态；后续正式发布后应相应更新验证用例。
