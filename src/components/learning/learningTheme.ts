import { StyleSheet, type TextStyle } from 'react-native';

export const learningColors = {
  background: '#F7FBFA',
  surface: '#FFFFFF',
  textPrimary: '#173D31',
  textSecondary: '#70827A',
  border: '#DDECE6',
  learningGreen: '#2A8A61',
  mintSurface: '#EAF6F1',
  mintStrong: '#E0F3EA',
  actionOrange: '#F58220',
  skySurface: '#EAF7FD',
  skyText: '#24566E',
  error: '#B5454D',
  // Arthur: NarIyirm
  // 中文：保留批准的品牌色；小字号正文、绿色链接和白字按钮使用对比度达标的同色系变体。
  // EN: Preserve approved brand colours; use matching accessible variants for small copy, green links and white-label buttons.
  textSecondaryReadable: '#64756D',
  learningGreenReadable: '#237B55',
  actionOrangeReadable: '#BE570A',
} as const;

export const learningSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, card: 18, page: 24, section: 32, spacious: 40,
} as const;

export const learningRadii = { option: 14, card: 16, button: 18 } as const;

export const learningLayout = {
  pageGutter: 24,
  narrowPageGutter: 18,
  narrowWidth: 360,
  minimumTouchTarget: 44,
  buttonMinHeight: 52,
  optionMinHeight: 56,
  heroMinHeight: 185,
  heroMaxHeight: 210,
  coverAspectRatio: 2,
  quizImageSize: 150,
  completionSealSize: 120,
} as const;

export const learningMotion = { enterMs: 200, selectionMs: 150, pressedOpacity: 0.84 } as const;

export const learningTypography = {
  title: { fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: -0.7 },
  section: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.3 },
  question: { fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  option: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
  subtitle: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
  eyebrow: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1.3 },
  button: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  statistic: { fontSize: 56, lineHeight: 64, fontWeight: '800', letterSpacing: -1 },
} as const satisfies Record<string, TextStyle>;

// Arthur: NarIyirm
// 中文：这里只提供静态视觉基准；屏幕组件仍需按安全区和字体缩放安排滚动内容，不在 tokens 固定屏幕高度。
// EN: These are static visual primitives; screens still arrange scrolling content around safe areas and text scaling, without a fixed screen height.
export const learningStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: learningColors.background },
  pageContent: { paddingHorizontal: learningLayout.pageGutter, gap: learningSpacing.page },
  title: { ...learningTypography.title, color: learningColors.textPrimary },
  sectionTitle: { ...learningTypography.section, color: learningColors.textPrimary },
  body: { ...learningTypography.body, color: learningColors.textPrimary },
  secondary: { ...learningTypography.subtitle, color: learningColors.textSecondaryReadable },
  caption: { ...learningTypography.caption, color: learningColors.textSecondaryReadable },
  eyebrow: { ...learningTypography.eyebrow, color: learningColors.learningGreenReadable },
  primaryButton: {
    minHeight: learningLayout.buttonMinHeight,
    paddingHorizontal: learningSpacing.card,
    paddingVertical: learningSpacing.md,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: learningRadii.button, borderCurve: 'continuous',
    backgroundColor: learningColors.actionOrangeReadable,
  },
  primaryButtonLabel: { ...learningTypography.button, color: learningColors.surface },
  option: {
    minHeight: learningLayout.optionMinHeight,
    paddingHorizontal: learningSpacing.lg, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: learningSpacing.md,
    borderWidth: 1, borderColor: learningColors.border,
    borderRadius: learningRadii.option, borderCurve: 'continuous',
    backgroundColor: learningColors.surface,
  },
  selectedOption: { borderColor: learningColors.learningGreen, backgroundColor: learningColors.mintSurface },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: learningColors.border },
  pressed: { opacity: learningMotion.pressedOpacity },
});
