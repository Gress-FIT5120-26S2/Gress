const EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const MAX_INVENTORY_ROWS = 80;
const MAX_HISTORY_ROWS = 40;

export const ASSISTANT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    name: 'get_inventory_snapshot',
    description: 'Read current active inventory with hard use-by and system quality dates. Never use this for recipes.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        itemName: { type: ['string', 'null'] },
        storageZone: { type: ['string', 'null'], enum: ['chilled', 'frozen', 'pantry', null] },
      },
      required: ['itemName', 'storageZone'],
    },
  },
  {
    type: 'function',
    name: 'get_consumption_history',
    description: 'Read bounded personal or shared consumption and restock aggregates. Use evidenceSufficient before predicting habits.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: { type: 'string', enum: ['personal', 'shared'] },
        itemName: { type: ['string', 'null'] },
        days: { type: 'integer', minimum: 14, maximum: 366 },
      },
      required: ['scope', 'itemName', 'days'],
    },
  },
  {
    type: 'function',
    name: 'get_restock_context',
    description: 'Read deterministic restock suggestions together with unchecked shopping-cart items to avoid duplicate advice.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { itemName: { type: ['string', 'null'] } },
      required: ['itemName'],
    },
  },
  {
    type: 'function',
    name: 'search_food_safety_knowledge',
    description: 'Search reviewed Australian food date, storage, and safety guidance. Set safetyOnly true when harm could result from a wrong answer.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 500 },
        language: { type: 'string', enum: ['zh', 'en'] },
        safetyOnly: { type: 'boolean' },
      },
      required: ['query', 'language', 'safetyOnly'],
    },
  },
];

function asIso(value) {
  return value ? new Date(value).toISOString() : null;
}

async function embedQuery(text) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('openai_not_configured');
  const response = await fetch(EMBEDDING_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      dimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      encoding_format: 'float',
      input: text,
    }),
  });
  if (!response.ok) throw new Error(`embedding_http_${response.status}`);
  const body = await response.json();
  return body.data?.[0]?.embedding;
}

async function getInventorySnapshot(args, context) {
  let query = context.supabase
    .from('inventory_batches')
    .select('batch_uid,name,storage_zone,remaining_quantity,unit,stocked_at,use_by_at,best_before_at,estimated_quality_until,quality_estimate_basis,owner_device_id,version')
    .eq('fridge_uid', context.fridgeUid)
    .eq('lifecycle_state', 'active')
    .limit(MAX_INVENTORY_ROWS);
  if (args.storageZone) query = query.eq('storage_zone', args.storageZone);
  if (args.itemName?.trim()) query = query.ilike('name', `%${args.itemName.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
  const { data, error } = await query;
  if (error) throw error;
  const now = Date.now();
  return (data ?? []).map((batch) => {
    const useByAt = asIso(batch.use_by_at);
    const bestBeforeAt = asIso(batch.best_before_at);
    const estimatedQualityUntil = asIso(batch.estimated_quality_until);
    const hardExpired = Boolean(useByAt && Date.parse(useByAt) < now);
    const qualityOverdue = Boolean(estimatedQualityUntil && Date.parse(estimatedQualityUntil) < now);
    return {
      batchUid: batch.batch_uid,
      name: batch.name,
      storageZone: batch.storage_zone,
      remainingQuantity: Number(batch.remaining_quantity),
      unit: batch.unit,
      stockedAt: asIso(batch.stocked_at),
      useByAt,
      bestBeforeAt,
      estimatedQualityUntil,
      qualityEstimateBasis: batch.quality_estimate_basis,
      hardExpired,
      qualityOverdue,
      // Arthur: NarIyirm
      // 中文：只有 use-by 是硬性食用阻断；best-before 与系统品质估计只提示检查，不能被助手当作安全期限。
      // EN: Only use-by blocks consumption; best-before and estimated quality prompt inspection and must not be treated as safety deadlines.
      consumptionEligible: !hardExpired,
      ownership: batch.owner_device_id === context.deviceId ? 'personal' : 'shared',
      version: batch.version,
    };
  });
}

async function getConsumptionHistory(args, context) {
  const to = new Date();
  const from = new Date(to.getTime() - args.days * 86_400_000);
  const { data, error } = await context.supabase.rpc('get_assistant_consumption_history', {
    p_device_id: context.deviceId,
    p_scope: args.scope,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_item_name: args.itemName?.trim() || null,
  });
  if (error) throw error;
  return (data ?? []).slice(0, MAX_HISTORY_ROWS).map((row) => ({
    scope: row.scope,
    itemName: row.item_name,
    unit: row.unit,
    stockedQuantity: Number(row.stocked_quantity),
    consumedQuantity: Number(row.consumed_quantity),
    discardedQuantity: Number(row.discarded_quantity),
    stockEventCount: Number(row.stock_event_count),
    consumeEventCount: Number(row.consume_event_count),
    discardEventCount: Number(row.discard_event_count),
    medianRestockIntervalDays: row.median_restock_interval_days === null ? null : Number(row.median_restock_interval_days),
    evidenceSufficient: row.evidence_sufficient,
  }));
}

async function getRestockContext(args, context) {
  const [suggestionsResult, cartResult] = await Promise.all([
    context.supabase.rpc('get_restock_suggestions', { p_fridge: context.fridgeUid }),
    context.supabase
      .from('shopping_cart_items')
      .select('item_uid,name,quantity,unit,source')
      .eq('fridge_uid', context.fridgeUid)
      .eq('is_checked', false)
      .limit(50),
  ]);
  if (suggestionsResult.error) throw suggestionsResult.error;
  if (cartResult.error) throw cartResult.error;
  const needle = args.itemName?.trim().toLocaleLowerCase() || null;
  const filter = (row) => !needle || row.name?.toLocaleLowerCase().includes(needle) || row.item_name?.toLocaleLowerCase().includes(needle);
  return {
    suggestions: (suggestionsResult.data ?? []).filter(filter).slice(0, 30),
    uncheckedCartItems: (cartResult.data ?? []).filter(filter).map((row) => ({
      itemUid: row.item_uid,
      name: row.name,
      quantity: row.quantity === null ? null : Number(row.quantity),
      unit: row.unit,
      source: row.source,
    })),
  };
}

async function searchFoodSafetyKnowledge(args, context) {
  const embedding = await embedQuery(args.query);
  if (!Array.isArray(embedding) || embedding.length !== 1536) throw new Error('embedding_dimension_mismatch');
  const { data, error } = await context.supabase.rpc('search_assistant_knowledge', {
    p_query_text: args.query,
    p_query_embedding: embedding,
    p_match_count: 6,
    p_language: args.language,
    p_jurisdiction: 'AU',
    p_safety_only: args.safetyOnly,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    chunkUid: row.chunk_uid,
    content: row.content,
    topic: row.topic,
    language: row.language,
    riskLevel: row.risk_level,
    sourceTitle: row.source_title,
    publisher: row.publisher,
    sourceUrl: row.source_url,
    trustLevel: row.trust_level,
  }));
}

const EXECUTORS = {
  get_inventory_snapshot: getInventorySnapshot,
  get_consumption_history: getConsumptionHistory,
  get_restock_context: getRestockContext,
  search_food_safety_knowledge: searchFoodSafetyKnowledge,
};

export async function executeAssistantTool(name, args, context) {
  const executor = EXECUTORS[name];
  if (!executor) throw new Error('assistant_tool_not_allowed');
  return executor(args, context);
}
