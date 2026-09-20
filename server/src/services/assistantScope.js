const ALLOWED_SCOPE_PATTERN = /\b(fridge|freezer|pantry|inventory|stock|food|item|batch|quantity|storage|stored|use[- ]?by|best[- ]?before|expir(?:y|ed|ing)|fresh(?:ness)?|safe to eat|food safety|consume|consumption|restock(?:ing)?|shopping (?:list|cart)|cart)\b|冰箱|冷冻|冷藏|常温|库存|食材|食品|批次|数量|还剩|剩余|储存|存放|保质|有效期|临期|过期|新鲜|食用|食品安全|消费记录|补货|购物清单|购物车/iu;

// Arthur: NarIyirm
// 中文：这些模式只做高置信度的模型前拦截；未命中的表达仍必须经过结构化范围判定和服务端拒绝替换。
// EN: These patterns are only a high-confidence pre-model gate; unmatched wording still passes through structured scope classification and server-owned refusal replacement.
const DISALLOWED_REQUEST_PATTERNS = [
  { type: 'code_generation', pattern: /\b(?:write|generate|create|show|give|provide|debug|fix|run|execute)\b.{0,80}\b(?:code|program|script|python|javascript|typescript|java|sql|shell|bash|powershell|html|css)\b|(?:写|生成|创建|提供|运行|执行|调试|修改).{0,40}(?:代码|程序|脚本|Python|JavaScript|TypeScript|Java|SQL|Shell|网页)/iu },
  { type: 'creative_writing', pattern: /\b(?:write|draft|compose|generate|create)\b.{0,80}\b(?:poem|story|essay|article|email|letter|report|song|lyrics|speech)\b|(?:写|创作|生成|起草).{0,40}(?:诗|故事|小说|论文|文章|邮件|信件|报告|歌词|演讲)/iu },
  { type: 'translation', pattern: /\b(?:translate|translation)\b|翻译|译成|翻成/iu },
  { type: 'unrelated_calculation', pattern: /\b(?:solve|calculate|compute)\b.{0,80}\b(?:equation|integral|derivative|algebra|geometry|homework|math)\b|(?:解答|计算|求解).{0,40}(?:方程|积分|导数|代数|几何|数学|作业)/iu },
  { type: 'roleplay', pattern: /\b(?:pretend|role[- ]?play|act as|you are now|developer mode|jailbreak)\b|假装|角色扮演|扮演|你现在是|开发者模式|越狱模式/iu },
  { type: 'privileged_instruction', pattern: /\b(?:ignore|disregard|override|reveal|repeat|print|show)\b.{0,80}\b(?:previous|prior|system|developer|hidden|internal)\b.{0,40}\b(?:instruction|prompt|rule|message|policy)\b|忽略.{0,30}(?:之前|以上|系统|开发者).{0,30}(?:指令|提示词|规则)|(?:泄露|显示|输出|重复).{0,30}(?:系统提示词|内部指令|隐藏指令)/iu },
  { type: 'unrelated_advice', pattern: /\b(?:plan|recommend|advise|help me with)\b.{0,80}\b(?:trip|travel|investment|stock market|legal case|lawsuit|medical diagnosis|career|relationship)\b|(?:规划|推荐|建议|帮我).{0,40}(?:旅行|旅游|投资|股票|法律案件|诉讼|医疗诊断|职业|感情)/iu },
  { type: 'general_knowledge', pattern: /\b(?:capital of|president of|prime minister of|weather in|latest news|sports score)\b|(?:首都|总统|总理|天气|最新新闻|比赛比分).{0,40}(?:是什么|是谁|如何|多少)?/iu },
  { type: 'other', pattern: /\b(?:before|after|first|then|also|additionally)\b.{0,100}\b(?:do another task|answer another question|unrelated task)\b|(?:在此之前|然后|顺便|另外|回答完后).{0,50}(?:做另一件事|回答另一个问题|无关任务)/iu },
];
const CONTINUATION_PATTERN = /\b(?:continue|go on|carry on|finish it|do that|same request)\b|继续|接着|接下去|完成它|照做|同一个请求/iu;

export const ASSISTANT_SCOPE_DECISIONS = ['in_scope', 'mixed', 'out_of_scope'];
export const ASSISTANT_REJECTED_REQUEST_TYPES = [
  'code_generation',
  'creative_writing',
  'translation',
  'unrelated_calculation',
  'general_knowledge',
  'roleplay',
  'unrelated_advice',
  'privileged_instruction',
  'other',
];

export function hasExplicitAllowedScope(message) {
  return ALLOWED_SCOPE_PATTERN.test(message);
}

export function detectObviousScopeViolation(message) {
  const rejectedRequestTypes = [...new Set(DISALLOWED_REQUEST_PATTERNS
    .filter(({ pattern }) => pattern.test(message))
    .map(({ type }) => type))];
  if (rejectedRequestTypes.length === 0) return null;
  return {
    scopeDecision: hasExplicitAllowedScope(message) ? 'mixed' : 'out_of_scope',
    rejectedRequestTypes,
  };
}

export function detectContextualScopeViolation(message, conversationMessages = []) {
  const directViolation = detectObviousScopeViolation(message);
  if (directViolation) return directViolation;
  if (!CONTINUATION_PATTERN.test(message) || hasExplicitAllowedScope(message)) return null;
  // Arthur: NarIyirm
  // 中文：仅当当前消息是模糊续写且没有明确冰箱意图时继承上一条用户消息的越界状态，避免旧注入通过“继续”重新激活。
  // EN: Only an ambiguous continuation without an explicit fridge intent inherits the prior user violation, preventing an old injection from being reactivated with “continue.”
  const priorUserMessage = [...conversationMessages].reverse().find((entry) => entry.role === 'user');
  const priorViolation = priorUserMessage ? detectObviousScopeViolation(priorUserMessage.content) : null;
  return priorViolation
    ? { scopeDecision: 'out_of_scope', rejectedRequestTypes: priorViolation.rejectedRequestTypes }
    : null;
}

export function buildScopeRefusal(language, scopeDecision, rejectedRequestTypes) {
  const mixed = scopeDecision === 'mixed';
  const answer = language === 'zh'
    ? mixed
      ? '这条消息同时包含冰箱助手范围内和范围外的请求。为避免执行无关指令，我没有处理其中任何部分。请单独询问库存、日期、食品安全、补货或购物清单。'
      : '我只能协助处理库存、食材日期、食品安全、补货和购物清单相关问题。'
    : mixed
      ? 'This message combines fridge-assistant tasks with an out-of-scope request. To avoid following unrelated instructions, I did not process either part. Please ask the inventory, date, food-safety, restocking, or shopping-list question separately.'
      : 'I can only help with inventory, food dates, food safety, restocking, and shopping-list tasks.';
  return {
    answer,
    riskLevel: 'info',
    batchReferences: [],
    citations: [],
    suggestedActions: [],
    requiresConfirmation: false,
    actionProposal: null,
    scopeDecision,
    rejectedRequestTypes,
  };
}

export function enforceModelScopeDecision(value, language) {
  if (value.scopeDecision === 'in_scope') return value;
  // Arthur: NarIyirm
  // 中文：越界或混合请求永远丢弃模型自由文本，由服务端生成固定回复，避免诱导内容从 answer 字段穿透。
  // EN: Out-of-scope or mixed requests always discard model prose and use a server-owned response so injected content cannot escape through answer.
  return buildScopeRefusal(language, value.scopeDecision, value.rejectedRequestTypes);
}
