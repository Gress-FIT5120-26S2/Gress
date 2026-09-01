-- Arthur: NarIyirm
-- 中文：为全局食材预设补充可缓存图标、来源与生成审计字段，并让新库存批次保存命中的 preset_uid。
-- EN: Add cacheable icons, provenance, and generation audit fields to global food presets, and persist the matched preset_uid on new inventory batches.

alter table public.food_presets
  add column icon_path text,
  add column icon_emoji text not null default '📦',
  add column icon_source text not null default 'emoji',
  add column source_type text not null default 'curated',
  add column generation_model text,
  add column generation_prompt_version integer,
  add constraint food_presets_icon_source_valid
    check (icon_source in ('emoji', 'ai_generated', 'open_data')),
  add constraint food_presets_source_type_valid
    check (source_type in ('curated', 'seed', 'ai', 'open_data')),
  add constraint food_presets_icon_path_not_blank
    check (icon_path is null or char_length(btrim(icon_path)) > 0),
  add constraint food_presets_icon_emoji_not_blank
    check (char_length(btrim(icon_emoji)) > 0),
  add constraint food_presets_generation_prompt_version_positive
    check (generation_prompt_version is null or generation_prompt_version > 0);

update public.food_presets
set
  source_type = 'seed',
  icon_emoji = case canonical_name
    when 'tomato' then '🍅'
    when 'banana' then '🍌'
    when 'bittermelon' then '🥒'
    when 'cucumber' then '🥒'
    when 'eggplant' then '🍆'
    when 'orange' then '🍊'
    when 'papaya' then '🥭'
    when 'pineapple' then '🍍'
    when 'milk' then '🥛'
    when 'egg' then '🥚'
    when 'blueberry' then '🫐'
    when 'rice' then '🍚'
    when 'peas' then '🫛'
    when 'soy sauce' then '🫙'
    when 'yogurt' then '🥣'
    when 'bread' then '🍞'
    else icon_emoji
  end
where canonical_name in (
  'tomato', 'banana', 'bittermelon', 'cucumber', 'eggplant', 'orange', 'papaya',
  'pineapple', 'milk', 'egg', 'blueberry', 'rice', 'peas', 'soy sauce', 'yogurt', 'bread'
);

-- Arthur: NarIyirm
-- 中文：只回填能通过标准名或别名唯一确定的历史批次；存在歧义的名称继续保留 null，避免错误关联。
-- EN: Backfill only historical batches with one unambiguous canonical-name or alias match; ambiguous names remain null rather than gaining a false link.
with unique_matches as (
  select
    batch.batch_uid,
    min(preset.preset_uid::text)::uuid as preset_uid
  from public.inventory_batches as batch
  join public.food_presets as preset
    on preset.is_enabled
    and (
      preset.normalized_name = batch.normalized_name
      or exists (
        select 1
        from unnest(preset.aliases) as preset_alias
        where lower(btrim(preset_alias)) = batch.normalized_name
      )
    )
  where batch.preset_uid is null
  group by batch.batch_uid
  having count(*) = 1
)
update public.inventory_batches as batch
set preset_uid = unique_matches.preset_uid
from unique_matches
where batch.batch_uid = unique_matches.batch_uid;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-preset-icons', 'food-preset-icons', true, 1048576, array['image/png'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Arthur: NarIyirm
-- 中文：AI 返回标准名和别名后在数据库事务中串行复查，避免并发请求为同一种食材创建多个预设和不同图标。
-- EN: Recheck AI canonical names and aliases serially in one transaction so concurrent requests cannot create duplicate presets and inconsistent icons.
create or replace function public.save_generated_food_preset(
  p_input_name text,
  p_canonical_name text,
  p_aliases text[],
  p_storage_zone public.storage_zone,
  p_shelf_life_days integer,
  p_category_code text,
  p_notes text,
  p_icon_emoji text,
  p_generation_model text
)
returns public.food_presets
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_names text[];
  matched_preset public.food_presets;
begin
  if p_input_name is null or char_length(btrim(p_input_name)) = 0
    or p_canonical_name is null or char_length(btrim(p_canonical_name)) = 0 then
    raise exception 'Input and canonical food names are required';
  end if;

  if p_shelf_life_days is null or p_shelf_life_days < 1 or p_shelf_life_days > 3650 then
    raise exception 'Shelf life must be between 1 and 3650 days';
  end if;

  if p_category_code not in ('meat', 'vegetables', 'fruit', 'staples', 'condiments', 'drinks', 'other') then
    raise exception 'Unknown category code';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(5120, 20260902);

  select array_agg(distinct lower(btrim(candidate)))
  into candidate_names
  from unnest(
    array[btrim(p_input_name), btrim(p_canonical_name)]
    || coalesce(p_aliases, '{}'::text[])
  ) as candidate
  where candidate is not null and char_length(btrim(candidate)) > 0;

  select preset.*
  into matched_preset
  from public.food_presets as preset
  where preset.is_enabled
    and (
      preset.normalized_name = any(candidate_names)
      or exists (
        select 1
        from unnest(preset.aliases) as existing_alias
        where lower(btrim(existing_alias)) = any(candidate_names)
      )
    )
  order by
    case preset.source_type when 'curated' then 0 when 'seed' then 1 when 'open_data' then 2 else 3 end,
    preset.created_at
  limit 1;

  if matched_preset.preset_uid is not null then
    return matched_preset;
  end if;

  insert into public.food_presets (
    canonical_name,
    aliases,
    suggested_storage_zone,
    suggested_shelf_life_days,
    suggested_category_code,
    notes,
    icon_emoji,
    icon_source,
    source_type,
    generation_model,
    generation_prompt_version
  )
  values (
    btrim(p_canonical_name),
    array(
      select distinct btrim(alias_name)
      from unnest(array[btrim(p_input_name)] || coalesce(p_aliases, '{}'::text[])) as alias_name
      where alias_name is not null
        and char_length(btrim(alias_name)) > 0
        and lower(btrim(alias_name)) <> lower(btrim(p_canonical_name))
    ),
    p_storage_zone,
    p_shelf_life_days,
    p_category_code,
    nullif(btrim(p_notes), ''),
    coalesce(nullif(btrim(p_icon_emoji), ''), '📦'),
    'emoji',
    'ai',
    nullif(btrim(p_generation_model), ''),
    1
  )
  returning * into matched_preset;

  return matched_preset;
end;
$$;

revoke execute on function public.save_generated_food_preset(
  text, text, text[], public.storage_zone, integer, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.save_generated_food_preset(
  text, text, text[], public.storage_zone, integer, text, text, text, text
) to service_role;

drop function public.create_inventory_batch(
  text, text, text, public.storage_zone, numeric, text, numeric, char(3), timestamptz, boolean, numeric, numeric
);

-- Arthur: NarIyirm
-- 中文：创建批次时验证可选 preset_uid，并在同一原子事务中把它写入库存；历史批次仍允许保持 null。
-- EN: Validate an optional preset_uid and store it in the same atomic batch transaction; historical batches may remain null.
create function public.create_inventory_batch(
  p_device_id text,
  p_category_code text,
  p_name text,
  p_storage_zone public.storage_zone,
  p_initial_quantity numeric,
  p_unit text,
  p_purchase_price numeric default null,
  p_currency char(3) default 'AUD',
  p_expires_at timestamptz default null,
  p_restock_enabled boolean default false,
  p_restock_minimum_quantity numeric default null,
  p_restock_target_quantity numeric default null,
  p_preset_uid uuid default null
)
returns public.inventory_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_fridge_uid uuid;
  current_category_uid uuid;
  created_batch public.inventory_batches;
begin
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'A food name is required';
  end if;

  if p_initial_quantity is null or p_initial_quantity <= 0 then
    raise exception 'Initial quantity must be greater than zero';
  end if;

  if p_unit is null or char_length(btrim(p_unit)) = 0 then
    raise exception 'A unit is required';
  end if;

  if p_purchase_price is not null and p_purchase_price < 0 then
    raise exception 'Purchase price cannot be negative';
  end if;

  if p_expires_at is not null and p_expires_at < now() then
    raise exception 'Expiry time must be in the future';
  end if;

  if p_restock_enabled and (
    p_restock_minimum_quantity is null
    or p_restock_target_quantity is null
    or p_restock_minimum_quantity < 0
    or p_restock_target_quantity <= p_restock_minimum_quantity
  ) then
    raise exception 'Restock target must be higher than the minimum quantity';
  end if;

  if p_preset_uid is not null and not exists (
    select 1
    from public.food_presets as preset
    where preset.preset_uid = p_preset_uid and preset.is_enabled
  ) then
    raise exception 'Unknown or disabled food preset';
  end if;

  current_fridge_uid := public.bootstrap_device(p_device_id);

  select category.category_uid
  into current_category_uid
  from public.food_categories as category
  where category.fridge_uid = current_fridge_uid
    and category.system_code = p_category_code;

  if current_category_uid is null then
    raise exception 'Unknown category code';
  end if;

  insert into public.inventory_batches (
    fridge_uid,
    category_uid,
    created_by_device_id,
    preset_uid,
    name,
    storage_zone,
    initial_quantity,
    remaining_quantity,
    unit,
    purchase_price,
    currency,
    expires_at
  )
  values (
    current_fridge_uid,
    current_category_uid,
    btrim(p_device_id),
    p_preset_uid,
    btrim(p_name),
    p_storage_zone,
    p_initial_quantity,
    p_initial_quantity,
    btrim(p_unit),
    p_purchase_price,
    coalesce(p_currency, 'AUD'),
    p_expires_at
  )
  returning * into created_batch;

  insert into public.inventory_events (
    fridge_uid,
    batch_uid,
    actor_device_id,
    event_type,
    quantity_change,
    value_change,
    note
  )
  values (
    current_fridge_uid,
    created_batch.batch_uid,
    btrim(p_device_id),
    'stock',
    p_initial_quantity,
    0,
    'Created by inventory entry'
  );

  if p_restock_enabled then
    insert into public.restock_rules (
      fridge_uid,
      preset_uid,
      normalized_item_name,
      minimum_quantity,
      target_quantity,
      unit,
      is_enabled
    )
    values (
      current_fridge_uid,
      null,
      lower(btrim(p_name)),
      p_restock_minimum_quantity,
      p_restock_target_quantity,
      btrim(p_unit),
      true
    )
    on conflict (fridge_uid, normalized_item_name, unit) where preset_uid is null
    do update set
      minimum_quantity = excluded.minimum_quantity,
      target_quantity = excluded.target_quantity,
      is_enabled = true,
      updated_at = now();
  end if;

  return created_batch;
end;
$$;

revoke execute on function public.create_inventory_batch(
  text, text, text, public.storage_zone, numeric, text, numeric, char(3), timestamptz, boolean, numeric, numeric, uuid
) from public, anon, authenticated;

grant execute on function public.create_inventory_batch(
  text, text, text, public.storage_zone, numeric, text, numeric, char(3), timestamptz, boolean, numeric, numeric, uuid
) to service_role;
