import { useTabActive, TabModal as Modal } from './RetainedTab';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer, type VideoPlayerStatus } from 'expo-video';
import { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import timeline from '../../assets/story/food-waste/timeline.json';
import { useI18n } from '../i18n';

const VIDEO = require('../../assets/story/food-waste/kitchmemo-food-waste-linear-60s.mp4');
const POSTER = require('../../assets/story/food-waste/poster.png');
const DURATION = timeline.durationSeconds;
const SOURCE = timeline.sourceUrl;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type LocalizedCopy = { eyebrow?: string; number?: string; headline?: string; body?: string; source?: string };
type Cue = { id: string; start: number; end: number; source?: boolean; zh: LocalizedCopy; en: LocalizedCopy };
const CUES = timeline.segments as Cue[];

const labels = {
  zh: {
    close: '关闭动画', play: '播放', pause: '暂停', replay: '重播', source: '查看研究来源',
    paused: '已暂停 · 点击画面继续', ended: '播放完毕 · 点击画面重播',
    loading: '正在准备动画…', failed: '动画暂时无法播放', retry: '重试播放',
    reduced: '静态摘要', watch: '仍要观看动画',
    summary: 'OzHarvest 2025 年调查估计：有 35 岁以下成员的澳大利亚家庭，每年约丢弃 113 kg 食物，价值超过 A$1,500。下次购物前，先看看家里已有的食物。',
  },
  en: {
    close: 'Close animation', play: 'Play', pause: 'Pause', replay: 'Replay', source: 'View research source',
    paused: 'Paused · tap to continue', ended: 'Finished · tap to replay',
    loading: 'Preparing animation…', failed: 'The animation could not play', retry: 'Try again',
    reduced: 'Story summary', watch: 'Watch the animation anyway',
    summary: 'OzHarvest estimates that Australian households with someone under 35 discard about 113 kg of food each year, worth over A$1,500. Before your next shop, check what you already have.',
  },
} as const;

function cueAt(time: number): Cue | null {
  return CUES.find(cue => time >= cue.start && time < cue.end) ?? (time >= DURATION ? CUES[CUES.length - 1] : null);
}

const CueCard = memo(function CueCard({ cue, language, reducedMotion }: { cue: Cue; language: 'zh' | 'en'; reducedMotion: boolean }) {
  const content = cue[language];
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const numberEntrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      numberEntrance.setValue(1);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(entrance, { toValue: 1, duration: 340, easing: EASE_OUT, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(70),
        Animated.timing(numberEntrance, { toValue: 1, duration: 420, easing: EASE_OUT, useNativeDriver: true }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [entrance, numberEntrance, reducedMotion]);

  const cardStyle = { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] };
  const numberStyle = { opacity: numberEntrance, transform: [{ translateY: numberEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] };
  const dark = cue.id === 'weight';
  const bottom = cue.id === 'opening' || cue.id === 'forgotten' || cue.id === 'habits' || cue.id === 'action';

  return (
    <Animated.View pointerEvents="box-none" style={[styles.card, bottom ? styles.bottomCard : styles.topCard, dark && styles.darkCard, cardStyle]}>
      {content.eyebrow ? <Text style={[styles.eyebrow, dark && styles.lightText]}>{content.eyebrow}</Text> : null}
      {content.number ? (
        <View style={styles.numberMask}>
          <Animated.Text adjustsFontSizeToFit numberOfLines={1} style={[styles.number, cue.id === 'cost' && styles.costNumber, numberStyle]}>{content.number}</Animated.Text>
        </View>
      ) : null}
      {content.headline ? <Text style={[styles.headline, dark && styles.lightText]}>{content.headline}</Text> : null}
      {content.body ? <Text style={[styles.body, dark && styles.lightText]}>{content.body}</Text> : null}
      {content.source ? (
        cue.id === 'action' ? (
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(SOURCE); }} style={styles.sourceHit}>
            <Text style={[styles.source, dark && styles.lightText, styles.sourceLink]}>{content.source}</Text>
          </Pressable>
        ) : <Text style={[styles.source, dark && styles.lightText]}>{content.source}</Text>
      ) : null}
    </Animated.View>
  );
});

export function LinearFoodWasteStory({ onClose }: { onClose: () => void }) {
  const tabActive = useTabActive();
  const { language } = useI18n();
  const t = labels[language];
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sceneWidth = Math.min(width, height * 540 / 960);
  const sceneHeight = sceneWidth * 960 / 540;
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [userRequestedVideo, setUserRequestedVideo] = useState(false);
  const [status, setStatus] = useState<VideoPlayerStatus>('loading');
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const [activeCue, setActiveCue] = useState<Cue | null>(null);
  const autoStartedRef = useRef(false);
  // Arthur: NarIyirm
  // 中文：拖动进度时暂停解码，松手后只恢复原本正在播放的视频。
  // EN: Pause during scrubbing and resume only when playback was running before the drag.
  const resumeAfterScrubRef = useRef(false);
  const currentCueRef = useRef<string | null>(null);
  const player = useVideoPlayer(VIDEO, instance => {
    instance.loop = false;
    instance.muted = true;
    instance.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    setStatus(player.status);
  }, [player]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReducedMotion(enabled);
    }).catch(() => {
      if (mounted) setReducedMotion(false);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (tabActive && status === 'readyToPlay' && (reducedMotion === false || userRequestedVideo) && !autoStartedRef.current) {
      autoStartedRef.current = true;
      player.play();
    }
  }, [player, reducedMotion, status, userRequestedVideo, tabActive]);

  useEffect(() => {
    if (!tabActive || reducedMotion && !userRequestedVideo) player.pause();
  }, [player, reducedMotion, userRequestedVideo, tabActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') player.pause();
    });
    return () => subscription.remove();
  }, [player]);

  useEventListener(player, 'statusChange', ({ status: next }) => setStatus(next));
  useEventListener(player, 'playingChange', ({ isPlaying }) => setPlaying(isPlaying));
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const next = Math.max(0, Math.min(DURATION, currentTime));
    setPosition(next);
    // Arthur: NarIyirm
    // 中文：进度条按低频原生事件更新，字幕只在跨越段落边界时切换。
    // EN: Progress follows low-rate native events while copy changes only when crossing a cue boundary.
    const cue = cueAt(next);
    if ((cue?.id ?? null) !== currentCueRef.current) {
      currentCueRef.current = cue?.id ?? null;
      setActiveCue(cue);
    }
  });
  useEventListener(player, 'playToEnd', () => {
    setPlaying(false);
    setPosition(DURATION);
    setActiveCue(CUES[CUES.length - 1]);
  });

  const close = () => {
    player.pause();
    onClose();
  };
  const togglePlayback = () => {
    if (playing) player.pause();
    else {
      if (position >= DURATION - .1) player.currentTime = 0;
      player.play();
    }
  };
  const retry = () => {
    setFirstFrameReady(false);
    setStatus('loading');
    autoStartedRef.current = false;
    setUserRequestedVideo(true);
    void player.replaceAsync(VIDEO).catch(() => setStatus('error'));
  };
  const showVideo = reducedMotion === false || userRequestedVideo;
  const showSummary = status === 'error' || (reducedMotion === true && !userRequestedVideo);
  const visibleTime = scrubPosition ?? position;
  const cue = activeCue ?? cueAt(visibleTime);
  const ended = position >= DURATION - .1;
  const paused = showVideo && status === 'readyToPlay' && !playing && autoStartedRef.current && scrubPosition === null;
  const cueAtTop = cue?.id === 'weight' || cue?.id === 'cost';
  const timeLabel = `${Math.floor(visibleTime / 60).toString().padStart(2, '0')}:${Math.floor(visibleTime % 60).toString().padStart(2, '0')} / 01:00`;

  return (
    <Modal animationType="fade" onRequestClose={close} presentationStyle="fullScreen" visible>
      <View style={styles.screen}>
        <View style={[styles.scene, { width: sceneWidth, height: sceneHeight }]}>
          <Image source={POSTER} resizeMode="stretch" style={styles.media} />
          {showVideo && status !== 'error' ? (
            <VideoView
              contentFit="fill"
              nativeControls={false}
              onFirstFrameRender={() => setFirstFrameReady(true)}
              player={player}
              style={styles.media}
              surfaceType="textureView"
            />
          ) : null}
          {!firstFrameReady && showVideo ? <Image source={POSTER} resizeMode="stretch" style={styles.media} /> : null}
          {showVideo && status === 'readyToPlay' ? <Pressable accessibilityLabel={playing ? t.pause : ended ? t.replay : t.play} accessibilityRole="button" onPress={togglePlayback} style={styles.mediaTap} /> : null}
          {showVideo && cue && status !== 'error' ? <CueCard key={`${cue.id}:${language}`} cue={cue} language={language} reducedMotion={reducedMotion === true} /> : null}
          {paused ? (
            <View pointerEvents="none" style={[styles.pauseNotice, cueAtTop ? styles.pauseNoticeLow : styles.pauseNoticeHigh]}>
              <View style={styles.pauseIcon}><Ionicons color="#F8F4EB" name={ended ? 'refresh' : 'play'} size={34} /></View>
              <Text style={styles.pauseLabel}>{ended ? t.ended : t.paused}</Text>
            </View>
          ) : null}
          {showSummary ? (
            <View style={styles.summary}>
              <Text style={styles.summaryEyebrow}>{status === 'error' ? t.failed : t.reduced}</Text>
              <Text style={styles.summaryBody}>{t.summary}</Text>
              <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(SOURCE); }} style={styles.summaryLinkHit}>
                <Text style={styles.summaryLink}>{t.source}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={status === 'error' ? retry : () => setUserRequestedVideo(true)} style={styles.summaryButton}>
                <Text style={styles.summaryButtonText}>{status === 'error' ? t.retry : t.watch}</Text>
              </Pressable>
            </View>
          ) : null}
          {showVideo && status === 'loading' && !firstFrameReady ? <Text style={styles.loading}>{t.loading}</Text> : null}

          <Pressable accessibilityLabel={t.source} accessibilityRole="link" onPress={() => { void Linking.openURL(SOURCE); }} style={[styles.topButton, { top: Math.max(18, insets.top) }, styles.infoButton]}>
            <Ionicons color="#19261f" name="information-circle-outline" size={23} />
          </Pressable>
          <Pressable accessibilityLabel={t.close} accessibilityRole="button" onPress={close} style={[styles.topButton, { top: Math.max(18, insets.top) }, styles.closeButton]}>
            <Ionicons color="#19261f" name="close" size={23} />
          </Pressable>

          {showVideo && status !== 'error' ? (
            <View style={[styles.progressArea, { bottom: Math.max(8, insets.bottom + 4) }]}>
              {(paused || scrubPosition !== null) ? <Text style={styles.timeLabel}>{timeLabel}</Text> : null}
              <View pointerEvents="none" style={[styles.progressTrack, cueAtTop && styles.progressTrackOnDark]}>
                <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, visibleTime / DURATION * 100))}%` }]} />
              </View>
              <Slider
                accessibilityLabel={language === 'zh' ? '播放进度' : 'Playback progress'}
                maximumValue={DURATION}
                minimumTrackTintColor="transparent"
                minimumValue={0}
                maximumTrackTintColor="transparent"
                onSlidingStart={() => { resumeAfterScrubRef.current = playing; player.pause(); }}
                onValueChange={setScrubPosition}
                onSlidingComplete={value => {
                  player.currentTime = value;
                  setPosition(value);
                  setScrubPosition(null);
                  const next = cueAt(value);
                  currentCueRef.current = next?.id ?? null;
                  setActiveCue(next);
                  if (resumeAfterScrubRef.current) player.play();
                }}
                style={styles.slider}
                thumbTintColor="#F8F4EB"
                value={visibleTime}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFEDE5' },
  scene: { position: 'relative', overflow: 'hidden', backgroundColor: '#EFEDE5' },
  media: { position: 'absolute', width: '100%', height: '100%' },
  mediaTap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  pauseNotice: { position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: 9 },
  pauseNoticeHigh: { top: '32%' },
  pauseNoticeLow: { top: '65%' },
  pauseIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F2B26C9' },
  pauseLabel: { color: '#F8F4EB', backgroundColor: '#1F2B26D9', fontSize: 13, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  card: { position: 'absolute', left: '8%', right: '8%', paddingHorizontal: 15, paddingTop: 18, paddingBottom: 20, backgroundColor: '#EFEDE5F5', borderLeftWidth: 3, borderTopWidth: 2, borderColor: '#D87553' },
  topCard: { top: '17%' },
  bottomCard: { bottom: '22%' },
  darkCard: { backgroundColor: '#202825F5', borderColor: '#ED9A78' },
  eyebrow: { color: '#213126', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  numberMask: { overflow: 'hidden', marginTop: 9 },
  number: { color: '#D87553', fontSize: 52, fontWeight: '900', letterSpacing: -2, lineHeight: 58 },
  costNumber: { fontSize: 37, lineHeight: 43 },
  headline: { color: '#1B2922', fontSize: 22, fontWeight: '800', lineHeight: 28 },
  body: { color: '#1B2922', fontSize: 16, fontWeight: '600', lineHeight: 23, marginTop: 7 },
  source: { color: '#39483D', fontSize: 12, lineHeight: 17, marginTop: 11 },
  sourceLink: { textDecorationLine: 'underline' },
  sourceHit: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  lightText: { color: '#F2EFE6' },
  topButton: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F1E9E8', alignItems: 'center', justifyContent: 'center' },
  infoButton: { left: 18 },
  closeButton: { right: 18 },
  progressArea: { position: 'absolute', left: 18, right: 18, height: 82, justifyContent: 'flex-end' },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 20, height: 4, borderRadius: 4, backgroundColor: '#24342B75', overflow: 'visible' },
  progressTrackOnDark: { backgroundColor: '#DFE8DB8C' },
  progressFill: { height: 4, borderRadius: 4, backgroundColor: '#FFFDF6', shadowColor: '#F8C59E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 8, elevation: 4 },
  timeLabel: { position: 'absolute', bottom: 47, alignSelf: 'center', color: '#F8F4EB', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], backgroundColor: '#1F2B26D9', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9, overflow: 'hidden' },
  slider: { width: '100%', height: 44 },
  loading: { position: 'absolute', alignSelf: 'center', top: '49%', color: '#26352B', fontSize: 14, fontWeight: '700', backgroundColor: '#EFEDE5E8', padding: 10 },
  summary: { position: 'absolute', left: '8%', right: '8%', top: '26%', padding: 22, backgroundColor: '#F5F1E9F5', borderTopWidth: 3, borderTopColor: '#D87553' },
  summaryEyebrow: { color: '#B56348', fontSize: 14, fontWeight: '800', marginBottom: 13 },
  summaryBody: { color: '#213126', fontSize: 18, lineHeight: 27, fontWeight: '600' },
  summaryLinkHit: { minHeight: 44, justifyContent: 'center', marginTop: 10, alignSelf: 'flex-start' },
  summaryLink: { color: '#315E45', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  summaryButton: { backgroundColor: '#23352A', borderRadius: 12, minHeight: 46, marginTop: 13, alignItems: 'center', justifyContent: 'center' },
  summaryButtonText: { color: '#F5F1E9', fontSize: 15, fontWeight: '800' },
});
