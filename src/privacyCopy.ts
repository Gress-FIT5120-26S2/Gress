import type { AppLanguage } from './i18n';

const copy = {
  en: {
    title: 'AI & photo permission',
    intro: 'Allow these services to process data when you choose an AI feature?',
    providers: 'OpenAI: messages, relevant chat/course context and authorized fridge information.\n\nGoogle Gemini: food/product names and units for food and packaging suggestions.\n\nCloudflare Workers AI: food/category names and material prompts for generated icons.\n\nFood-photo recognition service (d12q94a0v4ih7q.cloudfront.net, delivered via AWS CloudFront): only the photo you choose, filename and request metadata.',
    choice: 'These services may process data overseas under their own retention policies. Do not include faces, personal documents or confidential information. AI and photo suggestions may be wrong and do not establish food safety. You can decline and use manual inventory, shopping and courses. Withdraw permission in Profile → Privacy.',
    allow: 'Allow AI processing', decline: 'Use without AI', cancel: 'Cancel', policy: 'Read full privacy policy',
    support: 'Support & help', manage: 'AI permission', revoke: 'Withdraw AI permission',
    allowed: 'AI permission is on', notAllowed: 'AI permission is off', loading: 'Loading privacy choices…',
    delete: 'Delete my data', deleteTitle: 'Permanently delete this identity?',
    deleteBody: 'Deletes your profile, recovery code, push registration, personal learning and private chats, and inventory/shopping entries you added or own, including shared entries. Your custom categories are removed; other members’ items move to Other. Other members’ data and anonymous household totals remain. A shared fridge you created gets a generic name. An irreversible security fingerprint blocks your old credentials. This cannot be undone.',
    confirmDelete: 'Delete permanently', deleting: 'Deleting…', deleted: 'Your identity and data were deleted',
    deletedBody: 'Your old credentials and recovery code no longer work. Choose to start again with a new empty identity when you are ready.',
    startAgain: 'Start again', failure: 'Could not complete that', failureBody: 'Check your connection and try again. Your privacy choice has not been confirmed.',
    consentNeeded: 'AI permission is required. You can manage it in Profile → Privacy.',
  },
  zh: {
    title: 'AI 与照片处理授权', intro: '使用 AI 功能时，是否允许以下服务处理对应数据？',
    providers: 'OpenAI：消息、相关聊天／课程上下文及有权限访问的冰箱信息。\n\nGoogle Gemini：用于食物和包装建议的食物／商品名称与单位。\n\nCloudflare Workers AI：用于生成图标的食物／分类名称与材质提示。\n\n食物照片识别服务（d12q94a0v4ih7q.cloudfront.net，由 AWS CloudFront 分发）：仅你选择的照片、文件名与请求信息。',
    choice: '上述服务可能在境外处理数据，遵循各自的保留规则。请勿提供人脸、证件或保密信息。AI 与照片建议可能有误，不能证明食品安全。拒绝后仍可使用手动库存、购物和课程；可在“个人 → 隐私”撤回授权。',
    allow: '允许 AI 处理', decline: '不使用 AI', cancel: '取消', policy: '阅读完整隐私政策',
    support: '支持与帮助', manage: 'AI 授权', revoke: '撤回 AI 授权',
    allowed: 'AI 授权已开启', notAllowed: 'AI 授权已关闭', loading: '正在读取隐私设置…',
    delete: '删除我的数据', deleteTitle: '永久删除当前身份？',
    deleteBody: '删除设备资料、恢复码、推送登记、个人学习与私人聊天，以及由你创建或归你所有的库存／购物条目（包括共享条目）。自定义分类删除，其他成员的条目移至“其他”。其他成员数据与匿名家庭统计保留；由你创建的共享冰箱恢复通用名称。系统只保留不可逆安全指纹，阻止旧凭证重新创建身份。此操作无法撤销。',
    confirmDelete: '永久删除', deleting: '正在删除…', deleted: '身份与数据已删除',
    deletedBody: '旧凭证与恢复码已失效。准备好后，可主动选择创建新的空身份重新开始。',
    startAgain: '重新开始', failure: '操作未完成', failureBody: '请检查网络后重试，当前隐私操作尚未确认完成。',
    consentNeeded: '需要 AI 授权，可在“个人 → 隐私”管理。',
  },
};
export const privacyCopy = (language: AppLanguage) => copy[language];
export const privacyUrl = (language: AppLanguage) => `https://kitchmemo-api.vercel.app/privacy?lang=${language}`;
export const supportUrl = (language: AppLanguage) => `https://kitchmemo-api.vercel.app/support?lang=${language}`;
