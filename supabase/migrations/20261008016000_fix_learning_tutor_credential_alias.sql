-- Arthur: NarIyirm
-- 中文：凭证查询别名不能与 gate 的内容/manifest 行变量重名；新增修复保留已应用的 migration。
-- EN: Credential query aliases must not shadow the gate's content/manifest row variables; add a repair without rewriting applied migrations.
do $$ declare function_name text; definition text; old_lock text:='perform 1 from public.fridge_members m join public.device_credentials c on c.device_id=m.device_id where m.device_id=p_device_id and c.status=''active'' for update of m;'; begin
  foreach function_name in array array['public.learning_tutor_context(text,jsonb,text,boolean)',
    'public.learning_tutor_action(text,text,jsonb,boolean)','public.learning_tutor_support(text,text,jsonb,boolean)'] loop
    select pg_get_functiondef(function_name::regprocedure) into definition;
    if position(old_lock in definition)=0 then raise exception 'tutor_credential_alias_fix_failed'; end if;
    definition:=replace(definition,old_lock,
      'perform 1 from public.fridge_members membership join public.device_credentials credential on credential.device_id=membership.device_id where membership.device_id=p_device_id and credential.status=''active'' for update of membership;');
    execute definition;
  end loop;
end $$;
