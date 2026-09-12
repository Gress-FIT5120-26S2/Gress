# KitchMemo 成就与环境贡献业务规则

> 状态：团队已确认；第二阶段已在本地实现，待开发库迁移验证（Confirmed / Phase 2 local complete）  
> 版本：0.2  
> 最后更新：2026-09-12  
> 适用范围：库存结果记录、过期处理、环境贡献统计、XP、等级、成就及成就页数据接口

## 1. 文档目的

本文档定义 KitchMemo 成就功能使用的统一业务口径，确保产品、设计、Expo、Express、Supabase 和测试使用相同定义。

本文档是计划中的业务规格，不代表所有能力已经实现。当前数据库结构和实际行为仍以 `supabase/migrations/` 中已经部署的 migration 为准。实施本规格时，任何 Supabase schema 或数据库行为变化都必须通过新的时间戳 migration 提交，并在开发/测试项目验证后再应用到生产项目。

配套资料：

- `docs/achievement/KitchMemo_Report_Achievement_Data_Support.docx`：数据来源、报告指标和外部参考调研。
- `docs/data-architecture/BACKEND_DATA_CONTEXT.md`：当前后端数据契约和 migration 工作流。
- 未来的 `docs/achievement/ACHIEVEMENT_HERO_DESIGN_SPEC.md`：山峰等级区域的视觉素材、动效和前端实现规格。

## 2. 产品目标

成就系统应鼓励家庭及时使用已经购买的食材，减少确认丢弃的数量和价值，并通过平静、长期的山峰攀登过程展示环境贡献。

系统不得通过扣除等级、制造恐慌或把模糊日期描述成安全期限来驱动用户。食品安全判断优先于积分和成就。

第一版目标：

1. 准确区分入库、使用、丢弃和数据修正。
2. 区分硬性 `use-by`、`best-before` 和系统估算品质日期。
3. 记录及时使用临期食材产生的环境贡献。
4. 以共享冰箱为单位计算 XP、等级和成就。
5. 为成就页提供一个稳定、可解释、可测试的数据接口。

第一版不做：

- 不把不同单位的食材直接相加成一个“总公斤数”。
- 不在没有可靠价格时生成看似精确的节省金额。
- 不接入实时外部商品价格或汇率。
- 不允许客户端自行决定 XP、等级或成就是否解锁。
- 不实现需要用户手动领取奖励的任务商城。

## 3. 当前能力与缺口

### 3.1 当前已经具备

- `inventory_batches` 保存初始数量、剩余数量、单位、价格、币种和生命周期。
- `inventory_events` 保存 `stock`、`consume`、`discard`、`adjust` 和 `merge` 行为流水。
- `inventory_batches.use_by_at` 保存包装或可靠来源提供的硬性安全期限。
- `inventory_batches.estimated_quality_until` 保存系统计算的品质参考期限。
- `achievements` 保存全局成就定义。
- `fridge_achievements` 保存冰箱已经解锁的成就。
- 库存 mutation 已经使用批次 `version` 和数据库事务处理共享编辑冲突。

### 3.2 当前尚未具备

- 普通库存流程没有明确的 `discard` 入口。
- 普通库存数量修改没有在数据库边界阻止超过 `use_by_at` 后继续记录 `consume`。
- 主库存 API 和主要页面仍主要使用兼容字段 `expires_at`，没有完整暴露三种日期语义。
- `purchase_price` 仍允许为空。
- 没有结构化丢弃原因和事件发生时的日期、价格快照。
- 没有自动结算超过 `use_by_at` 的剩余库存。
- 没有 XP 流水、等级定义和防重复积分机制。
- 没有环境贡献聚合接口和 `GET /api/achievements`。

## 4. 核心术语

| 术语 | 定义 |
| --- | --- |
| 入库量 | 一个批次创建时确认的 `initial_quantity`。 |
| 当前剩余量 | 批次尚未结算的 `remaining_quantity`。 |
| 已使用量 | 通过 `consume` 事件减少的数量绝对值。 |
| 丢弃量 | 通过 `discard` 事件减少的数量绝对值。 |
| 数据修正 | 因录入错误、盘点偏差或合并产生的 `adjust`/`merge`，不代表使用或浪费。 |
| 临期窗口 | 从适用截止时间减去 `expiry_warning_days` 开始，到截止时间结束的区间。 |
| 及时挽救 | 食材进入临期窗口后，在允许使用的截止时间前发生的 `consume` 数量。 |
| 硬过期 | `use_by_at <= now()`。硬过期后不得食用。 |
| 品质待检查 | `best_before_at` 或 `estimated_quality_until` 已经过期，但不构成自动安全结论。 |
| 已结算批次 | 剩余量为 0，且最终结果为 `consumed`、`discarded` 或明确的数据修正。 |
| 等级 XP | 冰箱因符合规则的真实业务结果获得的累计积分，只增不减。 |

## 5. 日期语义和食品安全规则

### 5.1 日期类型

系统使用以下三种日期，不得混为一个“过期时间”：

| 日期类型 | 来源 | 到期后的含义 | 是否禁止食用 |
| --- | --- | --- | --- |
| `use_by` | 包装标签或经过用户确认的可靠识别 | 硬性安全期限 | 是 |
| `best_before` | 包装标签并由用户确认 | 品质可能下降，需要检查 | 否 |
| `estimated_quality` | 食材预设、照片新鲜度、储存方式和季节模型 | 系统品质预测，不是安全保证 | 否 |

`use-by` 与 `best-before` 的安全表述以 Food Standards Australia New Zealand 为权威参考：https://www.foodstandards.gov.au/consumer/labelling/dates

### 5.2 旧日期兼容

旧 `expires_at` 的来源不明确，不得批量升级为 `use_by_at`。迁移后的默认处理是：

- 已有 `use_by_at`：优先按硬性期限处理。
- 没有 `use_by_at`、只有旧 `expires_at`：作为兼容展示日期和品质检查日期，不自动禁止食用。
- 用户以后确认包装日期类型时，再写入 `use_by_at` 或 `best_before_at`。
- `estimated_quality_until` 仍由系统管理，不能由用户直接改成包装日期。

### 5.3 有效截止时间

临期提示可以使用当前适用日期中最早的一项，但必须保留来源：

```text
effective_attention_at = min(use_by_at, best_before_at, estimated_quality_until)
```

只有 `use_by_at` 可以形成硬性禁止食用的判断。

## 6. 库存状态与结算规则

### 6.1 状态转换

```text
active
  ├─ 合法 consume 后剩余量 > 0 ────────────────> active
  ├─ 合法 consume 后剩余量 = 0 ────────────────> consumed
  ├─ 用户确认丢弃后剩余量 = 0 ─────────────────> discarded
  ├─ use_by_at 到达且仍有剩余 ─────────────────> discarded
  └─ 确认是错误记录 ───────────────────────────> archived
```

`expiring` 和一般界面的 `expired` 仍然是根据时间计算的展示状态，不作为新的库存生命周期枚举。对于硬性 `use_by_at`，系统最终通过原子结算将批次转换为已经存在的 `discarded` 生命周期。

### 6.2 正常状态下移除

正常状态指尚未进入临期窗口，也没有硬过期。

用户点击移除后显示简短原因选择：

1. 已经用完：写入 `consume`。
2. 丢掉了：继续选择一个丢弃原因，然后写入 `discard`。
3. 录入错误：写入 `adjust` 或审计型归档，不计入使用、浪费、挽救或 XP。

丢弃原因第一版使用稳定代码：

| 原因代码 | 中文含义 |
| --- | --- |
| `spoiled` | 已经变质 |
| `overbought` | 买多了 |
| `forgotten` | 忘记使用 |
| `unwanted` | 不再需要 |
| `other` | 其他 |

### 6.3 临期状态下移除

临期状态指 `now()` 已进入临期窗口，但尚未超过适用截止时间。

- 点击移除默认记录为“及时使用”，写入 `consume` 并标记 `was_in_warning_window = true`。
- 成功提示必须提供“改为丢弃”入口，防止变质食品被误算成挽救。
- 更正必须通过原子数据库操作撤销原分类并创建正确流水或修正记录，不能只改前端显示。
- 同一来源操作只能产生一次最终 XP，重新分类时必须回收错误 XP 并写入正确结果。

### 6.4 硬过期状态下移除

当 `use_by_at <= now()`：

- 前端只显示“移除并记为浪费”。
- 普通数量减少、标记用完和 AI 助手动作全部禁止。
- 后端无论客户端提交什么意图，都不得写入 `consume`。
- 剩余量全部写入 `discard`，原因是 `auto_use_by_expiry` 或 `confirmed_use_by_expiry`。
- 批次剩余量归零，生命周期变为 `discarded`。

### 6.5 品质日期到期

当 `best_before_at` 或 `estimated_quality_until` 到达，但没有超过 `use_by_at`：

- 显示“需要检查品质”，不能显示为确定的食品安全风险。
- 用户仍可选择已经使用或丢弃。
- 丢弃时可以使用 `quality_rejected` 原因。
- 系统不得自动产生 `discard`。

### 6.6 部分使用

批次不必一次结算完成。部分使用时：

- `quantity_change` 为负数。
- `event_type = consume`。
- 剩余量大于 0 时生命周期保持 `active`。
- 如果发生在临期窗口内，临期部分数量可以计入及时挽救。
- 同一批次的完成奖励只能在首次达到剩余量 0 时触发一次。

## 7. 购买价格与价值口径

### 7.1 新库存强制价格

第一版面向澳大利亚用户，所有新库存必须填写购买总价，币种固定为 `AUD`。

校验必须同时存在于：

1. Expo 表单。
2. Express 请求校验。
3. Supabase 创建和编辑 RPC。
4. 数据库约束。

规则：

- 价格不得为空。
- 价格不得小于 0。
- 价格最多保留两位小数。
- 价格为 0 时，用户必须确认该食材为免费获得。
- 条码或外部数据可以预填价格，但保存前必须由用户确认。

### 7.2 历史空价格迁移

不得把历史空价格静默解释为免费。建议增加：

```text
price_status: recorded | free | legacy_unknown
price_source: user | barcode | estimated | legacy
```

迁移顺序：

1. 新增 `price_status` 和 `price_source`。
2. 现有非空价格回填为 `recorded` 和 `legacy`。
3. 现有空价格临时回填数值 0，同时标记为 `legacy_unknown`。
4. 将 `purchase_price` 改为 `NOT NULL`。
5. 新建和后续编辑禁止提交 `legacy_unknown`。
6. 报告金额和 XP 金额指标排除 `legacy_unknown`。

### 7.3 事件价值

对 `consume` 和 `discard`，事件价值按批次购买总价的比例计算：

```text
event_value_abs
= abs(quantity_change) / initial_quantity * purchase_price
```

数据库仍可以保存与数量同方向的负 `value_change`，展示与聚合时取绝对值。事件必须保存计算当时的价格、币种和初始数量快照，避免以后修改批次价格后重写历史。

第一版不跨币种合计。非 AUD 历史数据按原币种分组展示，不能直接加入 AUD 总额。

## 8. 环境贡献指标

### 8.1 库存守恒

单个批次应满足：

```text
入库量 + merge/adjust 净变化
= 当前剩余量 + 已使用量 + 已丢弃量
```

不能使用“购买量减去过期量”直接作为已使用量，因为尚在冰箱里的剩余库存不能被视为已经使用。

### 8.2 已使用量

```text
consumed_quantity(unit)
= sum(abs(quantity_change)) where event_type = consume
```

数量只能在相同规范单位内相加。第一版分别展示 `g`、`kg`、`ml`、`L`、`item` 等单位，或使用结算批次数，不能把它们直接合成一个数字。

### 8.3 浪费量

```text
discarded_quantity(unit)
= sum(abs(quantity_change)) where event_type = discard
```

数据修正、合并和归档错误记录不计入浪费量。

### 8.4 及时挽救量

一段 `consume` 同时满足以下条件时计为及时挽救：

```text
was_in_warning_window = true
AND occurred_at <= applicable_deadline_snapshot
AND date_type_snapshot IN (use_by, best_before, estimated_quality)
```

对于 `use_by`，截止时间必须严格执行。对于品质日期，该指标表示“在建议窗口内使用”，不表示食品原本一定会被浪费。

第一版顶部使用“及时使用次数”或“及时使用批次”作为跨单位指标；重量和容量在报告明细中按单位分别展示。

### 8.5 使用价值、浪费价值和挽救价值

```text
consumed_value = sum(abs(value_change)) where event_type = consume

discarded_value = sum(abs(value_change)) where event_type = discard

rescued_value = sum(abs(value_change))
  where event_type = consume
  and was_in_warning_window = true
```

只有 `rescued_value` 可以在用户文案中称为“及时挽救价值”。普通 `consumed_value` 应称为“已使用食材价值”，不能全部称为“节省金额”。

### 8.6 食材利用率

只针对已经结算的数量或价值计算，不包含当前剩余库存：

```text
utilization_rate
= consumed_value / (consumed_value + discarded_value) * 100
```

当分母为 0 时返回 `null`，不能返回 100%。`legacy_unknown` 价格记录不进入价值利用率，可以另算同单位数量利用率。

### 8.7 价格覆盖率

```text
price_coverage_rate
= 有可靠价格的已结算价值事件数 / 全部已结算价值事件数
```

金额卡片应同时返回覆盖率。覆盖率低于 80% 时，前端显示“基于部分已记录价格”，不得把金额描述成完整家庭总额。

## 9. XP 规则

### 9.1 基本原则

- XP 属于 `fridge_uid`，共享成员共同贡献。
- XP 只增不减，等级不会下降。
- 丢弃食品不扣 XP，避免惩罚式体验。
- 添加大量库存不能成为刷分方式。
- XP 必须由服务端和数据库根据权威事件生成。
- 每个业务来源只能记账一次。
- 数据修正不得产生 XP。

### 9.2 第一版积分表

| 行为 | XP | 条件与限制 |
| --- | ---: | --- |
| 第一次创建真实库存 | 10 | 每个冰箱一次。 |
| 一个批次在允许期限内完全使用 | 8 | 批次首次结算为 `consumed` 时一次。 |
| 临期窗口内及时用完一个批次 | 额外 12 | 与完整使用合计 20 XP；每批次一次。 |
| 一周零丢弃 | 30 | 冰箱时区内一周至少结算 3 个有效批次。 |
| 相比过去四周浪费率降低至少 10% | 40 | 每周一次；本周至少结算 5 个批次；历史样本充分。 |
| 首次开启共享冰箱 | 20 | 每个冰箱一次，不因重复邀请加分。 |
| 解锁成就 | 20–80 | 奖励值由成就定义决定。 |
| 丢弃食品 | 0 | 不扣分，也不产生使用或挽救奖励。 |

### 9.3 防重复与更正

建议新增追加式 `fridge_xp_events`，至少包含：

| 字段 | 用途 |
| --- | --- |
| `xp_event_uid` | 主键。 |
| `fridge_uid` | XP 所属冰箱。 |
| `source_event_uid` | 关联库存事件，可空。 |
| `source_key` | 周奖励、共享奖励等非库存来源的稳定幂等键。 |
| `reason_code` | 积分原因。 |
| `points` | 正常奖励为正数；纠错补偿允许负数，但用户等级不回退。 |
| `occurred_at` | 业务发生时间。 |
| `metadata` | 规则版本和计算快照。 |

数据库必须保证同一 `source_event_uid + reason_code` 或同一 `source_key` 只写入一次。误把临期删除记为使用后，如果用户改为丢弃，应写入可审计的补偿流水，而不是删除历史 XP 记录。

## 10. 等级体系

等级按累计 XP 决定，只升不降。阈值存入全局等级定义，不由前端写死。

| 等级 | 稳定代码 | 中文名称 | 英文名称 | 山峰 | 海拔 | 累计 XP |
| --- | --- | --- | --- | --- | ---: | ---: |
| Lv.1 | `rocky_seedling` | 岩峰新芽 | Rocky Seedling | 查亚峰 Puncak Jaya | 4,884 m | 0 |
| Lv.2 | `polar_guardian` | 冰原守护 | Polar Guardian | 文森峰 Vinson Massif | 4,892 m | 100 |
| Lv.3 | `cloud_saver` | 云巅节粮 | Cloudpeak Saver | 厄尔布鲁士峰 Mount Elbrus | 5,642 m | 320 |
| Lv.4 | `snowline_steward` | 雪线低废 | Snowline Steward | 乞力马扎罗峰 Mount Kilimanjaro | 5,895 m | 800 |
| Lv.5 | `climate_summit` | 气候之巅 | Climate Summit | 珠穆朗玛峰 Mount Everest | 8,848.86 m | 1,600 |

建议新增全局 `achievement_levels`：

```text
level
code
title_key
minimum_xp
mountain_key
theme_key
is_enabled
```

最高等级返回 `isMaxLevel = true` 和 `nextLevel = null`，前端显示累计贡献，不显示伪造的下一等级进度。

## 11. 第一版成就目录

成就与等级分开：等级反映长期累计贡献，成就是具体里程碑。所有成就均属于共享冰箱。

| 稳定代码 | 成就方向 | 解锁条件 | XP |
| --- | --- | --- | ---: |
| `first_item` | 第一次记录 | 创建第一个有效库存批次 | 20 |
| `first_rescue` | 初次及时使用 | 首次在临期窗口内使用食材 | 20 |
| `waste_watcher` | 浪费观察者 | 首次正确记录一个 `discard` 原因 | 20 |
| `zero_waste_week` | 零浪费一周 | 一周至少结算 3 个批次且没有 `discard` | 40 |
| `rescue_ten` | 挽救十次 | 累计 10 个批次在临期窗口内被完全使用 | 50 |
| `fridge_regular` | 稳定习惯 | 4 个不同自然周均有有效结算行为 | 50 |
| `shared_kitchen` | 共同厨房 | 冰箱拥有至少 2 位有效成员 | 20 |
| `climate_summit` | 气候之巅 | 达到 Lv.5 | 80 |

现有 seed 中的四项成就不能直接删除或改写已经部署的 migration。实施时通过新的 migration upsert 新定义、停用废弃定义或扩展规则。

现有 `achievements.rule_type + threshold` 只能表达简单阈值。复合规则建议新增：

```text
rule_config jsonb
xp_reward integer
sort_order integer
badge_asset_key text
rule_version integer
```

## 12. 冰箱时区和周期规则

周奖励和未来的每日/每周任务必须使用冰箱统一时区，不能分别使用每台成员设备的时区。

建议新增 `fridges.time_zone`：

- 创建冰箱时采用创建者设备报告的合法 IANA 时区。
- 共享后所有周期聚合继续使用冰箱时区。
- 第一版自然周定义为当地时间周一 00:00 到下周一 00:00。
- 服务端接收时间并转换为 UTC 保存，聚合边界按冰箱时区计算。
- 修改冰箱时区只影响未来周期，不重写已经结算的周奖励。

第一版不建立独立“任务领取”系统。零浪费周和改善周由权威流水自动结算，前端可以用挑战卡展示，但用户不需要手动领取 XP。

## 13. 自动过期结算

建议新增原子函数：

```text
discard_expired_use_by_batches(p_now)
```

单个批次结算必须在一个事务中完成：

1. 锁定仍为 `active` 的批次。
2. 再次检查 `use_by_at <= p_now` 和 `remaining_quantity > 0`。
3. 写入数量为负的 `discard` 事件。
4. 按价格比例写入负的 `value_change`。
5. 保存原因、日期、价格、单位和规则版本快照。
6. 将剩余量设为 0。
7. 将生命周期设为 `discarded`。
8. 更新批次 `version`。
9. 递增库存和成就同步版本。
10. 生成去重的共享通知。

定时任务应按固定频率调用此函数。为补偿任务延迟，读取成就页或尝试修改批次前也必须执行安全对账。自动事件的业务 `occurred_at` 使用 `use_by_at`，同时增加 `recorded_at` 保存实际写入时间，避免延迟执行扭曲周报或失去审计信息。

## 14. 推荐 API

### 14.1 结算库存

新增：

```text
POST /api/inventory/batches/:batchUid/resolve
```

请求示例：

```json
{
  "resolution": "consume",
  "quantity": 1,
  "reasonCode": "used",
  "expectedVersion": 4
}
```

允许的 `resolution`：

- `consume`
- `discard`
- `correction`

服务端必须根据权威时间和 `use_by_at` 覆盖不安全的客户端意图。超过硬期限的 `consume` 返回稳定错误码，例如 `inventory_use_by_expired`，并向客户端返回允许的 `discard` 动作。

现有 `DELETE /api/inventory/batches/:batchUid` 在新客户端上线后进入兼容期，最终只用于数据修正归档，不能继续把所有删除写成 `adjust`。

### 14.2 成就页读取

新增：

```text
GET /api/achievements
```

请求仍使用 `Device-ID + Device-Credential`，Express 将设备解析到唯一 `fridge_uid`，客户端不得提交任意冰箱 ID。

建议响应：

```json
{
  "level": {
    "current": 3,
    "code": "cloud_saver",
    "titleKey": "achievements.levels.cloudSaver",
    "totalXp": 462,
    "currentLevelMinimumXp": 320,
    "nextLevelMinimumXp": 800,
    "progress": 0.296,
    "isMaxLevel": false,
    "mountainKey": "elbrus",
    "themeKey": "cloudBlue"
  },
  "journey": {
    "previousLevel": 2,
    "currentLevel": 3,
    "nextLevel": 4
  },
  "metrics": {
    "consumedBatchCount": 18,
    "rescuedBatchCount": 7,
    "discardedBatchCount": 2,
    "consumedValue": 116.40,
    "rescuedValue": 38.20,
    "discardedValue": 9.60,
    "currency": "AUD",
    "priceCoverageRate": 1,
    "memberCount": 2
  },
  "achievements": [],
  "recentXpEvents": [],
  "updatedAt": "2026-09-12T00:00:00.000Z"
}
```

进度公式：

```text
progress
= (totalXp - currentLevelMinimumXp)
  / (nextLevelMinimumXp - currentLevelMinimumXp)
```

服务端将结果限制在 0 到 1。最高等级返回 `progress = 1`。

## 15. 成就页顶部数据映射

山峰等级区域固定展示三项可解释指标：

| 位置 | 主值 | 标签 | 点击去向 |
| --- | --- | --- | --- |
| 左侧 | 累计 XP | 等级分 | XP 明细 |
| 中间 | 有效成员数 | 共同成员 | 共享冰箱管理 |
| 右侧 | 及时使用批次数 | 及时挽救 | 环境贡献报告 |

标题示例：

```text
Lv.3 云巅节粮
再获得 338 XP 到达“雪线低废”
```

顶部不得把普通消费价值全部显示为“节省金额”。如果展示金额，应优先使用 `rescuedValue`，并在价格覆盖率不足时显示范围说明。

## 16. 一致性、并发和安全

- 所有库存结果、价值事件、XP、成就解锁和同步版本必须在数据库事务中完成，或使用可恢复的幂等流程。
- 普通库存 mutation 继续使用 `expectedVersion`，版本冲突返回 `409`。
- `use_by_at` 校验必须在数据库锁定批次后再次执行，防止用户在截止时间边界提交旧请求。
- 过期定时任务和用户手动操作同时发生时，只允许一个事务结算剩余量。
- 自动过期、API 重试和 Realtime 重拉不得重复写入 `discard`、XP 或成就。
- Express 使用 service role，必须在每个接口中验证设备凭证和当前冰箱成员关系。
- `actor_device_id` 仅用于审计；成就和 XP 仍属于整个 `fridge_uid`。
- 客户端只渲染服务端结果，不自行推导权威等级或解锁状态。

## 17. 实施顺序

1. 确认本业务规则并将状态改为 Approved。
2. 新增价格状态、日期类型、事件原因和事件快照 migration。
3. 对历史价格和旧日期执行可审计迁移。
4. 新增库存 resolve RPC 和 Express 接口。
5. 在所有普通库存数量 mutation 增加硬性 `use_by_at` 校验。
6. 新增自动过期结算函数和调度。
7. 新增 XP 流水、等级定义和复合成就规则。
8. 新增聚合与 `GET /api/achievements`。
9. 更新 `docs/data-architecture/BACKEND_DATA_CONTEXT.md`。
10. 接入成就页山峰区域和真实数据。
11. 在开发/测试项目完成迁移、接口、共享与并发验证。
12. 将同一 migration 应用到生产后再发布依赖新契约的 App。

## 18. 验收标准

### 18.1 日期和安全

- 超过 `use_by_at` 后，Expo、Express 和数据库均不能记录 `consume`。
- 超过 `best_before_at` 或 `estimated_quality_until` 不会自动判定为硬性不可食用。
- 旧 `expires_at` 不会被静默升级成 `use_by_at`。
- 自动过期任务重复运行不会重复创建事件。

### 18.2 移除和流水

- 正常移除可区分使用、丢弃和录入错误。
- 临期移除默认记为及时使用，并能更正为丢弃。
- 硬过期移除只能记为丢弃。
- 丢弃原因、事件日期、价格和单位快照可审计。
- 库存剩余量和事件累计变化满足守恒关系。

### 18.3 价格和金额

- 新库存无法以空价格保存。
- 价格 0 与历史缺失价格可区分。
- 历史 `legacy_unknown` 不进入金额总计。
- 部分使用和部分丢弃按初始数量比例计算价值。
- 非 AUD 历史数据不会直接合计到 AUD。

### 18.4 XP 和成就

- 同一库存事件重试不会重复获得 XP。
- 拆分多次使用不会重复获得批次完成奖励。
- 丢弃不会扣除 XP，也不会得到使用奖励。
- 数据更正留下补偿流水和审计记录。
- 共享成员看到相同等级、XP 和成就。
- 达到阈值后等级正确升级且不会下降。
- 最高等级不显示不存在的下一等级。

### 18.5 时区和周期

- 周边界使用冰箱 IANA 时区而不是服务器 UTC 或成员设备各自时区。
- 夏令时切换不会重复或遗漏周奖励。
- 修改冰箱时区不会重写已经结算的历史奖励。

## 19. 团队评审清单

团队批准本文档前应明确确认：

- [ ] 新库存购买价格必填，第一版币种固定 AUD。
- [ ] 历史空价格使用 `legacy_unknown`，不伪造金额。
- [ ] 只有 `use_by` 是硬性禁止食用的日期。
- [ ] 临期移除默认视为及时使用，但提供立即更正入口。
- [ ] 硬过期剩余库存自动或安全对账为 `discard`。
- [ ] XP 和成就属于共享冰箱，等级只升不降。
- [ ] 第一版采用五个山峰等级及本文阈值。
- [ ] 每周规则使用冰箱统一时区。
- [ ] 第一版不实现需要手动领取的任务系统。
- [ ] 所有 schema 和数据库行为变化使用新的 migration。

## 20. 待后续视觉规格定义

下列内容不属于本文档的权威范围，后续在独立视觉规格中确定：

- 五座山峰的最终图片来源、许可和署名方式。
- 山峰、前后云层、路线和节点的分层资产格式。
- 等级切换的准确帧时序、缓动和 reduced-motion 方案。
- 各等级背景色、文字对比度和深色主题。
- 山峰素材的低性能设备静态回退。
