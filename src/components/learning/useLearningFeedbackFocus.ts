import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, ScrollView, type LayoutChangeEvent } from 'react-native';

// Arthur: NarIyirm
// 中文：答案反馈完成布局后才滚动，普通测验与投放练习共用；同题刷新不抢回滚动位置，切题或离开时丢弃旧定位。
// EN: Scroll only after answer feedback lays out, shared by quizzes and sorting practice; refreshes never reclaim scrolling and stale targets are discarded on question changes or exit.
export function useLearningFeedbackFocus(feedbackKey: string | null) {
  const scrollRef = useRef<ScrollView>(null);
  const target = useRef<{ key: string; y: number } | null>(null);
  const session = useRef({ key: feedbackKey, focused: false });
  const frame = useRef<number | null>(null);
  const reducedMotion = useRef(true);
  if (session.current.key !== feedbackKey) session.current = { key: feedbackKey, focused: false };

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) reducedMotion.current = value; }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reducedMotion.current = value; });
    return () => {
      alive = false;
      subscription.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const revealFeedback = useCallback(() => {
    if (!feedbackKey || session.current.key !== feedbackKey || session.current.focused || target.current?.key !== feedbackKey) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    // Arthur: NarIyirm
    // 中文：等待这一帧内容高度提交，避免原生 ScrollView 用新增反馈前的最大偏移量截断滚动。
    // EN: Wait for this frame's content height to commit so native ScrollView does not clamp against the extent from before feedback appeared.
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const location = target.current;
      if (!location || location.key !== feedbackKey || session.current.key !== feedbackKey || session.current.focused || !scrollRef.current) return;
      scrollRef.current.scrollTo({ y: Math.max(0, location.y - 12), animated: !reducedMotion.current });
      session.current.focused = true;
    });
  }, [feedbackKey]);

  const onFeedbackLayout = useCallback((event: LayoutChangeEvent) => {
    if (!feedbackKey || session.current.key !== feedbackKey) return;
    target.current = { key: feedbackKey, y: event.nativeEvent.layout.y };
    revealFeedback();
  }, [feedbackKey, revealFeedback]);

  return { scrollRef, onFeedbackLayout, onContentSizeChange: revealFeedback };
}
