import { useEffect, useMemo } from 'react';
import { createLearningApiGateway } from '../../services/learningApi';
import type { LearningOrigin } from '../../types/learningRoom';
import { LearningRoomFlow } from './LearningRoomFlow';

// Arthur: NarIyirm
// 中文：关闭入口即销毁本人内存适配器；重新打开时从服务器恢复，不复用恢复前的设备记录。
// EN: Closing destroys the personal in-memory adapter; reopening restores the server record rather than reusing pre-recovery device state.
export function LearningRoomEntry({ origin, onClose, embedded = false }: { origin: LearningOrigin; onClose: () => void; embedded?: boolean }) {
  const gateway = useMemo(() => createLearningApiGateway(), []);
  useEffect(() => () => gateway.dispose?.(), [gateway]);
  return <LearningRoomFlow gateway={gateway} origin={origin} onClose={onClose} embedded={embedded} />;
}
