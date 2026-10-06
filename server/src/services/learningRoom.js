import { allowDraftLearning, projectLearningResponse, selectLearningQuestions } from './learningAssessment.js';
import { validateNoPrivateFields } from './learningContent.js';

export function createLearningRoomService(database, environment = process.env) {
  const allowDraft = allowDraftLearning(environment);
  const content = async () => {
    const { data, error } = await database.from('learning_content_versions')
      .select('content_version,public_catalog,private_question_bank,status,created_at')
      .in('status', allowDraft ? ['published', 'draft'] : ['published'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    const value = data?.find((item) => item.status === 'published') ?? data?.[0];
    if (!value || validateNoPrivateFields(value.public_catalog).length) throw new Error('content_unavailable');
    return value;
  };
  const action = async (deviceId, name, payload = {}, projection = {}) => {
    const { data, error } = await database.rpc('learning_room_action', {
      p_device_id: deviceId, p_action: name, p_payload: payload, p_allow_draft: allowDraft,
    });
    if (error) throw error;
    return projectLearningResponse(data, projection);
  };
  return {
    async catalog() { return { content: (await content()).public_catalog }; },
    state: (deviceId) => action(deviceId, 'state'),
    async course(code) { const value = (await content()).public_catalog; const course = value.courses.find((c) => c.courseCode === code);
      if (!course) throw new Error('activity_not_found');
      return { contentVersion: value.contentVersion, course, activities: value.activities.filter((a) => course.activityCodes.includes(a.activityCode)) }; },
    async activity(code) { const value = (await content()).public_catalog;
      const activity = value.activities.find((a) => a.activityCode === code) ?? value.resources.find((r) => r.resourceCode === code);
      if (!activity) throw new Error('activity_not_found');
      return { contentVersion: value.contentVersion, activity, sources: value.sources.filter((s) => activity.sourceRefs.includes(s.sourceCode)) }; },
    complete: (deviceId, payload) => action(deviceId, 'complete', payload),
    async start(deviceId, payload) {
      const value = await content();
      const questionCodes = selectLearningQuestions(value, payload.stageCode, payload.mode, payload.activityCode ?? null);
      return action(deviceId, 'start', { ...payload, contentVersion: value.content_version, questionCodes });
    },
    read: (deviceId, attemptUid) => action(deviceId, 'read', { attemptUid }),
    answer: (deviceId, payload) => action(deviceId, 'answer', payload, { questionUid: payload.questionUid }),
    next: (deviceId, payload) => action(deviceId, 'next', payload),
    finish: (deviceId, payload) => action(deviceId, 'finish', payload),
    abandon: (deviceId, payload) => action(deviceId, 'abandon', payload),
    review: (deviceId, attemptUid, missedOnly) => action(deviceId, 'review', { attemptUid }, { review: true, missedOnly }),
  };
}
