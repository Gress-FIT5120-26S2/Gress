import express from 'express';
import { requireFridge } from '../middleware/requireFridge.js';
import { learningError, LEARNING_MODES, LEARNING_STAGES } from '../services/learningAssessment.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const code = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const requestKey = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value);
const exact = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => fields.includes(key));
const inputError = () => { throw new Error('invalid_input'); };

export function createLearningRouter(service) {
  const router = express.Router();
  router.use('/learning', requireFridge);
  const handle = (operation) => async (request, response) => {
    try { return response.json(await operation(request)); }
    catch (error) { const failure = learningError(error); return response.status(failure.status).json({ error: failure.code }); }
  };
  const attempt = (request) => { if (!uuid.test(request.params.attemptUid ?? '')) inputError(); return request.params.attemptUid; };
  const mutation = (request, extra = []) => {
    if (!exact(request.body, ['requestKey', ...extra]) || !requestKey(request.body.requestKey)) inputError();
    return { attemptUid: attempt(request), requestKey: request.body.requestKey };
  };
  router.get('/learning/catalog', handle(() => service.catalog()));
  router.get('/learning/state', handle((request) => service.state(request.deviceId)));
  router.get('/learning/courses/:courseCode', handle((request) => {
    if (!code.test(request.params.courseCode)) inputError(); return service.course(request.params.courseCode);
  }));
  router.get('/learning/activities/:activityCode', handle((request) => {
    if (!code.test(request.params.activityCode)) inputError(); return service.activity(request.params.activityCode);
  }));
  router.put('/learning/activities/:activityCode/completion', handle((request) => {
    if (!code.test(request.params.activityCode) || !exact(request.body, ['contentVersion', 'requestKey'])
      || typeof request.body.contentVersion !== 'string' || !requestKey(request.body.requestKey)) inputError();
    return service.complete(request.deviceId, { activityCode: request.params.activityCode, contentVersion: request.body.contentVersion });
  }));
  // Arthur: NarIyirm
  // 中文：归属只取中间件的设备上下文；拒绝 score／passed／learner 等多余字段，避免把用户提交值当权威结算。
  // EN: Ownership comes only from authenticated middleware; reject extra score/passed/learner fields so submitted values cannot become authoritative results.
  router.post('/learning/attempts', handle((request) => {
    const body = request.body;
    if (!exact(body, ['stageCode', 'mode', 'activityCode', 'createKey']) || !LEARNING_STAGES.includes(body.stageCode)
      || !LEARNING_MODES.includes(body.mode) || !requestKey(body.createKey)
      || (body.mode === 'practice' ? typeof body.activityCode !== 'string' || !code.test(body.activityCode) : body.activityCode != null)) inputError();
    return service.start(request.deviceId, { stageCode: body.stageCode, mode: body.mode, createKey: body.createKey, activityCode: body.activityCode ?? null });
  }));
  router.get('/learning/attempts/:attemptUid', handle((request) => service.read(request.deviceId, attempt(request))));
  router.post('/learning/attempts/:attemptUid/answers', handle((request) => {
    const payload = mutation(request, ['questionUid', 'optionId']);
    if (!uuid.test(request.body.questionUid ?? '') || typeof request.body.optionId !== 'string' || !code.test(request.body.optionId)) inputError();
    return service.answer(request.deviceId, { ...payload, questionUid: request.body.questionUid, optionId: request.body.optionId });
  }));
  for (const name of ['next', 'finish', 'abandon']) router.post(`/learning/attempts/:attemptUid/${name}`, handle((request) => service[name](request.deviceId, mutation(request))));
  router.get('/learning/attempts/:attemptUid/review', handle((request) => {
    if (request.query.missedOnly !== undefined && !['true', 'false'].includes(request.query.missedOnly)) inputError();
    return service.review(request.deviceId, attempt(request), request.query.missedOnly === 'true');
  }));
  return router;
}
