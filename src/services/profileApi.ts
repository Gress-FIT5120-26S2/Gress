import { requestApi } from './apiClient';

export type ProfileAvatarKey = 'sage' | 'sky' | 'apricot' | 'plum' | 'coral';

export type DeviceProfile = {
  avatarKey: ProfileAvatarKey;
  displayName: string | null;
  updatedAt: string | null;
};

// Arthur: NarIyirm
// 中文：个人页只通过 Express 读取当前设备资料；昵称为空时由界面按当前语言显示通用称呼。
// EN: The profile screen reads the current device only through Express; a null name receives a localized generic label in the UI.
export function getDeviceProfile() {
  return requestApi<DeviceProfile>('/api/profile');
}

// Arthur: NarIyirm
// 中文：昵称修改不携带 device_id，服务端从已验证请求上下文确定唯一目标设备。
// EN: Display-name updates omit device_id because the server resolves the sole target from authenticated request context.
export function updateDeviceProfile(displayName: string) {
  return requestApi<DeviceProfile>('/api/profile', {
    body: JSON.stringify({ displayName }),
    method: 'PATCH',
  });
}
