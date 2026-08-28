create extension if not exists pgcrypto with schema extensions;

create type public.fridge_mode as enum ('personal', 'shared');
create type public.fridge_status as enum ('active', 'merged');
create type public.invite_status as enum ('active', 'used', 'revoked', 'expired');
create type public.storage_zone as enum ('chilled', 'frozen', 'pantry');
create type public.inventory_lifecycle as enum ('active', 'consumed', 'discarded', 'archived');
create type public.inventory_event_type as enum ('stock', 'consume', 'discard', 'adjust', 'merge');
create type public.notification_type as enum ('expiring', 'expired', 'restock', 'system');

create table public.devices (
  device_id text primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint devices_device_id_length check (char_length(device_id) between 3 and 200)
);

create table public.fridges (
  fridge_uid uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  mode public.fridge_mode not null default 'personal',
  created_by_device_id text not null references public.devices(device_id) on update cascade,
  status public.fridge_status not null default 'active',
  merged_into_fridge_uid uuid references public.fridges(fridge_uid) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fridges_name_not_blank check (char_length(btrim(name)) > 0),
  constraint fridges_merge_target_is_different check (merged_into_fridge_uid is null or merged_into_fridge_uid <> fridge_uid),
  constraint fridges_merge_state_consistent check (
    (status = 'active' and merged_into_fridge_uid is null)
    or (status = 'merged' and merged_into_fridge_uid is not null)
  )
);

create table public.fridge_members (
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  device_id text not null references public.devices(device_id) on update cascade on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (fridge_uid, device_id),
  constraint fridge_members_one_fridge_per_device unique (device_id)
);

create table public.fridge_invites (
  invite_uid uuid primary key default extensions.gen_random_uuid(),
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  code text not null unique,
  created_by_device_id text not null references public.devices(device_id) on update cascade,
  expires_at timestamptz,
  used_at timestamptz,
  status public.invite_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint fridge_invites_code_not_blank check (char_length(btrim(code)) between 6 and 64),
  constraint fridge_invites_expiry_after_creation check (expires_at is null or expires_at > created_at),
  constraint fridge_invites_used_state_consistent check (
    (status = 'used' and used_at is not null)
    or (status <> 'used')
  )
);

create table public.food_categories (
  category_uid uuid primary key default extensions.gen_random_uuid(),
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  system_code text,
  colour text,
  icon text,
  is_default boolean not null default false,
  created_by_device_id text not null references public.devices(device_id) on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_categories_name_not_blank check (char_length(btrim(name)) > 0),
  constraint food_categories_system_code_format check (system_code is null or system_code ~ '^[a-z][a-z0-9_]*$'),
  constraint food_categories_fridge_name_unique unique (fridge_uid, normalized_name),
  constraint food_categories_fridge_system_code_unique unique (fridge_uid, system_code),
  constraint food_categories_uid_fridge_unique unique (category_uid, fridge_uid)
);

create table public.food_presets (
  preset_uid uuid primary key default extensions.gen_random_uuid(),
  canonical_name text not null unique,
  normalized_name text generated always as (lower(btrim(canonical_name))) stored unique,
  aliases text[] not null default '{}',
  suggested_storage_zone public.storage_zone not null,
  suggested_shelf_life_days integer not null,
  suggested_category_code text,
  notes text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_presets_name_not_blank check (char_length(btrim(canonical_name)) > 0),
  constraint food_presets_shelf_life_positive check (suggested_shelf_life_days > 0),
  constraint food_presets_category_code_format check (
    suggested_category_code is null or suggested_category_code ~ '^[a-z][a-z0-9_]*$'
  )
);

create table public.inventory_batches (
  batch_uid uuid primary key default extensions.gen_random_uuid(),
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete restrict,
  category_uid uuid not null,
  created_by_device_id text not null references public.devices(device_id) on update cascade,
  preset_uid uuid references public.food_presets(preset_uid) on update cascade on delete set null,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  storage_zone public.storage_zone not null,
  initial_quantity numeric(12, 3) not null,
  remaining_quantity numeric(12, 3) not null,
  unit text not null,
  purchase_price numeric(12, 2),
  currency char(3) not null default 'AUD',
  stocked_at timestamptz not null default now(),
  expires_at timestamptz,
  opened_at timestamptz,
  lifecycle_state public.inventory_lifecycle not null default 'active',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_batches_category_same_fridge
    foreign key (category_uid, fridge_uid)
    references public.food_categories(category_uid, fridge_uid)
    on update cascade on delete restrict,
  constraint inventory_batches_name_not_blank check (char_length(btrim(name)) > 0),
  constraint inventory_batches_unit_not_blank check (char_length(btrim(unit)) > 0),
  constraint inventory_batches_initial_quantity_positive check (initial_quantity > 0),
  constraint inventory_batches_remaining_quantity_valid check (
    remaining_quantity >= 0 and remaining_quantity <= initial_quantity
  ),
  constraint inventory_batches_price_non_negative check (purchase_price is null or purchase_price >= 0),
  constraint inventory_batches_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint inventory_batches_expiry_after_stocking check (expires_at is null or expires_at >= stocked_at),
  constraint inventory_batches_opened_after_stocking check (opened_at is null or opened_at >= stocked_at),
  constraint inventory_batches_version_positive check (version > 0),
  constraint inventory_batches_uid_fridge_unique unique (batch_uid, fridge_uid)
);

create table public.inventory_events (
  event_uid uuid primary key default extensions.gen_random_uuid(),
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete restrict,
  batch_uid uuid not null,
  actor_device_id text not null references public.devices(device_id) on update cascade,
  event_type public.inventory_event_type not null,
  quantity_change numeric(12, 3) not null,
  value_change numeric(12, 2) not null default 0,
  occurred_at timestamptz not null default now(),
  note text,
  constraint inventory_events_batch_same_fridge
    foreign key (batch_uid, fridge_uid)
    references public.inventory_batches(batch_uid, fridge_uid)
    on update cascade on delete restrict
);

create table public.restock_rules (
  rule_uid uuid primary key default extensions.gen_random_uuid(),
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  preset_uid uuid references public.food_presets(preset_uid) on update cascade on delete set null,
  normalized_item_name text not null,
  minimum_quantity numeric(12, 3) not null,
  target_quantity numeric(12, 3) not null,
  unit text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restock_rules_name_not_blank check (char_length(btrim(normalized_item_name)) > 0),
  constraint restock_rules_unit_not_blank check (char_length(btrim(unit)) > 0),
  constraint restock_rules_minimum_non_negative check (minimum_quantity >= 0),
  constraint restock_rules_target_above_minimum check (target_quantity > minimum_quantity)
);

create table public.notifications (
  notification_uid uuid primary key default extensions.gen_random_uuid(),
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  related_batch_uid uuid,
  notification_type public.notification_type not null,
  message_key text not null,
  message_payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint notifications_related_batch_same_fridge
    foreign key (related_batch_uid, fridge_uid)
    references public.inventory_batches(batch_uid, fridge_uid)
    on update cascade on delete cascade,
  constraint notifications_message_key_not_blank check (char_length(btrim(message_key)) > 0),
  constraint notifications_dedupe_key_not_blank check (char_length(btrim(dedupe_key)) > 0),
  constraint notifications_expiry_after_creation check (expires_at is null or expires_at > created_at)
);

create table public.notification_reads (
  notification_uid uuid not null references public.notifications(notification_uid) on update cascade on delete cascade,
  device_id text not null references public.devices(device_id) on update cascade on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_uid, device_id)
);

create table public.achievements (
  achievement_uid uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  title_key text not null,
  description_key text not null,
  rule_type text not null,
  threshold numeric,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint achievements_code_format check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint achievements_threshold_non_negative check (threshold is null or threshold >= 0)
);

create table public.fridge_achievements (
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  achievement_uid uuid not null references public.achievements(achievement_uid) on update cascade on delete cascade,
  unlocked_at timestamptz not null default now(),
  metric_value numeric,
  primary key (fridge_uid, achievement_uid)
);

create unique index restock_rules_with_preset_unique
  on public.restock_rules (fridge_uid, preset_uid, unit)
  where preset_uid is not null;

create unique index restock_rules_without_preset_unique
  on public.restock_rules (fridge_uid, normalized_item_name, unit)
  where preset_uid is null;

create index fridge_invites_active_code_idx
  on public.fridge_invites (code)
  where status = 'active';

create index food_categories_fridge_idx on public.food_categories (fridge_uid);
create index food_presets_aliases_idx on public.food_presets using gin (aliases);
create index inventory_batches_fridge_active_idx
  on public.inventory_batches (fridge_uid, storage_zone, category_uid)
  where lifecycle_state = 'active';
create index inventory_batches_fridge_expiry_idx
  on public.inventory_batches (fridge_uid, expires_at)
  where lifecycle_state = 'active' and expires_at is not null;
create index inventory_batches_fridge_name_idx
  on public.inventory_batches (fridge_uid, normalized_name)
  where lifecycle_state = 'active';
create index inventory_events_fridge_time_idx
  on public.inventory_events (fridge_uid, occurred_at desc);
create index inventory_events_batch_time_idx
  on public.inventory_events (batch_uid, occurred_at desc);
create index notifications_fridge_time_idx
  on public.notifications (fridge_uid, created_at desc);
create index notification_reads_device_idx
  on public.notification_reads (device_id, read_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fridges_set_updated_at
before update on public.fridges
for each row execute function public.set_updated_at();

create trigger food_categories_set_updated_at
before update on public.food_categories
for each row execute function public.set_updated_at();

create trigger food_presets_set_updated_at
before update on public.food_presets
for each row execute function public.set_updated_at();

create trigger inventory_batches_set_updated_at
before update on public.inventory_batches
for each row execute function public.set_updated_at();

create trigger restock_rules_set_updated_at
before update on public.restock_rules
for each row execute function public.set_updated_at();

create trigger achievements_set_updated_at
before update on public.achievements
for each row execute function public.set_updated_at();

-- Arthur: NarIyirm
-- 中文：首次出现的设备会在一个事务内获得个人冰箱、成员关系和前端使用的七个稳定分类键。
-- EN: A first-seen device receives its personal fridge, membership, and seven stable frontend category keys in one transaction.
create or replace function public.bootstrap_device(
  p_device_id text,
  p_fridge_name text default 'My Fridge'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
begin
  if p_device_id is null or char_length(btrim(p_device_id)) < 3 then
    raise exception 'A valid device_id is required';
  end if;

  insert into public.devices (device_id)
  values (btrim(p_device_id))
  on conflict (device_id) do update
    set last_seen_at = now();

  select member.fridge_uid
  into current_fridge_uid
  from public.fridge_members as member
  join public.fridges as fridge on fridge.fridge_uid = member.fridge_uid
  where member.device_id = btrim(p_device_id)
    and fridge.status = 'active';

  if current_fridge_uid is not null then
    return current_fridge_uid;
  end if;

  insert into public.fridges (name, created_by_device_id)
  values (coalesce(nullif(btrim(p_fridge_name), ''), 'My Fridge'), btrim(p_device_id))
  returning fridge_uid into current_fridge_uid;

  insert into public.fridge_members (fridge_uid, device_id)
  values (current_fridge_uid, btrim(p_device_id));

  insert into public.food_categories (
    fridge_uid,
    name,
    system_code,
    colour,
    icon,
    is_default,
    created_by_device_id
  )
  values
    (current_fridge_uid, 'Meat & eggs', 'meat', '#D94B51', 'food-drumstick-outline', true, btrim(p_device_id)),
    (current_fridge_uid, 'Vegetables', 'vegetables', '#32915C', 'leaf-outline', true, btrim(p_device_id)),
    (current_fridge_uid, 'Fruit', 'fruit', '#D94C8B', 'food-apple-outline', true, btrim(p_device_id)),
    (current_fridge_uid, 'Staples', 'staples', '#A8732D', 'silverware-fork-knife', true, btrim(p_device_id)),
    (current_fridge_uid, 'Condiments', 'condiments', '#D46A1C', 'flask-outline', true, btrim(p_device_id)),
    (current_fridge_uid, 'Drinks', 'drinks', '#148AA0', 'cup-outline', true, btrim(p_device_id)),
    (current_fridge_uid, 'Other', 'other', '#697784', 'dots-grid', true, btrim(p_device_id));

  return current_fridge_uid;
end;
$$;

comment on table public.devices is 'Anonymous application installation identifiers; not user accounts.';
comment on table public.fridges is 'Top-level ownership boundary for personal and shared fridge data.';
comment on table public.fridge_members is 'Maps each device to exactly one active fridge.';
comment on table public.inventory_batches is 'One row per stocking action; same-name stock remains in separate batches.';
comment on column public.inventory_batches.created_by_device_id is 'Audit actor only; shared inventory ownership remains fridge_uid.';
comment on table public.notification_reads is 'Independent notification read state for each member device.';
comment on table public.fridge_achievements is 'Achievements unlocked by the fridge and visible to every member.';

alter table public.devices enable row level security;
alter table public.fridges enable row level security;
alter table public.fridge_members enable row level security;
alter table public.fridge_invites enable row level security;
alter table public.food_categories enable row level security;
alter table public.food_presets enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.inventory_events enable row level security;
alter table public.restock_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.achievements enable row level security;
alter table public.fridge_achievements enable row level security;

-- Arthur: NarIyirm
-- 中文：移动端不直连数据库；移除 Data API 的匿名/登录角色权限，只允许 Express 的 service_role 调用。
-- EN: The mobile app never connects directly; remove Data API client grants and allow only Express service_role access.
revoke all on table
  public.devices,
  public.fridges,
  public.fridge_members,
  public.fridge_invites,
  public.food_categories,
  public.food_presets,
  public.inventory_batches,
  public.inventory_events,
  public.restock_rules,
  public.notifications,
  public.notification_reads,
  public.achievements,
  public.fridge_achievements
from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.bootstrap_device(text, text) from public, anon, authenticated;

grant usage on schema public to service_role;
grant all on table
  public.devices,
  public.fridges,
  public.fridge_members,
  public.fridge_invites,
  public.food_categories,
  public.food_presets,
  public.inventory_batches,
  public.inventory_events,
  public.restock_rules,
  public.notifications,
  public.notification_reads,
  public.achievements,
  public.fridge_achievements
to service_role;
grant execute on function public.bootstrap_device(text, text) to service_role;
