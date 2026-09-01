import { requestApi } from './apiClient';

export type InventoryStorageZone = 'chilled' | 'frozen' | 'pantry';
export type InventoryCategoryCode =
  | 'meat'
  | 'vegetables'
  | 'fruit'
  | 'staples'
  | 'condiments'
  | 'drinks'
  | 'other';

export type InventoryBatch = {
  categoryCode: InventoryCategoryCode;
  currency: string;
  expiresAt: string | null;
  id: string;
  iconEmoji?: string | null;
  iconUrl?: string | null;
  name: string;
  needsRestock: boolean;
  presetUid?: string | null;
  purchasePrice: number | null;
  remainingQuantity: number;
  stockedAt: string;
  storageZone: InventoryStorageZone;
  unit: string;
};

export type InventoryLifecycleState = 'active' | 'consumed' | 'discarded' | 'archived';

export type InventoryRestockRule = {
  enabled: boolean;
  minimumQuantity: number;
  targetQuantity: number;
};

export type InventoryBatchDetail = InventoryBatch & {
  categoryName: string;
  initialQuantity: number;
  lifecycleState: InventoryLifecycleState;
  openedAt: string | null;
  restockRule: InventoryRestockRule | null;
  version: number;
};

export type InventorySnapshot = {
  batches: InventoryBatch[];
  categories: Array<{
    code: string | null;
    colour: string | null;
    icon: string | null;
    id: string;
    name: string;
  }>;
  fridge: {
    mode: 'personal' | 'shared';
    name: string;
    uid: string;
  };
};

export type CreateInventoryBatchInput = {
  categoryCode: InventoryCategoryCode;
  expiresAt: string | null;
  initialQuantity: number;
  name: string;
  presetUid: string | null;
  purchasePrice: number | null;
  restockRule: {
    enabled: true;
    minimumQuantity: number;
    targetQuantity: number;
  } | null;
  storageZone: InventoryStorageZone;
  unit: string;
};

export type UpdateInventoryBatchInput = {
  categoryCode: InventoryCategoryCode;
  expectedVersion: number;
  expiresAt: string | null;
  name: string;
  purchasePrice: number | null;
  remainingQuantity: number;
  storageZone: InventoryStorageZone;
  unit: string;
};

export type FoodPresetSuggestion = {
  aliases: string[];
  canonicalName: string;
  categoryCode: InventoryCategoryCode;
  iconEmoji: string;
  iconUrl: string | null;
  notes: string | null;
  presetUid: string;
  shelfLifeDays: number;
  source: 'curated' | 'seed' | 'ai' | 'open_data';
  storageZone: InventoryStorageZone;
};

// Arthur: NarIyirm
// 中文：冰箱页从这里读取完整库存快照；请求进入 Express 的 GET /api/inventory，再由 inventory.js 聚合批次、分类和补货状态。
// EN: The fridge screen reads its full snapshot here; GET /api/inventory lets inventory.js aggregate batches, categories, and restock state.
export function getInventorySnapshot(): Promise<InventorySnapshot> {
  return requestApi<InventorySnapshot>('/api/inventory');
}

// Arthur: NarIyirm
// 中文：详情弹窗按 batchUid 延迟读取版本和补货规则；对应后端 inventory.js 的单批次详情路由。
// EN: The detail sheet lazily loads version and restock data by batchUid; the matching handler is the single-batch route in inventory.js.
export function getInventoryBatchDetail(batchUid: string): Promise<{ batch: InventoryBatchDetail }> {
  return requestApi<{ batch: InventoryBatchDetail }>(`/api/inventory/batches/${encodeURIComponent(batchUid)}`);
}

// Arthur: NarIyirm
// 中文：录入表单用食材名称查询全局参考值；Express 匹配 food_presets 的标准名或别名，但不会自动写库存。
// EN: The entry form looks up global guidance by food name; Express matches food_presets names or aliases without writing inventory.
export function getFoodPresetSuggestion(query: string): Promise<{ suggestion: FoodPresetSuggestion | null }> {
  return requestApi<{ suggestion: FoodPresetSuggestion | null }>(
    `/api/food-presets/suggestion?q=${encodeURIComponent(query)}`,
  );
}

// Arthur: NarIyirm
// 中文：只有预设查询未命中且用户明确点击后才调用生成接口；服务端负责 Gemini、Cloudflare、去背景和全局 preset 缓存。
// EN: Call generation only after a preset miss and an explicit user action; the server owns Gemini, Cloudflare, background removal, and global preset caching.
export function generateFoodPreset(query: string): Promise<{ generated: boolean; suggestion: FoodPresetSuggestion }> {
  return requestApi<{ generated: boolean; suggestion: FoodPresetSuggestion }>('/api/food-presets/generate', {
    body: JSON.stringify({ name: query }),
    method: 'POST',
  });
}

// Arthur: NarIyirm
// 中文：手动和识别录入最终都走这个入口；后端 create_inventory_batch RPC 原子写入批次、stock 流水和可选补货规则。
// EN: Manual and recognition entries converge here; the create_inventory_batch RPC atomically writes the batch, stock event, and optional restock rule.
export function createInventoryBatch(input: CreateInventoryBatchInput): Promise<{ batchUid: string | null }> {
  return requestApi<{ batchUid: string | null }>('/api/inventory/batches', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

// Arthur: NarIyirm
// 中文：详情弹窗关闭时一次性提交数量草稿和 expectedVersion；后端用乐观锁避免覆盖共享成员的新修改。
// EN: The detail sheet commits its quantity draft and expectedVersion once on close; backend optimistic locking prevents overwriting a member's newer change.
export function updateInventoryBatchQuantity(
  batchUid: string,
  remainingQuantity: number,
  expectedVersion: number,
): Promise<{ batch: Pick<InventoryBatchDetail, 'id' | 'lifecycleState' | 'remainingQuantity' | 'version'> }> {
  return requestApi<{ batch: Pick<InventoryBatchDetail, 'id' | 'lifecycleState' | 'remainingQuantity' | 'version'> }>(`/api/inventory/batches/${encodeURIComponent(batchUid)}/quantity`, {
    body: JSON.stringify({ expectedVersion, remainingQuantity }),
    method: 'PATCH',
  });
}

// Arthur: NarIyirm
// 中文：编辑表单提交批次完整资料和版本号；Express 转给 update_inventory_batch_details RPC 并返回最新详情。
// EN: The edit form submits full batch details with a version; Express forwards them to update_inventory_batch_details and returns the refreshed detail.
export function updateInventoryBatch(
  batchUid: string,
  input: UpdateInventoryBatchInput,
): Promise<{ batch: InventoryBatchDetail }> {
  return requestApi<{ batch: InventoryBatchDetail }>(`/api/inventory/batches/${encodeURIComponent(batchUid)}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
}

// Arthur: NarIyirm
// 中文：补货规则按当前冰箱、规范化名称和单位生效；传 null 会让后端关闭规则而不是删除库存批次。
// EN: Restock rules apply by fridge, normalized name, and unit; passing null disables the rule without removing the inventory batch.
export function setInventoryRestockRule(
  batchUid: string,
  rule: InventoryRestockRule | null,
): Promise<{ restockRule: InventoryRestockRule | null }> {
  return requestApi<{ restockRule: InventoryRestockRule | null }>(`/api/inventory/batches/${encodeURIComponent(batchUid)}/restock-rule`, {
    body: JSON.stringify(rule ?? { enabled: false }),
    method: 'PUT',
  });
}

// Arthur: NarIyirm
// 中文：前端的“移出冰箱”调用此入口；后端执行软归档并保留 inventory_events 历史，不物理删除记录。
// EN: The remove action enters here; the backend soft-archives the batch and preserves inventory_events instead of physically deleting it.
export function archiveInventoryBatch(batchUid: string, expectedVersion: number): Promise<void> {
  return requestApi<void>(`/api/inventory/batches/${encodeURIComponent(batchUid)}`, {
    body: JSON.stringify({ expectedVersion }),
    method: 'DELETE',
  });
}
