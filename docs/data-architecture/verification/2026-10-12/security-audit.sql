-- Arthur: NarIyirm
-- 中文：核对移动端隔离、学习表只读授权、草稿状态和导师清理任务，不返回学习答案或用户数据。
-- EN: Check mobile isolation, read-only learning grants, draft states, and tutor retention without returning answers or user data.
select jsonb_build_object(
  'publicTables',(select count(*) from pg_tables where schemaname='public'),
  'tablesWithoutRls',(select coalesce(jsonb_agg(c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
  'mobileTableGrants',(select coalesce(jsonb_agg(c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))),
  'mobileDefinerFunctions',(select coalesce(jsonb_agg(p.proname),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))),
  'learningServiceWriteGrants',(select coalesce(jsonb_agg(c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'learning_%' and has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')),
  'courseVersions',(select jsonb_agg(jsonb_build_object('version',content_version,'status',status,'hash',content_hash,'independentReview',review_metadata #>> '{independentReview,status}')) from public.learning_content_versions),
  'tutorVersions',(select jsonb_agg(jsonb_build_object('version',manifest_version,'status',status,'contentVersion',content_version,'contentHash',content_hash)) from public.learning_tutor_manifests),
  'retentionJobs',(select jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'command',command,'active',active)) from cron.job where jobname='learning-tutor-retention'),
  'referenceCounts',jsonb_build_object('achievements',(select count(*) from public.achievements where is_enabled),'levels',(select count(*) from public.achievement_levels where is_enabled),'dailyQuests',(select count(*) from public.quest_definitions where is_enabled and period_type='daily'),'weeklyQuests',(select count(*) from public.quest_definitions where is_enabled and period_type='weekly'),'wasteMaterials',(select count(*) from public.waste_material_assets))
) as audit;
