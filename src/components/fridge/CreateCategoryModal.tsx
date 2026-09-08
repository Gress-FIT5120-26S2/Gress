import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createInventoryCategory, type InventoryCategory } from '../../services/inventoryApi';

type Copy = { aiHint: string; cancel: string; close: string; create: string; creating: string; error: string; example: string; nameLabel: string; placeholder: string; title: string };

// Arthur: NarIyirm
// 中文：分类名称提交后只生成并保存一次图标；返回页面时直接读取持久化 URL，不让 AI 阻塞冰箱首屏。
// EN: A category icon is generated and persisted only once after naming; subsequent page entries read its URL without letting AI block the fridge first paint.
export function CreateCategoryModal({ copy, onClose, onCreated, visible }: { copy: Copy; onClose: () => void; onCreated: (category: InventoryCategory) => void; visible: boolean }) {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || isCreating) return;
    setIsCreating(true); setError(null);
    try { const { category } = await createInventoryCategory(trimmedName); onCreated(category); setName(''); }
    catch { setError(copy.error); }
    finally { setIsCreating(false); }
  };
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}><View style={styles.card}>
    <View style={styles.header}><View style={styles.icon}><Ionicons color="#F58220" name="folder-open-outline" size={25} /></View><View style={styles.heading}><Text style={styles.title}>{copy.title}</Text><Text style={styles.example}>{copy.example}</Text></View><Pressable accessibilityLabel={copy.close} accessibilityRole="button" onPress={onClose} style={styles.close}><Ionicons color="#607169" name="close" size={22} /></Pressable></View>
    <Text style={styles.label}>{copy.nameLabel}</Text><TextInput editable={!isCreating} maxLength={24} onChangeText={(value) => { setName(value); setError(null); }} placeholder={copy.placeholder} placeholderTextColor="#71817A" style={styles.input} value={name} />
    <View style={styles.aiRow}>{isCreating ? <ActivityIndicator color="#147E8C" size="small" /> : <Ionicons color="#147E8C" name="sparkles-outline" size={18} />}<Text style={styles.aiText}>{isCreating ? copy.creating : copy.aiHint}</Text></View>{error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    <View style={styles.actions}><Pressable accessibilityRole="button" disabled={isCreating} onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>{copy.cancel}</Text></Pressable><Pressable accessibilityRole="button" disabled={!name.trim() || isCreating} onPress={() => { void create(); }} style={[styles.create, (!name.trim() || isCreating) && styles.disabled]}>{isCreating ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.createText}>{copy.create}</Text><Ionicons color="#FFFFFF" name="sparkles-outline" size={17} /></>}</Pressable></View>
  </View></KeyboardAvoidingView></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(12, 30, 25, 0.42)' }, card: { padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 }, icon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FFF1E3' }, heading: { flex: 1, minWidth: 0 }, title: { color: '#173D31', fontSize: 20, fontWeight: '900' }, example: { marginTop: 3, color: '#667870', fontSize: 12 }, close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#F0F3F1' },
  label: { marginTop: 22, marginBottom: 7, color: '#3C584F', fontSize: 12, fontWeight: '800' }, input: { minHeight: 52, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#F2F5F3', color: '#173D31', fontSize: 16, fontWeight: '700' }, aiRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 }, aiText: { flex: 1, color: '#47665C', fontSize: 12.5 }, error: { color: '#B83E45', fontSize: 12.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 15 }, cancel: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 13, backgroundColor: '#EEF2F0' }, cancelText: { color: '#536A61', fontWeight: '800' }, create: { minWidth: 112, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18, borderRadius: 13, backgroundColor: '#F58220' }, createText: { color: '#FFFFFF', fontWeight: '900' }, disabled: { opacity: 0.46 },
});
