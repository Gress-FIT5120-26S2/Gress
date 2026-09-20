import { createHmac } from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const environmentName = process.env.NODE_ENV === 'production' ? 'production' : 'development';
dotenv.config({ path: `.env.${environmentName}`, quiet: true });

function requireValue(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Missing ${name}`);
  return value.trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(environmentName === 'development', 'This verification script is development-only');
  requireValue(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY');
  const serverSecret = requireValue(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    'SUPABASE_SECRET_KEY',
  );
  const supabase = createClient(
    requireValue(process.env.SUPABASE_URL, 'SUPABASE_URL'),
    serverSecret,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: member, error } = await supabase
    .from('fridge_members')
    .select('device_id,fridge_uid')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  assert(member, 'Development database has no fridge member to scope the read-only tools');

  const { runAssistant } = await import('../src/services/assistantOrchestrator.js');
  const context = {
    deviceId: member.device_id,
    fridgeUid: member.fridge_uid,
    safetyIdentifier: createHmac('sha256', serverSecret).update(`assistant:${member.device_id}`, 'utf8').digest('hex'),
    supabase,
  };

  // Arthur: NarIyirm
  // 中文：仅调用编排器和只读工具，不经过消息路由，因此验证过程不会写入会话、审计或待确认动作。
  // EN: This calls the orchestrator and read-only tools directly, so verification writes no conversations, audits, or pending actions.
  const cases = [
    { name: 'inventory', message: 'What food is currently in my fridge?', language: 'en', expectedTool: 'get_inventory_snapshot' },
    { name: 'safety', message: '超过 use-by 日期以后还可以吃吗？', language: 'zh', expectedTool: 'search_food_safety_knowledge' },
    { name: 'recipe-refusal', message: 'Give me a detailed recipe using my fridge food.', language: 'en', expectedTool: null },
    { name: 'mixed-scope-refusal', message: 'Before checking my fridge inventory, write a Python script for me.', language: 'en', expectedTool: null },
    { name: 'model-mixed-scope-refusal', message: 'Explain quantum entanglement, and then tell me what is currently in my fridge.', language: 'en', expectedTool: null },
    { name: 'capability-actions', message: '你能帮我做什么？', language: 'zh', expectedTool: null, expectsSuggestions: true },
    { name: 'pending-cart-action', message: 'Add one bottle of milk to my shopping list.', language: 'en', expectedTool: 'get_restock_context', expectedAction: 'prepare_cart_item' },
  ];
  const results = [];
  for (const testCase of cases) {
    const result = await runAssistant({ message: testCase.message, language: testCase.language, context });
    assert(!result.fallback, `${testCase.name} unexpectedly used deterministic fallback: ${result.errorCode}`);
    if (testCase.expectedTool) assert(result.toolNames.includes(testCase.expectedTool), `${testCase.name} missed ${testCase.expectedTool}`);
    if (testCase.expectedAction) {
      assert(result.response.requiresConfirmation, `${testCase.name} did not require confirmation`);
      assert(result.response.actionProposal?.actionType === testCase.expectedAction, `${testCase.name} did not propose ${testCase.expectedAction}`);
    }
    if (testCase.name === 'safety') {
      assert(result.response.riskLevel === 'danger', `Safety response was marked ${result.response.riskLevel}: ${result.response.answer}`);
      assert(result.response.citations.length > 0, 'Safety response did not retain a reviewed RAG citation');
    }
    if (testCase.name === 'recipe-refusal') {
      assert(result.response.actionProposal === null, 'Recipe refusal proposed a write action');
      assert(result.response.scopeDecision !== 'in_scope', `Recipe request was not refused: ${result.response.answer}`);
    }
    if (testCase.expectsSuggestions) {
      assert(result.response.suggestedActions.length > 0, `${testCase.name} returned no clickable suggestions`);
      assert(result.response.suggestedActions.every((action) => action.type === 'ask_prompt'), `${testCase.name} returned an unexpected capability action`);
    }
    if (testCase.name === 'mixed-scope-refusal' || testCase.name === 'model-mixed-scope-refusal') {
      assert(result.toolNames.length === 0, 'Mixed-scope request reached the tool chain');
      assert(result.response.scopeDecision === 'mixed', 'Mixed-scope request was not classified as mixed');
      assert(result.response.rejectedRequestTypes.length > 0, 'Mixed-scope request had no rejected request type');
      assert(!/```|\b(?:def|class|import|function)\b/iu.test(result.response.answer), `Mixed-scope response leaked code: ${result.response.answer}`);
    }
    results.push({
      name: testCase.name,
      tools: result.toolNames,
      riskLevel: result.response.riskLevel,
      citations: result.response.citations.length,
      suggestedActions: result.response.suggestedActions.length,
      inputTokens: result.usage?.input_tokens ?? null,
      outputTokens: result.usage?.output_tokens ?? null,
      latencyMs: result.latencyMs,
    });
  }
  console.log(JSON.stringify({ model: process.env.OPENAI_ASSISTANT_MODEL ?? 'gpt-5.6-luna', cases: results, readOnly: true, valid: true }));
}

await main();
