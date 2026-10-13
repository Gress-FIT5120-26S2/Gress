import { useTabActive, TabModal as Modal } from '../RetainedTab';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import { learningColors as c } from './learningTheme';

export function LearningLoadingModal({ onClose, closeLabel, failed = false, onRetry, embedded = false }: { onClose: () => void; closeLabel?: string; failed?: boolean; onRetry?: () => void; embedded?: boolean }) {
  const { t } = useI18n();
  const active = useTabActive();
  // Arthur: NarIyirm
  // 中文：导航页的加载／失败视图留在页面内，并在模块尚未就绪时接管 Android 返回；视频仍用全屏 Modal。
  // EN: Tab loading/error stays inline and handles Android Back before the module is ready; video retains its full-screen modal.
  useEffect(() => {
    if (!embedded || !active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [embedded, onClose, active]);
  // Arthur: NarIyirm
  // 中文：普通内嵌加载页不显示关闭按钮；动画的外层弹窗传入 closeLabel，加载或失败时仍能退出。
  // EN: Regular inline loading omits Close; the animation's modal supplies closeLabel so loading and failure remain dismissible.
  const body = <SafeAreaView edges={embedded ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.background, paddingHorizontal: 24 }}>
      {embedded && !closeLabel ? null : <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 52, justifyContent: 'center' }}><Text style={{ color: c.learningGreenReadable }}>{closeLabel ?? t.learning.close}</Text></Pressable>}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {failed ? <><Text style={{ color: c.textPrimary }}>{t.learning.errorTitle}</Text><Text style={{ color: c.textSecondaryReadable }}>{t.learning.errorBody}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.learningGreenReadable }}>{t.learning.retry}</Text></Pressable></>
          : <><ActivityIndicator color={c.learningGreen} /><Text style={{ color: c.textPrimary }}>{t.learning.loading}</Text></>}
      </View>
    </SafeAreaView>;
  return embedded ? body : <Modal visible presentationStyle="fullScreen" animationType="none" onRequestClose={onClose}>{body}</Modal>;
}
