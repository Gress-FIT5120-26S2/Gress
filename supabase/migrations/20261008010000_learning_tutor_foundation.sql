-- Arthur: NarIyirm
-- 中文：导师归属个人 learner，服务端 RPC 锁定身份与幂等请求，不带冰箱写入权限。
-- EN: Tutor data belongs to a learner; server RPCs lock identity and idempotent requests without fridge mutations.
create table public.learning_tutor_manifests (
  manifest_version text primary key,
  content_version text not null references public.learning_content_versions(content_version),
  content_hash text not null,
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  body jsonb not null,
  status text not null default 'draft' check (status in ('draft','published','withdrawn')),
  review_metadata jsonb not null,
  created_at timestamptz not null default now()
);
create table public.learning_tutor_conversations (
  conversation_uid uuid primary key default gen_random_uuid(),
  learner_uid uuid not null references public.learning_learners on delete cascade,
  context jsonb not null,
  manifest_version text not null references public.learning_tutor_manifests,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  unique (conversation_uid,learner_uid)
);
create index learning_tutor_history on public.learning_tutor_conversations(learner_uid,created_at desc);
create table public.learning_tutor_messages (
  message_uid uuid primary key default gen_random_uuid(),
  learner_uid uuid not null references public.learning_learners on delete cascade,
  conversation_uid uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 6000),
  response jsonb,
  rating text check (rating in ('useful','not_useful')),
  reason_code text check (reason_code in ('helpful','unclear','source','other')),
  created_at timestamptz not null default now(),
  foreign key (conversation_uid,learner_uid) references public.learning_tutor_conversations(conversation_uid,learner_uid)
    on delete cascade deferrable initially deferred
);
create index learning_tutor_transcript on public.learning_tutor_messages(conversation_uid,created_at);
create table public.learning_tutor_requests (
  learner_uid uuid not null references public.learning_learners on delete cascade,
  request_key text not null,
  payload_hash text not null,
  conversation_uid uuid,
  manifest_version text references public.learning_tutor_manifests,
  status text not null check (status in ('pending','completed','uncertain','deleted')),
  lease_uid uuid,
  response jsonb,
  usage jsonb,
  state jsonb not null default '{}',
  created_at timestamptz not null default now(),
  lease_until timestamptz,
  primary key (learner_uid,request_key),
  foreign key (conversation_uid,learner_uid) references public.learning_tutor_conversations(conversation_uid,learner_uid)
    deferrable initially deferred
);
create table public.learning_tutor_preferences (
  learner_uid uuid primary key references public.learning_learners on delete cascade,
  proactive_enabled boolean not null default true,
  personalized_enabled boolean not null default true,
  dwell_hints_enabled boolean not null default false,
  time_zone text not null default 'Australia/Sydney'
);
create table public.learning_tutor_interventions (
  intervention_uid uuid primary key default gen_random_uuid(),
  learner_uid uuid not null references public.learning_learners on delete cascade,
  dedupe_key text not null,
  topic_code text not null,
  reason text not null check (reason in ('repeated-errors','checkpoint-failed','before-practice','dwell')),
  context jsonb not null,
  status text not null default 'claimed' check (status in ('claimed','shown','accepted','dismissed')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (learner_uid,dedupe_key)
);
create index learning_tutor_cooldown on public.learning_tutor_interventions(learner_uid,created_at desc);

create function public.guard_learning_tutor_manifest() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.learning_content_versions;
begin
  select * into c from public.learning_content_versions where content_version = new.content_version;
  if c.content_hash <> new.content_hash then raise exception 'tutor_content_changed'; end if;
  if tg_op = 'UPDATE' and (new.body,new.content_hash,new.manifest_hash,new.content_version,new.manifest_version)
    is distinct from (old.body,old.content_hash,old.manifest_hash,old.content_version,old.manifest_version) then
    raise exception 'tutor_manifest_immutable'; end if;
  if tg_op = 'UPDATE' and ((old.status = 'withdrawn' and new.status <> 'withdrawn') or (old.status = 'published' and new.status = 'draft')) then
    raise exception 'tutor_manifest_immutable'; end if;
  if new.status = 'published' and (c.status <> 'published'
    or coalesce(new.review_metadata->>'status','') <> 'approved'
    or new.review_metadata->>'approvedManifestHash' is distinct from new.manifest_hash
    or nullif(btrim(new.review_metadata->>'reviewer'),'') is null
    or lower(new.review_metadata->>'reviewer') = lower(new.review_metadata->>'author')
    or nullif(new.review_metadata->>'reviewedAt','') is null
    or exists(select 1 from jsonb_array_elements(new.body->'practiceTemplates') t where coalesce(t->>'independentStatus','')<>'approved')) then raise exception 'tutor_review_required'; end if;
  return new;
end $$;
create trigger learning_tutor_manifest_guard before insert or update on public.learning_tutor_manifests
  for each row execute function public.guard_learning_tutor_manifest();

-- Arthur: NarIyirm
-- 中文：只投影公开教材与本人这一题；完整快照和私有题库从不越过数据库边界。
-- EN: Project only public teaching content and this learner's single question; full snapshots and the private bank never cross this boundary.
create function public.learning_tutor_context(p_device_id text,p_context jsonb,p_intent text default null,p_allow_draft boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.learning_learners; c public.learning_content_versions; m public.learning_tutor_manifests;
  a public.learning_quiz_attempts; q jsonb; ans public.learning_quiz_answers; entity jsonb; label jsonb; feedback jsonb;
begin
  perform 1 from public.fridge_members where device_id = p_device_id for update;
  if not found then raise exception 'no_device'; end if;
  insert into public.learning_learners(owner_device_id) values(p_device_id) on conflict(owner_device_id) do nothing;
  select * into l from public.learning_learners where owner_device_id = p_device_id for update;
  select * into c from public.learning_content_versions where content_version = p_context->>'contentVersion'
    and (status = 'published' or (p_allow_draft and status = 'draft'));
  if not found then raise exception 'tutor_content_unavailable'; end if;
  select * into m from public.learning_tutor_manifests where content_version = c.content_version and content_hash = c.content_hash
    and (status = 'published' or (p_allow_draft and status = 'draft')) order by created_at desc limit 1;
  if not found then raise exception 'tutor_content_unavailable'; end if;
  if exists(select 1 from public.learning_quiz_attempts where learner_uid = l.learner_uid and mode = 'checkpoint' and status = 'in_progress')
    and (p_context->>'kind' <> 'submitted-question' or coalesce(p_intent,'') not in ('explain','simplify','example')) then
    raise exception 'tutor_assessment_restricted'; end if;
  label := jsonb_build_object('en','Waste & climate learning','zh','浪费与气候学习');
  if p_context->>'kind' in ('submitted-question','practice-question') then
    select * into a from public.learning_quiz_attempts where attempt_uid = (p_context->>'attemptUid')::uuid and learner_uid = l.learner_uid;
    if not found then raise exception 'tutor_feedback_not_available'; end if;
    if a.content_version <> c.content_version then raise exception 'tutor_content_changed'; end if;
    select item into q from jsonb_array_elements(a.question_snapshot) item where item->>'questionUid' = p_context->>'questionUid';
    if q is null then raise exception 'tutor_feedback_not_available'; end if;
    select * into ans from public.learning_quiz_answers where attempt_uid = a.attempt_uid and question_instance_uid = (p_context->>'questionUid')::uuid;
    if p_context->>'kind' = 'practice-question' then
      if a.mode <> 'practice' or a.status <> 'in_progress' or p_intent <> 'hint'
        or q->>'questionUid' <> a.question_snapshot->(a.cursor_position-1)->>'questionUid' then raise exception 'tutor_context_invalid'; end if;
      feedback := jsonb_build_object('question',q->'prompt','serviceCondition',q->'serviceCondition','topicCode',q->'topicCode');
    else
      if ans.answer_uid is null or p_intent not in ('explain','simplify','example') then raise exception 'tutor_feedback_not_available'; end if;
      feedback := jsonb_build_object('question',q->'prompt','serviceCondition',q->'serviceCondition','options',q->'options',
        'selectedOptionId',ans.selected_option_id,'correctOptionId',q->'correctOptionId','explanation',q->'explanation','topicCode',q->'topicCode');
    end if;
    feedback := feedback || jsonb_build_object('sources',q->'sourceSnapshots');
    label := q->'prompt';
  elsif p_context->>'kind' in ('course','activity','resource') then
    select item into entity from jsonb_array_elements(case p_context->>'kind' when 'course' then c.public_catalog->'courses'
      when 'activity' then c.public_catalog->'activities' else c.public_catalog->'resources' end) item
      where coalesce(item->>'courseCode',item->>'activityCode',item->>'resourceCode') = p_context->>'entityCode';
    if entity is null then raise exception 'tutor_context_invalid'; end if;
    label := entity->'title';
  elsif p_context->>'kind' = 'practice-template' then
    select item into entity from jsonb_array_elements(m.body->'practiceTemplates') item where item->>'templateCode' = p_context->>'entityCode';
    if entity is null then raise exception 'tutor_context_invalid'; end if;
    label := entity->'title';
  elsif p_context->>'kind' <> 'general' then raise exception 'tutor_context_invalid'; end if;
  return jsonb_build_object('learnerUid',l.learner_uid,'catalog',c.public_catalog,'manifest',m.body,'manifestVersion',m.manifest_version,
    'label',label,'feedback',feedback,'preferences',coalesce((select jsonb_build_object('proactiveEnabled',proactive_enabled,
      'personalizedEnabled',personalized_enabled,'dwellHintsEnabled',dwell_hints_enabled,'timeZone',time_zone)
      from public.learning_tutor_preferences where learner_uid=l.learner_uid),
      '{"proactiveEnabled":true,"personalizedEnabled":true,"dwellHintsEnabled":false,"timeZone":"Australia/Sydney"}'::jsonb));
end $$;

create function public.learning_tutor_action(p_device_id text,p_action text,p_payload jsonb default '{}',p_allow_draft boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.learning_learners; r public.learning_tutor_requests; conv public.learning_tutor_conversations;
  pref public.learning_tutor_preferences; gate jsonb; uid uuid; lease uuid; result jsonb; template jsonb;
  intervention public.learning_tutor_interventions;
begin
  perform 1 from public.fridge_members where device_id=p_device_id for update;
  if not found then raise exception 'no_device'; end if;
  insert into public.learning_learners(owner_device_id) values(p_device_id) on conflict(owner_device_id) do nothing;
  select * into l from public.learning_learners where owner_device_id=p_device_id for update;
  insert into public.learning_tutor_preferences(learner_uid) values(l.learner_uid) on conflict do nothing;
  select * into pref from public.learning_tutor_preferences where learner_uid=l.learner_uid;
  if p_action in ('preferences','preferences-update') then
    if p_action='preferences-update' then
      if p_payload ? 'timeZone' and not exists(select 1 from pg_catalog.pg_timezone_names where name=p_payload->>'timeZone') then raise exception 'invalid_input'; end if;
      update public.learning_tutor_preferences set proactive_enabled=coalesce((p_payload->>'proactiveEnabled')::boolean,proactive_enabled),
        personalized_enabled=coalesce((p_payload->>'personalizedEnabled')::boolean,personalized_enabled),
        dwell_hints_enabled=coalesce((p_payload->>'dwellHintsEnabled')::boolean,dwell_hints_enabled),
        time_zone=coalesce(p_payload->>'timeZone',time_zone) where learner_uid=l.learner_uid returning * into pref;
    end if;
    return jsonb_build_object('proactiveEnabled',pref.proactive_enabled,'personalizedEnabled',pref.personalized_enabled,
      'dwellHintsEnabled',pref.dwell_hints_enabled,'timeZone',pref.time_zone);
  elsif p_action='list' then
    return jsonb_build_object('conversations',coalesce((select jsonb_agg(item) from (select jsonb_build_object('conversationUid',conversation_uid,
      'context',context,'createdAt',created_at,'expiresAt',expires_at) item from public.learning_tutor_conversations
      where learner_uid=l.learner_uid and expires_at>now() and (not(p_payload ? 'before') or created_at<(p_payload->>'before')::timestamptz)
        and (not(p_payload ? 'context') or context=p_payload->'context') order by created_at desc limit 20) entries),'[]'));
  elsif p_action in ('read','delete','clear') then
    if p_action <> 'clear' then
      select * into conv from public.learning_tutor_conversations where conversation_uid=(p_payload->>'conversationUid')::uuid
        and learner_uid=l.learner_uid and expires_at>now();
      if conv.conversation_uid is null and p_action='read' then raise exception 'tutor_conversation_not_found'; end if;
    end if;
    if p_action='read' then
      return jsonb_build_object('conversationUid',conv.conversation_uid,'context',conv.context,'createdAt',conv.created_at,'expiresAt',conv.expires_at,
        'withdrawn',exists(select 1 from public.learning_tutor_manifests m join public.learning_content_versions c using(content_version)
          where m.manifest_version=conv.manifest_version and (m.status='withdrawn' or c.status='withdrawn')),
        'messages',coalesce((select jsonb_agg(item order by created_at,message_uid) from (select message_uid,created_at,jsonb_build_object('messageUid',message_uid,
          'role',role,'content',content,'response',response,'rating',rating,'createdAt',created_at) item from public.learning_tutor_messages
          where learner_uid=l.learner_uid and conversation_uid=conv.conversation_uid order by created_at desc limit 100) entries),'[]'));
    end if;
    update public.learning_tutor_requests set status='deleted',response=null,usage=null,lease_uid=null,conversation_uid=null,state='{}'
      where learner_uid=l.learner_uid and (p_action='clear' or conversation_uid=conv.conversation_uid);
    delete from public.learning_tutor_conversations where learner_uid=l.learner_uid and (p_action='clear' or conversation_uid=conv.conversation_uid);
    return '{"deleted":true}';
  elsif p_action='feedback' then
    update public.learning_tutor_messages set rating=p_payload->>'rating',reason_code=p_payload->>'reasonCode'
      where message_uid=(p_payload->>'messageUid')::uuid and learner_uid=l.learner_uid and role='assistant'
        and conversation_uid in(select conversation_uid from public.learning_tutor_conversations where expires_at>now());
    if not found then raise exception 'tutor_conversation_not_found'; end if;
    return '{"saved":true}';
  elsif p_action in ('claim','finish','practice-answer','hint') then
    gate := public.learning_tutor_context(p_device_id,p_payload->'context',p_payload->>'intent',p_allow_draft);
    select * into r from public.learning_tutor_requests where learner_uid=l.learner_uid and request_key=p_payload->>'requestKey' for update;
    if r.request_key is not null then
      if r.payload_hash<>p_payload->>'payloadHash' then raise exception 'tutor_request_conflict'; end if;
      if r.status='deleted' then raise exception 'tutor_conversation_not_found'; end if;
      if r.status='completed' then return jsonb_build_object('cached',true,'response',r.response); end if;
      if p_action<>'finish' then
        if r.status='pending' and r.lease_until>now() then raise exception 'tutor_request_pending'; end if;
        raise exception 'tutor_request_uncertain';
      end if;
    end if;
    if p_action='hint' then
      uid := gen_random_uuid();
      result := jsonb_build_object('hintLevel',least(3,1+(select count(*) from public.learning_tutor_requests where learner_uid=l.learner_uid
        and state->>'questionUid'=p_payload #>> '{context,questionUid}' and state->>'attemptUid'=p_payload #>> '{context,attemptUid}')),
        'topicCode',gate #>> '{feedback,topicCode}');
      insert into public.learning_tutor_requests(learner_uid,request_key,payload_hash,status,response,state)
        values(l.learner_uid,p_payload->>'requestKey',p_payload->>'payloadHash','completed',result,p_payload->'context');
      return jsonb_build_object('response',result);
    elsif p_action='practice-answer' then
      select item into template from jsonb_array_elements(gate #> '{manifest,practiceTemplates}') item
        where item->>'templateCode'=p_payload #>> '{context,entityCode}';
      if not exists(select 1 from jsonb_array_elements(template->'options') item where item->>'optionId'=p_payload->>'optionId') then raise exception 'invalid_input'; end if;
      result:=jsonb_build_object('isCorrect',template->>'correctOptionId'=p_payload->>'optionId','correctOptionId',template->>'correctOptionId',
        'explanation',template->'explanation','sourceRefs',template->'sourceRefs','scored',false);
      insert into public.learning_tutor_requests(learner_uid,request_key,payload_hash,status,response,state)
        values(l.learner_uid,p_payload->>'requestKey',p_payload->>'payloadHash','completed',result,p_payload->'context');
      return jsonb_build_object('response',result);
    elsif p_action='claim' then
      if p_payload ? 'conversationUid' then
        select * into conv from public.learning_tutor_conversations where conversation_uid=(p_payload->>'conversationUid')::uuid
          and learner_uid=l.learner_uid and expires_at>now();
        if not found then raise exception 'tutor_conversation_not_found'; end if;
        if conv.context<>p_payload->'context' or conv.manifest_version<>gate->>'manifestVersion' then raise exception 'tutor_context_invalid'; end if;
      else
        insert into public.learning_tutor_conversations(learner_uid,context,manifest_version) values(l.learner_uid,p_payload->'context',gate->>'manifestVersion') returning * into conv;
      end if;
      if (select count(*) from public.learning_tutor_messages where conversation_uid=conv.conversation_uid)>=100 then raise exception 'tutor_conversation_full'; end if;
      lease:=gen_random_uuid();
      insert into public.learning_tutor_requests(learner_uid,request_key,payload_hash,conversation_uid,manifest_version,status,lease_uid,lease_until,state)
        values(l.learner_uid,p_payload->>'requestKey',p_payload->>'payloadHash',conv.conversation_uid,gate->>'manifestVersion','pending',lease,now()+interval '40 seconds',
          jsonb_build_object('intent',p_payload->>'intent'));
      return jsonb_build_object('conversationUid',conv.conversation_uid,'leaseUid',lease,'learnerUid',l.learner_uid);
    else
      if r.request_key is null or r.lease_uid is distinct from (p_payload->>'leaseUid')::uuid or r.status<>'pending' or r.lease_until<now() then raise exception 'tutor_request_uncertain'; end if;
      if r.manifest_version<>gate->>'manifestVersion' then raise exception 'tutor_content_changed'; end if;
      select * into conv from public.learning_tutor_conversations where conversation_uid=r.conversation_uid and learner_uid=l.learner_uid and expires_at>now();
      if not found then raise exception 'tutor_conversation_not_found'; end if;
      uid:=gen_random_uuid();
      result:=p_payload->'response'||jsonb_build_object('conversationUid',conv.conversation_uid,'messageUid',uid);
      insert into public.learning_tutor_messages(learner_uid,conversation_uid,role,content,created_at) values(l.learner_uid,conv.conversation_uid,'user',p_payload->>'userText',clock_timestamp());
      insert into public.learning_tutor_messages(message_uid,learner_uid,conversation_uid,role,content,response,created_at)
        values(uid,l.learner_uid,conv.conversation_uid,'assistant',result->>'answer',result,clock_timestamp());
      update public.learning_tutor_requests set status='completed',response=result,usage=p_payload->'usage',lease_uid=null where learner_uid=l.learner_uid and request_key=r.request_key;
      return jsonb_build_object('response',result);
    end if;
  elsif p_action='uncertain' then
    update public.learning_tutor_requests set status='uncertain',lease_uid=null where learner_uid=l.learner_uid and request_key=p_payload->>'requestKey'
      and status='pending' and lease_uid=(p_payload->>'leaseUid')::uuid;
    return '{"saved":true}';
  elsif p_action='intervention-respond' then
    select * into intervention from public.learning_tutor_interventions where intervention_uid=(p_payload->>'interventionUid')::uuid and learner_uid=l.learner_uid for update;
    if not found then raise exception 'tutor_conversation_not_found'; end if;
    if intervention.status=p_payload->>'status' then return '{"saved":true}'; end if;
    if intervention.status in('accepted','dismissed') or p_payload->>'status' not in('shown','accepted','dismissed') then raise exception 'tutor_request_conflict'; end if;
    update public.learning_tutor_interventions set status=p_payload->>'status',responded_at=now() where intervention_uid=intervention.intervention_uid;
    return '{"saved":true}';
  else raise exception 'invalid_input'; end if;
end $$;

create function public.cleanup_learning_tutor() returns void language plpgsql security definer set search_path='' as $$
begin
  update public.learning_tutor_requests set status='deleted',response=null,usage=null,state='{}',lease_uid=null,conversation_uid=null
    where conversation_uid in(select conversation_uid from public.learning_tutor_conversations where expires_at<=now());
  delete from public.learning_tutor_conversations where expires_at<=now();
  delete from public.learning_tutor_requests where created_at<now()-interval '90 days';
  delete from public.learning_tutor_interventions where created_at<now()-interval '90 days';
end $$;

do $$ declare t text; begin
  foreach t in array array['learning_tutor_manifests','learning_tutor_conversations','learning_tutor_messages','learning_tutor_requests','learning_tutor_preferences','learning_tutor_interventions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to service_role',t);
  end loop;
end $$;
revoke all on function public.guard_learning_tutor_manifest() from public,anon,authenticated,service_role;
revoke all on function public.learning_tutor_context(text,jsonb,text,boolean) from public,anon,authenticated;
revoke all on function public.learning_tutor_action(text,text,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.cleanup_learning_tutor() from public,anon,authenticated;
grant execute on function public.learning_tutor_context(text,jsonb,text,boolean),public.learning_tutor_action(text,text,jsonb,boolean),public.cleanup_learning_tutor() to service_role;

-- Arthur: NarIyirm
-- 中文：在原恢复函数删除临时 learner 之前搬移导师数据；不依赖多个 AFTER trigger 的执行顺序。
-- EN: Move tutor data before the existing recovery function deletes the temporary learner, independent of AFTER trigger ordering.
do $$ declare definition text; begin
  select pg_get_functiondef('public.transfer_learning_with_membership()'::regprocedure) into definition;
  definition:=replace(definition,'    delete from public.learning_learners where learner_uid = temporary_uid;', $recovery$
    update public.learning_tutor_requests set status='uncertain',lease_uid=null where learner_uid in(old_uid,temporary_uid) and status='pending';
    update public.learning_tutor_requests r set request_key='recovery:'||gen_random_uuid()::text
      where r.learner_uid=temporary_uid and exists(select 1 from public.learning_tutor_requests x where x.learner_uid=old_uid and x.request_key=r.request_key);
    update public.learning_tutor_conversations set learner_uid=old_uid where learner_uid=temporary_uid;
    update public.learning_tutor_messages set learner_uid=old_uid where learner_uid=temporary_uid;
    update public.learning_tutor_requests set learner_uid=old_uid where learner_uid=temporary_uid;
    insert into public.learning_tutor_preferences select old_uid,proactive_enabled,personalized_enabled,dwell_hints_enabled,time_zone
      from public.learning_tutor_preferences where learner_uid=temporary_uid on conflict do nothing;
    update public.learning_tutor_interventions i set dedupe_key='recovery:'||i.intervention_uid::text
      where i.learner_uid=temporary_uid and exists(select 1 from public.learning_tutor_interventions x where x.learner_uid=old_uid and x.dedupe_key=i.dedupe_key);
    update public.learning_tutor_interventions set learner_uid=old_uid where learner_uid=temporary_uid;
    delete from public.learning_learners where learner_uid = temporary_uid;
$recovery$);
  if position('update public.learning_tutor_conversations' in definition)=0 then raise exception 'tutor_recovery_extension_failed'; end if;
  execute definition;
end $$;

create extension if not exists pg_cron;
select cron.schedule('learning-tutor-retention','17 3 * * *','select public.cleanup_learning_tutor()');
