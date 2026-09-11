import { createContext } from 'react';

export type AppLanguage = 'zh' | 'en';

// 中文：Context 单独放在小文件里，避免大段文案热更新时重建 Context 导致 useI18n 找不到 Provider。
// EN: Keep Context in a tiny module so large translation hot-reloads do not recreate it and break useI18n.
export type I18nContextValueBase = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: unknown;
};

export const I18nContext = createContext<I18nContextValueBase | null>(null);
