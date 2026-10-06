// Arthur: NarIyirm
// 中文：运行时公开字段校验独立于读取前端素材的内容工具，避免 Vercel 将 Expo 文件打包进 API。
// EN: Keep runtime public-field validation separate from frontend asset tooling so Vercel does not bundle Expo files into the API.
const forbiddenPublicKeys = new Set(['correctOptionId', 'isCorrect', 'questionSnapshot', 'privateQuestionBank', 'questionBank', 'questionCodes',
  'correct_option_id', 'is_correct', 'question_snapshot', 'private_question_bank', 'question_bank', 'question_codes', 'explanation']);

export function validateNoPrivateFields(value, errors = [], location = 'public') {
  if (!value || typeof value !== 'object') return errors;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenPublicKeys.has(key)) errors.push(`${location}.${key}: private assessment field`);
    validateNoPrivateFields(child, errors, `${location}.${key}`);
  }
  return errors;
}
