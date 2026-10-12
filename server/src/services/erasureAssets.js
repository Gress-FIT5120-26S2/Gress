// Arthur: NarIyirm
// 中文：删除数据库身份时原子记录图标清理任务；立即尝试与每日受保护任务共用幂等队列，失败不丢失待删除资产。
// EN: Identity erasure atomically queues icon cleanup; immediate and protected daily attempts share an idempotent queue so failures never lose pending assets.
export async function cleanupErasureAssets(database) {
  const { data, error } = await database.from('erasure_asset_queue')
    .select('icon_path').order('queued_at').limit(100);
  if (error) throw new Error('erasure_queue_unavailable');
  const paths = (data ?? []).map(row => row.icon_path);
  if (!paths.length) return { removed: 0 };
  const { error: storageError } = await database.storage.from('food-preset-icons').remove(paths);
  if (storageError) throw new Error('erasure_storage_unavailable');
  const { error: deleteError } = await database.from('erasure_asset_queue').delete().in('icon_path', paths);
  if (deleteError) throw new Error('erasure_queue_unavailable');
  return { removed: paths.length };
}
