import type { ImageSourcePropType } from 'react-native';

type LearningImageAsset = {
  source: ImageSourcePropType;
  width: number;
  height: number;
  contentFit: 'contain' | 'cover';
  decorative: boolean;
};

// Arthur: NarIyirm
// 中文：Metro 需要静态 require；公开课程只传稳定 assetKey，运行时不拼接本机路径或远程图片 URL。
// EN: Metro needs static requires; public courses use stable asset keys rather than machine-local paths or constructed remote image URLs.
export const learningAssets = {
  'waste-basics-still-life': {
    source: require('../../../assets/learning-room/waste-basics-still-life.png'),
    width: 640, height: 960, contentFit: 'contain', decorative: true,
  },
  'waste-basics-course-cover': {
    source: require('../../../assets/learning-room/waste-basics-course-cover.webp'),
    width: 1200, height: 600, contentFit: 'cover', decorative: false,
  },
  'empty-aluminium-can': {
    source: require('../../../assets/learning-room/empty-aluminium-can.png'),
    width: 640, height: 960, contentFit: 'contain', decorative: false,
  },
  'learning-complete-seal': {
    source: require('../../../assets/learning-room/learning-complete-seal.png'),
    width: 512, height: 512, contentFit: 'contain', decorative: true,
  },
  'waste-climate-cover': {
    source: require('../../../assets/learning-room/waste-climate-cover.webp'),
    width: 1200, height: 600, contentFit: 'cover', decorative: false,
  },
  'learning-leaf-sprig': {
    source: require('../../../assets/learning-room/learning-leaf-sprig.png'),
    width: 640, height: 960, contentFit: 'contain', decorative: true,
  },
  'packaging-recycling-cover': {
    source: require('../../../assets/learning-room/packaging-recycling-cover.webp'),
    width: 1200, height: 600, contentFit: 'cover', decorative: false,
  },
  'preventing-waste-cover': {
    source: require('../../../assets/learning-room/preventing-waste-cover.webp'),
    width: 1200, height: 600, contentFit: 'cover', decorative: false,
  },
  'sdg-13-climate-action': {
    source: require('../../../assets/learning-room/sdg-13-climate-action-en.png'),
    width: 512, height: 512, contentFit: 'contain', decorative: false,
  },
} as const satisfies Record<string, LearningImageAsset>;

export type LearningAssetKey = keyof typeof learningAssets;

const sdgChineseSource: ImageSourcePropType = require('../../../assets/learning-room/sdg-13-climate-action-zh.png');

export function getLearningImageSource(key: LearningAssetKey, language: 'en' | 'zh'): ImageSourcePropType {
  return key === 'sdg-13-climate-action' && language === 'zh' ? sdgChineseSource : learningAssets[key].source;
}

export function isLearningAssetKey(value: string): value is LearningAssetKey {
  return Object.prototype.hasOwnProperty.call(learningAssets, value);
}

// Arthur: NarIyirm
// 中文：官方标识必须保持原色与比例；阅读页来源区同时显示 UN 链接和声明，不能暗示联合国认证。
// EN: Keep official marks in their original colours and proportions; the reading source area includes the UN link and statement without implying endorsement.
export const learningSdgAttribution = {
  url: 'https://www.un.org/sustainabledevelopment',
  guidelinesUrl: 'https://www.un.org/sustainabledevelopment/news/communications-material/',
  en: 'The content of this publication has not been approved by the United Nations and does not reflect the views of the United Nations or its officials or Member States.',
  zh: '本刊物内容未经联合国批准，不代表联合国、其官员或会员国的观点。',
} as const;

