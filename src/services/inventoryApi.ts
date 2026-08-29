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
  name: string;
  needsRestock: boolean;
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
  canonicalName: string;
  categoryCode: InventoryCategoryCode;
  shelfLifeDays: number;
  storageZone: InventoryStorageZone;
};

export function getInventorySnapshot(): Promise<InventorySnapshot> {
  return requestApi<InventorySnapshot>('/api/inventory');
}

export function getInventoryBatchDetail(batchUid: string): Promise<{ batch: InventoryBatchDetail }> {
  return requestApi<{ batch: InventoryBatchDetail }>(`/api/inventory/batches/${encodeURIComponent(batchUid)}`);
}

export function getFoodPresetSuggestion(query: string): Promise<{ suggestion: FoodPresetSuggestion | null }> {
  return requestApi<{ suggestion: FoodPresetSuggestion | null }>(
    `/api/food-presets/suggestion?q=${encodeURIComponent(query)}`,
  );
}

export function createInventoryBatch(input: CreateInventoryBatchInput): Promise<{ batchUid: string | null }> {
  return requestApi<{ batchUid: string | null }>('/api/inventory/batches', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

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

export function updateInventoryBatch(
  batchUid: string,
  input: UpdateInventoryBatchInput,
): Promise<{ batch: InventoryBatchDetail }> {
  return requestApi<{ batch: InventoryBatchDetail }>(`/api/inventory/batches/${encodeURIComponent(batchUid)}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
}

export function setInventoryRestockRule(
  batchUid: string,
  rule: InventoryRestockRule | null,
): Promise<{ restockRule: InventoryRestockRule | null }> {
  return requestApi<{ restockRule: InventoryRestockRule | null }>(`/api/inventory/batches/${encodeURIComponent(batchUid)}/restock-rule`, {
    body: JSON.stringify(rule ?? { enabled: false }),
    method: 'PUT',
  });
}

export function archiveInventoryBatch(batchUid: string, expectedVersion: number): Promise<void> {
  return requestApi<void>(`/api/inventory/batches/${encodeURIComponent(batchUid)}`, {
    body: JSON.stringify({ expectedVersion }),
    method: 'DELETE',
  });
}
