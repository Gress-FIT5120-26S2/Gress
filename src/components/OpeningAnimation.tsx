import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

type OpeningAnimationProps = {
  canReveal: boolean;
  onSequenceComplete: () => void;
  onFinish: () => void;
};
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Arthur: NarIyirm
// 中文：每项食材携带位置与错峰时间，统一驱动“冰箱食材进入菜谱”的效果。
// EN: Each ingredient carries its position and delay to drive the fridge-to-recipe sequence.
const ingredients = [
  { emoji: '🥬', top: 126, left: 40, delay: 0, y: 28 },
  { emoji: '🍅', top: 206, left: 102, delay: 55, y: -18 },
  { emoji: '🍋', top: 290, left: 43, delay: 110, y: -2 },
];

type IngredientProps = (typeof ingredients)[number] & { progress: Animated.Value };

function Ingredient({ emoji, top, left, y, progress }: IngredientProps) {
  const opacity = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const translateX = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0, 104] });
  const translateY = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [14, 0, y] });
  const scale = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0.92, 1, 0.86] });

  return (
    <Animated.View style={[styles.ingredient, { top, left, opacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
      <Text style={styles.ingredientEmoji}>{emoji}</Text>
    </Animated.View>
  );
}

export function OpeningAnimation({ canReveal, onSequenceComplete, onFinish }: OpeningAnimationProps) {
  const door = useRef(new Animated.Value(0)).current;
  const recipe = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;
  const ingredientProgress = useRef(ingredients.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let cancelled = false;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;

    const start = async () => {
      const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (cancelled) return;

      if (reducedMotion) {
        door.setValue(1);
        recipe.setValue(1);
        wordmark.setValue(1);
        ingredientProgress.forEach((value) => value.setValue(1));
        finishTimer = setTimeout(onSequenceComplete, 160);
        return;
      }

      // Arthur: NarIyirm
      // 中文：只把位移、缩放和透明度交给 React Native 原生驱动，避开会导致 Expo Go 闪退的 Worklets 初始化。
      // EN: Send only translation, scale, and opacity to the React Native native driver, bypassing the Worklets initialization that crashes Expo Go.
      const ingredientAnimations = ingredientProgress.map((value, index) => Animated.sequence([
        Animated.delay(ingredients[index].delay + 280),
        Animated.timing(value, { toValue: 1, duration: 360, easing: EASE_OUT, useNativeDriver: true }),
        Animated.delay(430),
        Animated.timing(value, { toValue: 2, duration: 360, easing: EASE_OUT, useNativeDriver: true }),
      ]));

      Animated.parallel([
        Animated.timing(door, { toValue: 1, delay: 660, duration: 520, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(recipe, { toValue: 1, delay: 980, duration: 440, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(wordmark, { toValue: 1, delay: 1350, duration: 320, easing: EASE_OUT, useNativeDriver: true }),
        ...ingredientAnimations,
      ]).start();

      // Arthur: NarIyirm
      // 中文：主体动画完成后停在最终画面，通知 App 可以安全创建 3D 画布。
      // EN: Hold the completed scene and tell the app it can safely create the 3D canvas.
      finishTimer = setTimeout(onSequenceComplete, 1780);
    };

    start();
    return () => {
      cancelled = true;
      door.stopAnimation();
      recipe.stopAnimation();
      wordmark.stopAnimation();
      ingredientProgress.forEach((value) => value.stopAnimation());
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [door, ingredientProgress, onSequenceComplete, recipe, wordmark]);

  useEffect(() => {
    if (!canReveal) return;

    let isMounted = true;
    // Arthur: NarIyirm
    // 中文：只有厨房完成首次绘制后才淡出开场层，用户进入首页时直接看到完整模型。
    // EN: Fade the opener only after the kitchen presents its first frame so the completed model is immediately visible.
    Animated.timing(overlay, { toValue: 0, duration: 240, easing: EASE_OUT, useNativeDriver: true }).start(({ finished }) => {
      if (finished && isMounted) onFinish();
    });

    return () => {
      isMounted = false;
      overlay.stopAnimation();
    };
  }, [canReveal, onFinish, overlay]);

  const doorTranslateX = door.interpolate({ inputRange: [0, 1], outputRange: [0, -124] });
  const recipeTranslateY = recipe.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const recipeScale = recipe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const wordmarkTranslateY = wordmark.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={[styles.overlay, { opacity: overlay }]} pointerEvents="auto">
      <View style={styles.ambientGlow} />
      <View style={styles.scene}>
        <View style={styles.fridgeShell}>
          <Animated.View style={[styles.door, { transform: [{ translateX: doorTranslateX }] }]}>
            <View style={styles.doorInset} />
            <View style={styles.doorHandle} />
          </Animated.View>
          <View style={styles.fridgeInterior}>
            <View style={styles.shelf} />
            <View style={[styles.shelf, styles.secondShelf]} />
            {ingredients.map((ingredient, index) => <Ingredient key={ingredient.emoji} {...ingredient} progress={ingredientProgress[index]} />)}
          </View>
        </View>
        <Animated.View style={[styles.recipeCard, { opacity: recipe, transform: [{ translateY: recipeTranslateY }, { scale: recipeScale }] }]}>
          <View style={styles.recipeAccent} />
          <Text style={styles.recipeEyebrow}>TONIGHT&apos;S IDEA</Text>
          <Text style={styles.recipeTitle}>Fresh fridge{`\n`}pasta</Text>
          <View style={styles.recipeDetails}><Text style={styles.recipeDetail}>15 min</Text><View style={styles.dot} /><Text style={styles.recipeDetail}>3 ingredients</Text></View>
          <View style={styles.sparkle}><Text style={styles.sparkleText}>✦</Text></View>
        </Animated.View>
      </View>
      <Animated.View style={[styles.wordmark, { opacity: wordmark, transform: [{ translateY: wordmarkTranslateY }] }]}>
        <Text style={styles.brand}>KitchMemo</Text><Text style={styles.tagline}>from fridge to table</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FBF8' }, ambientGlow: { position: 'absolute', top: -100, width: 360, height: 360, borderRadius: 180, backgroundColor: '#D9F0E5', opacity: 0.85 }, scene: { width: 330, height: 405, justifyContent: 'center' },
  fridgeShell: { position: 'absolute', left: 8, top: 12, width: 190, height: 380, borderRadius: 28, backgroundColor: '#BBDCE4', shadowColor: '#1C5262', shadowOpacity: 0.16, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 8 }, fridgeInterior: { flex: 1, overflow: 'hidden', borderRadius: 28, backgroundColor: '#E9F8F6' }, shelf: { position: 'absolute', left: 18, right: 18, top: 192, height: 5, borderRadius: 8, backgroundColor: '#B9D9D7' }, secondShelf: { top: 277 },
  door: { ...StyleSheet.absoluteFill, zIndex: 3, padding: 13, borderRadius: 28, backgroundColor: '#78BCCD' }, doorInset: { flex: 1, borderRadius: 18, backgroundColor: '#A7D9E3', opacity: 0.78 }, doorHandle: { position: 'absolute', right: 14, top: 122, width: 8, height: 108, borderRadius: 8, backgroundColor: '#E7F5F6' }, ingredient: { position: 'absolute', width: 57, height: 57, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', shadowColor: '#285B62', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, ingredientEmoji: { fontSize: 31 },
  recipeCard: { position: 'absolute', right: 0, top: 122, width: 192, minHeight: 192, overflow: 'hidden', padding: 21, borderRadius: 24, backgroundColor: '#FFFFFF', shadowColor: '#29453C', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 }, recipeAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 7, backgroundColor: '#F6B55C' }, recipeEyebrow: { marginTop: 5, color: '#6B8278', fontSize: 10, fontWeight: '700', letterSpacing: 1.1 }, recipeTitle: { marginTop: 9, color: '#173E34', fontSize: 24, fontWeight: '700', lineHeight: 27, letterSpacing: -0.6 }, recipeDetails: { flexDirection: 'row', alignItems: 'center', marginTop: 16 }, recipeDetail: { color: '#6B8278', fontSize: 10, fontWeight: '600' }, dot: { width: 3, height: 3, marginHorizontal: 7, borderRadius: 2, backgroundColor: '#92A69D' }, sparkle: { position: 'absolute', right: 16, top: 18, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FFF1D8' }, sparkleText: { color: '#D78227', fontSize: 16 }, wordmark: { position: 'absolute', bottom: 68, alignItems: 'center' }, brand: { color: '#173E34', fontSize: 28, fontWeight: '700', letterSpacing: -1 }, tagline: { marginTop: 5, color: '#6B8278', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
});
