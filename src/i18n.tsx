import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

export type AppLanguage = 'zh' | 'en';

const zh = {
  screens: {
    home: { eyebrow: '今晚好', title: '家里的库存怎么样？', description: '购物前，先看看家里还剩下什么。' },
    shopping: { eyebrow: '购物车', title: '带着厨房库存去购物', description: '对照家中现有库存，只购买真正需要的东西。' },
    fridge: { eyebrow: '我的冰箱', title: '让食材始终看得见', description: '在好食材被浪费之前，及时掌握新鲜状态。' },
    achievements: { eyebrow: '厨房成就', title: '小习惯也会慢慢累积', description: '查看你节省下来的食材、开销和购物次数。' },
    profile: { eyebrow: '我的厨房', title: '打造属于你的厨房', description: '设置偏好、饮食习惯和日常目标。' },
    notifications: { eyebrow: '厨房信箱', title: '一些温和的提醒', description: '在一个安静的地方查看食材、购物和共享厨房动态。' },
  },
  tabs: { home: '首页', shopping: '购物车', fridge: '冰箱', achievements: '成就', profile: '我的' },
  status: {
    connecting: '正在连接后端…',
    connected: '服务已连接',
    disconnected: '暂时无法连接服务，请稍后重试',
  },
  opening: {
    eyebrow: '下一次购物',
    title: '先看看家里\n还有什么',
    lowStock: (count: number) => `${count} 项库存偏低`,
    liveInventory: '实时库存',
    tagline: '从冰箱到更聪明的购物',
  },
  home: {
    period: { night: '今晚的厨房', dawn: '清晨的厨房', day: '今天的厨房', sunset: '傍晚的厨房' },
    expiring: (count: number) => `${count} 件食材值得先用`,
    freshnessGood: '今天的食材状态很好',
    freshnessHint: '打开冰箱并查看临期食材',
    mailboxHint: '查看食材、购物和共享厨房提醒',
    mailboxUnread: (count: number) => `打开信箱，${count} 条未读提醒`,
    mailboxEmpty: '打开信箱',
    interactionHint: '拖动查看 · 轻点白点互动',
  },
  notifications: {
    unreadSummary: (count: number) => `${count} 条未读提醒`,
    allRead: '所有提醒都已读',
    older: (count: number) => `另有 ${count} 条较早提醒`,
    items: {
      freshness: { title: '草莓还有 2 天到期', detail: '今晚使用，口感会更好' },
      shopping: { title: '购物清单有 3 项待购买', detail: '牛奶、鸡蛋和燕麦库存偏低' },
      shared: { title: '共享厨房有新变化', detail: '一件商品刚刚被标记为已购买' },
    },
  },
  kitchen: {
    accessibility: '可旋转的三维厨房；冰箱、购物车和信箱可进入页面，灶台和菜谱可在原地互动',
    parsing: (progress: number) => `正在解析厨房 ${progress}%`,
    preparing: '正在准备 3D 厨房…',
  },
  settings: {
    open: '打开设置',
    title: '设置',
    subtitle: '调整 KitchMemo 的使用方式',
    language: '显示语言',
    languageDescription: '界面、提示和无障碍朗读会一起切换。',
    chinese: '中文',
    chineseDetail: '简体中文',
    english: '英语',
    englishDetail: 'English',
    selected: '已选择',
    close: '关闭设置',
  },
} as const;

type TranslationShape<T> = T extends (...args: infer Arguments) => unknown
  ? (...args: Arguments) => string
  : T extends string
    ? string
    : { [Key in keyof T]: TranslationShape<T[Key]> };

export type Translation = TranslationShape<typeof zh>;

const en: Translation = {
  screens: {
    home: { eyebrow: 'GOOD EVENING', title: 'How stocked is home?', description: 'See what is still at home before the next shop.' },
    shopping: { eyebrow: 'SHOPPING CART', title: 'Shop with the kitchen in mind', description: 'Compare what you need with the stock already at home.' },
    fridge: { eyebrow: 'MY FRIDGE', title: 'Keep food in view', description: 'Track freshness before good ingredients go to waste.' },
    achievements: { eyebrow: 'KITCHEN WINS', title: 'Small habits add up', description: 'See the food, money, and shopping trips you have saved.' },
    profile: { eyebrow: 'MY KITCHEN', title: 'Make it yours', description: 'Set your preferences, diets, and everyday goals.' },
    notifications: { eyebrow: 'KITCHEN MAIL', title: 'A gentle heads-up', description: 'Freshness, shopping, and shared-home updates in one quiet place.' },
  },
  tabs: { home: 'Home', shopping: 'Cart', fridge: 'Fridge', achievements: 'Wins', profile: 'Me' },
  status: {
    connecting: 'Connecting to the server…',
    connected: 'Service connected',
    disconnected: 'The service is unavailable. Please try again later.',
  },
  opening: {
    eyebrow: 'NEXT SHOP',
    title: 'Know what is\nalready home',
    lowStock: (count: number) => `${count} items low`,
    liveInventory: 'live inventory',
    tagline: 'from fridge to smarter shopping',
  },
  home: {
    period: { night: 'Tonight in your kitchen', dawn: 'This morning in your kitchen', day: 'Today in your kitchen', sunset: 'This evening in your kitchen' },
    expiring: (count: number) => `${count} ingredients to use soon`,
    freshnessGood: 'Everything is looking fresh today',
    freshnessHint: 'Open the fridge to view ingredients nearing expiry',
    mailboxHint: 'View freshness, shopping, and shared-kitchen reminders',
    mailboxUnread: (count: number) => `Open mailbox, ${count} unread reminders`,
    mailboxEmpty: 'Open mailbox',
    interactionHint: 'Drag to explore · Tap a white dot',
  },
  notifications: {
    unreadSummary: (count: number) => `${count} unread reminders`,
    allRead: 'You are all caught up',
    older: (count: number) => `${count} earlier reminders`,
    items: {
      freshness: { title: 'Strawberries expire in 2 days', detail: 'Use them tonight for the best flavour' },
      shopping: { title: '3 items are waiting on your list', detail: 'Milk, eggs, and oats are running low' },
      shared: { title: 'Something changed in your shared kitchen', detail: 'One item was just marked as purchased' },
    },
  },
  kitchen: {
    accessibility: 'Rotatable 3D kitchen. Fridge, cart, and mailbox open pages; stove and recipe book interact in place.',
    parsing: (progress: number) => `Preparing kitchen ${progress}%`,
    preparing: 'Preparing the 3D kitchen…',
  },
  settings: {
    open: 'Open settings',
    title: 'Settings',
    subtitle: 'Choose how KitchMemo works for you',
    language: 'Display language',
    languageDescription: 'Interface copy, guidance, and accessibility labels switch together.',
    chinese: '中文',
    chineseDetail: 'Simplified Chinese',
    english: 'English',
    englishDetail: 'English',
    selected: 'Selected',
    close: 'Close settings',
  },
};

const translations: Record<AppLanguage, Translation> = { zh, en };
const LANGUAGE_STORAGE_KEY = '@kitchmemo/language';

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: Translation;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('zh');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Arthur: NarIyirm
    // 中文：先恢复上次保存的语言，再挂载开场动画，避免英语用户启动时短暂看到中文。
    // EN: Restore the saved language before mounting the opener so English users never see a brief Chinese flash.
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((storedLanguage) => {
        if (mounted && (storedLanguage === 'zh' || storedLanguage === 'en')) setLanguageState(storedLanguage);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage).catch(() => undefined);
  };

  const value = useMemo(() => ({ language, setLanguage, t: translations[language] }), [language]);

  if (!isReady) return <View style={{ flex: 1, backgroundColor: '#F7FBF8' }} />;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
