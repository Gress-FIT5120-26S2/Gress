import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readLearningAssetKeys, readLearningContent, validateLearningContent } from '../src/services/learningContent.js';

const reviewer = 'NarIyirm';
// Arthur: NarIyirm
// 中文：审核日期采用校验器的 UTC 日期；发布决定的悉尼日期另行保存，避免跨时区被判为未来日期。
// EN: Use the validator's UTC review date and retain the Sydney decision date separately to avoid a false future-date rejection.
const reviewedAt = '2026-10-11';
const authorization = 'project-owner-chat-2026-10-12';
const sourceHash = '495079bb614ff51269ae2d183360efe2deb48e0da1ac2ac9a0bc9a76034035ae';
const courseHash = '0736124795fd1dbc5e5b82521f919162ea82692c27a3f127b850410ce31f6054';
const filename = '20261012050000_publish_owner_reviewed_learning.sql';
const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const writeJson = (path, value, flag = 'w') => writeFile(new URL(path, import.meta.url), JSON.stringify(value, null, 2) + '\n', { flag });
const quote = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";

if (process.argv[2] !== '--record-user-approval' || process.argv.length !== 3) {
  throw new Error('This release records the actual owner approval in the 2026-10-12 chat; use --record-user-approval once.');
}
const bundle = await readLearningContent();
const original = await readJson('../data/learning-tutor/v2/manifest.json');
const evaluation = await readJson('../../docs/learning-room/verification/2026-10-08/TUTOR_MODEL_EVALUATION.json');
assert.equal(original.manifestHash, sourceHash);
assert.equal(original.contentHash, courseHash);
assert.equal(evaluation.summary.manifestHash, sourceHash);
assert.equal(evaluation.results.length, 60);
assert.equal(original.practiceTemplates.length, 12);

// Arthur: NarIyirm
// 中文：记录用户已审阅并要求直接发布的真实决定；课程作者是 AI，导师保留原作者和独立审核 pending，另记负责人复核。
// EN: Record the user's actual review and release instruction; retain the tutor author and pending independent review while recording owner review separately.
bundle.review.independentReview = {
  status: 'approved', reviewer, reviewedAt, approvedContentHash: courseHash,
  authorizationSource: authorization,
  note: 'NarIyirm stated that review was already complete and requested direct publication. Course author remains Codex primary agent.',
};
bundle.review.questions = bundle.review.questions.map(question => ({
  ...question, independentStatus: 'approved', independentReviewer: reviewer, independentlyReviewedAt: reviewedAt,
}));
const validation = validateLearningContent(bundle, { assetKeys: await readLearningAssetKeys(), release: true });
assert.equal(validation.ok, true, validation.errors.join('\n'));
assert.equal(validation.contentHash, courseHash);
const { manifestHash: previousHash, review: previousReview, ...body } = structuredClone(original);
body.manifestVersion = 'learning-tutor-v3';
body.practiceTemplates = body.practiceTemplates.map(template => ({
  ...template, ownerReview: { status: 'approved', reviewer, reviewedAt },
}));
const manifestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
const review = {
  ...previousReview, status: 'approved', reviewer, reviewedAt, approvedManifestHash: manifestHash,
  reviewType: 'project-owner', authorizationSource: authorization,
  sourceManifestHash: sourceHash, independentReviewStatus: 'pending',
  note: 'Original author NarIyirm is also the release reviewer. The owner explicitly approved publication; this is not represented as independent review.',
};

// Arthur: NarIyirm
// 中文：仅此版本、此哈希和此负责人决定可走复核例外；其他版本仍须独立审核，已部署内容和旧会话保持不可变。
// EN: Scope the owner-review exception to this version, hash, and authorization; other releases retain independent review and deployed content stays immutable.
const sql = `-- Arthur: NarIyirm
-- 中文：负责人 NarIyirm 确认已审阅并要求直接发布；课程独立审核通过，导师 v3 如实记录负责人复核。
-- EN: NarIyirm confirmed review and requested publication; the course is independently reviewed and tutor v3 records owner review honestly.
begin;
update public.learning_content_versions set
  review_metadata = ${quote(bundle.review)}, status = 'published', published_at = coalesce(published_at, now())
where content_version = 'learning-room-v1' and content_hash = '${courseHash}';
do $$ begin
  if not exists(select 1 from public.learning_content_versions where content_version = 'learning-room-v1'
    and content_hash = '${courseHash}' and status = 'published') then raise exception 'release_course_hash_mismatch'; end if;
end $$;

create or replace function public.guard_learning_tutor_manifest() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.learning_content_versions; owner_release boolean;
begin
  select * into c from public.learning_content_versions where content_version = new.content_version;
  if c.content_hash <> new.content_hash then raise exception 'tutor_content_changed'; end if;
  if tg_op = 'UPDATE' and (new.body,new.content_hash,new.manifest_hash,new.content_version,new.manifest_version)
    is distinct from (old.body,old.content_hash,old.manifest_hash,old.content_version,old.manifest_version) then
    raise exception 'tutor_manifest_immutable'; end if;
  if tg_op = 'UPDATE' and ((old.status = 'withdrawn' and new.status <> 'withdrawn') or (old.status = 'published' and new.status = 'draft')) then
    raise exception 'tutor_manifest_immutable'; end if;
  -- Arthur: NarIyirm
  -- 中文：发布例外绑定单一 migration 中的精确版本和哈希，不把负责人复核伪装成独立审核。
  -- EN: Bind this release exception to the exact migration version and hash without presenting owner review as independent review.
  owner_release := new.manifest_version = 'learning-tutor-v3' and new.manifest_hash = '${manifestHash}'
    and new.review_metadata->>'reviewType' = 'project-owner'
    and new.review_metadata->>'authorizationSource' = '${authorization}'
    and new.review_metadata->>'sourceManifestHash' = '${sourceHash}'
    and new.review_metadata->>'author' = 'NarIyirm' and new.review_metadata->>'reviewer' = 'NarIyirm'
    and new.review_metadata->>'independentReviewStatus' = 'pending'
    and jsonb_array_length(new.body->'practiceTemplates') = 12
    and not exists(select 1 from jsonb_array_elements(new.body->'practiceTemplates') t
      where coalesce(t #>> '{ownerReview,status}','') <> 'approved'
        or coalesce(t #>> '{ownerReview,reviewer}','') <> 'NarIyirm'
        or coalesce(t #>> '{ownerReview,reviewedAt}','') <> '${reviewedAt}');
  if new.status = 'published' and (c.status <> 'published'
    or coalesce(new.review_metadata->>'status','') <> 'approved'
    or new.review_metadata->>'approvedManifestHash' is distinct from new.manifest_hash
    or nullif(btrim(new.review_metadata->>'reviewer'),'') is null
    or nullif(new.review_metadata->>'reviewedAt','') is null
    or (not coalesce(owner_release,false) and (
      lower(new.review_metadata->>'reviewer') = lower(new.review_metadata->>'author')
      or exists(select 1 from jsonb_array_elements(new.body->'practiceTemplates') t
        where coalesce(t->>'independentStatus','') <> 'approved')))) then raise exception 'tutor_review_required'; end if;
  return new;
end $$;

insert into public.learning_tutor_manifests(manifest_version,content_version,content_hash,manifest_hash,body,review_metadata,status)
values ('learning-tutor-v3','learning-room-v1','${courseHash}','${manifestHash}',${quote(body)},${quote(review)},'published');
commit;
`;
await writeFile(new URL('../../supabase/migrations/' + filename, import.meta.url), sql, { flag: 'wx' });
await mkdir(new URL('../data/learning-tutor/v3/', import.meta.url), { recursive: true });
await writeJson('../data/learning-tutor/v3/manifest.json', { ...body, manifestHash, review }, 'wx');
await writeJson('../data/learning-room/v1/review.json', bundle.review);
const manifest = await readJson('../data/learning-room/v1/manifest.json');
await writeJson('../data/learning-room/v1/manifest.json', { ...manifest, state: 'approved-for-publication', independentReview: 'approved' });
await mkdir(new URL('../../docs/learning-room/verification/2026-10-12/', import.meta.url), { recursive: true });
await writeJson('../../docs/learning-room/verification/2026-10-12/OWNER_RELEASE_APPROVAL.json', {
  date: reviewedAt, decisionLocalDate: '2026-10-12', decisionTimeZone: 'Australia/Sydney', reviewer, authorizationSource: authorization,
  userStatement: '不需要验收，我已经审阅过了，直接发布就像',
  decision: 'Publish directly; device acceptance explicitly waived by the owner.',
  course: { contentVersion: 'learning-room-v1', contentHash: courseHash, reviewer, author: bundle.review.authoringReview.reviewer, questions: 48, status: 'approved' },
  tutor: { sourceManifestVersion: original.manifestVersion, sourceManifestHash: sourceHash,
    manifestVersion: body.manifestVersion, manifestHash, templates: 12, reviewType: 'project-owner', independentReviewStatus: 'pending' },
  modelEvaluation: { source: '2026-10-08/TUTOR_MODEL_EVALUATION.json',
    sha256: createHash('sha256').update(await readFile(new URL('../../docs/learning-room/verification/2026-10-08/TUTOR_MODEL_EVALUATION.json', import.meta.url))).digest('hex'),
    answers: 60, status: 'approved-by-owner', measuredHumanAccuracy: null,
    note: 'Global owner sign-off; no invented per-answer scores or measured accuracy.' },
  deviceAcceptance: { status: 'waived-by-owner', availableDevice: 'iPhone', executed: false },
  migration: filename,
}, 'wx');
console.log(JSON.stringify({ filename, contentHash: courseHash, manifestHash, reviewType: review.reviewType }));
