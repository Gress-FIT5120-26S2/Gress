import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useI18n } from '../i18n';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../services/notificationApi';
import { enableSystemNotificationDelivery } from '../services/systemNotifications';

type EditablePreferences = Omit<NotificationPreferences, 'updatedAt'>;

type NotificationSettingsModalProps = {
  onClose: () => void;
  onOpenInbox: () => void;
  visible: boolean;
};

function dateFromTime(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function timeFromDate(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Arthur: NarIyirm
// 中文：通知设置使用独立全屏层，开关即时保存到当前设备；免打扰只压低首页角标，不把通知历史标成已读。
// EN: Notification settings use a dedicated full-screen layer with immediate device-scoped saves; quiet hours suppress the home badge without marking history as read.
export function NotificationSettingsModal({ onClose, onOpenInbox, visible }: NotificationSettingsModalProps) {
  const { language, t } = useI18n();
  const copy = t.profile.notificationSettings;
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [savingCount, setSavingCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setPreferences(await fetchNotificationPreferences());
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [load, visible]);

  const deviceTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  );

  // Arthur: NarIyirm
  // 中文：先做即时视觉反馈，再只 PATCH 改动字段；失败时重新读取服务端快照，避免并发点按留下假状态。
  // EN: Apply instant visual feedback, then PATCH only changed fields; on failure, reload the server snapshot so rapid taps cannot leave false state.
  const save = useCallback(async (patch: Partial<EditablePreferences>) => {
    if (!preferences) return;
    setPreferences((current) => (current ? { ...current, ...patch, timeZone: deviceTimeZone } : current));
    setSaveFailed(false);
    setSavingCount((count) => count + 1);
    try {
      await updateNotificationPreferences({ ...patch, timeZone: deviceTimeZone });
    } catch {
      setSaveFailed(true);
      void fetchNotificationPreferences().then(setPreferences).catch(() => undefined);
    } finally {
      setSavingCount((count) => Math.max(0, count - 1));
    }
  }, [deviceTimeZone, preferences]);

  const openInbox = () => {
    onClose();
    onOpenInbox();
  };

  const toggleSystemDelivery = async (value: boolean) => {
    if (!value) {
      await save({ systemDeliveryEnabled: false });
      return;
    }
    const result = await enableSystemNotificationDelivery(language);
    if (result.granted) {
      await save({ systemDeliveryEnabled: true });
      return;
    }
    Alert.alert(copy.permissionDeniedTitle, copy.permissionDeniedBody, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.openSystemSettings, onPress: () => { void Linking.openSettings(); } },
    ]);
  };

  const enabled = preferences?.notificationsEnabled ?? false;

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <View style={styles.screen}>
        <View style={styles.navigationBar}>
          <Pressable
            accessibilityLabel={copy.back}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons color="#168ACB" name="chevron-back" size={25} />
            <Text style={styles.backText}>{copy.back}</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.navigationTitle}>{copy.title}</Text>
          <View style={styles.navigationStatus}>
            {savingCount > 0 ? <ActivityIndicator color="#168ACB" size="small" /> : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#168ACB" />
            <Text style={styles.stateText}>{copy.loading}</Text>
          </View>
        ) : loadFailed || !preferences ? (
          <View style={styles.stateBox}>
            <Ionicons color="#5D7A70" name="cloud-offline-outline" size={31} />
            <Text style={styles.stateTitle}>{copy.loadError}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retryButton}>
              <Text style={styles.retryText}>{copy.retry}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {saveFailed ? (
              <View accessibilityLiveRegion="polite" style={styles.errorBanner}>
                <Ionicons color="#B04950" name="alert-circle-outline" size={18} />
                <Text style={styles.errorText}>{copy.saveError}</Text>
              </View>
            ) : null}

            <SettingsGroup>
              <SwitchRow
                detail={copy.masterDetail}
                isLast
                onValueChange={(value) => { void save({ notificationsEnabled: value }); }}
                title={copy.masterTitle}
                value={preferences.notificationsEnabled}
              />
            </SettingsGroup>

            <SectionLabel>{copy.deliverySection}</SectionLabel>
            <SettingsGroup>
              <SwitchRow
                detail={copy.systemDeliveryDetail}
                disabled={!enabled}
                onValueChange={(value) => { void toggleSystemDelivery(value); }}
                title={copy.systemDeliveryTitle}
                value={preferences.systemDeliveryEnabled}
              />
              <SwitchRow
                detail={copy.badgeDetail}
                disabled={!enabled}
                onValueChange={(value) => { void save({ badgesEnabled: value }); }}
                title={copy.badgeTitle}
                value={preferences.badgesEnabled}
              />
              <SwitchRow
                detail={copy.quietDetail}
                disabled={!enabled || !preferences.badgesEnabled}
                isLast={!preferences.quietHoursEnabled}
                onValueChange={(value) => { void save({ quietHoursEnabled: value }); }}
                title={copy.quietTitle}
                value={preferences.quietHoursEnabled}
              />
              {preferences.quietHoursEnabled ? (
                <View style={[styles.timeRows, (!enabled || !preferences.badgesEnabled) && styles.disabled]}>
                  <TimeRow
                    label={copy.startTitle}
                    onChange={(time) => { void save({ quietHoursStart: time }); }}
                    value={preferences.quietHoursStart}
                  />
                  <TimeRow
                    isLast
                    label={copy.endTitle}
                    onChange={(time) => { void save({ quietHoursEnd: time }); }}
                    value={preferences.quietHoursEnd}
                  />
                </View>
              ) : null}
            </SettingsGroup>

            <SectionLabel>{copy.typesSection}</SectionLabel>
            <SettingsGroup>
              <SwitchRow
                detail={copy.freshnessDetail}
                disabled={!enabled}
                onValueChange={(value) => { void save({ expiringEnabled: value }); }}
                title={copy.freshnessTitle}
                value={preferences.expiringEnabled}
              />
              <SwitchRow
                detail={copy.restockDetail}
                disabled={!enabled}
                onValueChange={(value) => { void save({ restockEnabled: value }); }}
                title={copy.restockTitle}
                value={preferences.restockEnabled}
              />
              <SwitchRow
                detail={copy.sharedDetail}
                disabled={!enabled}
                onValueChange={(value) => { void save({ sharedEnabled: value }); }}
                title={copy.sharedTitle}
                value={preferences.sharedEnabled}
              />
              <SwitchRow
                detail={copy.systemDetail}
                disabled={!enabled}
                isLast
                onValueChange={(value) => { void save({ systemEnabled: value }); }}
                title={copy.systemTitle}
                value={preferences.systemEnabled}
              />
            </SettingsGroup>

            <SectionLabel>{copy.historySection}</SectionLabel>
            <SettingsGroup>
              <DisclosureRow
                detail={copy.historyDetail}
                onPress={openInbox}
                title={copy.historyTitle}
              />
            </SettingsGroup>

            <Text style={styles.footer}>{copy.footer}</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SwitchRow({ detail, disabled = false, isLast = false, onValueChange, title, value }: {
  detail: string;
  disabled?: boolean;
  isLast?: boolean;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
}) {
  return (
    <View style={[styles.settingRow, !isLast && styles.divider, disabled && styles.disabled]}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDetail}>{detail}</Text>
      </View>
      <Switch
        accessibilityLabel={`${title}. ${detail}`}
        disabled={disabled}
        ios_backgroundColor="#C8D4D0"
        onValueChange={onValueChange}
        thumbColor="#FFFFFF"
        trackColor={{ false: '#C8D4D0', true: '#36A978' }}
        value={value}
      />
    </View>
  );
}

function TimeRow({ isLast = false, label, onChange, value }: {
  isLast?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [androidPickerVisible, setAndroidPickerVisible] = useState(false);
  const picker = (
    <DateTimePicker
      display={Platform.OS === 'ios' ? 'compact' : 'default'}
      mode="time"
      onChange={(event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') setAndroidPickerVisible(false);
        if (event.type === 'set' && date) onChange(timeFromDate(date));
      }}
      themeVariant="light"
      value={dateFromTime(value)}
    />
  );

  return (
    <>
      <Pressable
        accessibilityLabel={`${label} ${value}`}
        accessibilityRole="button"
        onPress={Platform.OS === 'android' ? () => setAndroidPickerVisible(true) : undefined}
        style={({ pressed }) => [styles.timeRow, !isLast && styles.divider, pressed && styles.rowPressed]}
      >
        <Text style={styles.settingTitle}>{label}</Text>
        {Platform.OS === 'ios' ? picker : <Text style={styles.timeValue}>{value}</Text>}
      </Pressable>
      {Platform.OS === 'android' && androidPickerVisible ? picker : null}
    </>
  );
}

function DisclosureRow({ detail, onPress, title }: { detail: string; onPress: () => void; title: string }) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
    >
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDetail}>{detail}</Text>
      </View>
      <Ionicons color="#789087" name="chevron-forward" size={19} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F2F7F5' },
  navigationBar: { minHeight: Platform.OS === 'ios' ? 104 : 76, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingBottom: 12, backgroundColor: 'rgba(247,251,250,0.97)' },
  backButton: { width: 112, minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  backText: { marginLeft: -3, color: '#168ACB', fontSize: 15, fontWeight: '600' },
  navigationTitle: { flex: 1, paddingBottom: 11, color: '#183E32', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  navigationStatus: { width: 112, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 12 },
  pressed: { opacity: 0.56 },
  content: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 46 },
  group: { overflow: 'hidden', borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  sectionLabel: { marginTop: 26, marginBottom: 8, paddingHorizontal: 14, color: '#4C6A60', fontSize: 13, fontWeight: '700' },
  settingRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 11 },
  settingCopy: { flex: 1, minWidth: 0 },
  settingTitle: { color: '#203F35', fontSize: 16, fontWeight: '600' },
  settingDetail: { marginTop: 3, color: '#647A72', fontSize: 12, lineHeight: 17 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D7E4E0' },
  disabled: { opacity: 0.42 },
  timeRows: { backgroundColor: '#F9FCFB' },
  timeRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 16, paddingRight: 12 },
  timeValue: { minWidth: 78, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, overflow: 'hidden', color: '#168ACB', fontSize: 16, fontWeight: '700', textAlign: 'center', backgroundColor: '#E8F4F8' },
  rowPressed: { backgroundColor: '#EDF6F3' },
  footer: { marginTop: 12, paddingHorizontal: 14, color: '#657B73', fontSize: 11.5, lineHeight: 17 },
  errorBanner: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#FBECEC' },
  errorText: { flex: 1, color: '#984047', fontSize: 12, lineHeight: 17 },
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 34 },
  stateText: { color: '#5D756C', fontSize: 14 },
  stateTitle: { color: '#264A3E', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  retryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4, paddingHorizontal: 18, borderRadius: 13, backgroundColor: '#168ACB' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
