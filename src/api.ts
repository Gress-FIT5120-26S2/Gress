import { getDeviceId } from './services/deviceId';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export type InventoryStorageZone = 'chilled' | 'frozen' | 'pantry';
export type InventoryCategoryCode = 'meat' | 'vegetables' | 'fruit' | 'staples' | 'condiments' | 'drinks' | 'other';

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

export type InventorySnapshot = {
  batches: InventoryBatch[];
  categories: Array<{ code: string | null; colour: string | null; icon: string | null; id: string; name: string }>;
  fridge: { mode: 'personal' | 'shared'; name: string; uid: string };
};

export type CreateInventoryBatchInput = {
  categoryCode: InventoryCategoryCode;
  expiresAt: string | null;
  initialQuantity: number;
  name: string;
  purchasePrice: number | null;
  restockRule: { enabled: true; minimumQuantity: number; targetQuantity: number } | null;
  storageZone: InventoryStorageZone;
  unit: string;
};

export type FoodPresetSuggestion = {
  canonicalName: string;
  categoryCode: InventoryCategoryCode;
  shelfLifeDays: number;
  storageZone: InventoryStorageZone;
};

type ApiError = { message?: string };

async function requestApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Arthur: NarIyirm
  // 中文：每个库存请求都附带同一 Device-ID，并只请求 Express；App 不拥有 Supabase 地址或密钥。
  // EN: Every inventory request carries the same Device-ID and targets Express only; the app never owns Supabase credentials.
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured');

  const deviceId = await getDeviceId();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Device-ID': deviceId,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as T | ApiError | null;

  if (!response.ok) {
    throw new Error((body as ApiError | null)?.message ?? `API request failed: ${response.status}`);
  }
  return body as T;
}

export async function getApiHealth(): Promise<void> {
  const result = await requestApi<{ database?: string }>('/api/health');
  if (result.database !== 'connected') throw new Error('Supabase is not connected');
}

export function getInventorySnapshot(): Promise<InventorySnapshot> {
  return requestApi<InventorySnapshot>('/api/inventory');
}

export function getFoodPresetSuggestion(query: string): Promise<{ suggestion: FoodPresetSuggestion | null }> {
  return requestApi<{ suggestion: FoodPresetSuggestion | null }>(`/api/food-presets/suggestion?q=${encodeURIComponent(query)}`);
}

export async function createInventoryBatch(input: CreateInventoryBatchInput): Promise<{ batchUid: string | null }> {
  return requestApi<{ batchUid: string | null }>('/api/inventory/batches', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}
