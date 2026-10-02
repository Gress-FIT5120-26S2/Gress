-- Arthur: NarIyirm
-- 中文：分类答题与已发生的使用流水关联，冰箱成员共享学习进度，但答题不表示实际投放或产生金钱收益。
-- EN: Link sorting answers to real consume events and share learning progress within the fridge without claiming disposal or financial savings.

alter table public.inventory_events
  add constraint inventory_events_uid_fridge_unique unique (event_uid, fridge_uid);

create table public.waste_sorting_attempts (
  attempt_uid uuid primary key default extensions.gen_random_uuid(),
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete restrict,
  event_uid uuid not null,
  actor_device_id text not null references public.devices(device_id) on update cascade,
  question_code text not null,
  selected_stream text not null check (selected_stream in ('recycling', 'organics', 'general')),
  correct_stream text not null check (correct_stream in ('recycling', 'organics', 'general')),
  is_correct boolean generated always as (selected_stream = correct_stream) stored,
  answered_at timestamptz not null default now(),
  constraint waste_sorting_attempts_event_same_fridge
    foreign key (event_uid, fridge_uid)
    references public.inventory_events(event_uid, fridge_uid)
    on update cascade on delete restrict,
  constraint waste_sorting_attempts_one_answer_per_event unique (event_uid, question_code)
);

create index waste_sorting_attempts_fridge_answered_idx
  on public.waste_sorting_attempts (fridge_uid, answered_at desc);

alter table public.waste_sorting_attempts enable row level security;
revoke all on public.waste_sorting_attempts from anon, authenticated;
grant all on public.waste_sorting_attempts to service_role;
