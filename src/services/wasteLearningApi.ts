import { requestApi } from './apiClient';

export type WasteStream = 'recycling' | 'organics' | 'general';
export type WasteMaterial = 'eggshell' | 'organic_residue' | 'aluminium_can' | 'plastic_bottle' | 'glass_container' | 'paper_cardboard' | 'rigid_plastic' | 'soft_plastic' | 'carton' | 'other' | 'unknown' | 'unknown_bottle' | 'unknown_container';
export type WasteComponent = { material: WasteMaterial; trigger: 'per_unit' | 'when_empty' };
export type WasteProfileSuggestion = { profile: WasteComponent[]; needsConfirmation: boolean; fallback?: boolean };

// Arthur: NarIyirm
// 中文：录入阶段的 AI 请求设超时，网络卡住时仍能切换到人工材质选择或备用图标。
// EN: Bound entry-time AI requests so stalled networks still permit manual materials and fallback artwork.
async function requestEntryAi<T>(path: string, body: unknown, timeout: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await requestApi<T>(path, { method: 'POST', body: JSON.stringify(body), signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export function suggestWasteProfile(name: string, unit: string) {
  return requestEntryAi<WasteProfileSuggestion>('/api/waste-learning/profile', { name, unit }, 35_000);
}

export function prepareWasteMaterials(profile: WasteComponent[]) {
  return requestEntryAi<{ assets: Partial<Record<WasteMaterial, string | null>> }>('/api/waste-learning/materials/prepare', { profile }, 55_000);
}

export type WasteOpportunity = {
  eventUid: string;
  itemName: string;
  questionCode: string;
  correctStream: WasteStream | null;
  material: WasteMaterial;
  quantity: number;
  componentKey?: string;
  displayName?: { zh: string; en: string };
  explanation?: { zh: string; en: string };
  iconUrl?: string | null;
  iconEmoji?: string;
  nextOpportunities?: WasteOpportunity[];
  sourceUrls: { vic: string; nsw: string };
};

export function submitWasteAnswer(eventUid: string, selectedStream: WasteStream, confirmedMaterial: 'plastic_bottle' | 'aluminium_can' | null = null, componentKey = 'legacy') {
  return requestApi<{ attemptUid: string; isCorrect: boolean; correctStream: WasteStream }>('/api/waste-learning/attempts', {
    method: 'POST',
    body: JSON.stringify({ eventUid, selectedStream, confirmedMaterial, componentKey }),
  });
}

export function getWasteLearningStats() {
  return requestApi<{ answered: number; correct: number }>('/api/waste-learning/stats');
}
