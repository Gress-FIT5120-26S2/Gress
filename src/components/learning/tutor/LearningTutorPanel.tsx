import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../../i18n';
import { getApiErrorCode } from '../../../services/apiClient';
import { learningTutorApi as api, newTutorKey } from '../../../services/learningTutorApi';
import type { LearningText } from '../../../types/learningContent';
import type { TutorAction, TutorContext, TutorConversation, TutorIntent, TutorMessage, TutorPreferences, TutorSend, TutorPractice } from '../../../types/learningTutor';
import { LearningButton, LearningLink, ui } from '../LearningUi';
import { learningColors as c } from '../learningTheme';

type Props={context:TutorContext;label:LearningText;restricted:boolean;onClose:()=>void;onAction:(a:TutorAction)=>void;
  onResume?:()=>void;onAbandon?:()=>Promise<void>;initialPrompt?:string;};

export function LearningTutorPanel({context,label,restricted,onClose,onAction,onResume,onAbandon,initialPrompt}:Props){
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
  const generation=useRef(0);const flight=useRef(false);const field=useRef<TextInput>(null);
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
    field.current?.focus();
    return()=>{live=false;generation.current++;controller.current?.abort();sub.remove();};
  },[]);
  const perform=async(operation:()=>Promise<void>)=>{if(flight.current)return;flight.current=true;setBusy(true);setError(null);const id=generation.current;
    try{await operation();}catch(err){if(id===generation.current)setError(failure(err));}finally{if(id===generation.current){flight.current=false;setBusy(false);}}};
  const send=async(value?:string,intent?:TutorIntent)=>{
    if(flight.current||withdrawn||loading)return;
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
  const newChat=()=>{cancel();pending.current=null;setConversation(undefined);setMessages([]);setWithdrawn(false);setHistory(null);setError(null);};
  const confirm=()=>{const action=confirmation;setConfirmation(null);cancel();void perform(async()=>{
    if(action==='abandon'){await onAbandon?.();onClose();return;}
    if(action==='clear')await api.clear();else if(conversation)await api.delete(conversation);
    pending.current=null;setConversation(undefined);setMessages([]);setHistory(null);setError(null);
  });};
  const practiceAnswer=()=>{if(!practice||!selected)return;
    practiceRequest.current??={key:newTutorKey(),option:selected};const frozen=practiceRequest.current;
    void perform(async()=>{setPracticeFeedback(await api.practiceAnswer(practice.templateCode,practice.contentVersion,frozen.option,frozen.key));});};
  return <Modal visible transparent={false} animationType="none" onRequestClose={()=>{cancel();onClose();}}>
    <SafeAreaView style={{flex:1,backgroundColor:c.background}}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={{paddingHorizontal:20,paddingVertical:8,gap:4}} accessibilityViewIsModal>
          <View style={[ui.row,{justifyContent:'space-between'}]}>
            <Image source={require('../../../../assets/kitchmemo-assistant.png')} style={{width:36,height:44}} resizeMode="contain" accessible={false}/>
            <Text accessibilityRole="header" style={[ui.listTitle,ui.flex]}>{copy.title}</Text>
            <LearningLink label={copy.close} onPress={()=>{cancel();onClose();}} icon="close-outline"/>
          </View>
          <Text style={ui.caption}>{copy.discussing}: {label[language]}</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',columnGap:16}}>
            <LearningLink label={copy.history} onPress={openHistory}/><LearningLink label={copy.newChat} onPress={newChat}/>
            <LearningLink label={copy.settings} onPress={()=>{setSettings(!settings);setHistory(null);}}/>
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,gap:16}}>
          {loading?<Text style={ui.secondary}>{t.learning.loading}</Text>:null}
          {settings?<View style={ui.group}><Text style={ui.body}>{copy.settingsBody}</Text>
            {preferences?(['proactiveEnabled','personalizedEnabled','dwellHintsEnabled'] as const).map((key,i)=><View key={key} style={[ui.row,{justifyContent:'space-between'}]}>
              <Text style={[ui.body,ui.flex]}>{[copy.proactive,copy.personalized,copy.dwell][i]}</Text>
              <Switch accessibilityLabel={[copy.proactive,copy.personalized,copy.dwell][i]} value={preferences[key]} disabled={busy}
                onValueChange={value=>{void perform(async()=>setPreferences(await api.savePreferences({[key]:value})));}}/>
            </View>):null}
            <LearningLink label={copy.clear} onPress={()=>setConfirmation('clear')}/>
            {conversation?<LearningLink label={copy.deleteChat} onPress={()=>setConfirmation('delete')}/>:null}
          </View>:history?<View style={ui.group}>{!history.length?<Text style={ui.secondary}>{copy.historyEmpty}</Text>:history.map(item=><LearningLink key={item.conversationUid}
            label={new Date(item.createdAt).toLocaleString(language==='zh'?'zh-CN':'en-AU')} onPress={()=>{void perform(async()=>{pending.current=null;await restore(item.conversationUid,generation.current);setHistory(null);});}}/>)}{moreHistory?<LearningButton label={copy.moreHistory} disabled={busy} onPress={loadMore}/>:null}</View>:<>
            {withdrawn?<Text style={ui.error}>{copy.withdrawn}</Text>:null}
            {!messages.length&&!loading?<Text style={ui.secondary}>{copy.empty}</Text>:null}
            {practice?<View style={ui.group}><Text accessibilityRole="header" style={ui.sectionTitle}>{practice.title[language]}</Text><Text style={ui.caption}>{copy.practiceBody}</Text>
              <Text style={ui.body}>{practice.prompt[language]}</Text>{practice.options.map(option=><Pressable key={option.optionId} accessibilityRole="radio"
                accessibilityState={{checked:selected===option.optionId,disabled:busy||Boolean(practiceFeedback)||Boolean(practiceRequest.current)}} disabled={busy||Boolean(practiceFeedback)||Boolean(practiceRequest.current)}
                onPress={()=>setSelected(option.optionId)} style={{padding:14,minHeight:48,borderWidth:1,borderColor:c.border,borderRadius:14,backgroundColor:selected===option.optionId?c.mintStrong:c.surface}}>
                <Text style={ui.body}>{option.text[language]}</Text></Pressable>)}
              {practiceFeedback?<><Text style={ui.listTitle}>{practiceFeedback.isCorrect?copy.practiceCorrect:copy.practiceIncorrect}</Text><Text style={ui.body}>{practiceFeedback.explanation[language]}</Text><Text style={ui.caption}>{copy.practiceSaved}</Text></>
                :<LearningButton label={copy.check} disabled={!selected||busy} onPress={practiceAnswer}/>}</View>:null}
            {messages.map(message=><View key={message.messageUid} style={{gap:8,padding:message.role==='user'?14:0,backgroundColor:message.role==='user'?c.mintSurface:c.background,borderRadius:14}}>
              <Text selectable style={ui.body}>{message.content}</Text>
              {message.response?<><Text style={ui.caption}>{message.response.contentVersion} · {message.response.manifestVersion} · {new Date(message.createdAt).toLocaleDateString()}</Text>
                {message.response.sources.length?<Text style={ui.listTitle}>{copy.sources}</Text>:null}
                {message.response.sources.map(s=><View key={s.sourceCode}><LearningLink label={`${s.publisher} · ${s.title}`} onPress={()=>{if(!withdrawn)void source(s.sourceCode);}} icon="open-outline"/><Text style={ui.caption}>{s.regionCode} · {copy.published}: {s.publishedAt??t.learning.unspecifiedDate}{s.updatedAt?` · ${copy.updated}: ${s.updatedAt}`:''}</Text></View>)}
                {!withdrawn?message.response.suggestedActions.map(a=><LearningLink key={a.type+a.entityCode} label={a.label[language]} onPress={()=>{cancel();onAction(a);}}/>):null}
                <View style={[ui.row,{flexWrap:'wrap'}]}>{(['useful','not_useful'] as const).map(rating=><LearningLink key={rating}
                  label={`${message.rating===rating?'✓ ':''}${rating==='useful'?copy.useful:copy.notUseful}`} onPress={()=>{void perform(async()=>{await api.feedback(message.messageUid,rating);setMessages(old=>old.map(m=>m.messageUid===message.messageUid?{...m,rating}:m));AccessibilityInfo.announceForAccessibility(copy.feedbackSaved);});}}/>)}</View>
              </>:null}
            </View>)}
          </>}
          {confirmation?<View style={ui.panel}><Text style={ui.body}>{confirmation==='clear'?copy.confirmClear:confirmation==='delete'?copy.confirmDelete:copy.abandonBody}</Text>
            <LearningButton label={copy.confirm} onPress={confirm} disabled={busy}/><LearningLink label={copy.cancel} onPress={()=>setConfirmation(null)}/></View>:null}
          {restricted?<View style={ui.panel}><Text style={ui.body}>{copy.restricted}</Text>{onResume?<LearningLink label={copy.resume} onPress={()=>{cancel();onClose();onResume();}}/>:null}
            {onAbandon?<LearningLink label={copy.abandon} onPress={()=>setConfirmation('abandon')}/>:null}</View>:null}
          {busy?<Text accessibilityLiveRegion="polite" style={ui.secondary}>{slow?copy.stillWaiting:copy.waiting}</Text>:null}
          {error?<Text accessibilityLiveRegion="polite" style={ui.error}>{error}</Text>:null}
        </ScrollView>
        {!settings&&!history&&!withdrawn?<View style={{padding:16,gap:8,backgroundColor:c.surface,borderTopWidth:1,borderTopColor:c.border}}>
          <View style={{flexDirection:'row',flexWrap:'wrap',columnGap:14}}>{(['explain','simplify','example'] as const).map(intent=><LearningLink key={intent} label={copy[intent]}
            onPress={()=>{if(!busy&&!pending.current&&(!restricted||submitted))void send(copy[intent],intent);}}/>)}</View>
          {!submitted?<TextInput ref={field} accessibilityLabel={copy.placeholder} placeholder={copy.placeholder} placeholderTextColor={c.textSecondaryReadable} value={input}
            onChangeText={setInput} editable={!busy&&!restricted&&!pending.current} multiline maxLength={2000} style={[ui.body,{maxHeight:140,minHeight:48,padding:12,borderWidth:1,borderColor:c.border,borderRadius:14}]}/>:null}
          <LearningButton label={pending.current?copy.retry:copy.send} disabled={busy||loading||Boolean(restricted&&!submitted)||(!submitted&&!input.trim()&&!pending.current)} onPress={()=>{void send();}}/>
        </View>:null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
