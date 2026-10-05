import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import { learningColors as c } from './learningTheme';

export function LearningLoadingModal({ onClose, closeLabel, failed = false, onRetry, embedded = false }: { onClose: () => void; closeLabel?: string; failed?: boolean; onRetry?: () => void; embedded?: boolean }) {
  const { t } = useI18n();
  // Arthur: NarIyirm
  // 中文：导航页的加载／失败视图留在页面内，并在模块尚未就绪时接管 Android 返回；视频仍用全屏 Modal。
  // EN: Tab loading/error stays inline and handles Android Back before the module is ready; video retains its full-screen modal.
  useEffect(() => {
    if (!embedded) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [embedded, onClose]);
  const body = <SafeAreaView edges={embedded ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.background, paddingHorizontal: 24 }}>
      {embedded ? null : <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 52, justifyContent: 'center' }}><Text style={{ color: c.learningGreenReadable }}>{closeLabel ?? t.learning.close}</Text></Pressable>}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {failed ? <><Text style={{ color: c.textPrimary }}>{t.learning.errorTitle}</Text><Text style={{ color: c.textSecondaryReadable }}>{t.learning.errorBody}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.learningGreenReadable }}>{t.learning.retry}</Text></Pressable></>
          : <><ActivityIndicator color={c.learningGreen} /><Text style={{ color: c.textPrimary }}>{t.learning.loading}</Text></>}
      </View>
    </SafeAreaView>;
  return embedded ? body : <Modal visible presentationStyle="fullScreen" animationType="none" onRequestClose={onClose}>{body}</Modal>;
}
