import type { LearningSource, PublicLearningContent } from '../types/learningContent';
import type { LearningAttemptView, LearningOutcome, LearningRoomGateway, LearningStateView } from '../types/learningRoom';

export type LearningRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
export class LearningActionError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'LearningActionError'; }
}
export const getLearningErrorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error ? String(error.code) : null;
const terminal = new Set(['invalid_input', 'learning_stage_locked', 'attempt_not_found', 'attempt_not_active', 'attempt_invalidated', 'answer_already_submitted', 'learning_question_not_current', 'idempotency_key_conflict', 'learning_content_changed']);

// Arthur: NarIyirm
// 中文：此适配器只映射服务器结果；失败请求保留原键及首个 payload，关闭学习室后不持久化身份、题目或答案。
// EN: Map server outcomes only; failed requests retain their original key and first payload, with no persistent identity, questions or answers after closing.
export function createLearningGateway(send: LearningRequest, uuid: () => string, identity: () => Promise<string> = async () => 'injected-test-identity'): LearningRoomGateway {
  let content: PublicLearningContent | null = null;
  let state: LearningStateView | null = null;
  let owner: string | null = null;
  let generation = 0;
  const pending = new Map<string, { payload: Record<string, unknown>; promise?: Promise<LearningAttemptView | LearningStateView> }>();
  const sources = new Map<string, LearningSource[]>();
  const cursors = new Map<string, { questionUid: string; version: bigint }>();
  const reset = () => { generation += 1; content = null; state = null; pending.clear(); sources.clear(); cursors.clear(); };
  const request: LearningRequest = async (path, init) => {
    try { return await send(path, init); }
    catch (error) {
      // Arthur: NarIyirm
      // 中文：设备凭证被拒绝时立即丢弃本人缓存与未确认请求，防止恢复身份后显示旧设备记录。
      // EN: Rejected device credentials discard personal cache and pending requests before recovered identity can display old device records.
      if (['invalid_device_credential', 'invalid_device'].includes(getLearningErrorCode(error) ?? '')) {
        reset(); owner = null; throw new LearningActionError('learning_identity_changed');
      }
      throw error;
    }
  };
  const context = async () => {
    const current = await identity();
    if (owner !== current) { reset(); owner = current; }
    return generation;
  };
  const verifyOwner = async (expected: number) => {
    await context();
    if (expected !== generation) throw new LearningActionError('learning_identity_changed');
  };
  const adopt = (value: LearningStateView, expected: number) => {
    if (expected !== generation) throw new LearningActionError('learning_identity_changed');
    if (!state || BigInt(value.stateVersion) >= BigInt(state.stateVersion)) state = value;
    if ('sources' in value) {
      const attempt = value as LearningAttemptView;
      const uid = attempt.quiz?.attemptUid ?? attempt.result?.attemptUid ?? attempt.questions?.[0]?.attemptUid;
      if (uid) sources.set(uid, attempt.sources);
      if (attempt.quiz && (!cursors.has(attempt.quiz.attemptUid) || BigInt(value.stateVersion) >= cursors.get(attempt.quiz.attemptUid)!.version)) {
        cursors.set(attempt.quiz.attemptUid, { questionUid: attempt.quiz.question.questionUid, version: BigInt(value.stateVersion) });
      }
    }
    return value;
  };
  const read = async (uid: string) => {
    const expected = await context();
    const value = await request<LearningAttemptView>(`/api/learning/attempts/${uid}`);
    await verifyOwner(expected);
    adopt(value, expected); sources.set(uid, value.sources);
    // Arthur: NarIyirm
    // 中文：恢复到活动测验即确认创建已成功，清除丢失创建响应的键，避免完成后再次开始却重放旧成绩。
    // EN: Restoring the active attempt confirms creation and clears lost-create keys so a later new start cannot replay an old result.
    if (value.quiz && value.activeAttemptUid === uid) {
      const quiz = value.quiz;
      for (const key of pending.keys()) if (key.startsWith(`start:${quiz.stageCode}:${quiz.mode}:`)) pending.delete(key);
    }
    return value;
  };
  const outcome = (value: LearningAttemptView): LearningOutcome => {
    if (value.result) return value.result;
    if (value.quiz) return value.quiz;
    throw new LearningActionError(value.status === 'invalidated' ? 'attempt_invalidated' : 'attempt_not_active');
  };
  const write = async (operation: string, path: string, body: Record<string, unknown>, method = 'POST') => {
    const expected = await context();
    let entry = pending.get(operation);
    if (!entry) { entry = { payload: { ...body, [path === '/api/learning/attempts' ? 'createKey' : 'requestKey']: uuid() } }; pending.set(operation, entry); }
    if (entry.promise) return entry.promise;
    const saved = entry;
    const promise = request<LearningAttemptView>(path, { method, body: JSON.stringify(saved.payload) })
      .then(async (value) => { await verifyOwner(expected); adopt(value, expected); pending.delete(operation); return value; })
      .catch((error: unknown) => { if (generation === expected && terminal.has(getLearningErrorCode(error) ?? '')) pending.delete(operation); throw error; })
      .finally(() => { if (pending.get(operation) === saved) saved.promise = undefined; });
    saved.promise = promise;
    return promise;
  };
  const completion = async (code: string) => {
    await context();
    if (!content) throw new LearningActionError('content_unavailable');
    const value = await write(`complete:${code}`, `/api/learning/activities/${code}/completion`, { contentVersion: content.contentVersion }, 'PUT');
    return value.session;
  };
  return {
    async load() {
      const expected = await context();
      const [catalog, personal] = await Promise.all([request<{ content: PublicLearningContent }>('/api/learning/catalog'), request<LearningStateView>('/api/learning/state')]);
      let current = catalog.content;
      if (current.contentVersion !== personal.contentVersion) current = (await request<{ content: PublicLearningContent }>('/api/learning/catalog')).content;
      if (current.contentVersion !== personal.contentVersion) throw new LearningActionError('learning_content_changed');
      await verifyOwner(expected);
      adopt(personal, expected);
      if (state!.contentVersion !== current.contentVersion) throw new LearningActionError('learning_content_changed');
      content = current;
      return { content, session: state!.session, recentResults: state!.recentResults };
    },
    async startQuiz(stageCode, mode, activityCode) {
      const value = await write(`start:${stageCode}:${mode}:${activityCode ?? ''}`, '/api/learning/attempts', { stageCode, mode, ...(activityCode ? { activityCode } : {}) });
      return outcome(value as LearningAttemptView);
    },
    async resumeQuiz(uid) { return outcome(await read(uid)); },
    async submitAnswer(uid, questionUid, optionId) {
      try {
        const value = await write(`answer:${uid}:${questionUid}`, `/api/learning/attempts/${uid}/answers`, { questionUid, optionId });
        if (!(value as LearningAttemptView).quiz) throw new LearningActionError('attempt_not_active');
        return (value as LearningAttemptView).quiz!;
      } catch (error) {
        if (!['answer_already_submitted', 'learning_question_not_current'].includes(getLearningErrorCode(error) ?? '')) throw error;
        const restored = await read(uid);
        if (restored.quiz) return restored.quiz;
        if (restored.result) throw new LearningActionError('attempt_not_active');
        throw error;
      }
    },
    async nextQuestion(uid) {
      await context();
      // Arthur: NarIyirm
      // 中文：下一题的幂等键绑定已知题目，丢响应后恢复到新题不会继续复用旧题的推进键。
      // EN: Bind next idempotency to the known question so restoring after a lost response cannot reuse the previous cursor's key.
      return outcome(await write(`next:${uid}:${cursors.get(uid)?.questionUid ?? 'unknown'}`, `/api/learning/attempts/${uid}/next`, {}) as LearningAttemptView);
    },
    async finishQuiz(uid) {
      const value = await write(`finish:${uid}`, `/api/learning/attempts/${uid}/finish`, {}) as LearningAttemptView;
      if (!value.result) throw new LearningActionError('attempt_incomplete');
      return value.result;
    },
    async reviewMissed(uid) {
      const expected = await context();
      const value = await request<LearningAttemptView>(`/api/learning/attempts/${uid}/review?missedOnly=true`);
      await verifyOwner(expected);
      adopt(value, expected); sources.set(uid, value.sources); return value.questions ?? [];
    },
    markActivity: completion, markResource: completion,
    async abandonQuiz(uid) { return (await write(`abandon:${uid}`, `/api/learning/attempts/${uid}/abandon`, {})).session; },
    getState: () => state, getSources: (uid) => sources.get(uid) ?? [],
    getPendingAnswer: (uid, questionUid) => {
      const value = pending.get(`answer:${uid}:${questionUid}`)?.payload.optionId;
      return typeof value === 'string' ? value : null;
    },
    dispose() { reset(); owner = null; },
  };
}
