-- Arthur: NarIyirm
-- 中文：把待确认动作精确关联到产生它的助手消息，使历史恢复不会依赖时间戳猜测，同时保留旧记录兼容。
-- EN: Link each pending action to the assistant message that produced it so history restoration never guesses by timestamp, while retaining legacy rows.
alter table public.assistant_pending_actions
  add column assistant_message_uid uuid
  references public.assistant_messages(message_uid)
  on update cascade
  on delete set null;

create unique index assistant_pending_actions_message_unique_idx
  on public.assistant_pending_actions (assistant_message_uid)
  where assistant_message_uid is not null;

comment on column public.assistant_pending_actions.assistant_message_uid is
  'Assistant message that produced this confirmation proposal; nullable only for legacy actions created before conversation-history restoration.';
