const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const code=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function validTutorContext(c) {
  if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['kind','contentVersion','entityCode','attemptUid','questionUid'].includes(k))
    ||typeof c.contentVersion!=='string'||!c.contentVersion||c.contentVersion.length>100) return false;
  if(c.kind==='general') return Object.keys(c).length===2;
  if(['course','activity','resource','practice-template'].includes(c.kind)) return Object.keys(c).length===3&&code.test(c.entityCode??'');
  return ['submitted-question','practice-question'].includes(c.kind)&&Object.keys(c).length===4&&uuid.test(c.attemptUid??'')&&uuid.test(c.questionUid??'');
}
export function tutorError(error) {
  const value=error.message??'';
  const codes={invalid_input:400,tutor_disabled:503,tutor_context_invalid:400,tutor_conversation_not_found:404,
    tutor_feedback_not_available:404,tutor_content_unavailable:503,tutor_content_changed:409,tutor_assessment_restricted:409,
    tutor_request_conflict:409,tutor_request_pending:409,tutor_request_uncertain:409,tutor_conversation_full:409};
  return codes[value]?{status:codes[value],code:value}:{status:503,code:'tutor_unavailable'};
}
