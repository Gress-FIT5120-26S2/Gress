import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { FridgeAccessContext } from '../../services/sharingApi';

type FridgeSpaceMenuProps = {
  context: FridgeAccessContext | null;
  failed: boolean;
  loading: boolean;
  onClose: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onManage: () => void;
  onRetry: () => void;
  visible: boolean;
};

// Arthur: NarIyirm
// 中文：这个锚定弹层只展示当前唯一冰箱及共享入口，不制造个人与家庭冰箱可并存切换的错觉。
// EN: This anchored menu shows the one active fridge and sharing entry points without implying personal and family fridges coexist as switchable stores.
export function FridgeSpaceMenu({
  context,
  failed,
  loading,
  onClose,
  onCreate,
  onJoin,
  onManage,
  onRetry,
  visible,
}: FridgeSpaceMenuProps) {
  const { t } = useI18n();
  const copy = t.fridge.sharing;
  const isShared = context?.fridge.mode === 'shared';

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={styles.root}>
        <Pressable accessibilityLabel={copy.close} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.pointer} />
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{copy.spaceTitle}</Text>
          {loading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator color="#168ACB" />
              <Text style={styles.stateText}>{copy.loading}</Text>
            </View>
          ) : failed || !context ? (
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
              <Ionicons color="#168ACB" name="refresh-outline" size={19} />
              <Text style={styles.retryText}>{copy.retry}</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.selectedRow}>
                <View style={styles.personalIcon}>
                  <MaterialCommunityIcons color="#167FB7" name="fridge-outline" size={25} />
                </View>
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.rowTitle}>{isShared ? context.fridge.name : copy.personal}</Text>
                  <Text style={styles.rowSubtitle}>{isShared ? copy.sharedMeta(context.fridge.memberCount) : copy.personalSubtitle}</Text>
                </View>
                <View style={styles.checkCircle}><Ionicons color="#FFFFFF" name="checkmark" size={18} /></View>
              </View>

              <View style={styles.familyRow}>
                <View style={styles.familyIcon}><Ionicons color="#168ACB" name="people-outline" size={24} /></View>
                <View style={styles.rowCopy}>
                  <View style={styles.familyTitleRow}>
                    <Text style={styles.rowTitle}>{copy.family}</Text>
                    {!isShared ? <Text style={styles.tag}>{copy.notEnabled}</Text> : null}
                  </View>
                  <Text style={styles.familyDescription}>{copy.familyDescription}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={isShared ? onManage : onCreate} style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}>
                  <Text style={styles.primaryText}>{isShared ? copy.manage : copy.create}</Text>
                </Pressable>
                {!isShared ? (
                  <Pressable accessibilityRole="button" onPress={onJoin} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}>
                    <Text style={styles.secondaryText}>{copy.join}</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(25, 49, 62, 0.14)' },
  pointer: { position: 'absolute', top: 107, left: 54, width: 16, height: 16, transform: [{ rotate: '45deg' }], backgroundColor: '#FFFFFF' },
  panel: { position: 'absolute', top: 114, left: 16, width: '82%', maxWidth: 320, padding: 12, borderRadius: 20, borderCurve: 'continuous', backgroundColor: '#FFFFFF', boxShadow: '0 14px 28px rgba(30, 75, 98, 0.18)' },
  panelTitle: { marginBottom: 8, color: '#6B8190', fontSize: 12, fontWeight: '700' },
  stateRow: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 8 },
  stateText: { color: '#6B8190', fontSize: 12 },
  selectedRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: '#B9E3F7', borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#EEF9FE' },
  personalIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#DDF3FC' },
  familyIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E4F6FD' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#234657', fontSize: 14, fontWeight: '800' },
  rowSubtitle: { marginTop: 2, color: '#718896', fontSize: 10.5 },
  checkCircle: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#168ACB' },
  familyRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10 },
  familyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  familyDescription: { marginTop: 2, color: '#718896', fontSize: 10.5, lineHeight: 14 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9, overflow: 'hidden', color: '#168ACB', fontSize: 9, fontWeight: '800', backgroundColor: '#E5F6FD' },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DDEAF0' },
  primaryButton: { minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#168ACB' },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  secondaryButton: { minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#EDF8FD' },
  secondaryText: { color: '#167FB7', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  retryButton: { minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 16, backgroundColor: '#F1F9FC' },
  retryText: { color: '#167FB7', fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.78 },
});
