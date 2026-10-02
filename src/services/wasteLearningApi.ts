import { requestApi } from './apiClient';

export type WasteStream = 'recycling' | 'organics' | 'general';
export type WasteMaterial = 'eggshell' | 'aluminium_can' | 'plastic_bottle' | 'unknown_bottle';

export type WasteOpportunity = {
  eventUid: string;
  itemName: string;
  questionCode: string;
  correctStream: WasteStream | null;
  material: WasteMaterial;
  quantity: number;
  sourceUrls: { vic: string; nsw: string };
};

export function submitWasteAnswer(eventUid: string, selectedStream: WasteStream, confirmedMaterial: 'plastic_bottle' | null = null) {
  return requestApi<{ attemptUid: string; isCorrect: boolean; correctStream: WasteStream }>('/api/waste-learning/attempts', {
    method: 'POST',
    body: JSON.stringify({ eventUid, selectedStream, confirmedMaterial }),
  });
}

export function getWasteLearningStats() {
  return requestApi<{ answered: number; correct: number }>('/api/waste-learning/stats');
}
