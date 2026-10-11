-- Arthur: NarIyirm
-- 中文：只读取结构、权限与迁移指纹，便于比较环境而不导出用户记录或密钥。
-- EN: Read schema, permission, and migration fingerprints to compare environments without exporting user records or secrets.
with objects as (
  select 'table' as kind, c.relname::text as name,
    jsonb_build_object('rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'acl',c.relacl::text) as definition
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
  union all
  select 'column', c.relname||'.'||a.attname,
    jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'generated',a.attgenerated,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid))
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
  where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
  union all
  select 'constraint', c.relname||'.'||x.conname,
    jsonb_build_object('definition',pg_get_constraintdef(x.oid),'validated',x.convalidated)
  from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
  union all
  select 'index', indexname, to_jsonb(indexdef) from pg_indexes where schemaname='public'
  union all
  select 'trigger', c.relname||'.'||t.tgname,
    jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal
  union all
  select 'function',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
    jsonb_build_object('bodyHash',md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')),'acl',p.proacl::text,'config',p.proconfig)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
    and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  union all
  select 'enum',t.typname,jsonb_agg(e.enumlabel order by e.enumsortorder)
  from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid
  where n.nspname='public' group by t.typname
  union all
  select 'policy',schemaname||'.'||tablename||'.'||policyname,
    jsonb_build_object('roles',roles,'cmd',cmd,'using',qual,'check',with_check,'permissive',permissive)
  from pg_policies where schemaname in ('public','storage','realtime')
  union all
  select 'migration',version,jsonb_build_object('name',name,'statementHash',md5(replace(array_to_string(statements,E'\n'),E'\r\n',E'\n')))
  from supabase_migrations.schema_migrations
)
select kind,name,definition from objects order by kind,name;
