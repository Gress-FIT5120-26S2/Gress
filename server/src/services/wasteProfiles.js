import { randomUUID } from 'node:crypto';
import { supabase } from '../supabase.js';
import { generateFoodPresetIcon, generateWasteProfileMetadata, GEMINI_PRESET_MODEL } from './foodPresetAi.js';

import { WASTE_MATERIALS } from './wasteMaterialCatalog.js';
export { WASTE_MATERIALS } from './wasteMaterialCatalog.js';

export function validateWasteProfile(value) {
  if (!Array.isArray(value) || value.length > 4) throw new Error('Choose up to four waste components.');
  const seen = new Set();
  return value.map((component) => {
    if (!component || !Object.hasOwn(WASTE_MATERIALS, component.material)
      || !['per_unit', 'when_empty'].includes(component.trigger) || seen.has(component.material)) {
      throw new Error('Invalid waste component.');
    }
    seen.add(component.material);
    return { material: component.material, trigger: component.trigger };
  });
}

export function wasteProfileKey(name, unit) {
  return JSON.stringify([name.trim().toLocaleLowerCase(), unit]);
}

export async function suggestWasteProfile(name, unit) {
  const key = wasteProfileKey(name, unit);
  const { data, error } = await supabase.from('product_waste_suggestions').select('profile, needs_confirmation').eq('suggestion_key', key).maybeSingle();
  if (error) throw error;
  if (data) return { profile: data.profile, needsConfirmation: data.needs_confirmation, cached: true };
  const metadata = await generateWasteProfileMetadata(name, unit, Object.keys(WASTE_MATERIALS));
  const profile = validateWasteProfile(metadata.profile);
  const needsConfirmation = metadata.needsConfirmation !== false || profile.some((part) => part.material === 'unknown');
  const result = await supabase.from('product_waste_suggestions').upsert({ suggestion_key: key, profile, needs_confirmation: needsConfirmation, model: GEMINI_PRESET_MODEL }, { onConflict: 'suggestion_key', ignoreDuplicates: true });
  if (result.error) throw result.error;
  return { profile, needsConfirmation, cached: false };
}

export async function getWasteMaterialAssets(materials) {
  if (!materials.length) return {};
  const { data, error } = await supabase.from('waste_material_assets').select('material_code, icon_path').in('material_code', materials);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.material_code, row.icon_path ? supabase.storage.from('food-preset-icons').getPublicUrl(row.icon_path).data.publicUrl : null]));
}

// Arthur: NarIyirm
// 中文：仅录入阶段生成共享材质图标；数据库租约和固定路径使同材质跨商品、跨设备复用。
// EN: Generate shared material icons only during entry; database leases and stable paths reuse them across products and devices.
export async function prepareWasteMaterialAssets(profile) {
  const materials = [...new Set(profile.map((part) => part.material))];
  await Promise.all(materials.map(async (material) => {
    const subject = WASTE_MATERIALS[material]?.subject;
    if (!subject) return;
    const token = randomUUID();
    const { data: claimed, error } = await supabase.rpc('claim_waste_material_icon', { p_material: material, p_token: token });
    if (error) throw error;
    if (!claimed) return;
    try {
      const image = await generateFoodPresetIcon(subject, { waste: true });
      const path = `waste-materials/${material}/v1.png`;
      const upload = await supabase.storage.from('food-preset-icons').upload(path, image, { upsert: false, contentType: 'image/png', cacheControl: '31536000' });
      if (upload.error && !upload.error.message.toLowerCase().includes('already exists')) throw upload.error;
      const saved = await supabase.from('waste_material_assets').update({ icon_path: path, generation_state: 'ready', lease_until: null }).eq('material_code', material).eq('generation_token', token);
      if (saved.error) throw saved.error;
    } catch (error) {
      console.error('Waste material icon unavailable:', material, error?.message);
      await supabase.from('waste_material_assets').update({ generation_state: 'missing', lease_until: null }).eq('material_code', material).eq('generation_token', token);
    }
  }));
  return getWasteMaterialAssets(materials);
}
