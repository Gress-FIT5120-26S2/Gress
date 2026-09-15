-- Arthur: NarIyirm
-- 中文：保存最少量的助手会话、审计、反馈和待确认动作；共享库存可见不代表会话自动对所有成员可见。
-- EN: Persist minimal assistant conversation, audit, feedback, and pending-action data; shared inventory visibility does not make conversations shared by default.

create table public.assistant_conversations (
  conversation_uid uuid primary key default extensions.gen_random_uuid(),
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  creator_device_id text not null references public.devices(device_id) on update cascade on delete cascade,
  language text not null,
  summary text,
  last_inventory_version bigint,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_conversations_language_valid check (language in ('zh', 'en')),
  constraint assistant_conversations_summary_length check (summary is null or char_length(summary) <= 2000),
  constraint assistant_conversations_inventory_version_valid check (last_inventory_version is null or last_inventory_version >= 0),
  constraint assistant_conversations_expiry_valid check (expires_at > created_at),
  constraint assistant_conversations_creator_fridge_unique unique (conversation_uid, creator_device_id, fridge_uid)
);

create table public.assistant_messages (
  message_uid uuid primary key default extensions.gen_random_uuid(),
  conversation_uid uuid not null references public.assistant_conversations(conversation_uid) on update cascade on delete cascade,
  role text not null,
  content text not null,
  structured_payload jsonb,
  model text,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now(),
  constraint assistant_messages_role_valid check (role in ('user', 'assistant')),
  constraint assistant_messages_content_not_blank check (char_length(btrim(content)) between 1 and 12000),
  constraint assistant_messages_payload_object check (structured_payload is null or jsonb_typeof(structured_payload) = 'object'),
  constraint assistant_messages_token_counts_valid check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
  ),
  constraint assistant_messages_latency_valid check (latency_ms is null or latency_ms >= 0)
);

create table public.assistant_request_audit (
  request_uid uuid primary key default extensions.gen_random_uuid(),
  conversation_uid uuid,
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  creator_device_id text not null references public.devices(device_id) on update cascade on delete cascade,
  model text not null,
  prompt_version text not null,
  tool_names text[] not null default '{}',
  status text not null,
  validation_status text not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error_code text,
  created_at timestamptz not null default now(),
  constraint assistant_request_audit_model_not_blank check (char_length(btrim(model)) > 0),
  constraint assistant_request_audit_prompt_not_blank check (char_length(btrim(prompt_version)) > 0),
  constraint assistant_request_audit_status_valid check (status in ('completed', 'fallback', 'rejected', 'failed')),
  constraint assistant_request_audit_validation_valid check (validation_status in ('valid', 'repaired', 'fallback', 'rejected')),
  constraint assistant_request_audit_token_counts_valid check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
  ),
  constraint assistant_request_audit_latency_valid check (latency_ms is null or latency_ms >= 0),
  constraint assistant_request_audit_error_code_length check (error_code is null or char_length(error_code) <= 120),
  constraint assistant_request_audit_conversation_scope
    foreign key (conversation_uid, creator_device_id, fridge_uid)
    references public.assistant_conversations(conversation_uid, creator_device_id, fridge_uid)
    on update cascade on delete set null (conversation_uid)
);

create table public.assistant_feedback (
  feedback_uid uuid primary key default extensions.gen_random_uuid(),
  message_uid uuid not null references public.assistant_messages(message_uid) on update cascade on delete cascade,
  creator_device_id text not null references public.devices(device_id) on update cascade on delete cascade,
  rating text not null,
  reason_code text,
  comment text,
  created_at timestamptz not null default now(),
  constraint assistant_feedback_rating_valid check (rating in ('up', 'down')),
  constraint assistant_feedback_reason_length check (reason_code is null or char_length(reason_code) <= 80),
  constraint assistant_feedback_comment_length check (comment is null or char_length(comment) <= 1000),
  constraint assistant_feedback_one_per_device unique (message_uid, creator_device_id)
);

create table public.assistant_pending_actions (
  action_uid uuid primary key default extensions.gen_random_uuid(),
  conversation_uid uuid not null,
  fridge_uid uuid not null references public.fridges(fridge_uid) on update cascade on delete cascade,
  creator_device_id text not null references public.devices(device_id) on update cascade on delete cascade,
  action_type text not null,
  action_payload jsonb not null,
  target_batch_uid uuid,
  expected_batch_version integer,
  inventory_version bigint,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  confirmed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assistant_pending_actions_type_valid check (
    action_type in ('prepare_cart_item', 'archive_batch', 'adjust_quantity', 'mark_consumed', 'edit_use_by', 'set_restock_rule')
  ),
  constraint assistant_pending_actions_payload_object check (jsonb_typeof(action_payload) = 'object'),
  constraint assistant_pending_actions_version_valid check (expected_batch_version is null or expected_batch_version > 0),
  constraint assistant_pending_actions_inventory_version_valid check (inventory_version is null or inventory_version >= 0),
  constraint assistant_pending_actions_status_valid check (status in ('pending', 'confirmed', 'executed', 'cancelled', 'expired', 'conflict', 'failed')),
  constraint assistant_pending_actions_expiry_valid check (expires_at > created_at),
  constraint assistant_pending_actions_conversation_scope
    foreign key (conversation_uid, creator_device_id, fridge_uid)
    references public.assistant_conversations(conversation_uid, creator_device_id, fridge_uid)
    on update cascade on delete cascade,
  constraint assistant_pending_actions_target_batch_same_fridge
    foreign key (target_batch_uid, fridge_uid)
    references public.inventory_batches(batch_uid, fridge_uid)
    on update cascade on delete restrict,
  constraint assistant_pending_actions_confirmation_state check (
    (status = 'pending' and confirmed_at is null and executed_at is null)
    or (status in ('cancelled', 'expired', 'conflict', 'failed') and executed_at is null)
    or (status = 'confirmed' and confirmed_at is not null and executed_at is null)
    or (status = 'executed' and confirmed_at is not null and executed_at is not null)
  )
);

create index assistant_conversations_creator_recent_idx
  on public.assistant_conversations (creator_device_id, updated_at desc);

create index assistant_conversations_expiry_idx
  on public.assistant_conversations (expires_at);

create index assistant_messages_conversation_timeline_idx
  on public.assistant_messages (conversation_uid, created_at);

create index assistant_request_audit_fridge_recent_idx
  on public.assistant_request_audit (fridge_uid, created_at desc);

create index assistant_pending_actions_creator_pending_idx
  on public.assistant_pending_actions (creator_device_id, expires_at)
  where status = 'pending';

create trigger assistant_conversations_set_updated_at
before update on public.assistant_conversations
for each row execute function public.set_updated_at();

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_request_audit enable row level security;
alter table public.assistant_feedback enable row level security;
alter table public.assistant_pending_actions enable row level security;

revoke all on table public.assistant_conversations from public, anon, authenticated;
revoke all on table public.assistant_messages from public, anon, authenticated;
revoke all on table public.assistant_request_audit from public, anon, authenticated;
revoke all on table public.assistant_feedback from public, anon, authenticated;
revoke all on table public.assistant_pending_actions from public, anon, authenticated;

grant select, insert, update, delete on table public.assistant_conversations to service_role;
grant select, insert, update, delete on table public.assistant_messages to service_role;
grant select, insert, update, delete on table public.assistant_request_audit to service_role;
grant select, insert, update, delete on table public.assistant_feedback to service_role;
grant select, insert, update, delete on table public.assistant_pending_actions to service_role;

comment on table public.assistant_conversations is
  'Creator-device-private assistant conversations with a default 30-day expiry; shared-fridge membership does not grant conversation visibility.';
comment on table public.assistant_request_audit is
  'Redacted operational metadata for assistant quality, cost, latency, validation, and fallback monitoring; never stores credentials or full tool output.';
comment on table public.assistant_pending_actions is
  'Short-lived server-validated action previews that require explicit user confirmation and version revalidation before existing mutations execute.';
