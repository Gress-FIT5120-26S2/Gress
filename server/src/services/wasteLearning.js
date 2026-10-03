import { supabase } from '../supabase.js';
import { classifyWasteQuestion, classifyProfileQuestions } from './wasteQuestionCatalog.js';
import { getWasteMaterialAssets } from './wasteProfiles.js';

export async function getWasteOpportunity(fridgeUid, eventUid, confirmedMaterial = null) {
  const { data: event, error: eventError } = await supabase
    .from('inventory_events')
    .select('event_uid, batch_uid, fridge_uid, event_type, quantity_change, actor_device_id, waste_profile_snapshot, waste_remaining_snapshot, waste_initial_snapshot, waste_unit_snapshot')
    .eq('event_uid', eventUid)
    .eq('fridge_uid', fridgeUid)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!event) return null;
  const { data: batch, error: batchError } = await supabase
    .from('inventory_batches')
    .select('batch_uid, name, unit, remaining_quantity')
    .eq('batch_uid', event.batch_uid)
    .eq('fridge_uid', fridgeUid)
    .maybeSingle();
  if (batchError) throw batchError;
  if (!batch) return null;
  const profileQuestions = classifyProfileQuestions(event);
  if (profileQuestions !== null) {
    if (!profileQuestions.length) return null;
    const assets = await getWasteMaterialAssets(profileQuestions.map((item) => item.material));
    const opportunities = profileQuestions.map((item) => ({ eventUid, itemName: batch.name, ...item, iconUrl: assets[item.material] ?? null }));
    return { ...opportunities[0], nextOpportunities: opportunities.slice(1) };
  }
  // Arthur: NarIyirm
  // 中文：毫升/升包装只在清零的那次流水出现；较早的部分使用事件不能在批次后来清零后被补答成空瓶。
  // EN: A volume-based bottle belongs only to the final consume event, so earlier partial events cannot become eligible after a later emptying.
  if (Number(batch.remaining_quantity) === 0) {
    const { data: latest, error: latestError } = await supabase.from('inventory_events')
      .select('event_uid')
      .eq('batch_uid', event.batch_uid)
      .eq('fridge_uid', fridgeUid)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    if (latest?.event_uid !== eventUid) return null;
  }
  const question = classifyWasteQuestion(batch, event, confirmedMaterial)
    ?? (Number(batch.remaining_quantity) === 0 ? classifyProfileQuestions({ ...event, waste_profile_snapshot: [{ material: 'unknown', trigger: 'when_empty' }], waste_remaining_snapshot: 0, waste_initial_snapshot: 0, waste_unit_snapshot: batch.unit })?.[0] : null);
  return question ? { eventUid, itemName: batch.name, ...question } : null;
}

// Arthur: NarIyirm
// 中文：库存 mutation 只返回本次使用事件的题目；读题失败不回滚已经成功的库存更新。
// EN: Resolve the question from this consume event after a successful mutation; a learning read failure never rolls back inventory.
export async function getLatestWasteOpportunity(fridgeUid, batchUid, deviceId) {
  try {
    const { data: event, error } = await supabase
      .from('inventory_events')
      .select('event_uid')
      .eq('fridge_uid', fridgeUid)
      .eq('batch_uid', batchUid)
      .eq('actor_device_id', deviceId)
      .eq('event_type', 'consume')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return event ? getWasteOpportunity(fridgeUid, event.event_uid) : null;
  } catch (error) {
    console.error('Waste learning opportunity unavailable:', error?.message ?? error);
    return null;
  }
}
