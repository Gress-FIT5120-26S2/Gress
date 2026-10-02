-- Arthur: NarIyirm
-- 中文：同一使用流水只能产生一次学习记录，即使商品名称或题库版本后来发生变化。
-- EN: A consume event yields one learning attempt even if the item name or catalog version changes later.

alter table public.waste_sorting_attempts
  drop constraint waste_sorting_attempts_one_answer_per_event;

alter table public.waste_sorting_attempts
  add constraint waste_sorting_attempts_one_answer_per_event unique (event_uid);
