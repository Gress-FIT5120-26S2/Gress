# KitchMemo 后端数据上下文

> 面向后续开发者和新的 Codex 对话。开始修改 Supabase、Express 数据接口、设备初始化、共享冰箱、库存、通知或成就功能前，请完整阅读本文档。

## 1. 当前状态

- 最后核对日期：2026-08-30（Australia/Sydney）。
- 当前数据库：Supabase PostgreSQL。
- 本地 schema 历史共有 5 份 migration；本轮没有连接远程项目核对实际应用状态，部署前必须分别在测试库和生产库执行 `migration list`。
- 新增库存写入与库存详情 mutation migration 必须先在测试库应用和验证，再把同一文件应用到生产库。
- 远程 PostgreSQL lint 已通过，无 schema error。
- 已建立 13 张业务表、7 个枚举、1 个通用更新时间触发函数和 1 个设备初始化 RPC。
- 已导入 9 条常见食材建议和 4 条成就定义。
- 前端不会直连 Supabase；所有请求必须经过 Express。
- 代码中已实现设备初始化、库存读取、建议查询、批次入库、批次详情、数量调整、资料编辑、补货规则保存和软删除；对应数据库函数只有在相关 migration 已应用后才可调用。共享、通知、成就和分类管理接口尚未实现。

实际实现的权威来源：

- Schema 与数据库行为 migration：`supabase/migrations/` 下按时间排序的全部 SQL 文件
- Seed：`supabase/seed.sql`
- Express Supabase 客户端：`server/src/supabase.js`
- Express 入口：`server/src/index.js`
- Expo 设备标识：`src/services/deviceId.ts`
- Expo 通用请求层：`src/services/apiClient.ts`
- Expo 库存业务 API：`src/services/inventoryApi.ts`

本文档解释设计意图。字段或约束与本文档发生冲突时，以已部署 migration 为准，并同步更新本文档。

### Migration 保留规则（强制）

任何数据库结构或行为变化必须新增带时间戳的 SQL 文件到 `supabase/migrations/` 并提交 Git，包含表、字段、约束、索引、枚举、RLS、权限、触发器、RPC/函数、视图和 Storage policy。已经应用到任一远程环境的 migration 永远不能修改、删除或重命名；必须新增后续 migration。

不要把 Dashboard、Table Editor 或远程 SQL Editor 的改动当作完成。若已经直接修改远程项目，必须立即补写等价 migration 后再继续开发。测试环境验证通过后，生产环境只能应用同一份 migration；`seed.sql` 只放可复现的非用户参考数据，绝不放生产库存、设备、邀请码等用户数据。

## 2. 系统边界

```text
Expo App
  └─ getDeviceId()
       └─ HTTP + Device-ID header
            └─ Express API
                 └─ server-only Supabase Secret Key
                      └─ Supabase PostgreSQL
```

必须保持的规则：

1. Expo 只读取 `EXPO_PUBLIC_API_URL`。
2. `SUPABASE_SECRET_KEY` 或旧的 `SUPABASE_SERVICE_ROLE_KEY` 只能存在于 `server/.env`。
3. Expo 代码中不得导入 `@supabase/supabase-js`、创建 Supabase client 或保存 Supabase key。
4. Express 使用 service role，因此会绕过 RLS。每个业务接口必须主动验证 `Device-ID` 对应的 `fridge_members` 关系。
5. `created_by_device_id` 和 `actor_device_id` 只表示创建者或操作者，不表示数据的所有权。业务数据的共同所有权由 `fridge_uid` 决定。

## 2.1 环境隔离与配置

- 测试与生产必须使用不同的 Supabase 项目、不同的 Express 部署/配置和不同的 `EXPO_PUBLIC_API_URL`。
- Expo 的公开变量只能包含 Express API 地址；绝不能包含 Supabase URL、Secret Key 或 service-role key。
- Expo 本地开发使用根目录 `.env.development`，生产构建使用 `.env.production`（或 EAS 的对应环境变量）；两者只设置 `EXPO_PUBLIC_API_URL`。
- 本地 Express 默认读取 `server/.env.development`；当 `NODE_ENV=production` 时读取 `server/.env.production`。部署平台直接提供的环境变量优先于文件。
- `server/.env` 仅作为旧开发机兼容回退。新配置请使用按环境命名的文件，所有真实 `.env` 文件都不得提交 Git。
- 测试 App 必须指向测试 Express，生产 App 必须指向生产 Express；同一 `device_id` 在两个 Supabase 项目中是彼此独立的数据。

## 3. Device ID 的真实格式

项目没有登录功能。`device_id` 是应用安装实例标识，不是用户账号，也不是可信身份认证。

当前 Expo 实现：

- iOS：首次生成 `ios_<UUID>`，保存到 SecureStore，后续复用。
- Android：读取系统 Android ID，形成 `android_<ANDROID_ID>`。
- Web：当前不支持，会抛出 `Unsupported platform`。

因此数据库中的所有 `device_id` 字段必须是 `text`，不能改成 PostgreSQL `uuid`。

已知限制：

- 更换设备后通常会得到新的 `device_id`。
- 当前没有跨设备恢复机制。
- 单独知道某个 `device_id` 不应被视为足够安全；正式业务接口后续应考虑服务端签发的设备令牌。

## 4. 已确认的业务规则

1. 一台设备同时只能属于一个冰箱。
2. 冰箱可以是 `personal` 或 `shared`，两种模式使用同一张 `fridges` 表。
3. 多台设备通过邀请码加入同一个共享冰箱。
4. 加入共享冰箱时，加入方原个人冰箱的数据需要合并到邀请码目标冰箱。
5. 合并后，库存、分类、使用记录、通知事件和成就都按目标 `fridge_uid` 共享。
6. 通知内容按冰箱共享，但每台成员设备拥有独立的已读状态。
7. 成就属于整个冰箱，不属于单个设备。
8. 每次入库都创建独立库存批次。同名食材在不同日期入库不能合并为一行。
9. `chilled`、`frozen`、`pantry` 是保存的储存方式。
10. `expired`、`expiring`、`restock` 是计算状态，不是库存批次的固定类别。
11. 分类属于冰箱，因此共享成员可以同步看到自定义分类。
12. 常见食材建议是全局参考数据；用户确认后的储存方式和到期时间复制到库存批次，之后修改建议不会修改历史库存。

## 5. 实体关系图

```mermaid
erDiagram
    DEVICES ||--o| FRIDGE_MEMBERS : joins
    FRIDGES ||--o{ FRIDGE_MEMBERS : contains
    DEVICES ||--o{ FRIDGES : creates
    FRIDGES ||--o{ FRIDGE_INVITES : issues
    FRIDGES ||--o{ FOOD_CATEGORIES : owns
    FRIDGES ||--o{ INVENTORY_BATCHES : owns
    FOOD_CATEGORIES ||--o{ INVENTORY_BATCHES : classifies
    FOOD_PRESETS o|--o{ INVENTORY_BATCHES : suggests
    INVENTORY_BATCHES ||--o{ INVENTORY_EVENTS : records
    DEVICES ||--o{ INVENTORY_EVENTS : acts
    FRIDGES ||--o{ RESTOCK_RULES : configures
    FRIDGES ||--o{ NOTIFICATIONS : receives
    INVENTORY_BATCHES o|--o{ NOTIFICATIONS : triggers
    NOTIFICATIONS ||--o{ NOTIFICATION_READS : read_by
    DEVICES ||--o{ NOTIFICATION_READS : reads
    FRIDGES ||--o{ FRIDGE_ACHIEVEMENTS : earns
    ACHIEVEMENTS ||--o{ FRIDGE_ACHIEVEMENTS : defines
```

## 6. PostgreSQL 枚举

| 枚举 | 值 | 用途 |
| --- | --- | --- |
| `fridge_mode` | `personal`, `shared` | 冰箱使用模式 |
| `fridge_status` | `active`, `merged` | 冰箱是否仍为有效数据归属 |
| `invite_status` | `active`, `used`, `revoked`, `expired` | 邀请码状态 |
| `storage_zone` | `chilled`, `frozen`, `pantry` | 实际储存方式 |
| `inventory_lifecycle` | `active`, `consumed`, `discarded`, `archived` | 库存批次生命周期 |
| `inventory_event_type` | `stock`, `consume`, `discard`, `adjust`, `merge` | 库存流水类型 |
| `notification_type` | `expiring`, `expired`, `restock`, `system` | 通知类型 |

## 7. 表结构

### 7.1 `devices`

匿名设备安装实例。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `device_id` | `text` | 主键，长度 3–200 |
| `created_at` | `timestamptz` | 默认 `now()` |
| `last_seen_at` | `timestamptz` | 默认 `now()`；初始化 RPC 再次调用时更新 |

### 7.2 `fridges`

所有业务数据的顶层归属。个人与共享冰箱不分表。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `fridge_uid` | `uuid` | 主键，自动生成 |
| `name` | `text` | 非空白 |
| `mode` | `fridge_mode` | 默认 `personal` |
| `created_by_device_id` | `text` | 外键 → `devices.device_id` |
| `status` | `fridge_status` | 默认 `active` |
| `merged_into_fridge_uid` | `uuid` | 自外键；合并后指向目标冰箱 |
| `created_at` | `timestamptz` | 创建时间 |
| `updated_at` | `timestamptz` | 由触发器更新 |

约束：

- `active` 冰箱的 `merged_into_fridge_uid` 必须为空。
- `merged` 冰箱必须保存目标 `fridge_uid`。
- 冰箱不能合并到自己。

### 7.3 `fridge_members`

设备与冰箱的成员关系。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `fridge_uid` | `uuid` | 联合主键，外键 → `fridges` |
| `device_id` | `text` | 联合主键，外键 → `devices`，全表唯一 |
| `joined_at` | `timestamptz` | 加入时间 |

`device_id UNIQUE` 从数据库层保证一台设备同时只能属于一个冰箱。

### 7.4 `fridge_invites`

共享冰箱邀请码。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `invite_uid` | `uuid` | 主键 |
| `fridge_uid` | `uuid` | 邀请目标冰箱 |
| `code` | `text` | 唯一，长度 6–64 |
| `created_by_device_id` | `text` | 创建邀请的设备 |
| `expires_at` | `timestamptz` | 可空，必须晚于创建时间 |
| `used_at` | `timestamptz` | 使用时间 |
| `status` | `invite_status` | 默认 `active` |
| `created_at` | `timestamptz` | 创建时间 |

`used` 状态必须有 `used_at`。邀请码合并事务目前尚未实现。

### 7.5 `food_categories`

每个冰箱自己的分类集合，支持自定义分类。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `category_uid` | `uuid` | 主键 |
| `fridge_uid` | `uuid` | 所属冰箱 |
| `name` | `text` | 分类名称 |
| `normalized_name` | `text` | 自动生成：`lower(btrim(name))` |
| `system_code` | `text` | 默认分类稳定键，可空 |
| `colour` | `text` | 前端颜色令牌 |
| `icon` | `text` | 前端图标名称 |
| `is_default` | `boolean` | 是否为系统默认分类 |
| `created_by_device_id` | `text` | 创建者设备 |
| `created_at` / `updated_at` | `timestamptz` | 审计时间 |

唯一约束：

- `(fridge_uid, normalized_name)`
- `(fridge_uid, system_code)`
- `(category_uid, fridge_uid)`，供库存批次使用组合外键

默认 `system_code` 必须与前端保持一致：

```text
meat, vegetables, fruit, staples, condiments, drinks, other
```

### 7.6 `food_presets`

全局常见食材储藏建议，不属于某个冰箱。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `preset_uid` | `uuid` | 主键 |
| `canonical_name` | `text` | 唯一标准名称 |
| `normalized_name` | `text` | 自动生成并唯一 |
| `aliases` | `text[]` | 中英文别名，带 GIN 索引 |
| `suggested_storage_zone` | `storage_zone` | 推荐储存方式 |
| `suggested_shelf_life_days` | `integer` | 必须大于 0 |
| `suggested_category_code` | `text` | 映射默认分类 |
| `notes` | `text` | 储藏说明 |
| `is_enabled` | `boolean` | 是否继续提供建议 |
| `created_at` / `updated_at` | `timestamptz` | 审计时间 |

### 7.7 `inventory_batches`

真实库存核心表。每次入库新增一条批次。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `batch_uid` | `uuid` | 主键 |
| `fridge_uid` | `uuid` | 数据所有权边界 |
| `category_uid` | `uuid` | 必须属于同一个 `fridge_uid` |
| `created_by_device_id` | `text` | 最初添加设备，仅用于审计 |
| `preset_uid` | `uuid` | 可空；命中的全局建议 |
| `name` | `text` | 用户确认名称 |
| `normalized_name` | `text` | 自动生成，用于搜索和聚合 |
| `storage_zone` | `storage_zone` | 冷藏、冷冻或常温 |
| `initial_quantity` | `numeric(12,3)` | 必须大于 0 |
| `remaining_quantity` | `numeric(12,3)` | 0 到初始数量之间 |
| `unit` | `text` | 例如 `item`、`g`、`ml` |
| `purchase_price` | `numeric(12,2)` | 可空且不得为负 |
| `currency` | `char(3)` | 默认 `AUD`，三位大写代码 |
| `stocked_at` | `timestamptz` | 入库时间 |
| `expires_at` | `timestamptz` | 可空，不得早于入库时间 |
| `opened_at` | `timestamptz` | 可空，不得早于入库时间 |
| `lifecycle_state` | `inventory_lifecycle` | 默认 `active` |
| `version` | `integer` | 默认 1，用于共享编辑乐观锁 |
| `created_at` / `updated_at` | `timestamptz` | 审计时间 |

关键规则：同名食材可以有多个批次。前端允许聚合展示，但消耗、丢弃和到期计算必须落到具体 `batch_uid`。

当前详情修改约束：

- 数量不能小于 0，也不能超过该批次的 `initial_quantity`。
- 数量降到 0 时批次转为 `consumed`；从 0 增加时可恢复为 `active`。
- 修改请求携带 `expectedVersion`；版本不一致时 Express 返回 `409`，避免共享冰箱中的并发覆盖。
- 普通删除是软删除：批次转为 `archived`、剩余数量归零并保留流水，不物理删除历史记录。

### 7.8 `inventory_events`

不可替代的库存使用与变更流水。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `event_uid` | `uuid` | 主键 |
| `fridge_uid` | `uuid` | 所属冰箱 |
| `batch_uid` | `uuid` | 必须属于同一个冰箱 |
| `actor_device_id` | `text` | 操作者设备，仅用于审计 |
| `event_type` | `inventory_event_type` | 入库、消耗、丢弃、调整或合并 |
| `quantity_change` | `numeric(12,3)` | 带符号数量变化 |
| `value_change` | `numeric(12,2)` | 默认 0，带符号价值影响 |
| `occurred_at` | `timestamptz` | 事件时间 |
| `note` | `text` | 可选原因或备注 |

建议约定：

- `stock`：正数量，价值影响通常为 0。
- `consume`：负数量；当前详情数量 mutation 按购买价比例记录同方向的带符号价值变化，成就统计实现前需统一“收益”展示口径。
- `discard`：负数量，价值影响为负浪费。
- `adjust`：数量和价值根据修正方向带符号。
- 更新 `inventory_batches` 和写入事件必须在同一事务中完成。

### 7.9 `restock_rules`

“需补货”筛选的规则来源。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `rule_uid` | `uuid` | 主键 |
| `fridge_uid` | `uuid` | 所属冰箱 |
| `preset_uid` | `uuid` | 可空 |
| `normalized_item_name` | `text` | 标准化食材名称 |
| `minimum_quantity` | `numeric(12,3)` | 不得为负 |
| `target_quantity` | `numeric(12,3)` | 必须高于最低数量 |
| `unit` | `text` | 聚合时必须单位一致 |
| `is_enabled` | `boolean` | 是否启用 |
| `created_at` / `updated_at` | `timestamptz` | 审计时间 |

同一冰箱、食材/预设和单位只能有一条规则。

### 7.10 `notifications`

整个冰箱共享的通知事件。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `notification_uid` | `uuid` | 主键 |
| `fridge_uid` | `uuid` | 所属冰箱 |
| `related_batch_uid` | `uuid` | 可空；必须属于同一冰箱 |
| `notification_type` | `notification_type` | 临期、过期、补货或系统通知 |
| `message_key` | `text` | i18n 文案键，不直接保存单一语言完整句子 |
| `message_payload` | `jsonb` | 食材名、剩余天数等模板参数 |
| `dedupe_key` | `text` | 全局唯一，防止同一事件重复生成 |
| `created_at` | `timestamptz` | 创建时间 |
| `expires_at` | `timestamptz` | 可空，必须晚于创建时间 |

### 7.11 `notification_reads`

每台成员设备独立的通知阅读状态。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `notification_uid` | `uuid` | 联合主键，外键 → `notifications` |
| `device_id` | `text` | 联合主键，外键 → `devices` |
| `read_at` | `timestamptz` | 阅读时间 |

成员 A 写入阅读记录不会改变成员 B 的未读状态。

### 7.12 `achievements`

全局成就定义。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `achievement_uid` | `uuid` | 主键 |
| `code` | `text` | 唯一稳定代码 |
| `title_key` | `text` | i18n 标题键 |
| `description_key` | `text` | i18n 描述键 |
| `rule_type` | `text` | 计算规则类型 |
| `threshold` | `numeric` | 可空且不得为负 |
| `is_enabled` | `boolean` | 是否启用 |
| `created_at` / `updated_at` | `timestamptz` | 审计时间 |

### 7.13 `fridge_achievements`

冰箱已经解锁的成就。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `fridge_uid` | `uuid` | 联合主键 |
| `achievement_uid` | `uuid` | 联合主键 |
| `unlocked_at` | `timestamptz` | 解锁时间 |
| `metric_value` | `numeric` | 解锁时指标，可空 |

不保存 `device_id`，因为成就属于整个冰箱。

## 8. 派生状态

顶部筛选状态按以下方式计算：

| 筛选 | 规则 |
| --- | --- |
| 冷藏 | `storage_zone = 'chilled'` |
| 冷冻 | `storage_zone = 'frozen'` |
| 常温 | `storage_zone = 'pantry'` |
| 已过期 | `lifecycle_state = 'active' AND expires_at < now()` |
| 快过期 | 尚未过期且 `expires_at` 位于业务配置的提醒窗口内；当前前端原型使用 3 天 |
| 需补货 | 按食材和单位汇总有效批次后，小于或等于 `restock_rules.minimum_quantity` |

不要在库存批次中增加 `expired` 或 `expiring` 固定状态，否则时间推进后数据会失真。

## 9. 索引

已经建立的主要索引：

- 有效邀请码：`fridge_invites(code) WHERE status = 'active'`
- 冰箱分类：`food_categories(fridge_uid)`
- 食材别名：`food_presets USING GIN (aliases)`
- 有效库存筛选：`inventory_batches(fridge_uid, storage_zone, category_uid)`
- 到期查询：`inventory_batches(fridge_uid, expires_at)`
- 名称搜索/聚合：`inventory_batches(fridge_uid, normalized_name)`
- 冰箱流水时间线：`inventory_events(fridge_uid, occurred_at DESC)`
- 批次流水：`inventory_events(batch_uid, occurred_at DESC)`
- 通知时间线：`notifications(fridge_uid, created_at DESC)`
- 设备阅读记录：`notification_reads(device_id, read_at DESC)`

## 10. `bootstrap_device` RPC

签名：

```sql
public.bootstrap_device(
  p_device_id text,
  p_fridge_name text default 'My Fridge'
) returns uuid
```

行为：

1. 校验并写入 `devices`；已存在则更新 `last_seen_at`。
2. 如果该设备已有有效冰箱，直接返回原 `fridge_uid`。
3. 否则创建个人冰箱。
4. 创建唯一 `fridge_members` 关系。
5. 创建七个默认分类。
6. 返回新冰箱的 UUID。

这是 `security definer` 函数，但已经撤销 `public`、`anon` 和 `authenticated` 的执行权限，只授予 `service_role`。它只能由 Express 调用。

Express 已通过以下 HTTP endpoint 调用它：

```text
POST /api/devices/bootstrap
Device-ID: ios_... | android_...
```

## 11. 种子数据

`supabase/seed.sql` 当前包含：

- 9 种食材：tomato、milk、egg、blueberry、rice、peas、soy sauce、yogurt、bread。
- 每种食材包含中英文别名、推荐储存方式、建议保质期和默认分类代码。
- 4 个成就：`first_item`、`waste_watcher`、`fridge_regular`、`shared_kitchen`。

Seed 使用 upsert，可重复运行。它不创建个人冰箱或默认分类；这些数据由 `bootstrap_device` 按冰箱创建。

## 12. 安全与权限

全部 13 张表都已经启用 RLS。

当前权限策略：

- `anon`：无业务表权限。
- `authenticated`：无业务表权限。
- `service_role`：拥有业务表权限。
- 没有给移动端可使用的角色创建 RLS policy，因为移动端不直连 Supabase。

后果：RLS 不会替 Express 自动隔离冰箱，因为 service role 绕过 RLS。每个 Express 业务接口都必须执行：

1. 读取并校验 `Device-ID` 请求头。
2. 通过 `fridge_members.device_id` 取得唯一有效 `fridge_uid`。
3. 所有查询和写入都限定为该 `fridge_uid`。
4. 检查请求中的 `category_uid`、`batch_uid`、`notification_uid` 等是否属于同一冰箱。
5. 不接受客户端自由提交并覆盖 `fridge_uid` 或 actor device 字段。

不要在日志、响应、代码或提交中输出 Supabase Secret Key。

## 13. 当前 Express 状态

`server/src/supabase.js`：

- 从 `SUPABASE_URL` 读取项目地址。
- 优先读取 `SUPABASE_SECRET_KEY`，兼容旧 `SUPABASE_SERVICE_ROLE_KEY`。
- 禁用 token 持久化和自动刷新。
- 只能被服务端模块导入。

`server/src/index.js` 已注册：

```text
GET /api/health
POST /api/devices/bootstrap
GET /api/inventory
GET /api/food-presets/suggestion?q=<food-name>
POST /api/inventory/batches
GET /api/inventory/batches/:batchUid
PATCH /api/inventory/batches/:batchUid/quantity
PATCH /api/inventory/batches/:batchUid
PUT /api/inventory/batches/:batchUid/restock-rule
DELETE /api/inventory/batches/:batchUid
```

该接口通过 Supabase Admin API 检查服务端连接，只返回：

```json
{ "status": "ok", "database": "connected" }
```

已实现：

- 设备 bootstrap：按 `Device-ID` 初始化并返回当前冰箱与默认分类。
- 库存读取：返回当前冰箱、分类、活跃批次与计算后的 `needsRestock`。
- 储藏建议：精确匹配 `food_presets.canonical_name` 或 `aliases`，返回建议储存方式、分类和保质期天数。
- 手动入库：数据库函数在一个事务中创建库存批次、`stock` 流水和可选补货规则。
- 批次详情：返回单个活跃批次、当前版本及匹配的补货规则。
- 数量调整：原子校验版本、更新数量/生命周期并写入 `consume` 或 `adjust` 流水。
- 资料编辑：原子校验版本并修改名称、储存方式、分类、价格和到期等批次字段。
- 补货规则：按当前冰箱、标准化名称和单位新增或更新规则，也可关闭规则。
- 移出冰箱：软归档批次并写入调整流水，保留历史数据。

尚未实现：

- 独立的“丢弃原因”流程与显式 `discard` 事件
- 分类管理
- 邀请码创建和冰箱合并
- 通知生成与独立已读
- 成就计算与查询

## 14. 建议的接口开发顺序

### 已完成：设备与冰箱上下文

```text
POST /api/devices/bootstrap
```

### 已完成：Fridge 页面读取与入库

```text
GET /api/inventory
POST /api/inventory/batches
```

库存查询应支持：

- `q`：名称模糊搜索
- `storage`：`chilled` / `frozen` / `pantry`
- `status`：`expired` / `expiring` / `restock`
- `categoryUid`

储存筛选和分类筛选必须允许叠加。

### 已完成：库存批次详情与修改

```text
GET    /api/inventory/batches/:batchUid
PATCH  /api/inventory/batches/:batchUid/quantity
PATCH  /api/inventory/batches/:batchUid
PUT    /api/inventory/batches/:batchUid/restock-rule
DELETE /api/inventory/batches/:batchUid
```

这些接口由 `20260830010000_inventory_detail_mutations.sql` 中的数据库函数保证数量更新与事件写入处于同一事务，并通过 `version` 做共享编辑冲突检测。前端详情弹窗调用 `src/services/inventoryApi.ts`，不得绕过 Express。

`20260830020000_fix_inventory_lifecycle_enum_cast.sql` 修复详情数量和资料 mutation 中 `lifecycle_state` 的枚举转换，必须在包含 `20260830010000` 的环境中继续应用。

### 阶段四：共享冰箱

```text
POST /api/fridges/invites
POST /api/fridges/join
```

加入共享冰箱必须在单一事务中完成：

1. 锁定来源和目标冰箱。
2. 按 `normalized_name` 合并分类映射。
3. 迁移批次、流水和补货规则到目标 `fridge_uid`。
4. 同名批次保持独立。
5. 更新成员关系和目标模式。
6. 旧通知失效并按合并后库存重新生成。
7. 重新计算冰箱成就。
8. 标记来源冰箱为 `merged`。

### 阶段五：通知与成就

```text
GET  /api/notifications
POST /api/notifications/:notificationUid/read
GET  /api/achievements
```

## 15. Migration 工作流

不要直接修改已经部署的 `20260829000000` migration。后续 schema 变化创建新的时间戳 migration。

常用命令：

```powershell
npx supabase migration new <change_name>
npx supabase db push --dry-run
npx supabase db push
npx supabase db lint --linked --level warning
npx supabase migration list
```

种子数据更新：

```powershell
npx supabase db push --include-seed
```

禁止对包含真实数据的远程项目执行 `supabase db reset --linked`，因为该命令会删除远程数据。

## 16. 新对话接手检查清单

新的开发对话开始处理数据端任务时，应按顺序确认：

1. 阅读本文档和当前 migration。
2. 查看 `git status`，保留组员未提交修改。
3. 查看 `server/src/index.js` 是否已经新增接口；本文档可能落后于代码。
4. 确认 `device_id` 仍为 text 格式。
5. 确认前端没有 Supabase client 或 key。
6. 所有业务访问都先由 Express 将设备解析到唯一 `fridge_uid`。
7. 所有库存修改同时写入 `inventory_events`。
8. 不把临期、过期保存成固定库存状态。
9. 通知事件按冰箱共享，已读状态按设备保存。
10. 成就按冰箱保存。
11. Schema 变化使用新 migration，并同步更新本文档。
