import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const noop = () => {};
const baseline = process.argv.includes('--baseline');
const tabActive = React.createContext(true);
let nextModalId = 0;
let mountedModals = [];
let removedModals = [];
let players = [];

// Arthur: NarIyirm
// 中文：执行真实学堂、懒加载与播放器组件，用原生窗口实例编号检查 Suspense 切换；模拟视频事件，不读取设备或请求服务。
// EN: Run the real Learn, lazy-loading and player components, tracking native-window identities across Suspense with simulated video events and no device or service access.
function Modal(props) {
  const active = React.useContext(tabActive);
  const [id] = React.useState(() => ++nextModalId);
  React.useEffect(() => { mountedModals.push(id); return () => removedModals.push(id); }, [id]);
  return React.createElement('NativeModal', { ...props, visible: active && (props.visible ?? true), modalId: id });
}
class AnimatedValue {
  setValue() {}
  interpolate() { return 0; }
}
const animation = () => ({ start: noop, stop: noop });
const native = {
  View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios' }, useWindowDimensions: () => ({ width: 390, height: 844 }),
  StyleSheet: { create: value => value }, Linking: { openURL: noop },
  Animated: { View: 'AnimatedView', Text: 'AnimatedText', Value: AnimatedValue, timing: animation, sequence: animation, parallel: animation, delay: animation },
  Easing: { bezier: noop }, PanResponder: { create: () => ({ panHandlers: {} }) },
  AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove: noop }) },
  AppState: { addEventListener: () => ({ remove: noop }) }, BackHandler: { addEventListener: () => ({ remove: noop }) },
};
function useVideoPlayer(_source, setup) {
  const [player] = React.useState(() => {
    const value = { currentTime: 0, status: 'readyToPlay', playing: false, released: false, playCalls: 0, listeners: new Map(),
      emit(event, payload) { for (const listener of this.listeners.get(event) ?? []) listener(payload); },
      play() { this.playCalls++; this.playing = true; this.emit('playingChange', { isPlaying: true }); },
      pause() { this.playing = false; this.emit('playingChange', { isPlaying: false }); },
      async replaceAsync() { this.status = 'readyToPlay'; this.emit('statusChange', { status: this.status }); },
    };
    setup(value); players.push(value); return value;
  });
  React.useEffect(() => () => { player.released = true; }, [player]);
  return player;
}
function useEventListener(player, event, listener) {
  const latest = React.useRef(listener); latest.current = listener;
  React.useEffect(() => {
    const callbacks = player.listeners.get(event) ?? new Set(); player.listeners.set(event, callbacks);
    const callback = payload => latest.current(payload); callbacks.add(callback);
    return () => callbacks.delete(callback);
  }, [player, event]);
}
async function loadModule(path, extra = {}) {
  const source = baseline ? execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' }) : await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const dependencies = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@react-native-community/slider': 'Slider',
    expo: { useEventListener }, 'expo-video': { VideoView: 'VideoView', useVideoPlayer },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    './RetainedTab': { useTabActive: () => React.useContext(tabActive), TabModal: Modal },
    '../RetainedTab': { useTabActive: () => React.useContext(tabActive), TabModal: Modal },
    '../i18n': { useI18n: () => ({ language: 'en', t }) }, '../../i18n': { useI18n: () => ({ language: 'en', t }) },
    './learningTheme': { learningColors: { background: '#FFFFFF', textPrimary: '#173D31' } }, ...extra,
  };
  new Function('require', 'module', 'exports', output)(name => {
    if (name.endsWith('timeline.json')) return require('../assets/story/food-waste/timeline.json');
    if (name.endsWith('.mp4') || name.endsWith('.png')) return 1;
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const { learningCopy } = await loadModule('src/i18n/learning.ts');
const t = { learning: learningCopy.en };
const story = await loadModule('src/components/LinearFoodWasteStory.tsx');
const loading = await loadModule('src/components/learning/LearningLoadingModal.tsx');
const lazy = await loadModule('src/components/learning/LearningLazyModal.tsx', { './LearningLoadingModal': loading });
const navigation = await loadModule('src/components/learning/learningNavigation.ts');
const gesture = await loadModule('src/components/learning/learningBackGesture.ts');
const Button = ({ label, ...props }) => React.createElement('Pressable', { ...props, accessibilityLabel: label }, label);
const Page = ({ children, footer, ...props }) => React.createElement('LearningPage', props, children, footer);
const flow = await loadModule('src/components/learning/LearningRoomFlow.tsx', {
  './LearningLazyModal': lazy, '../LinearFoodWasteStory': story,
  '../../services/learningGateway': { getLearningErrorCode: () => null },
  './LearningPracticeScreen': { LearningPracticeScreen: 'LearningPracticeScreen' }, './LearningCourseScreen': { LearningCourseScreen: 'LearningCourseScreen' },
  './LearningHub': { LearningHub: 'LearningHub' }, './LearningQuizScreen': { LearningQuizScreen: 'LearningQuizScreen' },
  './LearningResourceScreen': { LearningResourceScreen: 'LearningResourceScreen' }, './LearningResultScreen': { LearningResultScreen: 'LearningResultScreen' },
  './learningNavigation': navigation, './learningBackGesture': gesture,
  './LearningUi': { LearningBody: 'LearningBody', LearningPage: Page, LearningButton: Button, ui: {} },
  './learningViewport': { LearningBottomSafeAreaContext: React.createContext(true), LearningWidthContext: React.createContext(null) },
  './tutor/LearningTutorController': { LearningTutorController: ({ children }) => children },
});
const content = { activities: [{ activityCode: 'video', type: 'video', stageCode: 'beginner', title: { en: 'Animation lesson' }, objective: { en: 'Prevent food waste' }, durationEstimate: { minutes: 1 }, body: [] }], courses: [], resources: [], sources: [], stages: [] };
const session = { completedActivityCodes: [], readResourceCodes: [] };
const gateway = { load: async () => ({ content, session }) };
const props = { gateway, origin: 'tab', embedded: true, initialRoute: { name: 'lesson', activityCode: 'video' }, onClose: noop };
const watch = root => root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === t.learning.watchAnimation);
const windowId = root => root.findByType('NativeModal').props.modalId;
const closeVideo = root => root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Close animation');
async function mountLesson() {
  nextModalId = 0; mountedModals = []; removedModals = []; players = [];
  let renderer;
  await act(async () => { renderer = create(React.createElement(flow.LearningRoomFlow, props)); });
  return renderer;
}
async function open(renderer) {
  act(() => { watch(renderer.root).props.onPress(); });
  const id = windowId(renderer.root);
  assert.ok(renderer.root.findAllByType('Pressable').some(node => typeof node.props.onPress === 'function'));
  await act(async () => {});
  assert.equal(windowId(renderer.root), id, 'Loading and playback must retain the same native window');
  assert.equal(renderer.root.findAllByType('NativeModal').length, 1);
  assert.equal(renderer.root.findAllByType('VideoView').length, 1);
  return players.at(-1);
}
async function dispose(renderer) { await act(async () => { renderer.unmount(); }); }

for (const ended of [false, true]) {
  await test(`Repeat watching after ${ended ? 'finishing' : 'closing midway'} keeps one modal and starts a fresh player without switching tabs`, async () => {
    const renderer = await mountLesson();
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const player = await open(renderer);
        assert.equal(player.currentTime, 0); assert.equal(player.playCalls, 1);
        await act(async () => { player.currentTime = ended ? 60 : 20; player.emit('timeUpdate', { currentTime: player.currentTime }); if (ended) player.emit('playToEnd', {}); });
        await act(async () => { closeVideo(renderer.root).props.onPress(); });
        assert.equal(renderer.root.findAllByType('NativeModal').length, 0);
        assert.equal(player.released, true);
        assert.equal(player.playing, false);
        assert.equal(mountedModals.length, attempt + 1);
        assert.equal(removedModals.length, attempt + 1);
        assert.ok(watch(renderer.root));
      }
    } finally { await dispose(renderer); }
  });
}

await test('Closing while the module is loading leaves the lesson interactive and allows reopening', async () => {
  const renderer = await mountLesson();
  try {
    act(() => { watch(renderer.root).props.onPress(); });
    const cancel = renderer.root.findAllByType('Pressable').find(node => node.findAllByType('Text').some(label => label.children.includes(t.learning.cancel)));
    assert.ok(cancel, 'The loading view must retain a close button');
    act(() => { cancel.props.onPress(); });
    await act(async () => {});
    assert.equal(renderer.root.findAllByType('NativeModal').length, 0);
    await open(renderer);
  } finally { await dispose(renderer); }
});

await test('Standalone Home playback still provides its own modal', async () => {
  let renderer; let closed = 0;
  await act(async () => { renderer = create(React.createElement(story.LinearFoodWasteStory, { onClose: () => { closed++; } })); });
  try {
    assert.equal(renderer.root.findAllByType('NativeModal').length, 1);
    await act(async () => { closeVideo(renderer.root).props.onPress(); });
    assert.equal(closed, 1); assert.equal(players.at(-1).playing, false);
  } finally { await dispose(renderer); }
});
