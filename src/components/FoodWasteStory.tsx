import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useI18n } from '../i18n';

const VIDEO = require('../../docs/art-direction/food-waste-animation/kitchmemo-food-waste-visual.mp4');

const copy = {
  zh: {
    title: '为什么做 KitchMemo', close: '关闭动画', replay: '重播',
    shopping: '下班后，\n又带回一袋食材。',
    forgotten: '冰箱深处，\n还有上次的食物。',
    dataIntro: '一项澳大利亚家庭调查估计',
    dataHousehold: '有 35 岁以下成员的家庭',
    dataAmount: '每年丢弃约',
    food: '食物',
    source: '来源：OzHarvest《Half Eaten》2025',
    action: '下次买菜前，\n先看一眼冰箱。',
  },
  en: {
    title: 'Why KitchMemo exists', close: 'Close animation', replay: 'Replay',
    shopping: 'After work,\nwe bring home another bag of food.',
    forgotten: 'Deep in the fridge,\nlast week’s food is still there.',
    dataIntro: 'An Australian household survey estimates',
    dataHousehold: 'households with someone under 35',
    dataAmount: 'throw away about',
    food: 'of food each year',
    source: 'Source: OzHarvest, Half Eaten (2025)',
    action: 'Before the next shop,\ncheck the fridge first.',
  },
} as const;

// Arthur: NarIyirm
// 中文：字幕时间沿用 24 fps 分镜的帧位；语言只改变文字，不重启画面或改变统计数据。
// EN: Cue times follow the 24 fps animatic; changing language updates copy without restarting the video or changing its data.
function activeCue(seconds: number) {
  const frame = seconds * 24 + 1;
  if (frame >= 25 && frame < 190) return 'shopping';
  if (frame >= 220 && frame < 388) return 'forgotten';
  if (frame >= 406 && frame < 546) return 'data';
  if (frame >= 585 && frame < 841) return 'action';
  return null;
}

export function FoodWasteStory({ onClose }: { onClose: () => void }) {
  const { language } = useI18n();
  const t = copy[language];
  const [seconds, setSeconds] = useState(0);
  const [ended, setEnded] = useState(false);
  const { width, height } = useWindowDimensions();
  const videoWidth = Math.min(width, (height - 140) * 720 / 1280, 490);
  const player = useVideoPlayer(VIDEO, (instance) => {
    instance.timeUpdateEventInterval = 0.1;
    instance.play();
  });

  useEffect(() => {
    const time = player.addListener('timeUpdate', ({ currentTime }) => setSeconds(currentTime));
    const end = player.addListener('playToEnd', () => setEnded(true));
    return () => { time.remove(); end.remove(); };
  }, [player]);

  const cue = activeCue(seconds);
  const replay = () => {
    player.currentTime = 0;
    setSeconds(0);
    setEnded(false);
    player.play();
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.title}</Text>
          <Pressable accessibilityLabel={t.close} accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Ionicons color="#173B31" name="close" size={24} />
          </Pressable>
        </View>
        <View style={[styles.videoFrame, { width: videoWidth }]}>
          <VideoView contentFit="contain" nativeControls={false} player={player} style={styles.video} surfaceType="textureView" />
          {cue === 'shopping' || cue === 'forgotten' || cue === 'action' ? (
            <View accessibilityLiveRegion="polite" pointerEvents="none" style={styles.captionCard}>
              <View style={styles.accent} />
              <Text style={styles.caption}>{t[cue]}</Text>
            </View>
          ) : null}
          {cue === 'data' ? (
            <View accessibilityLiveRegion="polite" pointerEvents="none" style={styles.dataCard}>
              <Text style={styles.dataIntro}>{t.dataIntro}</Text>
              <Text style={styles.dataHousehold}>{t.dataHousehold}</Text>
              <Text style={styles.dataAmount}>{t.dataAmount}</Text>
              <Text style={styles.dataNumber}>113 kg</Text>
              <Text style={styles.dataFood}>{t.food}</Text>
              <Text style={styles.source}>{t.source}</Text>
            </View>
          ) : null}
          {ended ? (
            <Pressable accessibilityRole="button" onPress={replay} style={styles.replay}>
              <Ionicons color="#173B31" name="refresh" size={18} />
              <Text style={styles.replayText}>{t.replay}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: '#173B31', paddingTop: 48, paddingBottom: 24 },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { color: '#FFF8E8', fontSize: 17, fontWeight: '800' },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8E8' },
  videoFrame: { alignSelf: 'center', aspectRatio: 720 / 1280, position: 'relative' },
  video: { width: '100%', height: '100%' },
  captionCard: { position: 'absolute', top: '8%', left: '6%', right: '6%', minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 20, backgroundColor: 'rgba(255,252,245,0.93)' },
  accent: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: '#EB8F45' },
  caption: { flex: 1, color: '#1C4236', fontSize: 24, lineHeight: 32, fontWeight: '800' },
  dataCard: { position: 'absolute', top: '14%', left: '6%', right: '6%', padding: 22, borderRadius: 24, backgroundColor: 'rgba(18,57,47,0.94)' },
  dataIntro: { color: '#D2EBDC', fontSize: 15, lineHeight: 21 },
  dataHousehold: { color: '#FFFFF7', fontSize: 22, lineHeight: 29, fontWeight: '800', marginTop: 18 },
  dataAmount: { color: '#FFFFF7', fontSize: 18, marginTop: 14 },
  dataNumber: { color: '#FFBE69', fontSize: 64, lineHeight: 76, fontWeight: '900', marginTop: 6 },
  dataFood: { color: '#FFFFF7', fontSize: 22, fontWeight: '800' },
  source: { color: '#D5E2D5', fontSize: 12, lineHeight: 17, marginTop: 26 },
  replay: { position: 'absolute', bottom: 30, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, backgroundColor: '#FFF8E8' },
  replayText: { color: '#173B31', fontSize: 16, fontWeight: '800' },
});
