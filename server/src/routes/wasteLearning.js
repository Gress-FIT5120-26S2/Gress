import express from 'express';
import { requireFridge } from '../middleware/requireFridge.js';
import { supabase } from '../supabase.js';
import { getWasteOpportunity } from '../services/wasteLearning.js';
import { WASTE_MATERIALS, validateWasteProfile, suggestWasteProfile, prepareWasteMaterialAssets } from '../services/wasteProfiles.js';
import { consumeRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();
const STREAMS = new Set(['recycling', 'organics', 'general']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.post('/waste-learning/profile', requireFridge, async (request, response) => {
  const { name, unit } = request.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.length > 120 || !['item','bottle','box','bag','g','kg','ml','L'].includes(unit)) {
    return response.status(400).json({ message: 'Invalid product label or unit.' });
  }
  if (!await consumeRateLimit({ request, response, identifier: request.deviceId, policy: { scope: 'waste-profile-suggestion', limit: 30, windowSeconds: 900 } })) return;
  const options = Object.entries(WASTE_MATERIALS).map(([code, value]) => ({ code, label: { zh: value.zh, en: value.en }, emoji: value.emoji }));
  try {
    return response.json({ ...await suggestWasteProfile(name, unit), options });
  } catch (error) {
    console.error('Waste profile suggestion unavailable:', error?.message);
    // Arthur: NarIyirm
    // 中文：AI 或缓存不可用时仍提供人工材质选择，不把不确定的包装自动当成正确答案。
    // EN: Keep manual material choices available when AI or its cache fails, without turning guesses into answer keys.
    return response.json({ profile: [], needsConfirmation: true, fallback: true, options });
  }
});

router.post('/waste-learning/materials/prepare', requireFridge, async (request, response) => {
  let profile;
  try { profile = validateWasteProfile(request.body?.profile); }
  catch (error) { return response.status(400).json({ message: error.message }); }
  if (!await consumeRateLimit({ request, response, identifier: request.deviceId, policy: { scope: 'waste-icon-prepare', limit: 30, windowSeconds: 900 } })) return;
  try { return response.json({ assets: await prepareWasteMaterialAssets(profile) }); }
  catch (error) { return response.status(503).json({ message: 'Material artwork is unavailable; you can still save with the fallback icon.' }); }
});

// Arthur: NarIyirm
// 中文：答题先校验使用事件属于当前冰箱和当前操作者，再由服务端题库判分；客户端不能提交正确答案。
// EN: Grade only a consume event from this fridge and actor against the server catalog; the client never supplies the answer key.
router.post('/waste-learning/attempts', requireFridge, async (request, response) => {
  const eventUid = request.body?.eventUid;
  const selectedStream = request.body?.selectedStream;
  const confirmedMaterial = request.body?.confirmedMaterial ?? null;
  const componentKey = request.body?.componentKey ?? 'legacy';
  if (typeof eventUid !== 'string' || !UUID_PATTERN.test(eventUid) || !STREAMS.has(selectedStream)
    || typeof componentKey !== 'string' || componentKey.length > 80
    || (confirmedMaterial !== null && confirmedMaterial !== 'plastic_bottle' && confirmedMaterial !== 'aluminium_can')) {
    return response.status(400).json({ error: 'invalid_waste_learning_attempt' });
  }
  try {
    const { data: event, error: eventError } = await supabase
      .from('inventory_events')
      .select('event_uid')
      .eq('event_uid', eventUid)
      .eq('fridge_uid', request.fridgeUid)
      .eq('actor_device_id', request.deviceId)
      .eq('event_type', 'consume')
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return response.status(404).json({ error: 'waste_learning_event_not_found' });
    const first = await getWasteOpportunity(request.fridgeUid, eventUid, confirmedMaterial);
    const opportunity = [first, ...(first?.nextOpportunities ?? [])].find((item) => item && (item.componentKey ?? 'legacy') === componentKey);
    if (!opportunity || !opportunity.correctStream) return response.status(404).json({ error: 'waste_learning_question_not_found' });
    const { data, error } = await supabase.from('waste_sorting_attempts').insert({
      fridge_uid: request.fridgeUid,
      event_uid: eventUid,
      component_key: componentKey,
      actor_device_id: request.deviceId,
      question_code: opportunity.questionCode,
      selected_stream: selectedStream,
      correct_stream: opportunity.correctStream,
    }).select('attempt_uid, is_correct').single();
    if (error?.code === '23505') {
      const { data: existing, error: readError } = await supabase.from('waste_sorting_attempts')
        .select('attempt_uid, selected_stream, is_correct, correct_stream')
        .eq('event_uid', eventUid)
        .eq('component_key', componentKey)
        .eq('fridge_uid', request.fridgeUid)
        .maybeSingle();
      if (readError) throw readError;
      if (existing?.selected_stream === selectedStream) {
        return response.json({ attemptUid: existing.attempt_uid, isCorrect: existing.is_correct, correctStream: existing.correct_stream });
      }
      return response.status(409).json({ error: 'waste_learning_already_answered' });
    }
    if (error) throw error;
    return response.json({ attemptUid: data.attempt_uid, isCorrect: data.is_correct, correctStream: opportunity.correctStream });
  } catch (error) {
    console.error('Waste learning answer failed:', error?.message ?? error);
    return response.status(503).json({ error: 'waste_learning_unavailable' });
  }
});

router.get('/waste-learning/stats', requireFridge, async (request, response) => {
  const [{ count: answered, error }, { count: correct, error: correctError }] = await Promise.all([
    supabase.from('waste_sorting_attempts').select('attempt_uid', { count: 'exact', head: true }).eq('fridge_uid', request.fridgeUid),
    supabase.from('waste_sorting_attempts').select('attempt_uid', { count: 'exact', head: true }).eq('fridge_uid', request.fridgeUid).eq('is_correct', true),
  ]);
  if (error || correctError) {
    console.error('Waste learning stats failed:', error?.message ?? correctError?.message);
    return response.status(503).json({ error: 'waste_learning_unavailable' });
  }
  return response.json({ answered: answered ?? 0, correct: correct ?? 0 });
});

export default router;
