const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Arthur: NarIyirm
// 中文：允许 Metro 将 GLB 作为静态资源打包，供 Expo Asset 和 Three.js 加载。
// EN: Allow Metro to bundle GLB files for Expo Asset and Three.js loading.
if (!config.resolver.assetExts.includes('glb')) {
  config.resolver.assetExts.push('glb');
}

module.exports = config;
