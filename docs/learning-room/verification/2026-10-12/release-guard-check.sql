-- Arthur: NarIyirm
-- 中文：在回滚事务内验证本次负责人复核只能放行指定版本，同时保留哈希、模板审核及不可变约束。
-- EN: Verify the owner-review exception in a rolled-back transaction while preserving hash, template-review, and immutability constraints.
begin;
do $$
declare m public.learning_tutor_manifests; failure text;
begin
  select * into strict m from public.learning_tutor_manifests where manifest_version = 'learning-tutor-v3';
  if m.status <> 'published' or m.review_metadata->>'reviewType' <> 'project-owner'
    or m.manifest_hash <> '665f4a761224842cfadc6143f28e3f92f5374c02a04b8a48eee99159028d12a2'
    or m.review_metadata->>'independentReviewStatus' <> 'pending' then raise exception 'release_record_incorrect'; end if;
  if not exists(select 1 from public.learning_content_versions where content_version = 'learning-room-v1'
    and status = 'published' and content_hash = '0736124795fd1dbc5e5b82521f919162ea82692c27a3f127b850410ce31f6054') then
    raise exception 'course_not_published'; end if;
  begin
    update public.learning_tutor_manifests set review_metadata = review_metadata - 'authorizationSource' where manifest_version = m.manifest_version;
    raise exception 'missing_authorization_accepted';
  exception when others then
    if sqlerrm <> 'tutor_review_required' then raise; end if;
  end;
  begin
    insert into public.learning_tutor_manifests(manifest_version,content_version,content_hash,manifest_hash,body,review_metadata,status)
    values('learning-tutor-owner-exception-probe',m.content_version,m.content_hash,m.manifest_hash,m.body,m.review_metadata,'published');
    raise exception 'owner_exception_reused';
  exception when others then
    if sqlerrm <> 'tutor_review_required' then raise; end if;
  end;
  begin
    update public.learning_tutor_manifests set body = jsonb_set(body,'{practiceTemplates,0,ownerReview,status}','"pending"') where manifest_version = m.manifest_version;
    raise exception 'immutable_template_modified';
  exception when others then
    if sqlerrm <> 'tutor_manifest_immutable' then raise; end if;
  end;
  begin
    update public.learning_tutor_manifests set status = 'draft' where manifest_version = m.manifest_version;
    raise exception 'publication_reverted_to_draft';
  exception when others then
    if sqlerrm <> 'tutor_manifest_immutable' then raise; end if;
  end;
end $$;
rollback;
select 'PASS: published course/tutor, scoped owner authorization, immutable templates and status' as result;
