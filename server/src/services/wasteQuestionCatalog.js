const VICTORIA_GUIDE = 'https://www.environment.vic.gov.au/household-waste-recycling/sort-waste-recycling';
const NSW_PACKAGING_GUIDE = 'https://www.epa.nsw.gov.au/Your-environment/Recycling-and-reuse/business-government-recycling/standard-recycling-signs/containers';
const NSW_ORGANICS_GUIDE = 'https://www.epa.nsw.gov.au/Your-environment/Recycling-and-reuse/household-recycling-overview/what-can-go-in-your-fogo-bin';

// Arthur: NarIyirm
// 中文：只对名称明确、且不依赖具体 council 服务的材料出题；未知包装不推断材质或本地桶色。
// EN: Offer questions only for explicit materials and avoid inferring packaging or council bin colours from an unknown product.
export function classifyWasteQuestion(batch, event, confirmedMaterial = null) {
  if (!batch || !event || event.event_type !== 'consume' || Number(event.quantity_change) >= 0) return null;
  const name = batch.name.trim().toLocaleLowerCase();
  const unit = batch.unit;
  if (unit === 'item' && /^(egg|eggs|鸡蛋|鸡蛋壳)$/.test(name)) {
    return { questionCode: 'eggshell_v1', correctStream: 'organics', material: 'eggshell', quantity: Math.abs(Number(event.quantity_change)), sourceUrls: { vic: VICTORIA_GUIDE, nsw: NSW_ORGANICS_GUIDE } };
  }
  if (/\b(aluminium|aluminum)\s+(drink\s+|beverage\s+)?can(s)?\b|易拉罐|铝罐/.test(name) && (unit === 'item' || unit === 'bottle')) {
    return { questionCode: 'aluminium_can_v1', correctStream: 'recycling', material: 'aluminium_can', quantity: Math.abs(Number(event.quantity_change)), sourceUrls: { vic: VICTORIA_GUIDE, nsw: NSW_PACKAGING_GUIDE } };
  }
  if (/\bplastic\s+bottle(s)?\b|塑料瓶/.test(name) && (unit === 'bottle' || (['ml', 'L'].includes(unit) && Number(batch.remaining_quantity) === 0))) {
    return { questionCode: 'plastic_bottle_v1', correctStream: 'recycling', material: 'plastic_bottle', quantity: unit === 'bottle' ? Math.abs(Number(event.quantity_change)) : 1, sourceUrls: { vic: VICTORIA_GUIDE, nsw: NSW_PACKAGING_GUIDE } };
  }
  const isDrink = /\b(?:juice|milk|water|drink|beverage|cola|coke|soda|soft[\s-]?drink|pepsi|sprite|fanta)\b|果汁|牛奶|饮料|汽水|矿泉水|可乐|雪碧|芬达/u.test(name);
  const emptyContainer = unit === 'bottle'
    || (['ml', 'L'].includes(unit) && Number(batch.remaining_quantity) === 0 && isDrink)
    || (unit === 'item' && isDrink);
  if (emptyContainer) {
    const quantity = unit === 'item' || unit === 'bottle' ? Math.abs(Number(event.quantity_change)) : 1;
    if (confirmedMaterial === 'plastic_bottle' || confirmedMaterial === 'aluminium_can') {
      return { questionCode: `${confirmedMaterial}_v1`, correctStream: 'recycling', material: confirmedMaterial, quantity, sourceUrls: { vic: VICTORIA_GUIDE, nsw: NSW_PACKAGING_GUIDE } };
    }
    // Arthur: NarIyirm
    // 中文：“个”只表示计数，不能推断可乐的包装；先让用户确认塑料瓶或铝罐，其他材质暂不判分。
    // EN: An item count does not identify a drink's packaging; ask whether it was a plastic bottle or aluminium can before grading.
    return { questionCode: unit === 'item' ? 'confirm_container_material_v1' : 'confirm_bottle_material_v1', correctStream: null, material: unit === 'item' ? 'unknown_container' : 'unknown_bottle', quantity, sourceUrls: { vic: VICTORIA_GUIDE, nsw: NSW_PACKAGING_GUIDE } };
  }
  return null;
}
