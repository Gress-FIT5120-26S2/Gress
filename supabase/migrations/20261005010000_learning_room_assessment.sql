-- Arthur: NarIyirm
-- 中文：个人学习独立于冰箱；只有服务端事务可以冻结题目、保存首答和结算解锁。
-- EN: Personal learning is separate from fridges; only server transactions freeze questions, record first answers and settle unlocks.
create table public.learning_content_versions (
  content_version text primary key check (char_length(content_version) between 1 and 100),
  public_catalog jsonb not null,
  private_question_bank jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  review_metadata jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (public_catalog->>'contentVersion' = content_version),
  check (private_question_bank->>'contentVersion' = content_version),
  check (status <> 'published' or published_at is not null),
  check (public_catalog::text !~ '"(correctOptionId|correct_option_id|isCorrect|is_correct|questionSnapshot|question_snapshot|questionBank|privateQuestionBank|explanation)"[[:space:]]*:')
);

create table public.learning_learners (
  learner_uid uuid primary key default gen_random_uuid(),
  owner_device_id text not null unique references public.devices(device_id) on delete cascade,
  state_version bigint not null default 1 check (state_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_quiz_attempts (
  attempt_uid uuid primary key default gen_random_uuid(),
  learner_uid uuid not null references public.learning_learners(learner_uid) on delete cascade,
  created_by_device_id text references public.devices(device_id) on delete set null,
  stage_code text not null check (stage_code in ('beginner', 'intermediate', 'advanced')),
  mode text not null check (mode in ('checkpoint', 'review', 'practice', 'mixed-review')),
  activity_code text,
  content_version text not null references public.learning_content_versions(content_version),
  question_snapshot jsonb not null check (jsonb_typeof(question_snapshot) = 'array'),
  question_count integer not null check (question_count between 1 and 12),
  pass_percent integer not null default 80 check (pass_percent = 80),
  cursor_position integer not null default 1,
  next_keys jsonb not null default '{}',
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'abandoned', 'invalidated')),
  correct_count integer,
  passed boolean,
  create_key text not null check (char_length(create_key) between 8 and 200),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  terminal_reason text,
  unique (learner_uid, create_key),
  check (jsonb_array_length(question_snapshot) = question_count),
  check (cursor_position between 1 and question_count),
  check ((mode = 'practice') = (activity_code is not null)),
  check (status <> 'submitted' or (correct_count between 0 and question_count and passed is not null and submitted_at is not null))
);
create unique index learning_one_active_attempt on public.learning_quiz_attempts
  (learner_uid, stage_code, mode, coalesce(activity_code, '')) where status = 'in_progress';
create index learning_attempt_history on public.learning_quiz_attempts (learner_uid, started_at desc);

-- Arthur: NarIyirm
-- 中文：多个创建请求恢复同一考试时，每个幂等键都绑定到该考试，完成后重发也不会意外开始新考试。
-- EN: When several create requests resume one attempt, bind every idempotency key to it so a retry after finish cannot accidentally start another attempt.
create table public.learning_attempt_requests (
  learner_uid uuid not null references public.learning_learners(learner_uid) on delete cascade,
  create_key text not null,
  original_key text not null,
  attempt_uid uuid not null references public.learning_quiz_attempts(attempt_uid) on delete cascade,
  primary key (learner_uid, create_key)
);

create table public.learning_stage_progress (
  learner_uid uuid not null references public.learning_learners(learner_uid) on delete cascade,
  stage_code text not null check (stage_code in ('beginner', 'intermediate', 'advanced')),
  unlocked_at timestamptz not null default now(),
  passed_at timestamptz,
  first_pass_attempt_uid uuid references public.learning_quiz_attempts(attempt_uid),
  best_correct integer,
  best_total integer,
  primary key (learner_uid, stage_code),
  check ((passed_at is null) = (first_pass_attempt_uid is null)),
  check (best_correct is null or (best_total > 0 and best_correct between 0 and best_total))
);

create table public.learning_activity_progress (
  learner_uid uuid not null references public.learning_learners(learner_uid) on delete cascade,
  activity_code text not null,
  activity_type text not null check (activity_type in ('video', 'lesson', 'practice', 'resource')),
  first_completed_at timestamptz not null default now(),
  last_completed_at timestamptz not null default now(),
  seen_content_version text not null references public.learning_content_versions(content_version),
  completed_attempt_uid uuid references public.learning_quiz_attempts(attempt_uid),
  primary key (learner_uid, activity_code),
  check (activity_type <> 'practice' or completed_attempt_uid is not null)
);

create table public.learning_quiz_answers (
  answer_uid uuid primary key default gen_random_uuid(),
  attempt_uid uuid not null references public.learning_quiz_attempts(attempt_uid) on delete cascade,
  question_instance_uid uuid not null,
  selected_option_id text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  request_key text not null check (char_length(request_key) between 8 and 100),
  unique (attempt_uid, question_instance_uid),
  unique (attempt_uid, request_key)
);

create function public.guard_learning_content_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.content_version, new.public_catalog, new.private_question_bank, new.content_hash)
    is distinct from (old.content_version, old.public_catalog, old.private_question_bank, old.content_hash) then
    raise exception 'learning_content_immutable';
  end if;
  if tg_op = 'UPDATE' and old.status = 'withdrawn' and new.status <> 'withdrawn' then
    raise exception 'learning_content_withdrawn';
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'draft' then
    raise exception 'learning_content_immutable';
  end if;
  if new.status = 'published' and (
    coalesce(new.review_metadata #>> '{independentReview,status}', '') <> 'approved'
    or coalesce(new.review_metadata #>> '{independentReview,approvedContentHash}', '') <> new.content_hash
    or nullif(btrim(new.review_metadata #>> '{independentReview,reviewer}'), '') is null
    or nullif(btrim(new.review_metadata #>> '{authoringReview,reviewer}'), '') is null
    or lower(btrim(new.review_metadata #>> '{independentReview,reviewer}')) = lower(btrim(new.review_metadata #>> '{authoringReview,reviewer}'))
    or nullif(new.review_metadata #>> '{independentReview,reviewedAt}', '') is null
    or jsonb_array_length(coalesce(new.review_metadata->'questions', '[]')) <> jsonb_array_length(new.private_question_bank->'questions')
    or exists (select 1 from jsonb_array_elements(new.review_metadata->'questions') r where coalesce(r->>'independentStatus', '') <> 'approved')
    or exists (select 1 from jsonb_array_elements(new.private_question_bank->'questions') q
      where not exists (select 1 from jsonb_array_elements(new.review_metadata->'questions') r where r->>'questionCode' = q->>'questionCode'))
  ) then raise exception 'learning_content_review_required'; end if;
  return new;
end;
$$;
create trigger learning_content_guard before insert or update on public.learning_content_versions
  for each row execute function public.guard_learning_content_version();

-- Arthur: NarIyirm
-- 中文：状态只读取永久进度，不从当前题库重算等级；未完成正式考试优先于课程继续位置。
-- EN: State reads permanent progress rather than recalculating eligibility from the latest bank; unfinished checkpoints take resume priority.
create function public.learning_room_state(p_learner_uid uuid, p_content_version text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  catalog jsonb;
  current_stage text;
  statuses jsonb;
  active_uid uuid;
  course jsonb;
  next_activity text;
  resume jsonb;
begin
  select public_catalog into catalog from public.learning_content_versions where content_version = p_content_version;
  select stage_code into current_stage from public.learning_stage_progress where learner_uid = p_learner_uid
    order by case stage_code when 'advanced' then 3 when 'intermediate' then 2 else 1 end desc limit 1;
  select jsonb_object_agg(s.code, case when p.passed_at is not null then 'completed' when p.unlocked_at is not null then 'unlocked' else 'locked' end)
    into statuses from (values ('beginner'), ('intermediate'), ('advanced')) s(code)
    left join public.learning_stage_progress p on p.learner_uid = p_learner_uid and p.stage_code = s.code;
  select attempt_uid into active_uid from public.learning_quiz_attempts
    where learner_uid = p_learner_uid and mode = 'checkpoint' and status = 'in_progress' order by started_at desc limit 1;
  select c into course from jsonb_array_elements(catalog->'courses') c where c->>'stageCode' = current_stage;
  select a.code into next_activity from jsonb_array_elements_text(course->'activityCodes') with ordinality a(code, ord)
    where not exists (select 1 from public.learning_activity_progress p where p.learner_uid = p_learner_uid and p.activity_code = a.code)
    order by a.ord limit 1;
  resume := case when active_uid is not null then jsonb_build_object('type', 'attempt', 'attemptUid', active_uid)
    when statuses->>'advanced' = 'completed' then jsonb_build_object('type', 'mixed-review')
    when next_activity is not null then jsonb_build_object('type', 'activity', 'activityCode', next_activity)
    else jsonb_build_object('type', 'checkpoint', 'stageCode', current_stage) end;
  return jsonb_build_object(
    'stateVersion', (select state_version::text from public.learning_learners where learner_uid = p_learner_uid),
    'contentVersion', p_content_version, 'activeAttemptUid', active_uid,
    'session', jsonb_build_object('currentStageCode', current_stage, 'stageStatus', statuses,
      'completedActivityCodes', coalesce((select jsonb_agg(activity_code order by activity_code) from public.learning_activity_progress where learner_uid = p_learner_uid and activity_type <> 'resource'), '[]'),
      'readResourceCodes', coalesce((select jsonb_agg(activity_code order by activity_code) from public.learning_activity_progress where learner_uid = p_learner_uid and activity_type = 'resource'), '[]'),
      'resumeTarget', resume),
    'recentResults', coalesce((select jsonb_agg(r.item) from (select jsonb_build_object('attemptUid', attempt_uid,
      'stageCode', stage_code, 'mode', mode, 'correctCount', correct_count, 'totalCount', question_count,
      'passed', passed, 'submittedAt', submitted_at) item from public.learning_quiz_attempts
      where learner_uid = p_learner_uid and status = 'submitted' order by submitted_at desc limit 10) r), '[]')
  );
end;
$$;

create function public.learning_attempt_data(p_attempt_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(a) || jsonb_build_object('answers', coalesce((select jsonb_agg(to_jsonb(ans) order by ans.answered_at)
    from public.learning_quiz_answers ans where ans.attempt_uid = a.attempt_uid), '[]'))
  from public.learning_quiz_attempts a where a.attempt_uid = p_attempt_uid;
$$;

create function public.withdraw_learning_attempts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'withdrawn' and old.status <> 'withdrawn' then
    update public.learning_quiz_attempts set status = 'invalidated', terminal_reason = 'content_withdrawn'
      where content_version = new.content_version and status = 'in_progress';
    update public.learning_learners set state_version = state_version + 1, updated_at = now()
      where learner_uid in (select learner_uid from public.learning_quiz_attempts where content_version = new.content_version and status = 'invalidated');
  end if;
  return new;
end;
$$;
create trigger learning_content_withdraw after update of status on public.learning_content_versions
  for each row execute function public.withdraw_learning_attempts();

-- Arthur: NarIyirm
-- 中文：每个操作先锁成员与 learner；快照由已存题库生成，客户端分数或答案键不参与任何写入。
-- EN: Each operation locks membership then the learner; snapshots come from the stored bank and client scores or answer keys never drive writes.
create function public.learning_room_action(p_device_id text, p_action text, p_payload jsonb default '{}', p_allow_draft boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  learner public.learning_learners%rowtype;
  content public.learning_content_versions%rowtype;
  attempt public.learning_quiz_attempts%rowtype;
  answer public.learning_quiz_answers%rowtype;
  stage jsonb;
  question jsonb;
  snapshot jsonb;
  practice jsonb;
  activity jsonb;
  code text;
  mode_value text;
  key_value text;
  next_stage text;
  count_value integer;
  answer_count integer;
  correct_value integer;
  pass_value boolean;
  changed boolean := false;
  question_uid uuid;
begin
  perform 1 from public.fridge_members m join public.device_credentials c on c.device_id = m.device_id
    where m.device_id = p_device_id and c.status = 'active' for update of m;
  if not found then raise exception 'invalid_device_credential'; end if;
  if p_action not in ('state', 'start', 'read', 'answer', 'next', 'finish', 'abandon', 'complete', 'review') then raise exception 'invalid_input'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_input'; end if;
  select * into content from public.learning_content_versions
    where status = 'published' or (p_allow_draft and status = 'draft')
    order by (status = 'published') desc, created_at desc, content_version desc limit 1;
  -- Arthur: NarIyirm
  -- 中文：撤回最后版本后仍能查看本人已结算历史；被撤回的未完成考试继续返回 invalidated。
  -- EN: Keep settled personal history readable after the last version is withdrawn; unfinished withdrawn attempts still return invalidated.
  if not found and p_action in ('read', 'answer', 'next', 'finish', 'abandon', 'review') then
    select c.* into content from public.learning_content_versions c
      join public.learning_quiz_attempts a on a.content_version = c.content_version
      join public.learning_learners l on l.learner_uid = a.learner_uid
      where l.owner_device_id = p_device_id and a.attempt_uid = (p_payload->>'attemptUid')::uuid
        and (c.status in ('published', 'withdrawn') or p_allow_draft);
  end if;
  if not found then raise exception 'content_unavailable'; end if;
  insert into public.learning_learners(owner_device_id) values (p_device_id) on conflict (owner_device_id) do nothing;
  select * into learner from public.learning_learners where owner_device_id = p_device_id for update;
  insert into public.learning_stage_progress(learner_uid, stage_code) values (learner.learner_uid, 'beginner') on conflict do nothing;

  if p_action = 'complete' then
    if p_payload->>'contentVersion' is distinct from content.content_version then raise exception 'learning_content_changed'; end if;
    select a into activity from jsonb_array_elements(content.public_catalog->'activities') a where a->>'activityCode' = p_payload->>'activityCode';
    if activity is null then
      select r || jsonb_build_object('type', 'resource') into activity from jsonb_array_elements(content.public_catalog->'resources') r where r->>'resourceCode' = p_payload->>'activityCode';
    end if;
    if activity is null then raise exception 'activity_not_found'; end if;
    if activity->>'type' = 'practice' then raise exception 'learning_practice_requires_attempt'; end if;
    insert into public.learning_activity_progress(learner_uid, activity_code, activity_type, seen_content_version)
      values (learner.learner_uid, p_payload->>'activityCode', activity->>'type', content.content_version)
      on conflict (learner_uid, activity_code) do update set seen_content_version = excluded.seen_content_version, last_completed_at = now()
      where public.learning_activity_progress.seen_content_version <> excluded.seen_content_version;
    changed := found;
  elsif p_action = 'start' then
    code := p_payload->>'stageCode'; mode_value := p_payload->>'mode'; key_value := p_payload->>'createKey';
    if code not in ('beginner', 'intermediate', 'advanced') or mode_value not in ('checkpoint', 'review', 'practice', 'mixed-review')
      or code is null or mode_value is null or key_value is null or char_length(key_value) not between 8 and 100 then raise exception 'invalid_input'; end if;
    select a.* into attempt from public.learning_quiz_attempts a join public.learning_attempt_requests r on r.attempt_uid = a.attempt_uid
      where r.learner_uid = learner.learner_uid and r.create_key = key_value;
    if found then
      if attempt.stage_code <> code or attempt.mode <> mode_value or attempt.activity_code is distinct from p_payload->>'activityCode' then raise exception 'idempotency_key_conflict'; end if;
    else
      select * into attempt from public.learning_quiz_attempts where learner_uid = learner.learner_uid and stage_code = code
        and mode = mode_value and activity_code is not distinct from p_payload->>'activityCode' and status = 'in_progress';
      if not found then
        if mode_value = 'checkpoint' and not exists (select 1 from public.learning_stage_progress where learner_uid = learner.learner_uid and stage_code = code) then raise exception 'learning_stage_locked'; end if;
        if mode_value = 'mixed-review' and (code <> 'advanced' or not exists (select 1 from public.learning_stage_progress where learner_uid = learner.learner_uid and stage_code = 'advanced' and passed_at is not null)) then raise exception 'learning_stage_locked'; end if;
        select * into content from public.learning_content_versions where content_version = p_payload->>'contentVersion'
          and (status = 'published' or (p_allow_draft and status = 'draft')) for share;
        if not found then raise exception 'content_unavailable'; end if;
        select s into stage from jsonb_array_elements(content.public_catalog->'stages') s where s->>'stageCode' = code;
        count_value := (stage->>'questionCount')::integer;
        if mode_value = 'practice' then
          select pr into practice from jsonb_array_elements(content.private_question_bank->'practice') pr
            where pr->>'activityCode' = p_payload->>'activityCode';
          if practice is null or not exists (select 1 from jsonb_array_elements(content.public_catalog->'activities') a
            where a->>'activityCode' = p_payload->>'activityCode' and a->>'stageCode' = code and a->>'type' = 'practice') then raise exception 'invalid_input'; end if;
          count_value := (practice->>'questionCount')::integer;
        elsif p_payload->>'activityCode' is not null then raise exception 'invalid_input';
        elsif mode_value = 'mixed-review' then count_value := 12; end if;
        if jsonb_typeof(p_payload->'questionCodes') <> 'array' or jsonb_array_length(p_payload->'questionCodes') <> count_value
          or (select count(distinct c) from jsonb_array_elements_text(p_payload->'questionCodes') c) <> count_value then raise exception 'invalid_question_selection'; end if;
        select jsonb_agg(q || jsonb_build_object('questionUid', gen_random_uuid(),
          'options', (select jsonb_agg(o order by random()) from jsonb_array_elements(q->'options') o),
          'sourceSnapshots', (select jsonb_agg(src) from jsonb_array_elements(content.public_catalog->'sources') src where q->'sourceRefs' ? (src->>'sourceCode'))) order by chosen.ord)
          into snapshot from jsonb_array_elements_text(p_payload->'questionCodes') with ordinality chosen(code, ord)
          join lateral jsonb_array_elements(content.private_question_bank->'questions') q on q->>'questionCode' = chosen.code and q->>'status' = 'active';
        if coalesce(jsonb_array_length(snapshot), 0) <> count_value then raise exception 'invalid_question_selection'; end if;
        if mode_value = 'mixed-review' then
          if exists (select 1 from (values ('beginner'), ('intermediate'), ('advanced')) s(code)
            where (select count(*) from jsonb_array_elements(snapshot) q where q->>'stageCode' = s.code) <> 4) then raise exception 'invalid_question_selection'; end if;
        elsif exists (select 1 from jsonb_array_elements(snapshot) q where q->>'stageCode' <> code) then raise exception 'invalid_question_selection';
        elsif mode_value = 'practice' then
          if exists (select 1 from jsonb_array_elements(snapshot) q where not (practice->'questionCodes' ? (q->>'questionCode'))) then raise exception 'invalid_question_selection'; end if;
        elsif exists (select 1 from jsonb_array_elements(stage->'blueprint') topic
          where (select count(*) from jsonb_array_elements(snapshot) q where q->>'topicCode' = topic->>'topicCode') <> (topic->>'count')::integer) then raise exception 'invalid_question_selection'; end if;
        insert into public.learning_quiz_attempts(learner_uid, created_by_device_id, stage_code, mode, activity_code, content_version, question_snapshot, question_count, create_key)
          values (learner.learner_uid, p_device_id, code, mode_value, p_payload->>'activityCode', content.content_version, snapshot, count_value, key_value) returning * into attempt;
        changed := true;
      end if;
    end if;
    insert into public.learning_attempt_requests(learner_uid, create_key, original_key, attempt_uid)
      values (learner.learner_uid, key_value, key_value, attempt.attempt_uid) on conflict do nothing;
    if attempt.status = 'invalidated' then raise exception 'attempt_invalidated'; end if;
  elsif p_action <> 'state' then
    select * into attempt from public.learning_quiz_attempts where learner_uid = learner.learner_uid and attempt_uid = (p_payload->>'attemptUid')::uuid for update;
    if not found then raise exception 'attempt_not_found'; end if;
    if attempt.status = 'invalidated' then raise exception 'attempt_invalidated'; end if;
    if p_action in ('answer', 'next', 'finish', 'abandon') then
      key_value := p_payload->>'requestKey';
      if key_value is null or char_length(key_value) not between 8 and 100 then raise exception 'invalid_input'; end if;
    end if;
    if p_action = 'answer' then
      question_uid := (p_payload->>'questionUid')::uuid;
      if question_uid is null or p_payload->>'optionId' is null then raise exception 'invalid_input'; end if;
      select * into answer from public.learning_quiz_answers where attempt_uid = attempt.attempt_uid and request_key = key_value;
      if found and (answer.question_instance_uid <> question_uid or answer.selected_option_id <> p_payload->>'optionId') then raise exception 'idempotency_key_conflict'; end if;
      select * into answer from public.learning_quiz_answers where attempt_uid = attempt.attempt_uid and question_instance_uid = question_uid;
      if found then
        if answer.selected_option_id <> p_payload->>'optionId' then raise exception 'answer_already_submitted'; end if;
      else
        if attempt.status <> 'in_progress' then raise exception 'attempt_not_active'; end if;
        question := attempt.question_snapshot->(attempt.cursor_position - 1);
        if question->>'questionUid' <> question_uid::text then raise exception 'learning_question_not_current'; end if;
        if not exists (select 1 from jsonb_array_elements(question->'options') o where o->>'optionId' = p_payload->>'optionId') then raise exception 'invalid_input'; end if;
        insert into public.learning_quiz_answers(attempt_uid, question_instance_uid, selected_option_id, is_correct, request_key)
          values (attempt.attempt_uid, question_uid, p_payload->>'optionId', question->>'correctOptionId' = p_payload->>'optionId', key_value);
        changed := true;
      end if;
    elsif p_action = 'next' then
      if attempt.status <> 'in_progress' then raise exception 'attempt_not_active'; end if;
      if not (attempt.next_keys ? key_value) and attempt.cursor_position < attempt.question_count then
        question := attempt.question_snapshot->(attempt.cursor_position - 1);
        if not exists (select 1 from public.learning_quiz_answers where attempt_uid = attempt.attempt_uid and question_instance_uid = (question->>'questionUid')::uuid) then raise exception 'learning_answer_required'; end if;
        update public.learning_quiz_attempts set cursor_position = least(question_count, cursor_position + 1),
          next_keys = next_keys || jsonb_build_object(key_value, least(question_count, cursor_position + 1)) where attempt_uid = attempt.attempt_uid;
        changed := true;
      end if;
    elsif p_action = 'finish' then
      if attempt.status <> 'submitted' then
        if attempt.status <> 'in_progress' then raise exception 'attempt_not_active'; end if;
        select count(*), count(*) filter (where is_correct) into answer_count, correct_value from public.learning_quiz_answers where attempt_uid = attempt.attempt_uid;
        if answer_count <> attempt.question_count then raise exception 'attempt_incomplete'; end if;
        pass_value := correct_value * 100 >= attempt.question_count * attempt.pass_percent;
        update public.learning_quiz_attempts set status = 'submitted', correct_count = correct_value, passed = pass_value, submitted_at = now() where attempt_uid = attempt.attempt_uid;
        if attempt.mode = 'checkpoint' then
          update public.learning_stage_progress set
            passed_at = case when pass_value then coalesce(passed_at, now()) else passed_at end,
            first_pass_attempt_uid = case when pass_value then coalesce(first_pass_attempt_uid, attempt.attempt_uid) else first_pass_attempt_uid end,
            best_correct = case when best_correct is null or correct_value * best_total > best_correct * attempt.question_count then correct_value else best_correct end,
            best_total = case when best_correct is null or correct_value * best_total > best_correct * attempt.question_count then attempt.question_count else best_total end
            where learner_uid = learner.learner_uid and stage_code = attempt.stage_code;
          if pass_value then
            next_stage := case attempt.stage_code when 'beginner' then 'intermediate' when 'intermediate' then 'advanced' else null end;
            if next_stage is not null then insert into public.learning_stage_progress(learner_uid, stage_code) values (learner.learner_uid, next_stage) on conflict do nothing; end if;
          end if;
        elsif attempt.mode = 'practice' then
          insert into public.learning_activity_progress(learner_uid, activity_code, activity_type, seen_content_version, completed_attempt_uid)
            values (learner.learner_uid, attempt.activity_code, 'practice', attempt.content_version, attempt.attempt_uid)
            on conflict (learner_uid, activity_code) do update set last_completed_at = now(), seen_content_version = excluded.seen_content_version, completed_attempt_uid = excluded.completed_attempt_uid;
        end if;
        changed := true;
      end if;
    elsif p_action = 'abandon' and attempt.status = 'in_progress' then
      update public.learning_quiz_attempts set status = 'abandoned', terminal_reason = 'learner_restart' where attempt_uid = attempt.attempt_uid;
      changed := true;
    end if;
  end if;
  if changed then update public.learning_learners set state_version = state_version + 1, updated_at = now() where learner_uid = learner.learner_uid; end if;
  return public.learning_room_state(learner.learner_uid, content.content_version)
    || case when attempt.attempt_uid is null then '{}'::jsonb else jsonb_build_object('attempt', public.learning_attempt_data(attempt.attempt_uid)) end;
end;
$$;

-- Arthur: NarIyirm
-- 中文：只有恢复修改成员 device_id 才合并 learner；更换冰箱不触发。历史答题保留，冲突的临时考试标记 abandoned。
-- EN: Merge learners only when recovery changes membership device_id, never on fridge changes. Retain answer history and abandon conflicting temporary attempts.
create function public.transfer_learning_with_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_uid uuid;
  temporary_uid uuid;
begin
  if old.device_id is not distinct from new.device_id then return new; end if;
  perform 1 from public.learning_learners where owner_device_id in (old.device_id, new.device_id) order by learner_uid for update;
  select learner_uid into old_uid from public.learning_learners where owner_device_id = old.device_id;
  select learner_uid into temporary_uid from public.learning_learners where owner_device_id = new.device_id;
  if old_uid is null then return new; end if;
  if temporary_uid is not null then
    update public.learning_quiz_attempts a set status = 'abandoned', terminal_reason = 'recovery_conflict'
      where a.learner_uid = temporary_uid and a.status = 'in_progress' and exists (
        select 1 from public.learning_quiz_attempts original where original.learner_uid = old_uid and original.status = 'in_progress'
          and original.stage_code = a.stage_code and original.mode = a.mode and original.activity_code is not distinct from a.activity_code);
    update public.learning_quiz_attempts a set create_key = 'recovery:' || a.attempt_uid::text
      where a.learner_uid = temporary_uid and exists (select 1 from public.learning_quiz_attempts original where original.learner_uid = old_uid and original.create_key = a.create_key);
    update public.learning_quiz_attempts set learner_uid = old_uid where learner_uid = temporary_uid;
    update public.learning_attempt_requests r set create_key = 'recovery:' || gen_random_uuid()::text
      where r.learner_uid = temporary_uid and exists (select 1 from public.learning_attempt_requests original where original.learner_uid = old_uid and original.create_key = r.create_key);
    update public.learning_attempt_requests set learner_uid = old_uid where learner_uid = temporary_uid;
    insert into public.learning_stage_progress(learner_uid, stage_code, unlocked_at, passed_at, first_pass_attempt_uid, best_correct, best_total)
      select old_uid, stage_code, unlocked_at, passed_at, first_pass_attempt_uid, best_correct, best_total from public.learning_stage_progress where learner_uid = temporary_uid
      on conflict (learner_uid, stage_code) do update set
        unlocked_at = least(public.learning_stage_progress.unlocked_at, excluded.unlocked_at),
        passed_at = least(public.learning_stage_progress.passed_at, excluded.passed_at),
        first_pass_attempt_uid = case when public.learning_stage_progress.passed_at is null or excluded.passed_at < public.learning_stage_progress.passed_at then excluded.first_pass_attempt_uid else public.learning_stage_progress.first_pass_attempt_uid end,
        best_correct = case when public.learning_stage_progress.best_correct is null or excluded.best_correct * public.learning_stage_progress.best_total > public.learning_stage_progress.best_correct * excluded.best_total then excluded.best_correct else public.learning_stage_progress.best_correct end,
        best_total = case when public.learning_stage_progress.best_correct is null or excluded.best_correct * public.learning_stage_progress.best_total > public.learning_stage_progress.best_correct * excluded.best_total then excluded.best_total else public.learning_stage_progress.best_total end;
    insert into public.learning_activity_progress(learner_uid, activity_code, activity_type, first_completed_at, last_completed_at, seen_content_version, completed_attempt_uid)
      select old_uid, activity_code, activity_type, first_completed_at, last_completed_at, seen_content_version, completed_attempt_uid from public.learning_activity_progress where learner_uid = temporary_uid
      on conflict (learner_uid, activity_code) do update set
        first_completed_at = least(public.learning_activity_progress.first_completed_at, excluded.first_completed_at),
        last_completed_at = greatest(public.learning_activity_progress.last_completed_at, excluded.last_completed_at),
        seen_content_version = case when excluded.last_completed_at > public.learning_activity_progress.last_completed_at then excluded.seen_content_version else public.learning_activity_progress.seen_content_version end,
        completed_attempt_uid = coalesce(public.learning_activity_progress.completed_attempt_uid, excluded.completed_attempt_uid);
    update public.learning_learners set state_version = greatest(state_version, (select state_version from public.learning_learners where learner_uid = temporary_uid)) where learner_uid = old_uid;
    delete from public.learning_learners where learner_uid = temporary_uid;
  end if;
  update public.learning_learners set owner_device_id = new.device_id, state_version = state_version + 1, updated_at = now() where learner_uid = old_uid;
  return new;
end;
$$;
create trigger fridge_members_transfer_learning after update of device_id on public.fridge_members
  for each row execute function public.transfer_learning_with_membership();

do $$ declare table_name text; begin
  foreach table_name in array array['learning_content_versions', 'learning_learners', 'learning_stage_progress', 'learning_activity_progress', 'learning_quiz_attempts', 'learning_quiz_answers', 'learning_attempt_requests'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
    execute format('grant select on table public.%I to service_role', table_name);
  end loop;
end $$;
revoke execute on function public.guard_learning_content_version() from public, anon, authenticated, service_role;
revoke execute on function public.learning_room_state(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.learning_attempt_data(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.withdraw_learning_attempts() from public, anon, authenticated, service_role;
revoke execute on function public.transfer_learning_with_membership() from public, anon, authenticated, service_role;
revoke execute on function public.learning_room_action(text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.learning_room_action(text, text, jsonb, boolean) to service_role;
