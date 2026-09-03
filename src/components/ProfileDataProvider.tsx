import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getDeviceProfile, type DeviceProfile } from '../services/profileApi';
import { subscribeToSync } from '../services/realtimeSync';
import { getFridgeAccessContext, type FridgeAccessContext } from '../services/sharingApi';

type ProfileDataContextValue = {
  failed: boolean;
  fridgeContext: FridgeAccessContext | null;
  loading: boolean;
  profile: DeviceProfile | null;
  refresh: (silent?: boolean) => Promise<void>;
  setProfile: (profile: DeviceProfile) => void;
};

const ProfileDataContext = createContext<ProfileDataContextValue | null>(null);

// Arthur: NarIyirm
// 中文：Provider 在开场动画期间预取设备资料与冰箱摘要，并跨 Tab 常驻内存，个人页重新挂载时无需再次等待网络。
// EN: The provider prefetches device and fridge summaries during the opener and retains them across tabs so Profile remounts never wait on a new request.
export function ProfileDataProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [fridgeContext, setFridgeContext] = useState<FridgeAccessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setFailed(false);
    try {
      const [nextProfile, nextFridgeContext] = await Promise.all([
        getDeviceProfile(),
        getFridgeAccessContext(),
      ]);
      setProfile(nextProfile);
      setFridgeContext(nextFridgeContext);
    } catch {
      // Arthur: NarIyirm
      // 中文：静默同步失败时继续展示已取得的资料，只有显式首载或重试失败才切到错误状态。
      // EN: A failed silent sync keeps the last successful profile visible; only an explicit initial load or retry enters the error state.
      if (!silent) setFailed(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeToSync(['fridge'], () => {
    void refresh(true);
  }), [refresh]);

  const value = useMemo(() => ({ failed, fridgeContext, loading, profile, refresh, setProfile }), [failed, fridgeContext, loading, profile, refresh]);
  return <ProfileDataContext.Provider value={value}>{children}</ProfileDataContext.Provider>;
}

export function useProfileData() {
  const context = useContext(ProfileDataContext);
  if (!context) throw new Error('useProfileData must be used inside ProfileDataProvider');
  return context;
}
