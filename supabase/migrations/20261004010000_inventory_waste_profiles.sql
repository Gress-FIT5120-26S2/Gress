-- Arthur: NarIyirm
-- 中文：包装归属于每次入库批次；使用流水保存快照，后续编辑不能改变历史题目。
-- EN: Packaging belongs to a stocked batch; consume events snapshot it so later edits cannot rewrite past lessons.
alter table public.inventory_batches add column waste_profile jsonb;
alter table public.inventory_events add column waste_profile_snapshot jsonb;
alter table public.inventory_events add column waste_remaining_snapshot numeric;
alter table public.inventory_events add column waste_initial_snapshot numeric;
alter table public.inventory_events add column waste_unit_snapshot text;

create function public.valid_waste_profile(p_profile jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare component jsonb;
begin
  if p_profile is null then return true; end if;
  if jsonb_typeof(p_profile) <> 'array' or jsonb_array_length(p_profile) > 4 then return false; end if;
  for component in select value from jsonb_array_elements(p_profile) loop
    if jsonb_typeof(component) <> 'object'
      or coalesce(component->>'material', '') not in ('eggshell','organic_residue','aluminium_can','plastic_bottle','glass_container','paper_cardboard','rigid_plastic','soft_plastic','carton','other','unknown')
      or coalesce(component->>'trigger', '') not in ('per_unit','when_empty') then return false; end if;
  end loop;
  return true;
end;
$$;
alter table public.inventory_batches add constraint inventory_waste_profile_valid check (public.valid_waste_profile(waste_profile));
revoke execute on function public.valid_waste_profile(jsonb) from public, anon, authenticated;
grant execute on function public.valid_waste_profile(jsonb) to service_role;

create table public.waste_material_assets (
  material_code text primary key,
  icon_path text,
  generation_state text not null default 'missing' check (generation_state in ('missing','generating','ready')),
  generation_token uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.waste_material_assets (material_code) values
  ('eggshell'),('organic_residue'),('aluminium_can'),('plastic_bottle'),('glass_container'),
  ('paper_cardboard'),('rigid_plastic'),('soft_plastic'),('carton'),('other'),('unknown');
create table public.product_waste_suggestions (
  suggestion_key text primary key,
  profile jsonb not null check (public.valid_waste_profile(profile)),
  needs_confirmation boolean not null,
  model text not null,
  created_at timestamptz not null default now()
);
alter table public.waste_material_assets enable row level security;
alter table public.product_waste_suggestions enable row level security;
revoke all on public.waste_material_assets, public.product_waste_suggestions from anon, authenticated;
grant all on public.waste_material_assets, public.product_waste_suggestions to service_role;

-- Arthur: NarIyirm
-- 中文：数据库租约保证不同产品或并发设备不会为同一材质重复生成图标，超时后可安全重试。
-- EN: A database lease prevents concurrent products or devices generating the same material icon twice and permits timeout recovery.
create function public.claim_waste_material_icon(p_material text, p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.waste_material_assets set generation_state='generating', generation_token=p_token,
    lease_until=now()+interval '2 minutes', updated_at=now()
  where material_code=p_material and icon_path is null and (lease_until is null or lease_until<now());
  return found;
end;
$$;
revoke execute on function public.claim_waste_material_icon(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_waste_material_icon(text, uuid) to service_role;

create function public.snapshot_inventory_waste() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type='consume' then
    select waste_profile, remaining_quantity, initial_quantity, unit
      into new.waste_profile_snapshot, new.waste_remaining_snapshot, new.waste_initial_snapshot, new.waste_unit_snapshot
      from public.inventory_batches where batch_uid=new.batch_uid and fridge_uid=new.fridge_uid;
  end if;
  return new;
end;
$$;
create trigger inventory_events_waste_snapshot before insert on public.inventory_events
for each row execute function public.snapshot_inventory_waste();
revoke execute on function public.snapshot_inventory_waste() from public, anon, authenticated;

create function public.create_inventory_batch_v3(
  p_device_id text, p_category_code text, p_name text, p_storage_zone public.storage_zone,
  p_initial_quantity numeric, p_unit text, p_purchase_price numeric, p_price_source text,
  p_deadline_type text, p_deadline_at timestamptz, p_expiry_warning_days smallint,
  p_restock_enabled boolean, p_restock_minimum_quantity numeric, p_restock_target_quantity numeric,
  p_preset_uid uuid, p_waste_profile jsonb
) returns public.inventory_batches language plpgsql security definer set search_path = '' as $$
declare created public.inventory_batches;
begin
  select * into created from public.create_inventory_batch_v2(p_device_id,p_category_code,p_name,p_storage_zone,
    p_initial_quantity,p_unit,p_purchase_price,p_price_source,p_deadline_type,p_deadline_at,p_expiry_warning_days,
    p_restock_enabled,p_restock_minimum_quantity,p_restock_target_quantity,p_preset_uid);
  update public.inventory_batches set waste_profile=p_waste_profile where batch_uid=created.batch_uid returning * into created;
  return created;
end;
$$;
revoke execute on function public.create_inventory_batch_v3(text,text,text,public.storage_zone,numeric,text,numeric,text,text,timestamptz,smallint,boolean,numeric,numeric,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.create_inventory_batch_v3(text,text,text,public.storage_zone,numeric,text,numeric,text,text,timestamptz,smallint,boolean,numeric,numeric,uuid,jsonb) to service_role;

create function public.update_inventory_batch_details_v3(
  p_device_id text, p_batch_uid uuid, p_expected_version integer, p_category_code text, p_name text,
  p_storage_zone public.storage_zone, p_remaining_quantity numeric, p_unit text, p_purchase_price numeric,
  p_price_source text, p_deadline_type text, p_deadline_at timestamptz, p_expiry_warning_days smallint,
  p_waste_profile jsonb
) returns public.inventory_batches language plpgsql security definer set search_path = '' as $$
declare updated public.inventory_batches;
begin
  select * into updated from public.update_inventory_batch_details_v2(p_device_id,p_batch_uid,p_expected_version,
    p_category_code,p_name,p_storage_zone,p_remaining_quantity,p_unit,p_purchase_price,p_price_source,
    p_deadline_type,p_deadline_at,p_expiry_warning_days);
  update public.inventory_batches set waste_profile=p_waste_profile where batch_uid=updated.batch_uid returning * into updated;
  return updated;
end;
$$;
revoke execute on function public.update_inventory_batch_details_v3(text,uuid,integer,text,text,public.storage_zone,numeric,text,numeric,text,text,timestamptz,smallint,jsonb) from public, anon, authenticated;
grant execute on function public.update_inventory_batch_details_v3(text,uuid,integer,text,text,public.storage_zone,numeric,text,numeric,text,text,timestamptz,smallint,jsonb) to service_role;

-- Arthur: NarIyirm
-- 中文：多部件产品分别记录学习答案，仍以事件与部件键保证每题仅记录一次。
-- EN: Multi-component products record separate lessons while the event/component key keeps each answer idempotent.
alter table public.waste_sorting_attempts add column component_key text not null default 'legacy';
alter table public.waste_sorting_attempts drop constraint waste_sorting_attempts_one_answer_per_event;
alter table public.waste_sorting_attempts add constraint waste_sorting_attempts_one_answer_per_component unique(event_uid,component_key);
