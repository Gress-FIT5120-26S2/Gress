import { createHash } from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateNoPrivateFields } from './learningPublicPayload.js';

export { validateNoPrivateFields } from './learningPublicPayload.js';

export const LEARNING_CONTENT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/learning-room/v1');
const projectRoot = path.resolve(LEARNING_CONTENT_ROOT, '../../../..');
const contentFiles = ['catalog', 'activities', 'resources', 'sources', 'question-bank', 'review'];
const stageRules = [
  ['beginner', 6, 5, 12, 'intermediate'],
  ['intermediate', 8, 7, 16, 'advanced'],
  ['advanced', 10, 8, 20, null],
];

export async function readLearningContent(directory = LEARNING_CONTENT_ROOT) {
  const values = await Promise.all(contentFiles.map(async (name) => JSON.parse(await readFile(path.join(directory, `${name}.json`), 'utf8'))));
  return { catalog: values[0], activities: values[1].activities, resources: values[2].resources,
    sources: values[3].sources, bank: values[4], review: values[5],
    fileVersions: values.map((value) => value.contentVersion) };
}

export async function readLearningAssetKeys() {
  const source = await readFile(path.join(projectRoot, 'src/components/learning/learningAssets.ts'), 'utf8');
  return new Set([...source.matchAll(/^\s+'([^']+)': \{/gm)].map((match) => match[1]));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

// Arthur: NarIyirm
// 中文：审核元数据不属于教学内容 hash；独立审核必须绑定所有公开内容和私有题库，改动任何内容都会使旧审核失效。
// EN: Review metadata is outside the content hash; independent approval binds all public content and private questions, so any content change invalidates old approval.
export function learningContentHash(bundle) {
  return createHash('sha256').update(canonicalJson({ catalog: bundle.catalog, activities: bundle.activities,
    resources: bundle.resources, sources: bundle.sources, bank: bundle.bank })).digest('hex');
}

export function validateLearningContent(bundle, { assetKeys, release = false, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [];
  const check = (valid, message) => { if (!valid) errors.push(message); };
  const text = (value, label) => {
    check(typeof value === 'string' && value.trim().length > 0, `${label}: required nonempty text`);
    if (typeof value === 'string') check(!/\b(TODO|TBD|placeholder|lorem ipsum)\b|待补充|占位文案/i.test(value), `${label}: placeholder`);
  };
  const bi = (value, label) => { text(value?.en, `${label}.en`); text(value?.zh, `${label}.zh`); };
  const fields = (value, allowed, label) => {
    for (const key of Object.keys(value ?? {})) check(allowed.includes(key), `${label}: unsupported field ${key}`);
  };
  const date = (value, label, nullable = false) => {
    if (nullable && value === null) return;
    const valid = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    check(valid && value <= today, `${label}: invalid/future date`);
  };
  const https = (value, label) => { try { const url = new URL(value); check(url.protocol === 'https:' && !url.username && !url.password, `${label}: HTTPS required`); } catch { check(false, `${label}: invalid URL`); } };
  const list = (value, label, minimum = 1) => { check(Array.isArray(value) && value.length >= minimum, `${label}: required array`); return Array.isArray(value) ? value : []; };
  const index = (items, field, label) => {
    const map = new Map();
    for (const item of list(items, label)) {
      const id = item?.[field];
      check(typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id), `${label}: invalid ${field}`);
      check(!map.has(id), `${label}: duplicate ${id}`); map.set(id, item);
    }
    return map;
  };
  const catalog = bundle.catalog ?? {};
  const stages = index(catalog.stages, 'stageCode', 'stages');
  const courses = index(catalog.courses, 'courseCode', 'courses');
  const activities = index(bundle.activities, 'activityCode', 'activities');
  const resources = index(bundle.resources, 'resourceCode', 'resources');
  const sources = index(bundle.sources, 'sourceCode', 'sources');
  const questions = index(bundle.bank?.questions, 'questionCode', 'questions');
  const media = index(catalog.media, 'mediaAssetKey', 'media');
  const refList = (refs, map, label, minimum = 1) => {
    const ids = list(refs, label, minimum); check(new Set(ids).size === ids.length, `${label}: duplicate reference`);
    for (const id of ids) check(map.has(id), `${label}: unknown ${id}`);
  };
  const image = (key, label) => { if (key !== null) check(assetKeys?.has(key), `${label}: unknown asset ${key}`); };
  const version = (item, label) => check(item?.contentVersion === catalog.contentVersion, `${label}: content version mismatch`);
  const blockList = (blocks, label) => {
    let reflectionCount = 0;
    // Arthur: NarIyirm
    // 中文：正文块只接受已知字段，避免后续内容混入无法安全渲染的执行指令。
    // EN: Body blocks accept known fields only, preventing later content from introducing execution instructions the renderer cannot safely handle.
    const blockFields = {
      paragraph: ['type', 'text'], 'bullet-list': ['type', 'items'], reflection: ['type', 'title', 'text'],
      source: ['type', 'sourceRefs'], image: ['type', 'assetKey', 'alt'],
      fact: ['type', 'value', 'text', 'scope', 'sourceRefs'],
      'sdg-callout': ['type', 'goal', 'target', 'attributionRequired', 'assetKey', 'title', 'text', 'detail', 'sourceRefs'],
    };
    for (const [i, block] of list(blocks, label).entries()) {
      const at = `${label}[${i}]`;
      fields(block, blockFields[block?.type] ?? [], at);
      if (block?.type === 'paragraph') bi(block.text, at);
      else if (block?.type === 'bullet-list') list(block.items, at).forEach((item) => bi(item, at));
      else if (block?.type === 'reflection') { reflectionCount += 1; bi(block.title, at); bi(block.text, at); }
      else if (block?.type === 'source') refList(block.sourceRefs, sources, at);
      else if (block?.type === 'image') { image(block.assetKey, at); bi(block.alt, at); }
      else if (block?.type === 'fact') { bi(block.value, at); bi(block.text, at); bi(block.scope, at); refList(block.sourceRefs, sources, at); }
      else if (block?.type === 'sdg-callout') {
        check(block.goal === 13 && block.target === '13.3' && block.attributionRequired === true, `${at}: SDG 13.3/attribution required`);
        image(block.assetKey, at); bi(block.title, at); bi(block.text, at); bi(block.detail, at); refList(block.sourceRefs, sources, at);
      } else check(false, `${at}: unsupported block ${block?.type}`);
    }
    check(reflectionCount > 0, `${label}: reflection required`);
  };
  check(catalog.schemaVersion === 1 && bundle.bank?.schemaVersion === 1, 'unsupported schema version');
  text(catalog.contentVersion, 'contentVersion');
  check(['draft', 'published'].includes(catalog.status), 'invalid content status');
  check(catalog.projectSdg?.goal === 13 && catalog.projectSdg?.target === '13.3', 'project must be SDG 13.3');
  check(JSON.stringify(catalog.languages) === '["en","zh"]', 'en and zh required');
  for (const topic of list(catalog.libraryTopics, 'libraryTopics')) bi(topic.title, topic.topicCode);
  for (const item of media.values()) {
    check(item.type === 'video' && item.durationSeconds === 60, 'existing educational video contract');
    refList(item.sourceRefs, sources, item.mediaAssetKey);
  }
  check(stages.size === 3 && courses.size === 3 && activities.size === 9, 'three stages/courses and nine activities required');
  if (bundle.fileVersions) check(bundle.fileVersions.every((v) => v === catalog.contentVersion), 'file content versions differ');
  version(bundle.bank, 'question bank'); version(bundle.review, 'review');
  for (const [code, count, minimumCorrect, minimumBank, next] of stageRules) {
    const stage = stages.get(code);
    check(stage?.questionCount === count && stage?.minimumCorrect === minimumCorrect && stage?.minimumBankSize === minimumBank
      && stage?.passPercent === 80 && stage?.nextStageCode === next, `${code}: stage/threshold contract changed`);
    if (!stage) continue;
    bi(stage.title, code); check(courses.get(stage.courseCode)?.stageCode === code, `${code}: course mismatch`);
    const bank = [...questions.values()].filter((q) => q.stageCode === code && q.status === 'active');
    check(bank.length >= minimumBank, `${code}: insufficient question bank`);
    const blueprint = list(stage.blueprint, `${code}.blueprint`);
    check(blueprint.reduce((n, topic) => n + topic.count, 0) === count, `${code}: blueprint total`);
    check(new Set(blueprint.map((topic) => topic.topicCode)).size === blueprint.length, `${code}: duplicate blueprint topic`);
    for (const topic of blueprint) {
      text(topic.topicCode, `${code}.topic`); check(Number.isInteger(topic.count) && topic.count > 0, `${code}: invalid topic quota`);
      check(bank.filter((q) => q.topicCode === topic.topicCode).length >= topic.count, `${code}/${topic.topicCode}: insufficient candidates`);
    }
  }
  for (const [id, source] of sources) {
    text(source.title, id); text(source.publisher, id); https(source.url, id); date(source.reviewedAt, id);
    date(source.publishedAt, id, true); date(source.updatedAt, id, true); text(source.verificationNote, id);
    check(['global', 'AU', 'AU-VIC', 'AU-NSW'].includes(source.regionCode), `${id}: unsupported region`);
  }
  for (const [id, course] of courses) {
    bi(course.title, id); bi(course.summary, id); bi(course.objective, id); image(course.coverAssetKey, id);
    refList(course.activityCodes, activities, id); check(course.activityCodes?.length === 3, `${id}: exactly three activities`);
    check(course.activityCodes?.every((code) => activities.get(code)?.stageCode === course.stageCode), `${id}: activity stage mismatch`);
    refList(course.relatedResourceCodes, resources, id);
  }
  for (const [id, activity] of activities) {
    version(activity, id); bi(activity.title, id); bi(activity.objective, id); refList(activity.sourceRefs, sources, id);
    check(stages.has(activity.stageCode), `${id}: unknown stage`);
    check(['video', 'lesson', 'practice'].includes(activity.type), `${id}: invalid activity type`);
    check(Number.isInteger(activity.durationEstimate?.minutes) && activity.durationEstimate.minutes >= 1 && activity.durationEstimate.minutes <= 4, `${id}: invalid time estimate`);
    bi(activity.durationEstimate?.basis, id); check(typeof activity.durationEstimate?.includesReflection === 'boolean', `${id}: estimate basis required`);
    check(activity.completionKind === (activity.type === 'practice' ? 'verified-practice' : 'explicit-confirmation'), `${id}: invalid completion`);
    if (activity.type === 'video') check(media.has(activity.mediaAssetKey), `${id}: unknown media`);
    else image(activity.mediaAssetKey, id);
    refList(activity.relatedActivityCodes, activities, id, 0);
    check(activity.nextActivityCode === null || activities.has(activity.nextActivityCode), `${id}: invalid next activity`);
    blockList(activity.body, id);
  }
  check([...resources.values()].filter((r) => r.category !== 'news').length >= 6, 'six guide/data resources required');
  check([...resources.values()].filter((r) => r.category === 'news').length >= 3, 'three news resources required');
  check(new Set([...resources.values()].map((r) => r.sourceUrl)).size === resources.size, 'duplicate Library article');
  for (const [id, resource] of resources) {
    version(resource, id); bi(resource.title, id); bi(resource.summary, id); bi(resource.whyItMatters, id);
    check(['guide', 'data', 'news'].includes(resource.category), `${id}: category`);
    check(['standard', 'climate-feature'].includes(resource.readerLayout), `${id}: reader layout`);
    check(resource.summaryKind === 'kitchmemo-editorial-summary' && resource.completionKind === 'explicit-confirmation', `${id}: editorial/completion contract`);
    image(resource.coverAssetKey, id); https(resource.sourceUrl, id); text(resource.publisher, id);
    check(['global', 'AU', 'AU-VIC', 'AU-NSW'].includes(resource.regionCode), `${id}: unsupported region`);
    date(resource.reviewedAt, id); date(resource.publishedAt, id, resource.category !== 'news');
    refList(resource.sourceRefs, sources, id); refList(resource.relatedCourseCodes, courses, id);
    check(resource.sourceRefs?.some((code) => sources.get(code)?.url === resource.sourceUrl
      && sources.get(code)?.publishedAt === resource.publishedAt), `${id}: primary source/date mismatch`);
    const topics = new Set((catalog.libraryTopics ?? []).map((topic) => topic.topicCode));
    list(resource.topicCodes, id).forEach((code) => check(topics.has(code), `${id}: topic ${code}`));
    if (resource.relatedNewsCodes) refList(resource.relatedNewsCodes, resources, id);
    if (resource.category === 'data') {
      const stats = resource.statistics; text(stats?.measurementPeriod, id); text(stats?.units, id);
      bi(stats?.populationScope, id); bi(stats?.methodologyNote, id);
      list(stats?.includes, id).forEach((item) => text(item, id)); list(stats?.excludes, id).forEach((item) => text(item, id));
    }
    blockList(resource.body, id);
  }
  const prompts = new Set();
  for (const [id, question] of questions) {
    version(question, id); check(question.revision === 1 && question.status === 'active', `${id}: revision/status`);
    bi(question.prompt, id); bi(question.explanation, id); bi(question.serviceAssumptions, id); date(question.reviewedAt, id);
    const stage = stages.get(question.stageCode); check(stage?.blueprint?.some((t) => t.topicCode === question.topicCode), `${id}: unknown topic/stage`);
    check(['global', 'AU', 'AU-VIC', 'AU-NSW'].includes(question.regionCode), `${id}: region required`);
    refList(question.sourceRefs, sources, id); refList(question.relatedActivityCodes, activities, id); image(question.imageAssetKey, id);
    const options = index(question.options, 'optionId', `${id}.options`);
    check(options.size >= 3 && options.size <= 4, `${id}: 3–4 options required`);
    check(options.has(question.correctOptionId), `${id}: correct option missing`);
    const labels = new Set(); for (const option of options.values()) { bi(option.label, id); for (const language of ['en', 'zh']) {
      const label = `${language}:${option.label?.[language]?.trim()}`; check(!labels.has(label), `${id}: duplicate option label`); labels.add(label);
    } }
    for (const language of ['en', 'zh']) { const prompt = `${language}:${question.prompt?.[language]?.trim()}`;
      check(!prompts.has(prompt), `${id}: duplicate prompt`); prompts.add(prompt); }
  }
  for (const practice of list(bundle.bank?.practice, 'practice')) {
    check(activities.get(practice.activityCode)?.type === 'practice', 'practice activity mismatch');
    refList(practice.questionCodes, questions, 'practice questions'); check(practice.questionCount === 3 && practice.questionCodes?.length === 3, 'three practice questions required');
  }
  check(bundle.bank?.mixedReview?.questionCount === 12 && bundle.bank?.mixedReview?.perStage === 4 && bundle.bank?.mixedReview?.canUnlock === false, 'mixed review contract');
  const rules = catalog.assessmentRules ?? {};
  check(rules.answerKind === 'single-choice' && rules.timeLimitSeconds === null && rules.firstAnswerFinal === true
    && rules.gradingAuthority === 'server' && rules.unlockAuthority === 'atomic-finish' && rules.percentageRounding === 'display-only', 'assessment authority changed');
  check(rules.requiredActivitiesBeforeCheckpoint === false && rules.courseReadingRequiresUnlock === false
    && rules.personalProgress === true && rules.addsSharedXp === false && rules.changesInventory === false
    && rules.reviewCanUnlock === false && rules.practiceCanUnlock === false && rules.completionAfterAdvanced === 'mixed-review', 'learning isolation contract changed');
  const reviewQuestions = index(bundle.review?.questions, 'questionCode', 'review.questions');
  check(reviewQuestions.size === questions.size, 'review must cover every question');
  for (const [id, question] of questions) { const entry = reviewQuestions.get(id);
    check(entry?.evidenceNote === question.explanation.en && JSON.stringify(entry?.sourceRefs) === JSON.stringify(question.sourceRefs), `${id}: evidence review mismatch`); }
  validateNoPrivateFields({ catalog, activities: bundle.activities, resources: bundle.resources, sources: bundle.sources }, errors);
  if (release) {
    const independent = bundle.review?.independentReview;
    const reviewer = typeof independent?.reviewer === 'string' ? independent.reviewer.trim().toLowerCase() : '';
    const author = bundle.review?.authoringReview?.reviewer?.trim().toLowerCase();
    check(independent?.status === 'approved' && reviewer && reviewer !== author, 'independent review approval required for release');
    date(independent?.reviewedAt, 'independent review');
    check(independent?.approvedContentHash === learningContentHash(bundle), 'independent review hash does not match content');
    check([...reviewQuestions.values()].every((entry) => entry.independentStatus === 'approved'), 'independent review required for every question');
  }
  return { ok: errors.length === 0, errors, contentHash: learningContentHash(bundle),
    counts: { courses: courses.size, activities: activities.size, resources: resources.size, questions: questions.size, sources: sources.size } };
}

// Arthur: NarIyirm
// 中文：公开内容投影显式选取顶层字段，绝不包含 bank/review；题库只能由以后服务端的考试流程读取。
// EN: The public projection explicitly selects top-level fields and excludes bank/review; only the future server assessment flow reads private questions.
export function buildPublicLearningContent(bundle) {
  const result = { schemaVersion: bundle.catalog.schemaVersion, contentVersion: bundle.catalog.contentVersion,
    projectSdg: structuredClone(bundle.catalog.projectSdg), languages: structuredClone(bundle.catalog.languages),
    stages: structuredClone(bundle.catalog.stages), courses: structuredClone(bundle.catalog.courses),
    libraryTopics: structuredClone(bundle.catalog.libraryTopics), media: structuredClone(bundle.catalog.media),
    assessmentRules: structuredClone(bundle.catalog.assessmentRules), errorCodes: structuredClone(bundle.catalog.errorCodes),
    activities: structuredClone(bundle.activities), resources: structuredClone(bundle.resources),
    sources: bundle.sources.map(({ sourceCode, title, publisher, url, regionCode, publishedAt, updatedAt, reviewedAt, dateNote }) =>
      ({ sourceCode, title, publisher, url, regionCode, publishedAt, updatedAt, reviewedAt, dateNote })) };
  const errors = validateNoPrivateFields(result);
  if (errors.length) throw new Error(errors.join('\n'));
  return result;
}

export async function verifyLearningMediaFiles(bundle) {
  for (const media of bundle.catalog.media) for (const assetPath of [media.assetPath, media.posterPath]) {
    const resolved = path.resolve(projectRoot, assetPath);
    if (!resolved.startsWith(`${path.join(projectRoot, 'assets')}${path.sep}`)) throw new Error('Media path outside assets');
    await access(resolved);
  }
}
