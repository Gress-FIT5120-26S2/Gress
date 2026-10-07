alter table public.learning_tutor_interventions add column visit_key text;
create unique index learning_tutor_one_visit on public.learning_tutor_interventions(learner_uid,visit_key) where visit_key is not null;

-- Arthur: NarIyirm
-- 中文：本人近30天首答按题目/本地日去重，正式与练习不混；只返回当前版本最多两个可解释的复习 topic。
-- EN: Deduplicate this learner's 30-day first answers by question/local day, keep formal and practice samples separate, and return at most two explainable topics for this version.
create function public.learning_tutor_recommendations(p_learner uuid,p_version text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; pref public.learning_tutor_preferences; manifest jsonb;
begin
  select * into pref from public.learning_tutor_preferences where learner_uid=p_learner;
  if not coalesce(pref.personalized_enabled,true) then return '{"topics":[],"ruleVersion":"tutor-r1","evidenceVersion":"first-answers-v1","windowDays":30}'; end if;
  select body into manifest from public.learning_tutor_manifests where content_version=p_version and status<>'withdrawn' order by created_at desc limit 1;
  with samples as (
    select distinct on(q->>'questionCode',(ans.answered_at at time zone coalesce(pref.time_zone,'Australia/Sydney'))::date)
      q->>'topicCode' topic,ans.is_correct,ans.answered_at
    from public.learning_quiz_attempts a join public.learning_quiz_answers ans on ans.attempt_uid=a.attempt_uid
      cross join lateral jsonb_array_elements(a.question_snapshot) q
      join public.learning_content_versions c on c.content_version=a.content_version
    where a.learner_uid=p_learner and a.content_version=p_version and c.status<>'withdrawn' and a.status='submitted'
      and a.mode in('checkpoint','review','mixed-review') and q->>'questionUid'=ans.question_instance_uid::text
      and ans.answered_at>=now()-interval '30 days'
    order by q->>'questionCode',(ans.answered_at at time zone coalesce(pref.time_zone,'Australia/Sydney'))::date,ans.answered_at desc
  ), ranked as(select *,row_number() over(partition by topic order by answered_at desc) rn from samples),
  stats as(select topic,count(*) n,count(*) filter(where not is_correct) w,max(answered_at) filter(where not is_correct) last_wrong,
    bool_and(is_correct) filter(where rn<=2) recent_correct from ranked where rn<=5 group by topic),
  chosen as(select jsonb_build_object('topicCode',s.topic,'sampleCount',s.n,'wrongCount',s.w,'activityCode',m->>'activityCode',
      'resourceCode',m->>'resourceCode','templateCode',m->>'templateCode') item
    from stats s cross join jsonb_array_elements(manifest->'topicMap') with ordinality map(m,ord)
    where s.topic=m->>'topicCode' and s.n>=2 and s.w>=1 and not s.recent_correct order by s.w desc,s.last_wrong desc,map.ord limit 2)
  select coalesce(jsonb_agg(item),'[]') into result from chosen;
  return jsonb_build_object('topics',result,'ruleVersion','tutor-r1','evidenceVersion','first-answers-v1','windowDays',30);
end $$;

create function public.learning_tutor_support(p_device_id text,p_action text,p_payload jsonb,p_allow_draft boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.learning_learners; pref public.learning_tutor_preferences; gate jsonb; rec jsonb; candidate jsonb;
  dedupe text; intervention public.learning_tutor_interventions; context jsonb; failed public.learning_quiz_attempts;
begin
  perform 1 from public.fridge_members where device_id=p_device_id for update;
  if not found then raise exception 'no_device'; end if;
  select * into l from public.learning_learners where owner_device_id=p_device_id for update;
  if exists(select 1 from public.learning_quiz_attempts where learner_uid=l.learner_uid and mode='checkpoint' and status='in_progress') then
    if p_action='recommendations' then return '{"topics":[],"ruleVersion":"tutor-r1","evidenceVersion":"first-answers-v1","windowDays":30}'; end if;
    return '{"intervention":null}';
  end if;
  gate:=public.learning_tutor_context(p_device_id,p_payload->'context',case when p_payload #>> '{context,kind}'='submitted-question' then 'explain' else null end,p_allow_draft);
  select * into l from public.learning_learners where owner_device_id=p_device_id;
  select * into pref from public.learning_tutor_preferences where learner_uid=l.learner_uid;
  rec:=public.learning_tutor_recommendations(l.learner_uid,p_payload #>> '{context,contentVersion}');
  if p_action='recommendations' then return rec; end if;
  if not pref.proactive_enabled or not pref.personalized_enabled and p_payload->>'reason'<>'dwell' then return '{"intervention":null}'; end if;
  if exists(select 1 from public.learning_tutor_interventions where learner_uid=l.learner_uid and
    (visit_key=p_payload->>'visitKey' or created_at>now()-interval '5 minutes')) then return '{"intervention":null}'; end if;
  if (select count(*) from public.learning_tutor_interventions where learner_uid=l.learner_uid
    and (created_at at time zone pref.time_zone)::date=(now() at time zone pref.time_zone)::date)>=3 then return '{"intervention":null}'; end if;
  context:=p_payload->'context';
  if p_payload->>'reason'='dwell' then
    if not pref.dwell_hints_enabled or context->>'kind' not in('activity','resource') then return '{"intervention":null}'; end if;
    select m into candidate from jsonb_array_elements(gate #> '{manifest,topicMap}') m
      where m->>'activityCode'=context->>'entityCode' or m->>'resourceCode'=context->>'entityCode' limit 1;
  else
    select m into candidate from jsonb_array_elements(rec->'topics') m
      where p_payload->>'reason'<>'repeated-errors' or (m->>'wrongCount')::int>=2 limit 1;
    if p_payload->>'reason'='checkpoint-failed' then
      select * into failed from public.learning_quiz_attempts where attempt_uid=(p_payload->>'attemptUid')::uuid and learner_uid=l.learner_uid
        and mode='checkpoint' and status='submitted' and not passed and content_version=context->>'contentVersion';
      if not found then return '{"intervention":null}'; end if;
      if exists(select 1 from public.learning_tutor_interventions where learner_uid=l.learner_uid and dedupe_key='tutor-r1:result:'||failed.attempt_uid::text) then return '{"intervention":null}'; end if;
    elsif p_payload->>'reason'='before-practice' then
      if context->>'kind'<>'activity' or not exists(select 1 from jsonb_array_elements(gate #> '{catalog,activities}') a where a->>'activityCode'=context->>'entityCode' and a->>'type'='practice') then return '{"intervention":null}'; end if;
    elsif p_payload->>'reason'='repeated-errors' then
      if context->>'kind'<>'submitted-question' then return '{"intervention":null}'; end if;
      if candidate->>'topicCode' is distinct from gate #>> '{feedback,topicCode}' then return '{"intervention":null}'; end if;
    else return '{"intervention":null}'; end if;
  end if;
  if candidate is null then return '{"intervention":null}'; end if;
  if exists(select 1 from public.learning_tutor_interventions where learner_uid=l.learner_uid and topic_code=candidate->>'topicCode'
    and status='dismissed' and responded_at>now()-interval '24 hours') then return '{"intervention":null}'; end if;
  dedupe:=case when failed.attempt_uid is not null then 'tutor-r1:result:'||failed.attempt_uid::text else 'tutor-r1:visit:'||p_payload->>'visitKey' end;
  insert into public.learning_tutor_interventions(learner_uid,dedupe_key,topic_code,reason,context,visit_key)
    values(l.learner_uid,dedupe,candidate->>'topicCode',p_payload->>'reason',context,p_payload->>'visitKey') returning * into intervention;
  return jsonb_build_object('intervention',jsonb_build_object('interventionUid',intervention.intervention_uid,'reason',intervention.reason,
    'topicCode',intervention.topic_code,'context',case when intervention.reason='dwell' then context else jsonb_build_object('kind','activity',
      'entityCode',candidate->>'activityCode','contentVersion',context->>'contentVersion') end,
    'prompt',case when intervention.reason='dwell' then '{"en":"Would you like an example?","zh":"需要一个例子吗？"}'::jsonb
      else '{"en":"This topic can be confusing. Would an example help?","zh":"这个知识点容易混淆，需要换个例子吗？"}'::jsonb end));
end $$;

revoke all on function public.learning_tutor_recommendations(uuid,text),public.learning_tutor_support(text,text,jsonb,boolean) from public,anon,authenticated,service_role;
-- Arthur: NarIyirm
-- 中文：扩展已保存的服务端 action 契约，所有帮助请求仍锁定同一 learner，频率校验和登记原子完成。
-- EN: Extend the saved server action contract; all help requests lock the same learner so frequency checks and registration remain atomic.
do $$ declare definition text; begin
  select pg_get_functiondef('public.learning_tutor_action(text,text,jsonb,boolean)'::regprocedure) into definition;
  definition:=replace(definition, '  elsif p_action=''intervention-respond'' then',
    '  elsif p_action in (''recommendations'',''intervention-claim'') then
    return public.learning_tutor_support(p_device_id,p_action,p_payload,p_allow_draft);
  elsif p_action=''intervention-respond'' then');
  if position('learning_tutor_support' in definition)=0 then raise exception 'tutor_support_extension_failed'; end if;
  execute definition;
  select pg_get_functiondef('public.transfer_learning_with_membership()'::regprocedure) into definition;
  definition:=replace(definition,'    update public.learning_tutor_interventions set learner_uid=old_uid where learner_uid=temporary_uid;',
    '    update public.learning_tutor_interventions i set visit_key=''recovery:''||i.intervention_uid::text
      where i.learner_uid=temporary_uid and exists(select 1 from public.learning_tutor_interventions x where x.learner_uid=old_uid and x.visit_key=i.visit_key);
    update public.learning_tutor_interventions set learner_uid=old_uid where learner_uid=temporary_uid;');
  execute definition;
end $$;
