export const MAX_INVENTORY_NAME_LENGTH = 120;

export function getMaxInventoryQuantity(unit: string) {
  return unit === 'g' || unit === 'ml' ? 1_000_000 : 1_000;
}

// Arthur: NarIyirm
// 中文：质量与体积采用等价量级的软提醒和硬上限，避免 900 ml 这类普通包装被误判，同时继续拦截异常库存。
// EN: Mass and volume use equivalent unit-aware warning and hard-limit scales so ordinary packages such as 900 ml remain valid while pathological stock is blocked.
export function needsLargeQuantityConfirmation(quantity: number, unit: string) {
  if (unit === 'g' || unit === 'ml') return quantity >= 50_000;
  if (unit === 'kg' || unit === 'L') return quantity >= 50;
  return quantity >= 100;
}
