import { createHash } from 'node:crypto';
import { allowDraftLearning } from './learningAssessment.js';
import { retrieveTutorEvidence, tutorActions, TUTOR_PROMPT_VERSION } from './learningTutorEvidence.js';
import { runLearningTutor } from './learningTutorModel.js';

const canonical = value => value && typeof value==='object' ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
export const tutorPayloadHash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function createLearningTutorService(database,environment=process.env,model=runLearningTutor) {
  const allowDraft=allowDraftLearning(environment);
  const rpc=async (name,args)=>{ const {data,error}=await database.rpc(name,args); if(error) throw error; return data; };
  const action=(device,name,payload={})=>rpc('learning_tutor_action',{p_device_id:device,p_action:name,p_payload:payload,p_allow_draft:allowDraft});
  const gate=(device,context,intent=null,conversationUid=null)=>rpc('learning_tutor_conversation_context',{p_device_id:device,p_context:context,p_intent:intent,p_allow_draft:allowDraft,p_conversation_uid:conversationUid});
  const enabled=()=>{ if(environment.LEARNING_TUTOR_ENABLED!=='1') throw new Error('tutor_disabled'); };
  const coaching=()=>{enabled();if(environment.LEARNING_TUTOR_COACHING_ENABLED!=='1')throw new Error('tutor_disabled');};
  return {
    action,
    async send(device,payload) {
      enabled();
      if(['submitted-question','practice-template'].includes(payload.context.kind))coaching();
      const context=await gate(device,payload.context,payload.intent,payload.conversationUid);
      const payloadHash=tutorPayloadHash(payload);
      const claimed=await action(device,'claim',{...payload,payloadHash});
      if(claimed.cached) return claimed.response;
      try {
        const history=await action(device,'read',{conversationUid:claimed.conversationUid});
        const evidence=retrieveTutorEvidence(context,payload.context,payload.message??payload.intent,payload.language);
        const generated=await model({evidence,language:payload.language,message:payload.message??payload.intent,
          intent:payload.intent??null,history:history.messages});
        const response={answer:generated.answer,sources:evidence.sources.filter(s=>generated.sourceCodes.includes(s.sourceCode)),
          suggestedActions:generated.scope==='in_scope'?tutorActions(context,payload.context):[],contextLabel:context.label,
          contentVersion:payload.context.contentVersion,manifestVersion:context.manifestVersion,
          answerStatus:generated.scope==='in_scope'?'answered':generated.scope,fallback:false};
        // Arthur: NarIyirm
        // 中文：模型完成后 RPC 再验身份/内容/正式考试/租约；清除和恢复后的迟到回复不能重建历史。
        // EN: After generation, the RPC rechecks identity/content/checkpoints/lease; late replies after clear or recovery cannot rebuild history.
        const finished=await action(device,'finish',{...payload,payloadHash,leaseUid:claimed.leaseUid,userText:payload.message??payload.intent,
          response,usage:{...generated.usage,model:generated.model,latencyMs:generated.latencyMs,promptVersion:TUTOR_PROMPT_VERSION}});
        return finished.response;
      } catch(error) {
        await action(device,'uncertain',{requestKey:payload.requestKey,leaseUid:claimed.leaseUid}).catch(()=>undefined);
        throw error;
      }
    },
    async source(device,code,context) { const value=await gate(device,context,context.kind==='submitted-question'?'explain':null); const source=[...(value.feedback?.sources??[]),...value.catalog.sources].find(s=>s.sourceCode===code);
      if(!source) throw new Error('tutor_context_invalid'); return source; },
    async practice(device,code,version) { coaching(); const value=await gate(device,{kind:'practice-template',entityCode:code,contentVersion:version});
      const item=value.manifest.practiceTemplates.find(t=>t.templateCode===code);
      return {templateCode:item.templateCode,contentVersion:version,title:item.title,prompt:item.prompt,options:item.options,sourceRefs:item.sourceRefs}; },
    async practiceAnswer(device,code,payload) { coaching(); const context={kind:'practice-template',entityCode:code,contentVersion:payload.contentVersion};
      return (await action(device,'practice-answer',{...payload,context,payloadHash:tutorPayloadHash({code,...payload})})).response; },
    async hint(device,payload) { coaching(); const value=await action(device,'hint',{...payload,intent:'hint',payloadHash:tutorPayloadHash(payload)});
      const level=value.response.hintLevel;
      return {...value.response,hint:{en:level===1?'Observe the item and its materials.':level===2?'Read what this example collection service accepts.':'Compare each option with the stated service conditions; feedback follows your first answer.',
        zh:level===1?'先观察物品及其材质。':level===2?'阅读这项示例收集服务接收什么。':'将各选项与题目服务条件比较；首次答案提交后查看固定解释。'}}; },
    async recommendations(device,context) { coaching(); return action(device,'recommendations',{context}); },
    async claimIntervention(device,payload) { enabled(); if(environment.LEARNING_TUTOR_PROACTIVE_ENABLED!=='1') return {intervention:null};
      if(payload.reason!=='dwell'&&environment.LEARNING_TUTOR_COACHING_ENABLED!=='1')return {intervention:null};
      return action(device,'intervention-claim',payload); },
  };
}
