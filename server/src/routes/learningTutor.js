import express from 'express';
import { validTutorContext, tutorError } from '../services/learningTutorInput.js';
import { requireFridge } from '../middleware/requireFridge.js';
import { consumeRateLimit, rateLimitPolicies } from '../middleware/rateLimit.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const code=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(v);
const exact=(v,fields)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>fields.includes(k));
const invalid=()=>{throw new Error('invalid_input');};
export function createLearningTutorRouter(service,limit=consumeRateLimit) {
  const router=express.Router();router.use('/learning/tutor',requireFridge);
  const handle=fn=>async(req,res)=>{try{const value=await fn(req,res);if(!res.headersSent)res.json(value);}catch(e){const error=tutorError(e);res.status(error.status).json({error:error.code});}};
  const uid=(req,name)=>{if(!uuid.test(req.params[name]??''))invalid();return req.params[name];};
  const context=c=>{if(!validTutorContext(c))invalid();return c;};
  router.post('/learning/tutor/messages',handle(async(req,res)=>{
    const b=req.body;
    if(!exact(b,['context','language','requestKey','conversationUid','message','intent'])||!key(b.requestKey)||!['en','zh'].includes(b.language)
      ||(b.conversationUid!==undefined&&!uuid.test(b.conversationUid))||('message' in b)===('intent' in b))invalid();
    context(b.context);
    if('message' in b ? typeof b.message!=='string'||!b.message.trim()||b.message.length>2000 : !['explain','simplify','example'].includes(b.intent))invalid();
    if(b.context.kind==='submitted-question'&&('message' in b))invalid();
    if(b.context.kind==='practice-question')invalid();
    if(!await limit({request:req,response:res,identifier:req.deviceId,policy:rateLimitPolicies.assistant}))return;
    return service.send(req.deviceId,b);
  }));
  router.get('/learning/tutor/conversations',handle(req=>{
    if(Object.keys(req.query).some(k=>!['before','context'].includes(k)))invalid();
    const payload={};if(req.query.before){if(typeof req.query.before!=='string'||!Number.isFinite(Date.parse(req.query.before)))invalid();payload.before=req.query.before;}
    if(req.query.context){try{payload.context=context(JSON.parse(req.query.context));}catch{invalid();}}
    return service.action(req.deviceId,'list',payload);
  }));
  for(const method of ['get','delete'])router[method]('/learning/tutor/conversations/:conversationUid',handle(req=>service.action(req.deviceId,method==='get'?'read':'delete',{conversationUid:uid(req,'conversationUid')})));
  router.delete('/learning/tutor/history',handle(req=>service.action(req.deviceId,'clear')));
  router.put('/learning/tutor/messages/:messageUid/feedback',handle(req=>{
    if(!exact(req.body,['rating','reasonCode'])||!['useful','not_useful'].includes(req.body.rating)||!['helpful','unclear','source','other'].includes(req.body.reasonCode))invalid();
    return service.action(req.deviceId,'feedback',{...req.body,messageUid:uid(req,'messageUid')});
  }));
  router.get('/learning/tutor/preferences',handle(req=>service.action(req.deviceId,'preferences')));
  router.patch('/learning/tutor/preferences',handle(req=>{
    if(!exact(req.body,['proactiveEnabled','personalizedEnabled','dwellHintsEnabled','timeZone'])||Object.entries(req.body).some(([k,v])=>k==='timeZone'?typeof v!=='string'||v.length>100:typeof v!=='boolean'))invalid();
    return service.action(req.deviceId,'preferences-update',req.body);
  }));
  router.get('/learning/tutor/recommendations',handle(req=>service.recommendations(req.deviceId,context({kind:'general',contentVersion:req.query.contentVersion}))));
  router.get('/learning/tutor/practice/:templateCode',handle(req=>{if(!code.test(req.params.templateCode))invalid();return service.practice(req.deviceId,req.params.templateCode,req.query.contentVersion);}));
  router.post('/learning/tutor/practice/:templateCode/answer',handle(req=>{if(!code.test(req.params.templateCode)||!exact(req.body,['contentVersion','optionId','requestKey'])||!key(req.body.requestKey)||!code.test(req.body.optionId??''))invalid();return service.practiceAnswer(req.deviceId,req.params.templateCode,req.body);}));
  router.post('/learning/tutor/hints',handle(req=>{if(!exact(req.body,['context','requestKey'])||!key(req.body.requestKey)||context(req.body.context).kind!=='practice-question')invalid();return service.hint(req.deviceId,req.body);}));
  router.post('/learning/tutor/interventions/claim',handle(req=>{
    if(!exact(req.body,['context','visitKey','reason','attemptUid'])||!key(req.body.visitKey)||!['repeated-errors','checkpoint-failed','before-practice','dwell'].includes(req.body.reason)
      ||(req.body.attemptUid!==undefined&&!uuid.test(req.body.attemptUid)))invalid();context(req.body.context);return service.claimIntervention(req.deviceId,req.body);
  }));
  router.post('/learning/tutor/interventions/:interventionUid/respond',handle(req=>{
    if(!exact(req.body,['status'])||!['shown','accepted','dismissed'].includes(req.body.status))invalid();return service.action(req.deviceId,'intervention-respond',{...req.body,interventionUid:uid(req,'interventionUid')});
  }));
  router.get('/learning/tutor/sources/:sourceCode',handle(req=>{
    if(!code.test(req.params.sourceCode)||Object.keys(req.query).some(k=>!['contentVersion','context'].includes(k)))invalid();
    let value={kind:'general',contentVersion:req.query.contentVersion};
    if(req.query.context){try{value=context(JSON.parse(req.query.context));}catch{invalid();}}
    if(value.contentVersion!==req.query.contentVersion)invalid();
    return service.source(req.deviceId,req.params.sourceCode,value);
  }));
  return router;
}
