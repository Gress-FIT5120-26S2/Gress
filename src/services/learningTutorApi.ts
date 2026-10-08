import { randomUUID } from 'expo-crypto';
import { ApiRequestError, requestApi } from './apiClient';
import { getDeviceCredential, getDeviceId } from './deviceId';
import type { LearningSource, LearningText } from '../types/learningContent';
import type { TutorContext, TutorConversation, TutorMessage, TutorPreferences, TutorReply, TutorSend, TutorPractice, TutorIntervention, TutorRecommendations } from '../types/learningTutor';

const root='/api/learning/tutor';
const json=(method:string,body:unknown):RequestInit=>({method,body:JSON.stringify(body)});
// Arthur: NarIyirm
// 中文：恢复设备身份时丢弃在途旧结果，个人导师历史不能落到另一身份的界面。
// EN: Discard in-flight results when device identity changes so personal tutor history cannot enter another identity's UI.
const identity=async()=>JSON.stringify(await Promise.all([getDeviceId(),getDeviceCredential()]));
const request=async<T>(path:string,init?:RequestInit):Promise<T>=>{
  const owner=await identity();const value=await requestApi<T>(path,init);
  if(owner!==await identity())throw new ApiRequestError('learning_identity_changed',409,'Learning identity changed');
  return value;
};
export const newTutorKey=()=>randomUUID();
export const learningTutorApi={
  send:(payload:TutorSend,signal:AbortSignal)=>request<TutorReply>(`${root}/messages`,{...json('POST',payload),signal}),
  list:(context:TutorContext,before?:string)=>request<{conversations:TutorConversation[]}>(`${root}/conversations?context=${encodeURIComponent(JSON.stringify(context))}${before?`&before=${encodeURIComponent(before)}`:''}`),
  read:(uid:string)=>request<TutorConversation & {messages:TutorMessage[]}>(`${root}/conversations/${uid}`),
  delete:(uid:string)=>request(`${root}/conversations/${uid}`,{method:'DELETE'}),
  clear:()=>request(`${root}/history`,{method:'DELETE'}),
  feedback:(uid:string,rating:'useful'|'not_useful')=>request(`${root}/messages/${uid}/feedback`,json('PUT',{rating,reasonCode:rating==='useful'?'helpful':'unclear'})),
  preferences:()=>request<TutorPreferences>(`${root}/preferences`),
  savePreferences:(value:Partial<TutorPreferences>)=>request<TutorPreferences>(`${root}/preferences`,json('PATCH',value)),
  recommendations:(version:string)=>request<TutorRecommendations>(`${root}/recommendations?contentVersion=${encodeURIComponent(version)}`),
  practice:(code:string,version:string)=>request<TutorPractice>(`${root}/practice/${code}?contentVersion=${encodeURIComponent(version)}`),
  practiceAnswer:(code:string,contentVersion:string,optionId:string,requestKey:string)=>request<{isCorrect:boolean;explanation:LearningText;correctOptionId:string}>(`${root}/practice/${code}/answer`,json('POST',{contentVersion,optionId,requestKey})),
  hint:(context:TutorContext,requestKey:string)=>request<{hintLevel:number;hint:LearningText}>(`${root}/hints`,json('POST',{context,requestKey})),
  claim:(context:TutorContext,visitKey:string,reason:string,attemptUid?:string)=>request<{intervention:TutorIntervention|null}>(`${root}/interventions/claim`,json('POST',{context,visitKey,reason,...(attemptUid?{attemptUid}:{})})),
  respond:(uid:string,status:'shown'|'accepted'|'dismissed')=>request(`${root}/interventions/${uid}/respond`,json('POST',{status})),
  source:(code:string,version:string,context:TutorContext)=>request<LearningSource>(`${root}/sources/${code}?contentVersion=${encodeURIComponent(version)}&context=${encodeURIComponent(JSON.stringify(context))}`),
};
