import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, KeyboardAvoidingView, Linking, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../../i18n';
import { getApiErrorCode } from '../../../services/apiClient';
import { learningTutorApi as defaultApi, newTutorKey } from '../../../services/learningTutorApi';
import type { LearningText } from '../../../types/learningContent';
import type { TutorAction, TutorContext, TutorConversation, TutorIntent, TutorMessage, TutorPreferences, TutorSend, TutorPractice } from '../../../types/learningTutor';
import { LearningTutorView } from './LearningTutorView';
import type { LearningAssetKey } from '../learningAssets';
import { learningColors as c } from '../learningTheme';

type Props={context:TutorContext;label:LearningText;restricted:boolean;onClose:()=>void;onAction:(a:TutorAction)=>void;
  onResume?:()=>void;onAbandon?:()=>Promise<void>;initialPrompt?:string;
  coverAssetKey?:LearningAssetKey;showLifecycle?:boolean;service?:typeof defaultApi;embedded?:boolean;};

export function LearningTutorPanel({context,label,restricted,onClose,onAction,onResume,onAbandon,initialPrompt,coverAssetKey,showLifecycle,service=defaultApi,embedded=false}:Props){
  const api=service;
  const {language,t}=useI18n();const copy=t.learningTutor;
  const [messages,setMessages]=useState<TutorMessage[]>([]);const [conversation,setConversation]=useState<string>();
  const [history,setHistory]=useState<TutorConversation[]|null>(null);const [input,setInput]=useState(initialPrompt??'');
  const [moreHistory,setMoreHistory]=useState(false);
  const [busy,setBusy]=useState(false);const [slow,setSlow]=useState(false);const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);const [withdrawn,setWithdrawn]=useState(false);
  const [preferences,setPreferences]=useState<TutorPreferences|null>(null);const [settings,setSettings]=useState(false);
  const [confirmation,setConfirmation]=useState<'clear'|'delete'|'abandon'|null>(null);
  const [practice,setPractice]=useState<TutorPractice|null>(null);const [selected,setSelected]=useState<string|null>(null);
  const [practiceFeedback,setPracticeFeedback]=useState<{isCorrect:boolean;explanation:LearningText}|null>(null);
  const pending=useRef<TutorSend|null>(null);const controller=useRef<AbortController|null>(null);
  const generation=useRef(0);const flight=useRef(false);
  const [intent,setIntent]=useState<TutorIntent>('explain');
  const practiceRequest=useRef<{key:string;option:string}|null>(null);
  const submitted=context.kind==='submitted-question';
  const failure=(err:unknown)=>{const code=getApiErrorCode(err);
    if(['learning_identity_changed','invalid_device','invalid_device_credential'].includes(code??'')){
      pending.current=null;setMessages([]);setConversation(undefined);setHistory(null);setPreferences(null);setWithdrawn(true);
      return copy.identityChanged;
    }
    if(code==='tutor_assessment_restricted')return copy.restricted;
    if(code==='tutor_request_uncertain'||code==='tutor_request_pending')return copy.uncertain;
    if(code==='tutor_disabled')return copy.disabled;
    if(code==='tutor_content_unavailable'||code==='tutor_content_changed')return copy.unavailable;
    return copy.failed;};
  const cancel=()=>{generation.current++;controller.current?.abort();controller.current=null;flight.current=false;setBusy(false);setSlow(false);};
  const restore=async(uid:string,id:number)=>{const value=await api.read(uid);if(generation.current!==id)return;setConversation(uid);setMessages(value.messages);setWithdrawn(Boolean(value.withdrawn));};
  useEffect(()=>{
    const id=++generation.current;let live=true;
    void Promise.all([api.list(context),api.preferences()]).then(async([list,pref])=>{
      if(!live||generation.current!==id)return;setPreferences(pref);
      if(list.conversations[0])await restore(list.conversations[0].conversationUid,id);
      if(context.kind==='practice-template'){const value=await api.practice(context.entityCode,context.contentVersion);if(live&&generation.current===id)setPractice(value);}
    }).catch(err=>{if(live)setError(failure(err));}).finally(()=>{if(live)setLoading(false);});
    const sub=AppState.addEventListener('change',state=>{if(state!=='active'){cancel();}else{const version=generation.current;void api.list(context).then(list=>list.conversations[0]?restore(list.conversations[0].conversationUid,version):undefined).catch(err=>setError(failure(err)));}});
    return()=>{live=false;generation.current++;controller.current?.abort();sub.remove();};
  },[]);
  const perform=async(operation:()=>Promise<void>)=>{if(flight.current)return;flight.current=true;setBusy(true);setError(null);const id=generation.current;
    try{await operation();}catch(err){if(id===generation.current)setError(failure(err));}finally{if(id===generation.current){flight.current=false;setBusy(false);}}};
  const send=async(value?:string,intent?:TutorIntent)=>{
    if(flight.current||withdrawn||loading||(restricted&&!submitted))return;
    if(intent)setIntent(intent);
    const payload=pending.current??{context,language,requestKey:newTutorKey(),...(conversation?{conversationUid:conversation}:{}),
      ...(submitted?{intent:intent??'explain'}:{message:value??input.trim()})};
    if(!payload.message&&!payload.intent)return;
    pending.current=payload;flight.current=true;setBusy(true);setError(null);
    const id=++generation.current;const abort=new AbortController();controller.current=abort;
    const slowTimer=setTimeout(()=>{if(generation.current===id)setSlow(true);},8000);
    const deadline=setTimeout(()=>abort.abort(),40000);
    // Arthur: NarIyirm
    // 中文：失败重用原请求键和正文，关闭/后台使旧 UI 响应失效；服务端已保存回答通过历史恢复。
    // EN: Failures reuse the original key and text; close/background invalidate old UI responses while saved answers restore from server history.
    try{const reply=await api.send(payload,abort.signal);if(generation.current!==id)return;
      setConversation(reply.conversationUid);pending.current=null;setInput('');
      await restore(reply.conversationUid,id);
      AccessibilityInfo.announceForAccessibility(reply.answer);
    }catch(err){if(generation.current===id)setError(failure(err));}
    finally{clearTimeout(slowTimer);clearTimeout(deadline);if(generation.current===id){flight.current=false;setBusy(false);setSlow(false);controller.current=null;}}
  };
  const source=async(code:string)=>{await perform(async()=>{const verified=await api.source(code,context.contentVersion,context);await Linking.openURL(verified.url);});};
  const openHistory=()=>{cancel();void perform(async()=>{const list=(await api.list(context)).conversations;setHistory(list);setMoreHistory(list.length===20);});};
  const loadMore=()=>{if(!history?.length)return;void perform(async()=>{const list=(await api.list(context,history[history.length-1].createdAt)).conversations;setHistory(old=>[...(old??[]),...list]);setMoreHistory(list.length===20);});};
  const newChat=()=>{cancel();pending.current=null;setConversation(undefined);setMessages([]);setWithdrawn(false);setHistory(null);setSettings(false);setError(null);};
  const confirm=()=>{const action=confirmation;setConfirmation(null);cancel();void perform(async()=>{
    if(action==='abandon'){await onAbandon?.();onClose();return;}
    if(action==='clear')await api.clear();else if(conversation)await api.delete(conversation);
    pending.current=null;setConversation(undefined);setMessages([]);setHistory(null);setError(null);
  });};
  const practiceAnswer=()=>{if(!practice||!selected)return;
    practiceRequest.current??={key:newTutorKey(),option:selected};const frozen=practiceRequest.current;
    void perform(async()=>{setPracticeFeedback(await api.practiceAnswer(practice.templateCode,practice.contentVersion,frozen.option,frozen.key));});};
  // Arthur: NarIyirm
  // 中文：展示层只接收状态与原操作；开发预览显式注入离线服务，正式界面继续使用设备身份校验 API。
  // EN: Presentation receives state and existing operations; explicit development previews inject an offline service while production retains the identity-checked API.
  const close=()=>{cancel();onClose();};
  const content=<SafeAreaView style={{flex:1,backgroundColor:c.background}}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
      <LearningTutorView label={label} coverAssetKey={coverAssetKey} showLifecycle={showLifecycle} submitted={submitted}
        messages={messages} input={input} loading={loading} busy={busy} slow={slow} error={error}
        withdrawn={withdrawn} restricted={restricted} retrying={Boolean(pending.current)} intent={intent}
        settings={settings} history={history} moreHistory={moreHistory} preferences={preferences}
        practice={practice} selected={selected} practiceLocked={Boolean(practiceFeedback)||Boolean(practiceRequest.current)}
        practiceFeedback={practiceFeedback} confirmation={confirmation}
        onClose={close} onInput={setInput} onSend={(value,nextIntent)=>{void send(value,nextIntent);}}
        onMenu={action=>{if(action==='history'){setSettings(false);openHistory();}
          else if(action==='new')newChat();else{setSettings(!settings);setHistory(null);}}}
        onBackToConversation={()=>{cancel();setSettings(false);setHistory(null);}}
        onHistory={uid=>{void perform(async()=>{pending.current=null;await restore(uid,generation.current);setHistory(null);});}}
        onMoreHistory={loadMore} onPreferences={value=>{void perform(async()=>setPreferences(await api.savePreferences(value)));}}
        onConfirmation={setConfirmation} onConfirm={confirm} onSelect={setSelected} onPracticeAnswer={practiceAnswer}
        onSource={code=>{if(!withdrawn)void source(code);}}
        onFeedback={(uid,rating)=>{void perform(async()=>{await api.feedback(uid,rating);
          setMessages(old=>old.map(m=>m.messageUid===uid?{...m,rating}:m));AccessibilityInfo.announceForAccessibility(copy.feedbackSaved);});}}
        onAction={action=>{cancel();onAction(action);}} onResume={onResume?()=>{close();onResume();}:undefined}
        canAbandon={Boolean(onAbandon)} />
    </KeyboardAvoidingView>
  </SafeAreaView>;
  return embedded?content:<Modal visible transparent={false} animationType="none" onRequestClose={close}>{content}</Modal>;
}
