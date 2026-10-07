begin;
-- Arthur: NarIyirm
-- 中文：这些合成答案只存在回滚事务中，验证统计/冷却的边界，不代表真实学习成绩或独立审核。
-- EN: Synthetic answers exist only in a rolled-back transaction to verify statistics/cooldown boundaries, not real grades or independent approval.
do $$
declare device text:='test_tutor_sql_'||gen_random_uuid()::text; learner uuid; attempt uuid:=gen_random_uuid();
  qid uuid; snapshot jsonb:='[]'; qids uuid[]:='{}'; i int; topic text; ctx jsonb; result jsonb; help jsonb; visit text;
  practice_attempt uuid:=gen_random_uuid();practice_qids uuid[]:='{}';practice_snapshot jsonb:='[]';expired uuid:=gen_random_uuid();
begin
  perform public.authenticate_device(device,repeat('a',64));
  perform public.learning_room_action(device,'state','{}',true);
  select learner_uid into learner from public.learning_learners where owner_device_id=device;
  ctx:='{"kind":"activity","entityCode":"advanced-climate","contentVersion":"learning-room-v1"}';
  for i in 1..6 loop
    qid:=gen_random_uuid();qids:=array_append(qids,qid);
    topic:=case when i<=2 then 'planning' when i<=4 then 'storage-safety' else 'climate-evidence' end;
    snapshot:=snapshot||jsonb_build_array(jsonb_build_object('questionUid',qid,'questionCode','sql-test-'||i,'topicCode',topic,
      'prompt','{"en":"Synthetic test feedback","zh":"合成测试反馈"}'::jsonb,'correctOptionId','yes','explanation','{"en":"Test","zh":"测试"}'::jsonb,
      'sourceSnapshots','[]'::jsonb));
  end loop;
  insert into public.learning_quiz_attempts(attempt_uid,learner_uid,stage_code,mode,content_version,question_snapshot,question_count,
    status,correct_count,passed,create_key,submitted_at) values(attempt,learner,'beginner','checkpoint','learning-room-v1',snapshot,6,'submitted',0,false,gen_random_uuid()::text,now());
  for i in 1..6 loop
    insert into public.learning_quiz_answers(attempt_uid,question_instance_uid,selected_option_id,is_correct,request_key)
      values(attempt,qids[i],'no',false,gen_random_uuid()::text);
  end loop;
  perform public.learning_tutor_action(device,'preferences','{}',true);
  result:=public.learning_tutor_action(device,'recommendations',jsonb_build_object('context',ctx),true);
  if jsonb_array_length(result->'topics')<>2 then raise exception 'expected_two_review_topics'; end if;
  if exists(select 1 from jsonb_array_elements(result->'topics') t where (t->>'sampleCount')::int<>2 or (t->>'wrongCount')::int<>2) then raise exception 'wrong_sample_counts'; end if;
  visit:=gen_random_uuid()::text;
  help:=public.learning_tutor_action(device,'intervention-claim',jsonb_build_object('context',ctx,'reason','checkpoint-failed','attemptUid',attempt,'visitKey',visit),true);
  if help->'intervention'='null'::jsonb then raise exception 'failed_checkpoint_help_missing'; end if;
  result:=public.learning_tutor_action(device,'intervention-claim',jsonb_build_object('context',ctx,'reason','checkpoint-failed','attemptUid',attempt,'visitKey',visit),true);
  if result->'intervention'<>'null'::jsonb then raise exception 'duplicate_intervention'; end if;
  perform public.learning_tutor_action(device,'intervention-respond',jsonb_build_object('interventionUid',help #>> '{intervention,interventionUid}','status','dismissed'),true);
  update public.learning_tutor_interventions set created_at=now()-interval '6 minutes' where learner_uid=learner;
  result:=public.learning_tutor_action(device,'intervention-claim',jsonb_build_object('context',ctx,'reason','checkpoint-failed','attemptUid',attempt,'visitKey',gen_random_uuid()),true);
  if result->'intervention'<>'null'::jsonb then raise exception 'result_dedupe_failed'; end if;
  perform public.learning_tutor_action(device,'preferences-update','{"dwellHintsEnabled":true}',true);
  result:=public.learning_tutor_action(device,'intervention-claim',jsonb_build_object('context',ctx,'reason','dwell','visitKey',gen_random_uuid()),true);
  if help #>> '{intervention,topicCode}'='climate-evidence' and result->'intervention'<>'null'::jsonb then raise exception 'dismiss_24h_failed'; end if;
  delete from public.learning_tutor_interventions where learner_uid=learner;
  for i in 1..3 loop
    result:=public.learning_tutor_action(device,'intervention-claim',jsonb_build_object('context',ctx,'reason','dwell','visitKey',gen_random_uuid()),true);
    if result->'intervention'='null'::jsonb then raise exception 'daily_quota_underflow'; end if;
    update public.learning_tutor_interventions set created_at=now()-interval '6 minutes' where learner_uid=learner;
  end loop;
  result:=public.learning_tutor_action(device,'intervention-claim',jsonb_build_object('context',ctx,'reason','dwell','visitKey',gen_random_uuid()),true);
  if result->'intervention'<>'null'::jsonb then raise exception 'daily_quota_failed'; end if;
  update public.learning_quiz_answers set is_correct=true where attempt_uid=attempt and question_instance_uid in(qids[1],qids[2]);
  result:=public.learning_tutor_action(device,'recommendations',jsonb_build_object('context',ctx),true);
  if exists(select 1 from jsonb_array_elements(result->'topics') t where t->>'topicCode'='planning') then raise exception 'two_correct_should_stop'; end if;
  perform public.learning_tutor_action(device,'preferences-update','{"personalizedEnabled":false}',true);
  result:=public.learning_tutor_action(device,'recommendations',jsonb_build_object('context',ctx),true);
  if jsonb_array_length(result->'topics')<>0 then raise exception 'personalization_off_failed'; end if;
  perform public.learning_tutor_action(device,'preferences-update','{"personalizedEnabled":true}',true);
  delete from public.learning_tutor_interventions where learner_uid=learner;
  for i in 1..3 loop
    qid:=gen_random_uuid();practice_qids:=array_append(practice_qids,qid);
    practice_snapshot:=practice_snapshot||jsonb_build_array(jsonb_build_object('questionUid',qid,'questionCode',case when i<3 then 'same-practice' else 'another-practice' end,'topicCode','materials',
      'prompt','{"en":"Synthetic practice","zh":"合成练习"}'::jsonb,'correctOptionId','yes','explanation','{"en":"Test","zh":"测试"}'::jsonb,'sourceSnapshots','[]'::jsonb));
  end loop;
  insert into public.learning_quiz_attempts(attempt_uid,learner_uid,stage_code,mode,activity_code,content_version,question_snapshot,question_count,status,correct_count,passed,submitted_at,create_key)
    values(practice_attempt,learner,'beginner','practice','beginner-bin-action','learning-room-v1',practice_snapshot,3,'submitted',0,false,now(),gen_random_uuid()::text);
  for i in 1..2 loop
    insert into public.learning_quiz_answers(attempt_uid,question_instance_uid,selected_option_id,is_correct,request_key)
      values(practice_attempt,practice_qids[i],'no',false,gen_random_uuid()::text);
  end loop;
  result:=public.learning_tutor_practice_signals(learner,'learning-room-v1');
  if jsonb_array_length(result->'topics')<>0 then raise exception 'same_question_day_should_count_once'; end if;
  insert into public.learning_quiz_answers(attempt_uid,question_instance_uid,selected_option_id,is_correct,request_key)
    values(practice_attempt,practice_qids[3],'no',false,gen_random_uuid()::text);
  ctx:=jsonb_build_object('kind','submitted-question','attemptUid',practice_attempt,'questionUid',practice_qids[3],'contentVersion','learning-room-v1');
  help:=public.learning_tutor_action(device,'intervention-claim',jsonb_build_object('context',ctx,'reason','repeated-errors','visitKey',gen_random_uuid()),true);
  if help->'intervention'='null'::jsonb or help #>> '{intervention,topicCode}'<>'materials' then raise exception 'practice_separate_signal_failed'; end if;
  result:=public.learning_tutor_action(device,'recommendations',jsonb_build_object('context','{"kind":"general","contentVersion":"learning-room-v1"}'::jsonb),true);
  if exists(select 1 from jsonb_array_elements(result->'topics') t where t->>'topicCode'='materials') then raise exception 'practice_polluted_formal_statistics'; end if;
  result:=public.learning_tutor_action(device,'intervention-claim',jsonb_build_object('context',ctx,'reason','repeated-errors','visitKey',gen_random_uuid()),true);
  if result->'intervention'<>'null'::jsonb then raise exception 'five_minute_gap_failed'; end if;
  perform public.learning_tutor_action(device,'intervention-respond',jsonb_build_object('interventionUid',help #>> '{intervention,interventionUid}','status','dismissed'),true);
  update public.learning_tutor_interventions set created_at=now()-interval '6 minutes' where learner_uid=learner;
  result:=public.learning_tutor_action(device,'intervention-claim',jsonb_build_object('context',ctx,'reason','repeated-errors','visitKey',gen_random_uuid()),true);
  if result->'intervention'<>'null'::jsonb then raise exception 'practice_24h_dismiss_failed'; end if;
  insert into public.learning_tutor_conversations(conversation_uid,learner_uid,context,manifest_version,expires_at)
    values(expired,learner,'{}','learning-tutor-v1',now()-interval '1 minute');
  insert into public.learning_tutor_messages(learner_uid,conversation_uid,role,content) values(learner,expired,'user','retention fixture');
  insert into public.learning_tutor_requests(learner_uid,request_key,payload_hash,conversation_uid,status,response,state)
    values(learner,'retention-test','hash',expired,'completed','{"answer":"fixture"}','{"message":"fixture"}');
  perform public.cleanup_learning_tutor();
  if exists(select 1 from public.learning_tutor_conversations where conversation_uid=expired)
    or exists(select 1 from public.learning_tutor_messages where conversation_uid=expired)
    or exists(select 1 from public.learning_tutor_requests where learner_uid=learner and request_key='retention-test' and (response is not null or state<>'{}'::jsonb)) then raise exception 'retention_purge_failed'; end if;
  if has_table_privilege('anon','public.learning_tutor_messages','select') or has_function_privilege('authenticated','public.learning_tutor_action(text,text,jsonb,boolean)','execute') then raise exception 'tutor_rls_privilege_failed'; end if;
  insert into public.learning_tutor_conversations(conversation_uid,learner_uid,context,manifest_version)
    values(expired,learner,'{"kind":"general","contentVersion":"learning-room-v1"}','learning-tutor-v1');
  result:=public.learning_tutor_conversation_context(device,'{"kind":"general","contentVersion":"learning-room-v1"}',null,true,expired);
  if result->>'manifestVersion'<>'learning-tutor-v1' then raise exception 'restored_manifest_version_changed'; end if;
  begin
    perform public.learning_tutor_context(device,'{"kind":"general","contentVersion":"learning-room-v1"}',null,false);
    raise exception 'draft_gate_should_reject';
  exception when others then if sqlerrm<>'tutor_content_unavailable' then raise; end if; end;
  update public.learning_tutor_manifests set status='withdrawn' where manifest_version='learning-tutor-v1';
  result:=public.learning_tutor_action(device,'read',jsonb_build_object('conversationUid',expired),true);
  if not (result->>'withdrawn')::boolean then raise exception 'withdrawn_history_marker_missing'; end if;
  begin
    perform public.learning_tutor_conversation_context(device,'{"kind":"general","contentVersion":"learning-room-v1"}',null,true,expired);
    raise exception 'withdrawn_conversation_should_reject';
  exception when others then if sqlerrm<>'tutor_content_unavailable' then raise; end if; end;
end $$;
rollback;
