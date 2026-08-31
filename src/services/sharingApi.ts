import { requestApi } from './apiClient';

export type FridgeAccessContext = {
  activeInvite: {
    code: string;
    expiresAt: string;
  } | null;
  fridge: {
    memberCount: number;
    mode: 'personal' | 'shared';
    name: string;
    uid: string;
  };
  members: Array<{
    index: number;
    isCurrent: boolean;
    joinedAt: string;
  }>;
  recoveryConfigured: boolean;
};

// Arthur: NarIyirm
// 中文：共享入口读取当前冰箱模式、有效邀请和匿名成员摘要；数据由 server/routes/sharing.js 按已认证 fridgeUid 组装。
// EN: The sharing entry reads mode, active invite, and anonymous member summaries assembled by server/routes/sharing.js for the authenticated fridgeUid.
export function getFridgeAccessContext() {
  return requestApi<FridgeAccessContext>('/api/fridges/context');
}

// Arthur: NarIyirm
// 中文：共享管理页用此函数轮换邀请码；后端在同一事务中撤销旧码并生成新码。
// EN: The sharing manager rotates an invite here; the backend revokes the old code and creates the new one in one transaction.
export function createFridgeInvite() {
  return requestApi<FridgeAccessContext>('/api/fridges/invites', { method: 'POST' });
}

// Arthur: NarIyirm
// 中文：个人冰箱创建家庭空间时调用；后端命名当前冰箱、切换 shared 模式并返回首个邀请码。
// EN: Creating a family space calls this; the backend names the current fridge, switches it to shared mode, and returns the first invite.
export function activateSharedFridge(name: string) {
  return requestApi<FridgeAccessContext>('/api/fridges/share', {
    body: JSON.stringify({ name }),
    method: 'POST',
  });
}

// Arthur: NarIyirm
// 中文：共享管理页修改当前冰箱名称；服务端只使用鉴权上下文中的 fridgeUid，不接受客户端指定目标冰箱。
// EN: The sharing manager renames the current fridge; the server uses the authenticated fridgeUid and never accepts a client-selected target fridge.
export function renameCurrentFridge(name: string) {
  return requestApi<FridgeAccessContext>('/api/fridges/current', {
    body: JSON.stringify({ name }),
    method: 'PATCH',
  });
}

// Arthur: NarIyirm
// 中文：输入或扫描邀请码后调用；数据库 join_shared_fridge RPC 原子合并个人数据并切换成员关系。
// EN: Entering or scanning an invite calls this; join_shared_fridge atomically merges personal data and switches membership.
export function joinSharedFridge(code: string) {
  return requestApi<FridgeAccessContext>('/api/fridges/join', {
    body: JSON.stringify({ code }),
    method: 'POST',
  });
}

// Arthur: NarIyirm
// 中文：退出共享时调用；后端只把当前设备拥有的活跃批次和未购手动购物项迁回新个人冰箱。
// EN: Leaving sharing calls this; the backend moves only this device's active batches and unchecked manual cart items to a new personal fridge.
export function leaveSharedFridge(name?: string) {
  return requestApi<FridgeAccessContext>('/api/fridges/leave', {
    body: JSON.stringify({ name }),
    method: 'POST',
  });
}

// Arthur: NarIyirm
// 中文：设置页生成一次性恢复码；服务端只保存 SHA-256 摘要，明文仅在本次响应中返回给用户保存。
// EN: Settings generates a one-time recovery code here; the server stores only its SHA-256 digest and returns plaintext only in this response.
export function createDeviceRecoveryCode() {
  return requestApi<{ recoveryCode: string }>('/api/devices/recovery-code', { method: 'POST' });
}

// Arthur: NarIyirm
// 中文：新设备用恢复码转移旧设备的成员关系和所有权；此请求在普通凭证中间件前由恢复码自鉴权。
// EN: A new device transfers the old device's membership and ownership here; the recovery code self-authenticates before normal credential middleware.
export function recoverDevice(recoveryCode: string) {
  return requestApi<FridgeAccessContext & { recoveryCode: string }>('/api/devices/recover', {
    body: JSON.stringify({ recoveryCode }),
    method: 'POST',
  });
}
