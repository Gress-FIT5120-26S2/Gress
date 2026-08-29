import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Arthur: NarIyirm
// 中文：用原生指示器叠加静态波纹表达预设查询状态，避免嵌入网页加载器在 Expo Go 中产生平台差异。
// EN: A native indicator over wave layers represents preset lookup without embedding a web loader that can vary across Expo Go platforms.
export function WavePhysicsLoader() {
  return (
    <View accessibilityLabel="Loading storage suggestion" accessibilityRole="progressbar" style={styles.container}>
      <View style={[styles.wave, styles.waveOne]} />
      <View style={[styles.wave, styles.waveTwo]} />
      <View style={[styles.wave, styles.waveThree]} />
      <ActivityIndicator color="#1595A5" size="small" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 44, height: 34, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: 34, height: 11, borderRadius: 20, backgroundColor: 'rgba(64, 202, 213, 0.18)' },
  waveOne: { top: 5, transform: [{ rotate: '-7deg' }] },
  waveTwo: { top: 12, width: 39, backgroundColor: 'rgba(64, 202, 213, 0.24)', transform: [{ rotate: '6deg' }] },
  waveThree: { top: 19, width: 31, backgroundColor: 'rgba(64, 202, 213, 0.15)', transform: [{ rotate: '-4deg' }] },
  spinner: { transform: [{ scale: 0.72 }] },
});
