import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Text, View } from 'react-native';
import { useI18n } from '../../../i18n';
import { learningTutorApi as api, newTutorKey } from '../../../services/learningTutorApi';
import type { PublicLearningContent } from '../../../types/learningContent';
import type { LearningRoomGateway, LearningRoute } from '../../../types/learningRoom';
import type { TutorAction, TutorContext, TutorIntervention, TutorRecommendations } from '../../../types/learningTutor';
import { LearningLink, ui } from '../LearningUi';
import { LearningTutorSlot } from './LearningTutorSlot';
import { LearningTutorPanel } from './LearningTutorPanel';
import { TutorEntryButton, TutorHelpCard } from './LearningTutorView';

type Props={children:ReactNode;content:PublicLearningContent;route:LearningRoute;gateway:LearningRoomGateway;
  busy:boolean;storyVisible:boolean;onNavigate:(route:LearningRoute)=>void;onResume:(uid:string)=>void;onAbandoned:()=>void;};
export function LearningTutorController({children,content,route,gateway,busy,storyVisible,onNavigate,onResume,onAbandoned}:Props){
  const {t,language}=useI18n();const copy=t.learningTutor;
  const [panel,setPanel]=useState<TutorContext|null>(null);const [prompt,setPrompt]=useState<string>();
  const [intervention,setIntervention]=useState<TutorIntervention|null>(null);const [recommendations,setRecommendations]=useState<TutorRecommendations|null>(null);
  const [hint,setHint]=useState<string|null>(null);const [active,setActive]=useState(AppState.currentState==='active');
  const [screenReader,setScreenReader]=useState(true);const [error,setError]=useState<string|null>(null);
  const visit=useRef(newTutorKey());const hintKey=useRef<string|null>(null);const hintBusy=useRef(false);
  const state=gateway.getState?.();const activeAttempt=state?.activeAttemptUid??null;
  const quiz=route.name==='quiz'?route.quiz:route.name==='review'?route.questions[route.index]:null;
  // Arthur: NarIyirm
  // 中文：历史单题用服务器冻结版本，客户端只传标识；未答正式题没有导师入口。
  // EN: Historical single questions use the server-frozen version and identifiers only; unanswered formal questions have no tutor entry.
  const context:TutorContext=quiz?.feedback?{kind:'submitted-question',contentVersion:gateway.getAttemptContentVersion?.(quiz.attemptUid)??content.contentVersion,attemptUid:quiz.attemptUid,questionUid:quiz.question.questionUid}
    :route.name==='course'?{kind:'course',contentVersion:content.contentVersion,entityCode:route.courseCode}
    :route.name==='lesson'?{kind:'activity',contentVersion:content.contentVersion,entityCode:route.activityCode}
    :route.name==='resource'?{kind:'resource',contentVersion:content.contentVersion,entityCode:route.resourceCode}
    :{kind:'general',contentVersion:content.contentVersion};
  const contextKey=JSON.stringify(context);const routeKey=JSON.stringify(route.name==='hub'?{name:route.name,segment:route.segment}:route.name==='result'?{name:'result',uid:route.result.attemptUid}:context);
  const formalUnanswered=Boolean(route.name==='quiz'&&quiz?.mode!=='practice'&&!quiz?.feedback);
  const canOffer=active&&!storyVisible&&!busy&&!panel&&!formalUnanswered;
  useEffect(()=>{let alive=true;void AccessibilityInfo.isScreenReaderEnabled().then(v=>{if(alive)setScreenReader(v);});
    const reader=AccessibilityInfo.addEventListener('screenReaderChanged',setScreenReader);
    const app=AppState.addEventListener('change',v=>{setActive(v==='active');if(v!=='active')setIntervention(null);});
    return()=>{alive=false;reader.remove();app.remove();};},[]);
  useEffect(()=>{visit.current=newTutorKey();hintKey.current=null;setHint(null);setPanel(null);setIntervention(null);setError(null);},[routeKey]);
  useEffect(()=>{let alive=true;setRecommendations(null);
    if(!activeAttempt&&(route.name==='result'||route.name==='hub'&&route.segment==='path'))
      void api.recommendations(content.contentVersion).then(v=>{if(alive)setRecommendations(v);}).catch(()=>undefined);
    return()=>{alive=false;};},[routeKey,activeAttempt,active,content.contentVersion]);
  useEffect(()=>{
    let alive=true;let timer:ReturnType<typeof setTimeout>|undefined;
    if(!canOffer||activeAttempt)return;
    const reason=route.name==='result'&&!route.result.passed&&route.result.mode==='checkpoint'?'checkpoint-failed'
      :quiz?.feedback?'repeated-errors':route.name==='lesson'&&content.activities.find(a=>a.activityCode===route.activityCode)?.type==='practice'?'before-practice':null;
    const claim=async(candidate:string)=>{try{const value=await api.claim(context,visit.current,candidate,route.name==='result'?route.result.attemptUid:undefined);
      if(alive&&value.intervention){setIntervention(value.intervention);await api.respond(value.intervention.interventionUid,'shown');}}catch{if(alive)setIntervention(null);}};
    if(reason)void claim(reason);
    else if(!screenReader&&(route.name==='lesson'||route.name==='resource'))
      void api.preferences().then(pref=>{if(alive&&pref.proactiveEnabled&&pref.dwellHintsEnabled)timer=setTimeout(()=>{void claim('dwell');},90000);}).catch(()=>undefined);
    return()=>{alive=false;if(timer)clearTimeout(timer);};
  },[routeKey,canOffer,activeAttempt,screenReader]);
  const label=(value:TutorContext)=>value.kind==='submitted-question'||value.kind==='practice-question'?quiz?.question.prompt??{en:copy.explain,zh:copy.explain}
    :'entityCode' in value?[...content.courses,...content.activities,...content.resources].find(item=>('courseCode' in item?item.courseCode:'activityCode' in item?item.activityCode:item.resourceCode)===value.entityCode)?.title??{en:copy.practice,zh:copy.practice}
    :{en:'Waste & climate',zh:'浪费与气候'};
  const open=(value:TutorContext=context,initial?:string)=>{setPrompt(initial);setPanel(value);setError(null);};
  const navigateAction=(a:TutorAction)=>{if(a.type==='open_practice'){setPanel({kind:'practice-template',entityCode:a.entityCode,contentVersion:content.contentVersion});return;}
    setPanel(null);onNavigate(a.type==='open_lesson'?{name:'lesson',activityCode:a.entityCode}:{name:'resource',resourceCode:a.entityCode});};
  const accept=async()=>{if(!intervention)return;const selected=intervention;setIntervention(null);
    try{await api.respond(selected.interventionUid,'accepted');open(selected.context,copy.example);}catch{setError(t.learning.actionFailed);}};
  const dismiss=async()=>{if(!intervention)return;const selected=intervention;setIntervention(null);try{await api.respond(selected.interventionUid,'dismissed');}catch{setError(t.learning.actionFailed);}};
  const askHint=async()=>{if(!quiz||hintBusy.current)return;hintBusy.current=true;hintKey.current??=newTutorKey();
    const hintVisit=visit.current;
    try{const result=await api.hint({kind:'practice-question',contentVersion:content.contentVersion,attemptUid:quiz.attemptUid,questionUid:quiz.question.questionUid},hintKey.current);if(hintVisit===visit.current){setHint(result.hint[language]);hintKey.current=null;}}
    catch{setError(t.learning.actionFailed);}finally{hintBusy.current=false;}};
  const footer=formalUnanswered?<Text style={ui.caption}>{copy.checkpointNote}</Text>:route.name==='quiz'&&quiz?.mode==='practice'&&!quiz.feedback?
    <TutorEntryButton label={copy.hint} disabled={busy} onPress={()=>{void askHint();}}/>:
    <TutorEntryButton label={quiz?.feedback?copy.explain:copy.ask} disabled={busy} onPress={()=>open()}/>;
  const body=hint||intervention&&canOffer||recommendations?.topics.length||error?<View style={{gap:16}}>
    {hint?<View style={ui.panel}><Text style={ui.body}>{hint}</Text></View>:null}
    {intervention&&canOffer?<TutorHelpCard prompt={intervention.prompt[language]} onAccept={()=>{void accept();}} onDismiss={()=>{void dismiss();}}
      onTurnOff={()=>{setIntervention(null);void api.savePreferences({proactiveEnabled:false}).catch(()=>setError(t.learning.actionFailed));}}/>:null}
    {recommendations?.topics.length?<View style={ui.group}><Text style={ui.listTitle}>{copy.review}</Text>{recommendations.topics.map(item=><View key={item.topicCode}>
      <Text style={ui.caption}>{copy.evidence(item.sampleCount,item.wrongCount)}</Text><View style={{flexDirection:'row',flexWrap:'wrap',columnGap:14}}>
        <LearningLink label={content.activities.find(a=>a.activityCode===item.activityCode)?.title[language]??copy.readLesson} onPress={()=>onNavigate({name:'lesson',activityCode:item.activityCode})}/>
        <LearningLink label={copy.similar} onPress={()=>open({kind:'practice-template',entityCode:item.templateCode,contentVersion:content.contentVersion})}/></View></View>)}</View>:null}
    {error?<Text style={ui.error}>{error}</Text>:null}
  </View>:undefined;
  const slot={body,footer};
  const panelCover=panel&&'entityCode' in panel?panel.kind==='resource'?content.resources.find(r=>r.resourceCode===panel.entityCode)?.coverAssetKey
    :panel.kind==='course'?content.courses.find(course=>course.courseCode===panel.entityCode)?.coverAssetKey
    :content.courses.find(course=>course.activityCodes.includes(panel.entityCode))?.coverAssetKey:undefined;
  return <LearningTutorSlot.Provider value={storyVisible?null:slot}>{children}
    {panel?<LearningTutorPanel key={JSON.stringify(panel)} context={panel} label={label(panel)} coverAssetKey={panelCover}
      showLifecycle={'entityCode' in panel&&['waste-climate-sdg13','beginner-why-waste'].includes(panel.entityCode)}
      initialPrompt={prompt} restricted={Boolean(activeAttempt)} onClose={()=>setPanel(null)} onAction={navigateAction}
      onResume={activeAttempt?()=>onResume(activeAttempt):undefined} onAbandon={activeAttempt&&gateway.abandonQuiz?async()=>{await gateway.abandonQuiz!(activeAttempt);onAbandoned();}:undefined}/>:null}
  </LearningTutorSlot.Provider>;
}
