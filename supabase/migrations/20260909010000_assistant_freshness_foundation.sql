-- Arthur: NarIyirm
-- 中文：把系统品质估计与包装 use-by 硬期限拆开；旧 expires_at 保留兼容，历史值绝不自动升级成安全期限。
-- EN: Separate system quality estimates from hard package use-by deadlines; keep legacy expires_at without upgrading historical values into safety deadlines.

create table public.food_quality_profiles (
  profile_uid uuid primary key default extensions.gen_random_uuid(),
  preset_uid uuid not null references public.food_presets(preset_uid) on update cascade on delete cascade,
  storage_zone public.storage_zone not null,
  season text not null,
  shelf_life_days smallint not null,
  jurisdiction text not null default 'AU',
  source_class text not null default 'product_default',
  source_url text,
  profile_version integer not null default 1,
  is_reviewed boolean not null default false,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_quality_profiles_season_valid
    check (season in ('summer', 'autumn', 'winter', 'spring')),
  constraint food_quality_profiles_days_positive
    check (shelf_life_days between 1 and 3650),
  constraint food_quality_profiles_jurisdiction_valid
    check (jurisdiction ~ '^[A-Z]{2}$'),
  constraint food_quality_profiles_source_class_valid
    check (source_class in ('product_default', 'reviewed_reference')),
  constraint food_quality_profiles_source_url_valid
    check (source_url is null or source_url ~ '^https://'),
  constraint food_quality_profiles_version_positive
    check (profile_version > 0),
  constraint food_quality_profiles_identity_unique
    unique (preset_uid, storage_zone, season, jurisdiction, profile_version)
);

create unique index food_quality_profiles_enabled_unique
  on public.food_quality_profiles (preset_uid, storage_zone, season, jurisdiction)
  where is_enabled;

create index food_quality_profiles_lookup_idx
  on public.food_quality_profiles (preset_uid, storage_zone, jurisdiction, season)
  where is_enabled;

create trigger food_quality_profiles_set_updated_at
before update on public.food_quality_profiles
for each row execute function public.set_updated_at();

alter table public.inventory_batches
  add column use_by_at timestamptz,
  add column estimated_quality_until timestamptz,
  add column quality_profile_uid uuid references public.food_quality_profiles(profile_uid) on update cascade on delete set null,
  add column quality_estimate_version integer,
  add column quality_estimate_basis jsonb;

alter table public.inventory_batches
  add constraint inventory_batches_use_by_after_stocking
    check (use_by_at is null or use_by_at >= stocked_at),
  add constraint inventory_batches_quality_after_stocking
    check (estimated_quality_until is null or estimated_quality_until >= stocked_at),
  add constraint inventory_batches_quality_version_positive
    check (quality_estimate_version is null or quality_estimate_version > 0),
  add constraint inventory_batches_quality_basis_object
    check (quality_estimate_basis is null or jsonb_typeof(quality_estimate_basis) = 'object'),
  add constraint inventory_batches_quality_fields_consistent
    check (
      (estimated_quality_until is null and quality_profile_uid is null and quality_estimate_version is null and quality_estimate_basis is null)
      or
      (estimated_quality_until is not null and quality_estimate_version is not null and quality_estimate_basis is not null)
    );

create index inventory_batches_fridge_use_by_idx
  on public.inventory_batches (fridge_uid, use_by_at)
  where lifecycle_state = 'active' and use_by_at is not null;

create index inventory_batches_fridge_quality_idx
  on public.inventory_batches (fridge_uid, estimated_quality_until)
  where lifecycle_state = 'active' and estimated_quality_until is not null;

-- Arthur: NarIyirm
-- 中文：澳洲版按设备本地月份选择季节；优先读取已启用季节档案，没有档案时才使用旧 preset 静态天数并明确记录回退来源。
-- EN: The Australian release selects season by the device-local month, preferring an enabled seasonal profile and recording an explicit fallback to the legacy preset days.
create function public.resolve_food_quality_estimate(
  p_preset_uid uuid,
  p_storage_zone public.storage_zone,
  p_stocked_at timestamptz,
  p_time_zone text default 'Australia/Sydney'
)
returns table (
  estimated_quality_until timestamptz,
  quality_profile_uid uuid,
  quality_estimate_version integer,
  shelf_life_days smallint,
  season text,
  source_class text,
  resolved_time_zone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  local_month integer;
  local_season text;
  safe_time_zone text;
  selected_profile public.food_quality_profiles;
  fallback_days smallint;
begin
  if p_preset_uid is null or p_storage_zone is null or p_stocked_at is null then
    return;
  end if;

  select zone.name
  into safe_time_zone
  from pg_catalog.pg_timezone_names as zone
  where zone.name = nullif(btrim(p_time_zone), '')
  limit 1;

  safe_time_zone := coalesce(safe_time_zone, 'Australia/Sydney');
  local_month := extract(month from pg_catalog.timezone(safe_time_zone, p_stocked_at));
  local_season := case
    when local_month in (12, 1, 2) then 'summer'
    when local_month in (3, 4, 5) then 'autumn'
    when local_month in (6, 7, 8) then 'winter'
    else 'spring'
  end;

  select profile.*
  into selected_profile
  from public.food_quality_profiles as profile
  where profile.preset_uid = p_preset_uid
    and profile.storage_zone = p_storage_zone
    and profile.season = local_season
    and profile.jurisdiction = 'AU'
    and profile.is_enabled
  order by profile.profile_version desc
  limit 1;

  if selected_profile.profile_uid is not null then
    return query select
      ((pg_catalog.timezone(safe_time_zone, p_stocked_at)::date + selected_profile.shelf_life_days) + time '23:59:00') at time zone safe_time_zone,
      selected_profile.profile_uid,
      selected_profile.profile_version,
      selected_profile.shelf_life_days,
      local_season,
      selected_profile.source_class,
      safe_time_zone;
    return;
  end if;

  select preset.suggested_shelf_life_days::smallint
  into fallback_days
  from public.food_presets as preset
  where preset.preset_uid = p_preset_uid
    and preset.is_enabled;

  if fallback_days is null then
    return;
  end if;

  return query select
    ((pg_catalog.timezone(safe_time_zone, p_stocked_at)::date + fallback_days) + time '23:59:00') at time zone safe_time_zone,
    null::uuid,
    1,
    fallback_days,
    local_season,
    'static_preset_fallback'::text,
    safe_time_zone;
end;
$$;

-- Arthur: NarIyirm
-- 中文：新批次和影响估计的字段变化都在数据库写入边界自动重算；调用方不能把 Luna 输出直接保存成品质期限。
-- EN: New batches and estimate-affecting changes recalculate at the database boundary so callers cannot persist a Luna-produced quality deadline.
create function public.set_inventory_quality_estimate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  estimate record;
  estimate_time_zone text;
begin
  if new.preset_uid is null then
    new.estimated_quality_until := null;
    new.quality_profile_uid := null;
    new.quality_estimate_version := null;
    new.quality_estimate_basis := null;
    return new;
  end if;

  select profile.notification_time_zone
  into estimate_time_zone
  from public.device_profiles as profile
  where profile.device_id = coalesce(new.owner_device_id, new.created_by_device_id);

  estimate_time_zone := coalesce(estimate_time_zone, 'Australia/Sydney');

  select resolved.*
  into estimate
  from public.resolve_food_quality_estimate(
    new.preset_uid,
    new.storage_zone,
    new.stocked_at,
    estimate_time_zone
  ) as resolved;

  if estimate.estimated_quality_until is null then
    new.estimated_quality_until := null;
    new.quality_profile_uid := null;
    new.quality_estimate_version := null;
    new.quality_estimate_basis := null;
    return new;
  end if;

  new.estimated_quality_until := estimate.estimated_quality_until;
  new.quality_profile_uid := estimate.quality_profile_uid;
  new.quality_estimate_version := estimate.quality_estimate_version;
  new.quality_estimate_basis := pg_catalog.jsonb_build_object(
    'season', estimate.season,
    'shelfLifeDays', estimate.shelf_life_days,
    'sourceClass', estimate.source_class,
    'timeZone', estimate.resolved_time_zone,
    'storageZone', new.storage_zone,
    'calculatedFrom', 'stocked_at'
  );
  return new;
end;
$$;

create trigger inventory_batches_set_quality_estimate
before insert or update of preset_uid, storage_zone, stocked_at, owner_device_id
on public.inventory_batches
for each row execute function public.set_inventory_quality_estimate();

-- Arthur: NarIyirm
-- 中文：首版牛奶季节档案采用产品确认的夏 5 天、冬 7 天，春秋 6 天作为待来源复核的插值；它只描述品质，不构成安全期限。
-- EN: The initial milk profile uses the approved 5-day summer and 7-day winter values, with a review-pending 6-day spring/autumn interpolation; it describes quality, not safety.
insert into public.food_quality_profiles (
  preset_uid,
  storage_zone,
  season,
  shelf_life_days,
  jurisdiction,
  source_class,
  profile_version,
  is_reviewed,
  is_enabled
)
select
  preset.preset_uid,
  'chilled'::public.storage_zone,
  season_values.season,
  season_values.shelf_life_days,
  'AU',
  'product_default',
  1,
  false,
  true
from public.food_presets as preset
cross join (
  values
    ('summer'::text, 5::smallint),
    ('autumn'::text, 6::smallint),
    ('winter'::text, 7::smallint),
    ('spring'::text, 6::smallint)
) as season_values(season, shelf_life_days)
where preset.normalized_name = 'milk'
on conflict (preset_uid, storage_zone, season, jurisdiction, profile_version)
do update set
  shelf_life_days = excluded.shelf_life_days,
  source_class = excluded.source_class,
  is_reviewed = excluded.is_reviewed,
  is_enabled = excluded.is_enabled,
  updated_at = now();

alter table public.food_quality_profiles enable row level security;

revoke all on table public.food_quality_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.food_quality_profiles to service_role;

revoke execute on function public.resolve_food_quality_estimate(uuid, public.storage_zone, timestamptz, text) from public, anon, authenticated;
grant execute on function public.resolve_food_quality_estimate(uuid, public.storage_zone, timestamptz, text) to service_role;

revoke execute on function public.set_inventory_quality_estimate() from public, anon, authenticated;

comment on table public.food_quality_profiles is
  'Versioned seasonal best-quality reference data. Values are product guidance and never hard food-safety deadlines.';
comment on column public.inventory_batches.use_by_at is
  'Verified hard package or trusted-source deadline; once passed, the batch must be discarded and never recommended for consumption.';
comment on column public.inventory_batches.estimated_quality_until is
  'System-calculated, non-user-editable quality window derived from versioned food and storage rules; not a food-safety guarantee.';
comment on column public.inventory_batches.quality_estimate_basis is
  'Audit snapshot of deterministic inputs used to produce estimated_quality_until; contains no model reasoning or secrets.';
