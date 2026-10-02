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
  const emptyBottle = unit === 'bottle' || (['ml', 'L'].includes(unit) && Number(batch.remaining_quantity) === 0 && /juice|milk|water|drink|beverage|果汁|牛奶|饮料|汽水|矿泉水/.test(name));
  if (emptyBottle) {
    return confirmedMaterial === 'plastic_bottle'
      ? { questionCode: 'plastic_bottle_v1', correctStream: 'recycling', material: 'plastic_bottle', quantity: unit === 'bottle' ? Math.abs(Number(event.quantity_change)) : 1, sourceUrls: { vic: VICTORIA_GUIDE, nsw: NSW_PACKAGING_GUIDE } }
      : { questionCode: 'confirm_bottle_material_v1', correctStream: null, material: 'unknown_bottle', quantity: unit === 'bottle' ? Math.abs(Number(event.quantity_change)) : 1, sourceUrls: { vic: VICTORIA_GUIDE, nsw: NSW_PACKAGING_GUIDE } };
  }
  return null;
}
