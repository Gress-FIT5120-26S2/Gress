import type { InventoryCategoryCode, InventoryStorageZone, InventoryUnit } from '../components/inventory-entry/InventoryEntryFlow';
import { requestApi } from './apiClient';

export type BarcodeProduct = {
  barcode: string;
  brand: string | null;
  categoryCode: InventoryCategoryCode;
  conservationConditions: string | null;
  imageUrl: string | null;
  name: string;
  packageLabel: string | null;
  packageQuantity: number | null;
  packageUnit: Extract<InventoryUnit, 'g' | 'kg' | 'ml' | 'L'> | null;
  source: 'open_food_facts';
  storageZone: InventoryStorageZone;
};

export type BarcodeLookupResult = {
  barcode?: string;
  found: boolean;
  product: BarcodeProduct | null;
};

// Arthur: NarIyirm
// 中文：扫描页只消费 KitchMemo 的稳定商品结构，Open Food Facts 的版本和字段差异由 Express 隔离。
// EN: The scanner consumes only KitchMemo's stable product shape while Express isolates Open Food Facts version and field differences.
export function lookupBarcodeProduct(barcode: string): Promise<BarcodeLookupResult> {
  return requestApi<BarcodeLookupResult>(`/api/barcode-products/${encodeURIComponent(barcode)}`);
}
