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

export function getFridgeAccessContext() {
  return requestApi<FridgeAccessContext>('/api/fridges/context');
}

export function createFridgeInvite() {
  return requestApi<FridgeAccessContext>('/api/fridges/invites', { method: 'POST' });
}

export function activateSharedFridge(name: string) {
  return requestApi<FridgeAccessContext>('/api/fridges/share', {
    body: JSON.stringify({ name }),
    method: 'POST',
  });
}

export function renameCurrentFridge(name: string) {
  return requestApi<FridgeAccessContext>('/api/fridges/current', {
    body: JSON.stringify({ name }),
    method: 'PATCH',
  });
}

export function joinSharedFridge(code: string) {
  return requestApi<FridgeAccessContext>('/api/fridges/join', {
    body: JSON.stringify({ code }),
    method: 'POST',
  });
}

export function leaveSharedFridge(name?: string) {
  return requestApi<FridgeAccessContext>('/api/fridges/leave', {
    body: JSON.stringify({ name }),
    method: 'POST',
  });
}

export function createDeviceRecoveryCode() {
  return requestApi<{ recoveryCode: string }>('/api/devices/recovery-code', { method: 'POST' });
}

export function recoverDevice(recoveryCode: string) {
  return requestApi<FridgeAccessContext & { recoveryCode: string }>('/api/devices/recover', {
    body: JSON.stringify({ recoveryCode }),
    method: 'POST',
  });
}
