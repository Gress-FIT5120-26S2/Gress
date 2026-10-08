-- Arthur: NarIyirm
-- 中文：追加修复已在开发库应用的函数，保留旧 migration；明确 JSON 返回类型并修正去重键的运算符优先级。
-- EN: Append fixes for functions already applied to development, preserving prior migrations; make JSON return casts explicit and fix dedupe-key operator precedence.
do $$ declare definition text; signature text; begin
  foreach signature in array array['public.learning_tutor_action(text,text,jsonb,boolean)',
    'public.learning_tutor_recommendations(uuid,text)','public.learning_tutor_support(text,text,jsonb,boolean)'] loop
    select pg_get_functiondef(signature::regprocedure) into definition;
    definition:=regexp_replace(definition,$pattern$return '([^']*)';$pattern$,$replacement$return '\1'::jsonb;$replacement$,'gi');
    definition:=replace(definition,'''tutor-r1:visit:''||p_payload->>''visitKey''','''tutor-r1:visit:''||(p_payload->>''visitKey'')');
    execute definition;
  end loop;
end $$;
