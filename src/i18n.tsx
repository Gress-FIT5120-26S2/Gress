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
  fridge: {
    scopes: { personal: '我的冰箱', household: '家庭冰箱' },
    switchA11y: (scope: string) => `切换冰箱，当前为${scope}`,
    searchPlaceholder: '搜索冰箱食材',
    searchA11y: '按名称搜索当前冰箱食材',
    clearSearch: '清除搜索',
    filters: { chilled: '冷藏', frozen: '冷冻', pantry: '常温', expired: '已过期', expiring: '快过期', restock: '需补货' },
    categories: { all: '全部', meat: '肉蛋', vegetables: '蔬菜', fruit: '水果', staples: '主食', condiments: '调料', drinks: '饮品', other: '其他' },
    categoryHeading: '分类',
    titles: { all: '全部食材', search: '搜索结果' },
    titleFor: (label: string) => `${label}食材`,
    itemCount: (count: number, filtered: boolean) => `${count} 个食材${filtered ? '，已按条件筛选' : ''}`,
    freshness: {
      expired: '已过期',
      today: '今天到期',
      daysLeft: (days: number) => `剩 ${days} 天`,
    },
    clearFilters: '清除筛选',
    reloadInventory: '重新加载',
    emptyTitle: (title: string) => `${title}暂无食材`,
    emptyDescription: '换一个分类、状态或关键词看看。',
    addItem: {
      open: '添加食材',
      title: '添加食材',
      subtitle: '选择一种录入方式',
      close: '关闭添加食材',
      dragHint: '向上拖动查看更多介绍，向下拖动收起',
      recommended: '推荐',
      manualTitle: '手动录入',
      manualDescription: '数量 · 分类 · 保质期',
      manualDetails: '逐项填写名称、数量、分类和保质期，适合快速添加少量食材。',
      manualA11y: '使用手动录入添加食材',
      cameraTitle: '拍照识别',
      cameraDescription: '小票 · 订单 · 包装',
      cameraDetails: '拍摄小票、订单或食品包装，自动识别多种食材信息。',
      cameraA11y: '使用拍照识别添加食材',
    },
    manualEntry: {
      title: '录入冰箱食材',
      cancel: '取消',
      back: '上一步',
      next: '设置提醒',
      save: '保存食材',
      saving: '正在保存',
      step: (step: number) => `${step} / 2`,
      name: { label: '食材名称', placeholder: '例如 番茄' },
      quantity: { label: '数量', placeholder: '例如 2' },
      unitsLabel: '单位',
      units: { item: '个', g: 'g', kg: 'kg', ml: 'ml', L: 'L', bag: '袋', bottle: '瓶', box: '盒' },
      storageLabel: '存放方式',
      storage: { pantry: '常温', chilled: '冷藏', frozen: '冷冻' },
      categoryLabel: '分类',
      price: { label: '购买价格（可选）', placeholder: '0.00', helper: '用于后续统计节省金额和浪费价值。' },
      suggestion: {
        title: '储藏建议',
        empty: '输入食材名称后，这里会显示匹配的储藏建议。',
        hint: '试试输入番茄、牛奶、鸡蛋或其他常见食材。',
        match: (name: string) => `找到“${name}”的常见储藏方式`,
        shelfLife: (days: number) => `约 ${days} 天`,
        summary: (storage: string, category: string, days: number) => `推荐${storage} · ${category} · ${days} 天`,
        apply: '采用这条建议',
        applied: '已采用，可继续修改',
        loading: '正在查询储藏建议…',
        unavailable: '暂时没有这类食材的储藏建议。',
        searchOnline: '搜索储藏建议',
      },
      remindersTitle: '提醒设置',
      remindersDescription: '这些设置只影响当前这次入库的批次，不会合并不同日期添加的同名食材。',
      expiry: {
        title: '到期时间',
        closePicker: '关闭日期时间选择器',
        pickerDone: '完成',
        enabled: '临期和到期时提醒',
        disabled: '不设置到期提醒',
        date: '到期日期',
        time: '时间',
        warning: '临期提醒',
        advance: (days: number) => `提前 ${days} 天`,
        summary: (days: number) => `系统将在到期前 ${days} 天和到期时生成提醒。`,
      },
      restock: {
        title: '补货提醒',
        enabled: '库存偏低时加入需补货状态',
        disabled: '库存不足时不提醒',
        minimum: '最低库存',
        target: '期望补到',
        helper: (minimum: number, target: number, unit: string) => `剩余不高于 ${minimum} ${unit} 时提醒，建议补到 ${target} ${unit}。`,
        quantity: '提醒数量',
      },
      validation: {
        name: '请输入食材名称。',
        quantity: '数量必须大于 0。',
        price: '价格应为 0 或更大的数字。',
        expiry: '请输入有效且晚于当前时间的日期与时间。',
        restock: '期望库存必须高于最低库存。',
        save: '暂时无法保存，请稍后再试。',
      },
    },
    items: {
      milk: { name: '鲜牛奶', amount: '600 ml' },
      tomato: { name: '番茄', amount: '2 个' },
      egg: { name: '鸡蛋', amount: '6 个' },
      blueberry: { name: '蓝莓', amount: '1 盒' },
      rice: { name: '大米', amount: '1.5 kg' },
      peas: { name: '青豆', amount: '300 g' },
      soySauce: { name: '酱油', amount: '半瓶' },
      yogurt: { name: '酸奶', amount: '4 杯' },
      bread: { name: '全麦面包', amount: '1 包' },
    },
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
  shopping: {
    restockTab: '建议购物',
    cartTab: '购物车',
    addToCart: '加入购物车',
    add: '添加',
    placeholder: '添加物品…',
    restockEmpty: '暂时没有需要补货的东西',
    cartEmpty: '购物车是空的',
    remaining: (current: number, minimum: number, unit: string) => `剩 ${current}/${minimum} ${unit}`,
  },
  kitchen: {
    accessibility: '可旋转的三维厨房；冰箱、购物车和信箱可进入页面，灶台和菜谱可在原地互动',
    resetCamera: '恢复厨房视角',
    resetCameraHint: '将三维厨房恢复到初始视角',
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
  fridge: {
    scopes: { personal: 'My Fridge', household: 'Family Fridge' },
    switchA11y: (scope: string) => `Switch fridge. Currently showing ${scope}`,
    searchPlaceholder: 'Search fridge food',
    searchA11y: 'Search the current fridge by food name',
    clearSearch: 'Clear search',
    filters: { chilled: 'Chilled', frozen: 'Frozen', pantry: 'Pantry', expired: 'Expired', expiring: 'Expiring', restock: 'Restock' },
    categories: { all: 'All', meat: 'Meat & eggs', vegetables: 'Vegetables', fruit: 'Fruit', staples: 'Staples', condiments: 'Condiments', drinks: 'Drinks', other: 'Other' },
    categoryHeading: 'Categories',
    titles: { all: 'All ingredients', search: 'Search results' },
    titleFor: (label: string) => `${label} ingredients`,
    itemCount: (count: number, filtered: boolean) => `${count} ingredient${count === 1 ? '' : 's'}${filtered ? ', filtered' : ''}`,
    freshness: {
      expired: 'Expired',
      today: 'Expires today',
      daysLeft: (days: number) => `${days}d left`,
    },
    clearFilters: 'Clear filters',
    reloadInventory: 'Reload',
    emptyTitle: (title: string) => `No ${title.toLocaleLowerCase()}`,
    emptyDescription: 'Try another category, status, or search term.',
    addItem: {
      open: 'Add ingredients',
      title: 'Add ingredients',
      subtitle: 'Choose an entry method',
      close: 'Close add ingredients',
      dragHint: 'Drag up for more details or down to collapse',
      recommended: 'Recommended',
      manualTitle: 'Manual entry',
      manualDescription: 'Quantity · category · expiry',
      manualDetails: 'Enter the name, quantity, category, and expiry for a small number of items.',
      manualA11y: 'Add ingredients manually',
      cameraTitle: 'Photo recognition',
      cameraDescription: 'Receipt · order · packaging',
      cameraDetails: 'Photograph a receipt, order, or package to recognise multiple item details automatically.',
      cameraA11y: 'Add ingredients with photo recognition',
    },
    manualEntry: {
      title: 'Add fridge item',
      cancel: 'Cancel',
      back: 'Back',
      next: 'Set reminders',
      save: 'Save item',
      saving: 'Saving',
      step: (step: number) => `${step} of 2`,
      name: { label: 'Ingredient name', placeholder: 'For example, tomato' },
      quantity: { label: 'Quantity', placeholder: 'For example, 2' },
      unitsLabel: 'Unit',
      units: { item: 'item', g: 'g', kg: 'kg', ml: 'ml', L: 'L', bag: 'bag', bottle: 'bottle', box: 'box' },
      storageLabel: 'Storage',
      storage: { pantry: 'Pantry', chilled: 'Chilled', frozen: 'Frozen' },
      categoryLabel: 'Category',
      price: { label: 'Purchase price (optional)', placeholder: '0.00', helper: 'Used later to calculate money saved and the value of waste.' },
      suggestion: {
        title: 'Storage suggestion',
        empty: 'Enter an ingredient name to see a matching storage suggestion.',
        hint: 'Try tomato, milk, eggs, or another common ingredient.',
        match: (name: string) => `Common storage guidance found for “${name}”`,
        shelfLife: (days: number) => `About ${days} days`,
        summary: (storage: string, category: string, days: number) => `Recommended: ${storage} · ${category} · ${days} days`,
        apply: 'Use this suggestion',
        applied: 'Applied, still editable',
        loading: 'Looking up storage guidance…',
        unavailable: 'No storage guidance is available for this ingredient yet.',
        searchOnline: 'Search storage advice',
      },
      remindersTitle: 'Reminder settings',
      remindersDescription: 'These settings apply only to this batch. The same food added on another day remains a separate batch.',
      expiry: {
        title: 'Expiry time',
        closePicker: 'Close date and time picker',
        pickerDone: 'Done',
        enabled: 'Remind near and at expiry',
        disabled: 'No expiry reminder',
        date: 'Expiry date',
        time: 'Time',
        warning: 'Early reminder',
        advance: (days: number) => `${days} day${days === 1 ? '' : 's'} early`,
        summary: (days: number) => `A reminder will be created ${days} day${days === 1 ? '' : 's'} before expiry and again at expiry.`,
      },
      restock: {
        title: 'Restock reminder',
        enabled: 'Mark as low when stock reaches the limit',
        disabled: 'Do not remind when stock runs low',
        minimum: 'Low-stock limit',
        target: 'Restock target',
        helper: (minimum: number, target: number, unit: string) => `Remind at ${minimum} ${unit} or less and suggest restocking to ${target} ${unit}.`,
        quantity: 'Reminder quantity',
      },
      validation: {
        name: 'Enter an ingredient name.',
        quantity: 'Quantity must be greater than 0.',
        price: 'Price must be zero or a positive number.',
        expiry: 'Enter a valid date and time later than now.',
        restock: 'The restock target must be higher than the low-stock limit.',
        save: 'This item could not be saved. Please try again.',
      },
    },
    items: {
      milk: { name: 'Fresh milk', amount: '600 ml' },
      tomato: { name: 'Tomatoes', amount: '2' },
      egg: { name: 'Eggs', amount: '6' },
      blueberry: { name: 'Blueberries', amount: '1 punnet' },
      rice: { name: 'Rice', amount: '1.5 kg' },
      peas: { name: 'Green peas', amount: '300 g' },
      soySauce: { name: 'Soy sauce', amount: 'Half bottle' },
      yogurt: { name: 'Yoghurt', amount: '4 cups' },
      bread: { name: 'Wholemeal bread', amount: '1 loaf' },
    },
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
    shopping: {
    restockTab: 'Suggested',
    cartTab: 'Cart',
    addToCart: 'Add to cart',
    add: 'Add',
    placeholder: 'Add an item…',
    restockEmpty: 'Nothing to restock right now',
    cartEmpty: 'Your cart is empty',
    remaining: (current: number, minimum: number, unit: string) => `${current}/${minimum} ${unit} left`,
  },
  kitchen: {
    accessibility: 'Rotatable 3D kitchen. Fridge, cart, and mailbox open pages; stove and recipe book interact in place.',
    resetCamera: 'Reset kitchen view',
    resetCameraHint: 'Return the 3D kitchen to its initial camera angle',
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
