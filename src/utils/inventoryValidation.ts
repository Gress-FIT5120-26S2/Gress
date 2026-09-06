export const MAX_INVENTORY_QUANTITY = 1000;
export const MAX_INVENTORY_NAME_LENGTH = 120;

// Arthur: NarIyirm
// 中文：不同单位使用不同的软提醒阈值；这些值只触发二次确认，1000 的硬上限由各层独立执行。
// EN: Unit-aware soft thresholds trigger confirmation only; every layer enforces the separate hard ceiling of 1000.
export function needsLargeQuantityConfirmation(quantity: number, unit: string) {
  if (unit === 'g' || unit === 'ml') return quantity >= 900;
  if (unit === 'kg' || unit === 'L') return quantity >= 50;
  return quantity >= 100;
}
