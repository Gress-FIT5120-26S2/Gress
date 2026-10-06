-- Arthur: NarIyirm
-- 中文：仅供 prepare-learning-preflight.js 的回滚事务调用；用随机设备验证真实 SQL 判分和恢复，不代表内容审核通过。
-- EN: Run only inside the preflight rollback transaction; random devices exercise real SQL grading and recovery without approving content.
do $$
declare
  selections jsonb := current_setting('kitchmemo.test_selections')::jsonb;
  device_a text := 'test_learning_' || gen_random_uuid()::text;
  device_b text := 'test_learning_' || gen_random_uuid()::text;
  value jsonb;
  replay jsonb;
  attempt_id uuid;
  old_uid uuid;
  settled_id uuid;
  frozen_snapshot jsonb;
  q jsonb;
  option_value text;
  stage text;
  idx integer;
  target_correct integer;
  expected_error boolean;
  recovery_digest text := encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex');
  device_b_digest text := encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex');
begin
  perform public.authenticate_device(device_a, encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'));
  perform public.authenticate_device(device_b, device_b_digest);
  value := public.learning_room_action(device_a, 'state', '{}', true);
  assert value #>> '{session,stageStatus,beginner}' = 'unlocked';
  assert value #>> '{session,stageStatus,intermediate}' = 'locked';
  select learner_uid into old_uid from public.learning_learners where owner_device_id = device_a;
  assert not has_table_privilege('anon', 'public.learning_quiz_answers', 'SELECT');
  assert not has_function_privilege('authenticated', 'public.learning_room_action(text,text,jsonb,boolean)', 'EXECUTE');
  assert not has_function_privilege('service_role', 'public.learning_attempt_data(uuid)', 'EXECUTE');
  assert (select bool_and(relrowsecurity) from pg_class where relname like 'learning_%' and relkind = 'r');
  expected_error := false;
  begin perform public.learning_room_action(device_a, 'state', '{}', false);
  exception when others then assert sqlerrm = 'content_unavailable'; expected_error := true; end;
  assert expected_error;
  expected_error := false;
  begin perform public.learning_room_action(device_a, 'start', jsonb_build_object('stageCode', 'intermediate', 'mode', 'checkpoint', 'createKey', 'locked_stage', 'contentVersion', 'learning-room-v1', 'questionCodes', selections->'intermediate'), true);
  exception when others then assert sqlerrm = 'learning_stage_locked'; expected_error := true; end;
  assert expected_error;
  expected_error := false;
  begin update public.learning_content_versions set status = 'published', published_at = now() where content_version = 'learning-room-v1';
  exception when others then assert sqlerrm = 'learning_content_review_required'; expected_error := true; end;
  assert expected_error;
  expected_error := false;
  begin update public.learning_content_versions set content_hash = repeat('0', 64) where content_version = 'learning-room-v1';
  exception when others then assert sqlerrm = 'learning_content_immutable'; expected_error := true; end;
  assert expected_error;

  foreach stage in array array['beginner', 'beginner', 'intermediate', 'advanced'] loop
    target_correct := case when stage = 'beginner' and value #>> '{session,stageStatus,intermediate}' = 'locked'
      and not exists (select 1 from public.learning_quiz_attempts where learner_uid = old_uid and status = 'submitted') then 4
      when stage = 'beginner' then 5 when stage = 'intermediate' then 7 else 8 end;
    value := public.learning_room_action(device_a, 'start', jsonb_build_object('stageCode', stage, 'mode', 'checkpoint', 'createKey', gen_random_uuid()::text, 'contentVersion', 'learning-room-v1', 'questionCodes', selections->stage), true);
    attempt_id := (value #>> '{attempt,attempt_uid}')::uuid;
    replay := public.learning_room_action(device_a, 'start', jsonb_build_object('stageCode', stage, 'mode', 'checkpoint', 'createKey', 'resume_' || attempt_id::text, 'contentVersion', 'learning-room-v1', 'questionCodes', selections->stage), true);
    assert replay #>> '{attempt,attempt_uid}' = attempt_id::text;
    expected_error := false;
    begin perform public.learning_room_action(device_b, 'read', jsonb_build_object('attemptUid', attempt_id), true);
    exception when others then assert sqlerrm = 'attempt_not_found'; expected_error := true; end;
    assert expected_error;
    expected_error := false;
    begin perform public.learning_room_action(device_a, 'finish', jsonb_build_object('attemptUid', attempt_id, 'requestKey', 'incomplete_finish'), true);
    exception when others then assert sqlerrm = 'attempt_incomplete'; expected_error := true; end;
    assert expected_error;
    for idx in 1..(value #>> '{attempt,question_count}')::integer loop
      q := value->'attempt'->'question_snapshot'->(idx - 1);
      option_value := q->>'correctOptionId';
      if idx > target_correct then select o->>'optionId' into option_value from jsonb_array_elements(q->'options') o where o->>'optionId' <> q->>'correctOptionId' limit 1; end if;
      value := public.learning_room_action(device_a, 'answer', jsonb_build_object('attemptUid', attempt_id, 'questionUid', q->>'questionUid', 'optionId', option_value, 'requestKey', 'answer_' || idx), true);
      replay := public.learning_room_action(device_a, 'answer', jsonb_build_object('attemptUid', attempt_id, 'questionUid', q->>'questionUid', 'optionId', option_value, 'requestKey', 'answer_' || idx), true);
      assert replay->>'stateVersion' = value->>'stateVersion';
      expected_error := false;
      begin perform public.learning_room_action(device_a, 'answer', jsonb_build_object('attemptUid', attempt_id, 'questionUid', q->>'questionUid', 'optionId', 'different-option', 'requestKey', 'reanswer_' || idx), true);
      exception when others then assert sqlerrm = 'answer_already_submitted'; expected_error := true; end;
      assert expected_error;
      if idx < (value #>> '{attempt,question_count}')::integer then
        value := public.learning_room_action(device_a, 'next', jsonb_build_object('attemptUid', attempt_id, 'requestKey', 'next_key_' || idx), true);
        replay := public.learning_room_action(device_a, 'next', jsonb_build_object('attemptUid', attempt_id, 'requestKey', 'next_key_' || idx), true);
        assert replay #>> '{attempt,cursor_position}' = (idx + 1)::text;
        assert replay->>'stateVersion' = value->>'stateVersion';
      end if;
    end loop;
    value := public.learning_room_action(device_a, 'finish', jsonb_build_object('attemptUid', attempt_id, 'requestKey', 'finish_key'), true);
    assert (value #>> '{attempt,correct_count}')::integer = target_correct;
    assert (value #>> '{attempt,passed}')::boolean = (target_correct <> 4);
    if target_correct = 4 then assert value #>> '{session,stageStatus,intermediate}' = 'locked'; end if;
    replay := public.learning_room_action(device_a, 'finish', jsonb_build_object('attemptUid', attempt_id, 'requestKey', 'finish_key'), true);
    assert replay->>'stateVersion' = value->>'stateVersion';
    replay := public.learning_room_action(device_a, 'start', jsonb_build_object('stageCode', stage, 'mode', 'checkpoint', 'createKey', 'resume_' || attempt_id::text, 'contentVersion', 'learning-room-v1', 'questionCodes', selections->stage), true);
    assert replay #>> '{attempt,attempt_uid}' = attempt_id::text;
    assert replay #>> '{attempt,status}' = 'submitted';
  end loop;
  assert value #>> '{session,stageStatus,advanced}' = 'completed';
  settled_id := attempt_id;
  assert value #>> '{session,resumeTarget,type}' = 'mixed-review';
  perform public.learning_room_action(device_a, 'start', jsonb_build_object('stageCode', 'advanced', 'mode', 'mixed-review', 'createKey', 'mixed_start', 'contentVersion', 'learning-room-v1', 'questionCodes', selections->'mixed'), true);
  value := public.learning_room_action(device_a, 'start', jsonb_build_object('stageCode', 'beginner', 'mode', 'checkpoint', 'createKey', 'recovery_collision', 'contentVersion', 'learning-room-v1', 'questionCodes', selections->'beginner'), true);
  attempt_id := (value #>> '{attempt,attempt_uid}')::uuid;
  perform public.learning_room_action(device_b, 'start', jsonb_build_object('stageCode', 'beginner', 'mode', 'checkpoint', 'createKey', 'recovery_collision', 'contentVersion', 'learning-room-v1', 'questionCodes', selections->'beginner'), true);
  perform public.set_device_recovery_code(device_a, recovery_digest);
  perform public.recover_device(device_b, device_b_digest, recovery_digest, encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'));
  assert (select learner_uid = old_uid from public.learning_learners where owner_device_id = device_b);
  assert (select count(*) = 1 from public.learning_quiz_attempts where learner_uid = old_uid and terminal_reason = 'recovery_conflict');
  value := public.learning_room_action(device_b, 'read', jsonb_build_object('attemptUid', attempt_id), true);
  frozen_snapshot := value #> '{attempt,question_snapshot}';
  assert value #>> '{session,stageStatus,advanced}' = 'completed';
  assert not exists (select 1 from public.learning_learners where owner_device_id = device_a);
  insert into public.learning_content_versions(content_version, public_catalog, private_question_bank, content_hash, review_metadata, status, created_at)
    select 'learning-room-sql-test-v2', jsonb_set(public_catalog, '{contentVersion}', '"learning-room-sql-test-v2"'),
      jsonb_set(private_question_bank, '{contentVersion}', '"learning-room-sql-test-v2"'), repeat('1', 64), review_metadata, 'draft', now() + interval '1 second'
      from public.learning_content_versions where content_version = 'learning-room-v1';
  replay := public.learning_room_action(device_b, 'read', jsonb_build_object('attemptUid', attempt_id), true);
  assert replay->>'contentVersion' = 'learning-room-sql-test-v2';
  assert replay #>> '{attempt,content_version}' = 'learning-room-v1';
  assert replay #> '{attempt,question_snapshot}' = frozen_snapshot;
  assert replay #>> '{session,stageStatus,advanced}' = 'completed';
  -- Arthur: NarIyirm
  -- 中文：审核替身只验证发布 SQL，在外层事务回滚，不会把真实 pending 内容标记为已校对。
  -- EN: This review fixture tests publication SQL only and is rolled back, never marking real pending content as reviewed.
  insert into public.learning_content_versions(content_version, public_catalog, private_question_bank, content_hash, review_metadata, status, published_at)
    select content_version, public_catalog, private_question_bank, content_hash,
      jsonb_set(jsonb_set(review_metadata, '{independentReview}', jsonb_build_object('status', 'approved', 'reviewer', 'SQL rollback fixture',
        'reviewedAt', '2026-10-05', 'approvedContentHash', content_hash)), '{questions}',
        (select jsonb_agg(r || '{"independentStatus":"approved"}'::jsonb) from jsonb_array_elements(review_metadata->'questions') r)), 'published', now()
      from public.learning_content_versions where content_version = 'learning-room-sql-test-v2'
    on conflict (content_version) do update set public_catalog = excluded.public_catalog, private_question_bank = excluded.private_question_bank,
      content_hash = excluded.content_hash, review_metadata = excluded.review_metadata, status = excluded.status,
      published_at = coalesce(public.learning_content_versions.published_at, excluded.published_at);
  assert (select status = 'published' from public.learning_content_versions where content_version = 'learning-room-sql-test-v2');
  expected_error := false;
  begin update public.learning_content_versions set status = 'draft' where content_version = 'learning-room-sql-test-v2';
  exception when others then assert sqlerrm = 'learning_content_immutable'; expected_error := true; end;
  assert expected_error;
  update public.learning_content_versions set status = 'withdrawn' where content_version = 'learning-room-v1';
  assert not exists (select 1 from public.learning_quiz_attempts where learner_uid = old_uid and content_version = 'learning-room-v1' and status = 'in_progress');
  assert (select count(*) = 4 from public.learning_quiz_attempts where learner_uid = old_uid and status = 'submitted');
  expected_error := false;
  begin perform public.learning_room_action(device_b, 'read', jsonb_build_object('attemptUid', attempt_id), true);
  exception when others then assert sqlerrm = 'attempt_invalidated'; expected_error := true; end;
  assert expected_error;
  replay := public.learning_room_action(device_b, 'review', jsonb_build_object('attemptUid', settled_id), true);
  assert replay #>> '{attempt,status}' = 'submitted';
  assert replay #>> '{session,stageStatus,advanced}' = 'completed';
  raise notice 'Learning Room preflight passed: grading, idempotency, isolation, recovery, withdrawal';
end $$;
