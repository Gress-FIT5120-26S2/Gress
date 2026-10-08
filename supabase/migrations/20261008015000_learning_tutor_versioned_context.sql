-- Arthur: NarIyirm
-- 中文：恢复会话绑定原不可变教材，后续教材版本不能悄悄替换证据；身份/考试仍由原 gate 再验。
-- EN: Restored conversations retain their immutable manifest; later versions cannot silently replace evidence, while the original gate rechecks identity and assessments.
create function public.learning_tutor_conversation_context(p_device_id text,p_context jsonb,p_intent text,p_allow_draft boolean,p_conversation_uid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare gate jsonb; conv public.learning_tutor_conversations; m public.learning_tutor_manifests;
begin
  gate:=public.learning_tutor_context(p_device_id,p_context,p_intent,p_allow_draft);
  if p_conversation_uid is null then return gate; end if;
  select * into conv from public.learning_tutor_conversations where conversation_uid=p_conversation_uid
    and learner_uid=(gate->>'learnerUid')::uuid and expires_at>now();
  if not found then raise exception 'tutor_conversation_not_found'; end if;
  if conv.context<>p_context then raise exception 'tutor_context_invalid'; end if;
  select * into m from public.learning_tutor_manifests where manifest_version=conv.manifest_version
    and content_version=p_context->>'contentVersion' and content_hash=gate #>> '{manifest,contentHash}'
    and (status='published' or p_allow_draft and status='draft');
  if not found then raise exception 'tutor_content_unavailable'; end if;
  return gate||jsonb_build_object('manifest',m.body,'manifestVersion',m.manifest_version);
end $$;
revoke all on function public.learning_tutor_conversation_context(text,jsonb,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.learning_tutor_conversation_context(text,jsonb,text,boolean,uuid) to service_role;

do $$ declare definition text; old_gate text:='gate := public.learning_tutor_context(p_device_id,p_payload->''context'',p_payload->>''intent'',p_allow_draft);'; begin
  select pg_get_functiondef('public.learning_tutor_action(text,text,jsonb,boolean)'::regprocedure) into definition;
  if position(old_gate in definition)=0 then raise exception 'tutor_version_extension_failed'; end if;
  definition:=replace(definition,old_gate,$gate$
    gate := public.learning_tutor_conversation_context(p_device_id,p_payload->'context',p_payload->>'intent',p_allow_draft,
      coalesce((p_payload->>'conversationUid')::uuid,(select conversation_uid from public.learning_tutor_requests
        where learner_uid=l.learner_uid and request_key=p_payload->>'requestKey')));
  $gate$);
  execute definition;
end $$;

-- Arthur: NarIyirm
-- 中文：与原学堂采用同一有效凭证/成员锁，撤销身份后的在途请求不能保存导师记录。
-- EN: Use the learning room's active-credential/member lock so in-flight requests cannot save tutor records after identity revocation.
do $$ declare function_name text; definition text; begin
  foreach function_name in array array['public.learning_tutor_context(text,jsonb,text,boolean)',
    'public.learning_tutor_action(text,text,jsonb,boolean)','public.learning_tutor_support(text,text,jsonb,boolean)'] loop
    select pg_get_functiondef(function_name::regprocedure) into definition;
    if definition !~ 'perform 1 from public.fridge_members where device_id\s*=\s*p_device_id for update;' then raise exception 'tutor_identity_extension_failed'; end if;
    definition:=regexp_replace(definition,'perform 1 from public.fridge_members where device_id\s*=\s*p_device_id for update;',
      'perform 1 from public.fridge_members m join public.device_credentials c on c.device_id=m.device_id where m.device_id=p_device_id and c.status=''active'' for update of m;');
    execute definition;
  end loop;
end $$;

-- Arthur: NarIyirm
-- 中文：练习首答信号单独计算，只用于练习错题主动帮助，不进入正式复习推荐或升级。
-- EN: Practice first-answer signals stay separate and serve only practice-error help, never formal recommendations or advancement.
create function public.learning_tutor_practice_signals(p_learner uuid,p_version text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; zone text;
begin
  select time_zone into zone from public.learning_tutor_preferences where learner_uid=p_learner;
  with samples as (
    select distinct on(q->>'questionCode',(ans.answered_at at time zone coalesce(zone,'Australia/Sydney'))::date)
      q->>'topicCode' topic,ans.is_correct,ans.answered_at
    from public.learning_quiz_attempts a join public.learning_quiz_answers ans on ans.attempt_uid=a.attempt_uid
      cross join lateral jsonb_array_elements(a.question_snapshot) q
      join public.learning_content_versions c on c.content_version=a.content_version
    where a.learner_uid=p_learner and a.content_version=p_version and c.status<>'withdrawn'
      and a.mode='practice' and a.status in('in_progress','submitted') and q->>'questionUid'=ans.question_instance_uid::text
      and ans.answered_at>=now()-interval '30 days'
    order by q->>'questionCode',(ans.answered_at at time zone coalesce(zone,'Australia/Sydney'))::date,ans.answered_at desc
  ), ranked as(select *,row_number() over(partition by topic order by answered_at desc) rn from samples),
  stats as(select topic,count(*) n,count(*) filter(where not is_correct) w,
    bool_and(is_correct) filter(where rn<=2) recent_correct from ranked where rn<=5 group by topic)
  select coalesce(jsonb_agg(jsonb_build_object('topicCode',topic,'sampleCount',n,'wrongCount',w)),'[]'::jsonb)
    into result from stats where n>=2 and w>=2 and not recent_correct;
  return jsonb_build_object('topics',result,'evidenceVersion','practice-first-answers-v1');
end $$;
revoke all on function public.learning_tutor_practice_signals(uuid,text) from public,anon,authenticated,service_role;

do $$ declare definition text; old_selection text:=$old$
    select m into candidate from jsonb_array_elements(rec->'topics') m
      where p_payload->>'reason'<>'repeated-errors' or (m->>'wrongCount')::int>=2 limit 1;
$old$; begin
  select pg_get_functiondef('public.learning_tutor_support(text,text,jsonb,boolean)'::regprocedure) into definition;
  if position(old_selection in definition)=0 then raise exception 'tutor_practice_signal_extension_failed'; end if;
  definition:=replace(definition,old_selection,$new$
    if p_payload->>'reason'='repeated-errors' and exists(select 1 from public.learning_quiz_attempts
      where attempt_uid=(context->>'attemptUid')::uuid and learner_uid=l.learner_uid and mode='practice') then
      rec:=public.learning_tutor_practice_signals(l.learner_uid,context->>'contentVersion');
      select mapping||signal into candidate from jsonb_array_elements(rec->'topics') signal
        cross join jsonb_array_elements(gate #> '{manifest,topicMap}') mapping
        where signal->>'topicCode'=gate #>> '{feedback,topicCode}' and mapping->>'topicCode'=signal->>'topicCode' limit 1;
    else
      select m into candidate from jsonb_array_elements(rec->'topics') m
        where p_payload->>'reason'<>'repeated-errors' or ((m->>'wrongCount')::int>=2
          and m->>'topicCode'=gate #>> '{feedback,topicCode}') limit 1;
    end if;
$new$);
  execute definition;
end $$;
