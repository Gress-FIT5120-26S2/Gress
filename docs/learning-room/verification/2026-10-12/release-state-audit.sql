-- Arthur: NarIyirm
-- 中文：仅核对迁移、参考内容和保留期任务状态，不读取学习者、设备、库存或聊天正文。
-- EN: Audit migrations, reference content, and retention jobs without reading learner, device, inventory, or conversation data.
select 'migrations' as section, jsonb_build_object('count',count(*),'latest',max(version)) as result from supabase_migrations.schema_migrations
union all
select 'course', jsonb_build_object('version',content_version,'hash',content_hash,'status',status,
  'reviewer',review_metadata #>> '{independentReview,reviewer}') from public.learning_content_versions
union all
select 'tutor', jsonb_build_object('version',manifest_version,'hash',manifest_hash,'status',status,
  'reviewer',review_metadata->>'reviewer','reviewType',review_metadata->>'reviewType',
  'independentReviewStatus',review_metadata->>'independentReviewStatus') from public.learning_tutor_manifests
union all
select 'retention', jsonb_build_object('active',j.active,'schedule',j.schedule,
  'successfulRuns',(select count(*) from cron.job_run_details r where r.jobid=j.jobid and r.status='succeeded'),
  'failedRuns',(select count(*) from cron.job_run_details r where r.jobid=j.jobid and r.status='failed'),
  'lastRun',(select max(r.start_time) from cron.job_run_details r where r.jobid=j.jobid))
from cron.job j where j.jobname='learning-tutor-retention';
