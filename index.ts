import { registerRootComponent } from 'expo';

// Arthur: NarIyirm
// 中文：只有明确启动的开发预览才加载情景；生产始终进入真实 App，预览不启动设备身份或数据服务。
// EN: Only an explicitly launched development preview loads scenarios; production always enters the real app, and previews never bootstrap identity or data services.
const Root = __DEV__ && process.env.EXPO_PUBLIC_LEARNING_PREVIEW === '1'
  ? require('./src/components/learning/dev/LearningPreviewApp').default
  : require('./App').default;

registerRootComponent(Root);
