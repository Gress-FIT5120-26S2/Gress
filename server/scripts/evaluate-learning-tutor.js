import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import '../src/env.js';
import { readLearningContent,buildPublicLearningContent } from '../src/services/learningContent.js';
import { retrieveTutorEvidence,TUTOR_PROMPT_VERSION } from '../src/services/learningTutorEvidence.js';
import { runLearningTutor } from '../src/services/learningTutorModel.js';
import { OPENAI_ASSISTANT_MODEL } from '../src/services/openaiResponses.js';

assert.ok(process.argv.includes('--live'),'Explicit --live is required for model evaluation.');
assert.notEqual(process.env.NODE_ENV,'production');
assert.equal(new URL(process.env.SUPABASE_URL).hostname,'thmbtsssvnslotoexntz.supabase.co');
const manifest=JSON.parse(await readFile(new URL('../data/learning-tutor/v2/manifest.json',import.meta.url)));
const cases=JSON.parse(await readFile(new URL('../data/learning-tutor/v2/eval-cases.json',import.meta.url)));
const gate={manifest,catalog:buildPublicLearningContent(await readLearningContent()),feedback:null};
const results=[];let cursor=0;
// Arthur: NarIyirm
// 中文：真实模型评估不写 learner 数据；有限并发记录结构/引用与延迟，事实准确率必须另经人工审核。
// EN: Live evaluation writes no learner records; bounded concurrency records structure/citations/latency, with factual accuracy reserved for human review.
await Promise.all(Array.from({length:3},async()=>{while(cursor<cases.length){const index=cursor++;const sample=cases[index];const started=Date.now();
  try{const evidence=retrieveTutorEvidence(gate,sample.context,sample.message,sample.language);
    const result=await runLearningTutor({evidence,language:sample.language,message:sample.message});
    const structuralPass=sample.expected==='refuse'?result.scope==='out_of_scope':sample.expected==='in_scope'?result.scope==='in_scope':true;
    results[index]={...sample,...result,structuralPass,humanFactReview:'pending',sources:evidence.sources.filter(s=>result.sourceCodes.includes(s.sourceCode))};
  }catch(error){results[index]={...sample,errorCode:error.code??error.message,latencyMs:Date.now()-started,structuralPass:false,humanFactReview:'pending',evaluation:error.evaluation??null};}
  console.log(JSON.stringify({case:sample.id,structuralPass:results[index].structuralPass,errorCode:results[index].errorCode??null}));
}}));
const generated=results.filter(r=>r.usage);const latencies=generated.map(r=>r.latencyMs).sort((a,b)=>a-b);
const summary={date:'2026-10-08',model:OPENAI_ASSISTANT_MODEL,promptVersion:TUTOR_PROMPT_VERSION,manifestVersion:manifest.manifestVersion,manifestHash:manifest.manifestHash,
  count:results.length,providerCalls:results.filter(r=>r.usage||r.evaluation?.usage).length,structuralPass:results.filter(r=>r.structuralPass).length,errors:results.filter(r=>r.errorCode).length,
  p50Ms:latencies[Math.floor(latencies.length*.5)]??null,p95Ms:latencies[Math.min(latencies.length-1,Math.floor(latencies.length*.95))]??null,
  inputTokens:generated.reduce((s,r)=>s+Number(r.usage.input_tokens??0),0),outputTokens:generated.reduce((s,r)=>s+Number(r.usage.output_tokens??0),0),
  humanFactReview:'pending',independentTemplateReview:'pending',releaseApproved:false};
const output=new URL('../../docs/learning-room/verification/2026-10-08/TUTOR_MODEL_EVALUATION.json',import.meta.url);
await mkdir(new URL('.',output),{recursive:true});await writeFile(output,JSON.stringify({summary,results},null,2)+'\n');
console.log(JSON.stringify(summary));if(summary.errors)process.exitCode=1;
