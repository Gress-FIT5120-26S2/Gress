import type { InventoryBatchDetail, InventorySnapshot } from '../services/inventoryApi';

export function quickUseStep(unit: string) {
  if (unit === 'ml' || unit === 'g') return 50;
  return unit === 'kg' || unit === 'L' ? 0.1 : 1;
}

// Arthur: NarIyirm
// 中文：保留输入中的空白和小数编辑状态供界面显示；只有有效的正数且精度不超过库存契约才能提交。
// EN: Keep incomplete input in the UI; only positive numbers within inventory precision can be submitted.
export function parseQuickUseQuantity(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

export function roundInventoryQuantity(quantity: number) {
  return Math.round(quantity * 1000) / 1000;
}

// Arthur: NarIyirm
// 中文：使用量遵循库存的三位小数精度，并保留不足一个步长的最后一份，避免扣出负库存。
// EN: Usage follows inventory's three-decimal precision and allows the last fraction of a step without negative stock.
export function clampQuickUseQuantity(quantity: number, remaining: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(remaining) || remaining <= 0) return 0;
  const maximum = roundInventoryQuantity(remaining);
  return roundInventoryQuantity(Math.min(maximum, Math.max(Math.min(0.001, maximum), quantity)));
}

export function remainingAfterQuickUse(remaining: number, used: number) {
  if (!Number.isFinite(remaining) || !Number.isFinite(used) || used <= 0 || used > remaining) {
    throw new Error('Invalid inventory usage quantity');
  }
  return roundInventoryQuantity(remaining - used);
}

// Arthur: NarIyirm
// 中文：只合并服务器已确认的数量与版本，并重新汇总同名同单位补货状态；完整快照随后在后台对账。
// EN: Merge only server-confirmed quantity and version, recalculating name/unit restock totals before the full snapshot reconciles in the background.
export function applyQuickUseResult(snapshot: InventorySnapshot, updated: Pick<InventoryBatchDetail, 'id' | 'remainingQuantity' | 'version' | 'lifecycleState'>): InventorySnapshot {
  const batches = snapshot.batches.map((batch) => batch.id === updated.id && batch.version <= updated.version ? { ...batch, ...updated } : batch).filter((batch) => batch.lifecycleState === 'active');
  const keyOf = (batch: InventoryBatchDetail) => `${batch.name.trim().toLowerCase()}\u0000${batch.unit}`;
  const totals = new Map<string, number>();
  for (const batch of batches) totals.set(keyOf(batch), (totals.get(keyOf(batch)) ?? 0) + batch.remainingQuantity);
  return { ...snapshot, batches: batches.map((batch) => ({ ...batch, needsRestock: Boolean(batch.restockRule?.enabled && (totals.get(keyOf(batch)) ?? 0) <= batch.restockRule.minimumQuantity) })) };
}
