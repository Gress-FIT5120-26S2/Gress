import { randomInt } from 'node:crypto';

export const LEARNING_STAGES = ['beginner', 'intermediate', 'advanced'];
export const LEARNING_MODES = ['checkpoint', 'review', 'practice', 'mixed-review'];

export function shuffled(items, pick = randomInt) {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = pick(index + 1);
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
}

// Arthur: NarIyirm
// 中文：服务端按固定 topic 配额抽样；数据库再次校验选题并从原题库生成冻结快照。
// EN: Sample fixed topic quotas on the server; the database revalidates the selection and builds frozen snapshots from its original bank.
export function selectLearningQuestions(content, stageCode, mode, activityCode = null, pick = randomInt) {
  if (!LEARNING_STAGES.includes(stageCode) || !LEARNING_MODES.includes(mode)) throw new Error('invalid_input');
  const bank = content.private_question_bank;
  const active = bank.questions.filter((question) => question.status === 'active');
  let selected;
  if (mode === 'practice') {
    const practice = bank.practice.find((item) => item.activityCode === activityCode);
    const activity = content.public_catalog.activities.find((item) => item.activityCode === activityCode);
    if (!practice || activity?.stageCode !== stageCode || activity.type !== 'practice') throw new Error('invalid_input');
    selected = practice.questionCodes.map((code) => active.find((item) => item.questionCode === code));
    if (selected.some((item) => !item) || selected.length !== 3) throw new Error('content_unavailable');
  } else if (activityCode !== null) throw new Error('invalid_input');
  else if (mode === 'mixed-review') {
    if (stageCode !== 'advanced') throw new Error('invalid_input');
    selected = LEARNING_STAGES.flatMap((stage) => shuffled(active.filter((q) => q.stageCode === stage), pick).slice(0, 4));
    if (selected.length !== 12) throw new Error('content_unavailable');
  } else {
    const stage = content.public_catalog.stages.find((item) => item.stageCode === stageCode);
    if (!stage) throw new Error('content_unavailable');
    selected = stage.blueprint.flatMap((topic) => {
      const candidates = active.filter((q) => q.stageCode === stageCode && q.topicCode === topic.topicCode);
      if (candidates.length < topic.count) throw new Error('content_unavailable');
      return shuffled(candidates, pick).slice(0, topic.count);
    });
    if (selected.length !== stage.questionCount) throw new Error('content_unavailable');
  }
  return shuffled(selected, pick).map((question) => question.questionCode);
}

// Arthur: NarIyirm
// 中文：只投影当前题与已提交反馈；从不展开数据库整行，未答题不会返回答案、解释或其它题目。
// EN: Project only the current question and submitted feedback; never spread database rows or reveal answers, explanations or other unanswered questions.
export function projectLearningQuiz(attempt, questionUid = null) {
  const index = questionUid === null ? attempt.cursor_position - 1 : attempt.question_snapshot.findIndex((q) => q.questionUid === questionUid);
  const question = attempt.question_snapshot[index];
  if (!question) throw new Error('attempt_not_found');
  const answer = attempt.answers.find((item) => item.question_instance_uid === question.questionUid);
  return {
    attemptUid: attempt.attempt_uid, stageCode: attempt.stage_code, mode: attempt.mode,
    questionNumber: index + 1, questionCount: attempt.question_count,
    question: { questionUid: question.questionUid, prompt: question.prompt,
      options: question.options.map(({ optionId, label }) => ({ optionId, label })), imageAssetKey: question.imageAssetKey,
      serviceAssumptions: question.serviceAssumptions, regionCode: question.regionCode },
    feedback: answer ? { selectedOptionId: answer.selected_option_id, correctOptionId: question.correctOptionId,
      isCorrect: answer.is_correct, explanation: question.explanation, sourceRefs: question.sourceRefs } : null,
  };
}

export function projectLearningResult(attempt, session) {
  if (attempt.status !== 'submitted') throw new Error('attempt_not_active');
  const next = attempt.stage_code === 'beginner' ? 'intermediate' : attempt.stage_code === 'intermediate' ? 'advanced' : null;
  return { attemptUid: attempt.attempt_uid, stageCode: attempt.stage_code, mode: attempt.mode,
    correctCount: attempt.correct_count, totalCount: attempt.question_count,
    scorePercent: Math.round(attempt.correct_count / attempt.question_count * 100), passed: attempt.passed,
    missedCount: attempt.question_count - attempt.correct_count,
    nextStageCode: attempt.mode === 'checkpoint' && attempt.passed ? next : null, session };
}

export function projectLearningResponse(raw, { questionUid = null, review = false, missedOnly = false } = {}) {
  const result = { contentVersion: raw.contentVersion, stateVersion: raw.stateVersion,
    session: raw.session, activeAttemptUid: raw.activeAttemptUid, recentResults: raw.recentResults };
  if (!raw.attempt) return result;
  const attempt = raw.attempt;
  result.status = attempt.status;
  result.attemptContentVersion = attempt.content_version;
  if (review) {
    result.questions = attempt.question_snapshot.filter((q) => attempt.answers.some((a) => a.question_instance_uid === q.questionUid && (!missedOnly || !a.is_correct)))
      .map((q) => projectLearningQuiz(attempt, q.questionUid));
  } else if (attempt.status === 'submitted' && questionUid === null) result.result = projectLearningResult(attempt, raw.session);
  else if (attempt.status === 'in_progress' || questionUid !== null) result.quiz = projectLearningQuiz(attempt, questionUid);
  const answered = new Set(attempt.answers.map((a) => a.question_instance_uid));
  result.sources = [...new Map(attempt.question_snapshot.filter((q) => answered.has(q.questionUid))
    .flatMap((q) => q.sourceSnapshots ?? []).map((source) => [source.sourceCode, source])).values()];
  return result;
}

export function allowDraftLearning(environment) {
  try {
    return environment.NODE_ENV !== 'production' && environment.LEARNING_ROOM_ALLOW_DRAFT === '1'
      && environment.LEARNING_ROOM_DRAFT_PROJECT_REF === 'thmbtsssvnslotoexntz'
      && new URL(environment.SUPABASE_URL).hostname === 'thmbtsssvnslotoexntz.supabase.co';
  } catch { return false; }
}

const errors = {
  invalid_input: 400, invalid_question_selection: 400, learning_question_not_current: 409,
  learning_stage_locked: 403, learning_practice_requires_attempt: 409, learning_content_changed: 409,
  attempt_not_found: 404, activity_not_found: 404, attempt_not_active: 409, answer_already_submitted: 409,
  attempt_incomplete: 409, learning_answer_required: 409, idempotency_key_conflict: 409,
  attempt_invalidated: 410, content_unavailable: 503, learning_unavailable: 503, invalid_device_credential: 401,
};
export function learningError(error) {
  const code = Object.keys(errors).find((item) => error?.message === item) ?? (error?.code === '22P02' ? 'invalid_input' : 'learning_unavailable');
  return { code, status: errors[code] };
}
