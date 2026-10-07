import { validateNoPrivateFields } from './learningPublicPayload.js';

export const TUTOR_PROMPT_VERSION = 'learning-tutor-p3';
const words = value => (String(value).toLowerCase().match(/[a-z0-9-]+|[\u4e00-\u9fff]/g) ?? []);

export function retrieveTutorEvidence(gate, context, message, language) {
  if (validateNoPrivateFields(gate.catalog).length) throw new Error('tutor_content_unavailable');
  const terms = new Set(words(message));
  const feedbackTopic = gate.feedback?.topicCode;
  const course = gate.catalog.courses.find(c=>c.courseCode === context.entityCode);
  const currentEntities = new Set(course?.activityCodes ?? [context.entityCode]);
  const templateTopic = gate.manifest.topicMap.find(t=>t.templateCode===context.entityCode)?.topicCode;
  // Arthur: NarIyirm
  // 中文：当前页优先，按显式 topic 映射和双语词汇选有限公开证据，不遍历私有题库。
  // EN: Prefer the current page and explicit topic maps, selecting bounded bilingual public evidence without traversing a private bank.
  const selected = gate.manifest.knowledge.map(chunk => ({chunk,score:
    (currentEntities.has(chunk.entityCode)?100:0) + (chunk.topicCodes.includes(feedbackTopic ?? templateTopic)?80:0)
    + words(JSON.stringify(chunk.block)).filter(w=>terms.has(w)).length
  })).filter(e=>e.score>0).sort((a,b)=>b.score-a.score).slice(0,6).map(e=>e.chunk);
  const refs = new Set(selected.flatMap(c=>c.sourceRefs));
  const sources = [...gate.catalog.sources.filter(s=>refs.has(s.sourceCode)),...(gate.feedback?.sources??[])];
  const unique = [...new Map(sources.map(s=>[s.sourceCode,s])).values()].slice(0,12);
  const chunks = selected.map(chunk=>({chunkCode:chunk.chunkCode,title:chunk.title[language],block:chunk.block,
    sourceRefs:chunk.sourceRefs.filter(ref=>unique.some(s=>s.sourceCode===ref))}));
  return { chunks, sources:unique, feedback:gate.feedback ? { ...gate.feedback, sources:undefined } : null };
}

export function tutorActions(gate, context) {
  const topic = gate.manifest.topicMap.find(t=>t.topicCode===gate.feedback?.topicCode || t.activityCode===context.entityCode || t.resourceCode===context.entityCode);
  if (!topic) return [];
  return [
    {type:'open_lesson',entityCode:topic.activityCode,label:{en:'Read the lesson',zh:'阅读相关课程'}},
    {type:'open_resource',entityCode:topic.resourceCode,label:{en:'Check the source context',zh:'查看相关资料'}},
    {type:'open_practice',entityCode:topic.templateCode,label:{en:'Try a similar practice',zh:'练一道类似题'}},
  ];
}

export function validateTutorModel(value, evidence) {
  if (!value || !['in_scope','out_of_scope','insufficient_evidence'].includes(value.scope)
    || typeof value.answer!=='string' || value.answer.length>6000 || !Array.isArray(value.sourceCodes)
    || value.sourceCodes.length>6 || Object.keys(value).some(k=>!['scope','answer','sourceCodes'].includes(k))) throw new Error('tutor_response_invalid');
  if (/<[^>]+>|https?:\/\/|javascript:/i.test(value.answer)) throw new Error('tutor_response_invalid');
  if (value.sourceCodes.some(code=>!evidence.sources.some(s=>s.sourceCode===code))) throw new Error('tutor_source_invalid');
  if (value.scope==='in_scope' && (!value.answer.trim() || !value.sourceCodes.length)) throw new Error('tutor_source_invalid');
  return value;
}
