import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import { learningColors as c } from './learningTheme';

export function LearningLoadingModal({ onClose, closeLabel, failed = false, onRetry }: { onClose: () => void; closeLabel?: string; failed?: boolean; onRetry?: () => void }) {
  const { t } = useI18n();
  return <Modal visible presentationStyle="fullScreen" animationType="none" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background, paddingHorizontal: 24 }}>
      <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 52, justifyContent: 'center' }}><Text style={{ color: c.learningGreenReadable }}>{closeLabel ?? t.learning.close}</Text></Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {failed ? <><Text style={{ color: c.textPrimary }}>{t.learning.errorTitle}</Text><Text style={{ color: c.textSecondaryReadable }}>{t.learning.errorBody}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.learningGreenReadable }}>{t.learning.retry}</Text></Pressable></>
          : <><ActivityIndicator color={c.learningGreen} /><Text style={{ color: c.textPrimary }}>{t.learning.loading}</Text></>}
      </View>
    </SafeAreaView>
  </Modal>;
}
