import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import { prepareWasteMaterials, suggestWasteProfile, type WasteComponent, type WasteMaterial } from '../../services/wasteLearningApi';

const MATERIALS: Array<{ code: WasteMaterial; zh: string; en: string }> = [
  { code: 'eggshell', zh: '鸡蛋壳', en: 'Eggshell' },
  { code: 'organic_residue', zh: '果皮／天然残余物', en: 'Peels / natural residue' },
  { code: 'aluminium_can', zh: '铝罐', en: 'Aluminium can' },
  { code: 'plastic_bottle', zh: '塑料瓶', en: 'Plastic bottle' },
  { code: 'glass_container', zh: '玻璃瓶／罐', en: 'Glass bottle / jar' },
  { code: 'paper_cardboard', zh: '干净纸／纸盒', en: 'Clean paper / cardboard' },
  { code: 'rigid_plastic', zh: '硬塑料盒／托盘', en: 'Rigid plastic tub / tray' },
  { code: 'soft_plastic', zh: '软塑料袋／薄膜', en: 'Soft bag / film' },
  { code: 'carton', zh: '复合饮料纸盒', en: 'Composite drink carton' },
  { code: 'other', zh: '其他', en: 'Other' },
  { code: 'unknown', zh: '暂不确定', en: 'Not sure yet' },
];

type Props = { name: string; unit: string; enabled: boolean; initialProfile?: WasteComponent[] | null; initialName?: string; initialUnit?: string; onChange: (profile: WasteComponent[] | null, ready: boolean) => void };

export function WasteProfileSection({ name, unit, enabled, initialProfile, initialName, initialUnit, onChange }: Props) {
  const { language } = useI18n();
  const zh = language === 'zh';
  const [profile, setProfile] = useState<WasteComponent[] | null>(null);
  const [suggested, setSuggested] = useState<WasteComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [assets, setAssets] = useState<Partial<Record<WasteMaterial, string | null>>>({});
  const revision = useRef(0);
  const counted = ['item', 'bag', 'bottle', 'box'].includes(unit);

  // Arthur: NarIyirm
  // 中文：录入草稿更名或换单位时重新建议；忽略旧请求，保留同名同单位的已保存包装，人工选择不会被 AI 覆盖。
  // EN: Re-suggest after draft name/unit changes, ignore stale responses, preserve saved profiles, and never overwrite a manual choice.
  useEffect(() => {
    const current = ++revision.current;
    setProfile(null); setAssets({}); setSuggested([]); setFallback(false); setEditing(false); setPreparing(false);
    if (!enabled || !name.trim()) { setLoading(false); return; }
    if (initialProfile && name.trim() === initialName?.trim() && unit === initialUnit) {
      setPreparing(initialProfile.length > 0); setProfile(initialProfile); setLoading(false); return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void suggestWasteProfile(name.trim(), unit).then((result) => {
        if (current !== revision.current) return;
        setSuggested(result.profile);
        setFallback(Boolean(result.fallback));
        if (result.needsConfirmation) setEditing(true);
        else { setPreparing(result.profile.length > 0); setProfile(result.profile); }
      }).catch(() => {
        if (current === revision.current) { setFallback(true); setEditing(true); }
      }).finally(() => { if (current === revision.current) setLoading(false); });
    }, 900);
    return () => { clearTimeout(timer); revision.current++; };
  }, [enabled, initialName, initialProfile, initialUnit, name, unit]);

  // Arthur: NarIyirm
  // 中文：用户选定材质后才预备共享图标；失败时允许固定回退图标，使用后绝不调用生成接口。
  // EN: Prepare shared icons only for selected materials; failures permit a stable fallback and consumption never calls generation.
  useEffect(() => {
    let active = true;
    if (!profile?.length) { setPreparing(false); return; }
    setPreparing(true);
    const timer = setTimeout(() => {
      void prepareWasteMaterials(profile).then((result) => { if (active) setAssets(result.assets); })
        .catch(() => { if (active) setFallback(true); })
        .finally(() => { if (active) setPreparing(false); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [profile]);

  useEffect(() => { onChange(profile, profile !== null && !loading && !preparing); }, [loading, onChange, preparing, profile]);

  const select = (next: WasteComponent[]) => {
    revision.current++;
    setLoading(false); setPreparing(next.length > 0); setProfile(next); setSuggested(next);
  };
  const toggle = (material: WasteMaterial) => {
    const current = profile ?? suggested;
    const next = current.some((part) => part.material === material)
      ? current.filter((part) => part.material !== material)
      : current.length < 4 ? [...current, { material, trigger: counted ? 'per_unit' as const : 'when_empty' as const }] : current;
    select(next);
  };

  return <View style={styles.section}>
    <View style={styles.heading}><Text style={styles.title}>{zh ? '包装与丢弃物' : 'Packaging & residue'}</Text><Pressable accessibilityRole="button" onPress={() => setEditing(!editing)} hitSlop={8}><Text style={styles.change}>{zh ? '修改' : 'Change'}</Text></Pressable></View>
    <Text style={styles.hint}>{loading ? (zh ? 'AI 正在判断材质…' : 'AI is checking the materials…') : profile === null ? (zh ? '包装不确定，请选择实物的材质。' : 'Packaging is uncertain. Choose the actual material.') : (zh ? '已为使用后的分类保存；相同材质共用图标。' : 'Saved for sorting after use; matching materials share one icon.')}</Text>
    {loading || preparing ? <View style={styles.busy}><ActivityIndicator size="small" color="#277351" /><Text style={styles.hint}>{preparing ? (zh ? '正在准备分类图标…' : 'Preparing sorting artwork…') : ''}</Text></View> : null}
    {(profile ?? suggested).map((part) => <View key={part.material} style={styles.component}>
      {assets[part.material] ? <Image source={{ uri: assets[part.material]! }} style={styles.image} /> : null}
      <View style={styles.componentCopy}><Text style={styles.label}>{MATERIALS.find((option) => option.code === part.material)?.[zh ? 'zh' : 'en']}</Text>
        <Pressable accessibilityRole="button" onPress={() => select((profile ?? suggested).map((item) => item.material === part.material ? { ...item, trigger: counted && item.trigger === 'when_empty' ? 'per_unit' : 'when_empty' } : item))}>
          <Text style={styles.change}>{part.trigger === 'per_unit' && counted ? (zh ? '每用完一个完整单位' : 'Each complete stored unit') : (zh ? '整批用完时' : 'When the whole batch is empty')}{counted ? ' ▾' : ''}</Text>
        </Pressable>
      </View>
    </View>)}
    {profile?.length === 0 ? <Text style={styles.label}>{zh ? '没有包装或丢弃物' : 'No packaging or residue'}</Text> : null}
    {editing ? <>
      <Text style={styles.hint}>{zh ? '最多选 4 项；每项可调整触发时机。' : 'Choose up to 4 components; adjust timing for each.'}</Text>
      <View style={styles.options}>{MATERIALS.map((option) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: (profile ?? suggested).some((part) => part.material === option.code) }} key={option.code} onPress={() => toggle(option.code)} style={[styles.chip, (profile ?? suggested).some((part) => part.material === option.code) && styles.chipSelected]}><Text style={styles.chipText}>{option[zh ? 'zh' : 'en']}</Text></Pressable>)}</View>
      {profile === null && suggested.length > 0 ? <Pressable accessibilityRole="button" onPress={() => select(suggested)} style={styles.noWaste}><Text style={styles.change}>{zh ? '确认这些材质' : 'Confirm these materials'}</Text></Pressable> : null}
      <Pressable accessibilityRole="button" onPress={() => select([])} style={styles.noWaste}><Text style={styles.change}>{zh ? '没有包装或丢弃物' : 'No packaging or residue'}</Text></Pressable>
    </> : null}
    {fallback ? <Text style={styles.hint}>{zh ? '建议或图片暂不可用；可手动选择并使用备用图标。' : 'Advice or artwork is unavailable; manual choices and fallback icons are available.'}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 20, padding: 15, borderRadius: 16, backgroundColor: '#F0F6F1', gap: 9 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700', color: '#244B39' },
  hint: { fontSize: 12, lineHeight: 18, color: '#607568' },
  change: { color: '#277351', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  component: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  componentCopy: { flex: 1, gap: 3 },
  image: { width: 42, height: 42 },
  label: { fontSize: 13, fontWeight: '600', color: '#244B39' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#CCDCD0', backgroundColor: '#FFFFFF' },
  chipSelected: { backgroundColor: '#DCECDD', borderColor: '#619A71' },
  chipText: { color: '#244B39', fontSize: 12 },
  noWaste: { minHeight: 44, justifyContent: 'center' },
});
