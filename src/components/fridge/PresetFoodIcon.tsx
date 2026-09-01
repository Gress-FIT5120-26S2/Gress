import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

type PresetFoodIconProps = {
  emoji: string;
  iconUrl?: string | null;
  size: 'card' | 'detail';
};

// Arthur: NarIyirm
// 中文：列表、详情和确认弹窗共用同一远程 preset 图标与 Emoji 回退逻辑，避免各页面再次按分类显示不同图标。
// EN: Lists, details, and confirmation sheets share the same remote preset icon and emoji fallback so category defaults cannot diverge between views.
export const PresetFoodIcon = memo(function PresetFoodIcon({ emoji, iconUrl, size }: PresetFoodIconProps) {
  const [iconFailed, setIconFailed] = useState(false);
  useEffect(() => setIconFailed(false), [iconUrl]);

  if (!iconUrl || iconFailed) {
    return <Text style={size === 'card' ? styles.cardEmoji : styles.detailEmoji}>{emoji}</Text>;
  }

  return (
    <Image
      accessible={false}
      cachePolicy="memory-disk"
      contentFit="contain"
      onError={() => setIconFailed(true)}
      recyclingKey={iconUrl}
      source={{ uri: iconUrl }}
      style={size === 'card' ? styles.cardImage : styles.detailImage}
      transition={120}
    />
  );
});

const styles = StyleSheet.create({
  cardEmoji: { fontSize: 24 },
  cardImage: { width: 36, height: 36 },
  detailEmoji: { fontSize: 40 },
  detailImage: { width: 64, height: 64 },
});
