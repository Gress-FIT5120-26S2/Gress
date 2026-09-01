import { supabase } from '../src/supabase.js';
import {
  CLOUDFLARE_ICON_MODEL,
  ICON_PROMPT_VERSION,
  generateFoodPresetIcon,
} from '../src/services/foodPresetAi.js';

const ICON_BUCKET = 'food-preset-icons';

async function uploadPresetIcon(preset) {
  const iconBuffer = await generateFoodPresetIcon(preset.canonical_name);
  const iconPath = `generated/${preset.preset_uid}/v${ICON_PROMPT_VERSION}.png`;
  const uploadResult = await supabase.storage
    .from(ICON_BUCKET)
    .upload(iconPath, iconBuffer, {
      cacheControl: '31536000',
      contentType: 'image/png',
      upsert: false,
    });
  if (uploadResult.error && !uploadResult.error.message.toLowerCase().includes('already exists')) {
    throw uploadResult.error;
  }

  const { error } = await supabase
    .from('food_presets')
    .update({
      generation_model: CLOUDFLARE_ICON_MODEL,
      generation_prompt_version: ICON_PROMPT_VERSION,
      icon_path: iconPath,
      icon_source: 'ai_generated',
    })
    .eq('preset_uid', preset.preset_uid)
    .is('icon_path', null);
  if (error) throw error;
}

async function main() {
  const { data: presets, error } = await supabase
    .from('food_presets')
    .select('preset_uid, canonical_name')
    .eq('is_enabled', true)
    .is('icon_path', null)
    .order('created_at');
  if (error) throw error;

  // Arthur: NarIyirm
  // 中文：顺序生成可控制免费额度和 GPU 并发；每条成功后立即落库，脚本中断后可安全重跑剩余项。
  // EN: Sequential generation controls free quota and GPU concurrency; each success is persisted immediately so an interrupted run safely resumes remaining presets.
  for (const preset of presets ?? []) {
    process.stdout.write(`Generating icon for ${preset.canonical_name}... `);
    await uploadPresetIcon(preset);
    console.log('done');
  }

  console.log(`Preset icon backfill complete: ${presets?.length ?? 0} generated.`);
}

main().catch((error) => {
  console.error('Preset icon backfill failed:', error.message);
  process.exitCode = 1;
});
