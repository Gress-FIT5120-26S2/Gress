import express from 'express';
import { requireFridge } from '../middleware/requireFridge.js';
import { supabase } from '../supabase.js';
import { getWasteOpportunity } from '../services/wasteLearning.js';

const router = express.Router();
const STREAMS = new Set(['recycling', 'organics', 'general']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Arthur: NarIyirm
// 中文：答题先校验使用事件属于当前冰箱和当前操作者，再由服务端题库判分；客户端不能提交正确答案。
// EN: Grade only a consume event from this fridge and actor against the server catalog; the client never supplies the answer key.
router.post('/waste-learning/attempts', requireFridge, async (request, response) => {
  const eventUid = request.body?.eventUid;
  const selectedStream = request.body?.selectedStream;
  const confirmedMaterial = request.body?.confirmedMaterial ?? null;
  if (typeof eventUid !== 'string' || !UUID_PATTERN.test(eventUid) || !STREAMS.has(selectedStream)
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
    const opportunity = await getWasteOpportunity(request.fridgeUid, eventUid, confirmedMaterial);
    if (!opportunity || !opportunity.correctStream) return response.status(404).json({ error: 'waste_learning_question_not_found' });
    const { data, error } = await supabase.from('waste_sorting_attempts').insert({
      fridge_uid: request.fridgeUid,
      event_uid: eventUid,
      actor_device_id: request.deviceId,
      question_code: opportunity.questionCode,
      selected_stream: selectedStream,
      correct_stream: opportunity.correctStream,
    }).select('attempt_uid, is_correct').single();
    if (error?.code === '23505') {
      const { data: existing, error: readError } = await supabase.from('waste_sorting_attempts')
        .select('attempt_uid, selected_stream, is_correct, correct_stream')
        .eq('event_uid', eventUid)
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
