import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, learningContentHash, readLearningContent, readLearningAssetKeys,
  validateLearningContent, buildPublicLearningContent, validateNoPrivateFields, verifyLearningMediaFiles } from '../src/services/learningContent.js';

const baseline = await readLearningContent();
const assetKeys = await readLearningAssetKeys();
const validate = (bundle, release = false) => validateLearningContent(bundle, { assetKeys, release, today: '2026-10-05' });
const rejects = (change, message) => {
  const bundle = structuredClone(baseline);
  change(bundle);
  const result = validate(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), message);
};

// Arthur: NarIyirm
// 中文：此审批仅存在于测试副本，用来验证发布门槛；绝不写回真实待审文件或代表真人校对。
// EN: This approval exists only in test copies to exercise release gates; it never writes to pending review files or represents human proofreading.
const approvedTestCopy = () => {
  const bundle = structuredClone(baseline);
  bundle.review.independentReview = { status: 'approved', reviewer: 'Independent test fixture',
    reviewedAt: '2026-10-05', approvedContentHash: learningContentHash(bundle) };
  bundle.review.questions.forEach((entry) => { entry.independentStatus = 'approved'; });
  return bundle;
};

test('real bilingual draft has sufficient topic candidates and existing media', async () => {
  const result = validate(baseline);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.deepEqual(result.counts, { courses: 3, activities: 9, resources: 9, questions: 48, sources: 18 });
  await verifyLearningMediaFiles(baseline);
  for (const stage of baseline.catalog.stages) {
    const candidates = baseline.bank.questions.filter((q) => q.stageCode === stage.stageCode);
    assert.equal(candidates.length, stage.minimumBankSize);
    for (const topic of stage.blueprint) assert.ok(candidates.filter((q) => q.topicCode === topic.topicCode).length >= topic.count * 2);
  }
});

test('missing Chinese translation and duplicate option meanings fail content validation', () => {
  rejects((b) => { delete b.bank.questions[0].prompt.zh; }, /required nonempty text/);
  rejects((b) => { b.bank.questions[0].options[1].label.zh = b.bank.questions[0].options[0].label.zh; }, /duplicate option label/);
});

test('duplicate question identity or wording and nonexistent correct options are rejected', () => {
  rejects((b) => { b.bank.questions[1].questionCode = b.bank.questions[0].questionCode; }, /duplicate/);
  rejects((b) => { b.bank.questions[1].prompt = b.bank.questions[0].prompt; }, /duplicate prompt/);
  rejects((b) => { b.bank.questions[0].correctOptionId = 'unoffered-answer'; }, /correct option missing/);
});

test('large total bank cannot hide missing topic candidates', () => {
  rejects((b) => { b.bank.questions.filter((q) => q.stageCode === 'beginner' && q.topicCode === 'sorting')
    .forEach((q) => { q.topicCode = 'materials'; }); }, /beginner\/sorting: insufficient candidates/);
  rejects((b) => { b.bank.questions.pop(); }, /advanced: insufficient question bank/);
});

test('thresholds and server grading cannot be weakened by content metadata', () => {
  rejects((b) => { b.catalog.stages[0].minimumCorrect = 4; }, /threshold contract changed/);
  rejects((b) => { b.catalog.assessmentRules.gradingAuthority = 'client'; }, /assessment authority changed/);
  rejects((b) => { b.catalog.assessmentRules.firstAnswerFinal = false; }, /assessment authority changed/);
});

test('practice, review and learning rewards remain separate from real progression and inventory', () => {
  for (const field of ['changesInventory', 'addsSharedXp', 'practiceCanUnlock', 'reviewCanUnlock']) {
    rejects((b) => { b.catalog.assessmentRules[field] = true; }, /learning isolation contract changed/);
  }
  rejects((b) => { b.bank.mixedReview.canUnlock = true; }, /mixed review contract/);
});

test('unsafe source URLs, unknown assets and invalid video references or paths fail', async () => {
  rejects((b) => { b.sources[0].url = 'javascript:alert(1)'; }, /HTTPS required/);
  rejects((b) => { b.catalog.courses[0].coverAssetKey = 'unregistered-cover'; }, /unknown asset/);
  rejects((b) => { b.activities[0].mediaAssetKey = null; }, /unknown media/);
  const b = structuredClone(baseline);
  b.catalog.media[0].assetPath = '../outside-assets.mp4';
  await assert.rejects(verifyLearningMediaFiles(b), /outside assets/);
});

test('reader blocks reject embedded HTML, unknown execution properties and missing reflection', () => {
  rejects((b) => { b.activities[0].body[0] = { type: 'html', text: { en: '<script>', zh: '<script>' } }; }, /unsupported block/);
  rejects((b) => { b.activities[0].body[0].onPress = 'execute'; }, /unsupported field onPress/);
  rejects((b) => { b.activities[0].body = b.activities[0].body.filter((block) => block.type !== 'reflection'); }, /reflection required/);
});

test('news dates must match primary sources and data needs its measurement scope', () => {
  rejects((b) => { b.resources.find((r) => r.category === 'news').publishedAt = '2026-01-01'; }, /primary source\/date mismatch/);
  rejects((b) => { b.resources.find((r) => r.category === 'news').publishedAt = '2027-01-01'; }, /invalid\/future date/);
  rejects((b) => { delete b.resources.find((r) => r.statistics).statistics.populationScope.zh; }, /required nonempty text/);
  rejects((b) => { b.resources[1].sourceUrl = b.resources[0].sourceUrl; }, /duplicate Library article/);
});

test('public projection excludes the whole private bank and review metadata', () => {
  const b = structuredClone(baseline);
  b.bank.secretMarker = 'PRIVATE_BANK_SENTINEL';
  b.review.secretMarker = 'PRIVATE_REVIEW_SENTINEL';
  const publicContent = buildPublicLearningContent(b);
  assert.deepEqual(validateNoPrivateFields(publicContent), []);
  const json = JSON.stringify(publicContent);
  assert.doesNotMatch(json, /PRIVATE_BANK_SENTINEL|PRIVATE_REVIEW_SENTINEL|correctOptionId|questionCodes|evidenceNote/);
  assert.equal(publicContent.activities.length, 9);
  assert.equal(publicContent.sources[0].verificationNote, undefined);
});

test('future answer data nested anywhere in public content is blocked', () => {
  const b = structuredClone(baseline);
  b.activities[0].body[0].questionSnapshot = { correctOptionId: 'metal' };
  assert.equal(validate(b).ok, false);
  assert.throws(() => buildPublicLearningContent(b), /private assessment field/);
  const c = structuredClone(baseline);
  c.catalog.stages[0].question_snapshot = { correct_option_id: 'metal' };
  assert.equal(validate(c).ok, false);
  assert.throws(() => buildPublicLearningContent(c), /private assessment field/);
});

test('release rejects pending review, self approval and incomplete per-question review', () => {
  assert.equal(validate(baseline, true).ok, false);
  assert.match(validate(baseline, true).errors.join('\n'), /independent review approval required/);
  const b = approvedTestCopy();
  assert.equal(validate(b, true).ok, true);
  b.review.independentReview.reviewer = ` ${b.review.authoringReview.reviewer.toUpperCase()} `;
  assert.match(validate(b, true).errors.join('\n'), /independent review approval required/);
  const c = approvedTestCopy();
  c.review.questions[0].independentStatus = 'pending';
  assert.match(validate(c, true).errors.join('\n'), /every question/);
});

test('approval binds content and answers; unrelated review notes do not invalidate it', () => {
  const b = approvedTestCopy();
  b.review.internalNote = 'Proofreading commentary only';
  assert.equal(validate(b, true).ok, true);
  b.resources[0].summary.zh += '（修订）';
  assert.match(validate(b, true).errors.join('\n'), /hash does not match/);
  const c = approvedTestCopy();
  c.bank.questions[0].correctOptionId = c.bank.questions[0].options[1].optionId;
  assert.match(validate(c, true).errors.join('\n'), /hash does not match/);
});

test('content hashing ignores object-key order but preserves array order', () => {
  assert.equal(canonicalJson({ b: 2, a: [1, 2] }), canonicalJson({ a: [1, 2], b: 2 }));
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
  const b = structuredClone(baseline);
  b.catalog = Object.fromEntries(Object.entries(b.catalog).reverse());
  assert.equal(learningContentHash(b), learningContentHash(baseline));
});
