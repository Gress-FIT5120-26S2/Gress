import { useEffect, useMemo } from 'react';
import { createLearningApiGateway } from '../../services/learningApi';
import type { LearningOrigin } from '../../types/learningRoom';
import { LearningRoomFlow } from './LearningRoomFlow';
import { useTabActive } from '../RetainedTab';
import { preloadLearningAssets } from './learningAssets';

// Arthur: NarIyirm
// 中文：导航切换复用本人适配器，只有会话结束或设备恢复才销毁，避免重复读取和丢失请求重试键。
// EN: Tab switches reuse the personal adapter; session end or device recovery disposes it, avoiding repeat loads and lost retry keys.
export function LearningRoomEntry({ origin, onClose, embedded = false, entryToken = 0 }: { origin: LearningOrigin; onClose: () => void; embedded?: boolean; entryToken?: number }) {
  const gateway = useMemo(() => createLearningApiGateway(), []);
  const active = useTabActive();
  useEffect(() => { if (active) void preloadLearningAssets().catch(() => undefined); }, [active]);
  useEffect(() => () => gateway.dispose?.(), [gateway]);
  return <LearningRoomFlow gateway={gateway} origin={origin} onClose={onClose} embedded={embedded} entryToken={entryToken} />;
}
