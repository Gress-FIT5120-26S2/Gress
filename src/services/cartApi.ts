import { requestApi } from './apiClient';

export type CartItem = {
  item_uid: string;
  fridge_uid: string;
  name: string;
  category_uid: string | null;
  preset_uid: string | null;
  quantity: number | null;
  unit: string | null;
  source: 'manual' | 'restock' | 'notification';
  is_checked: boolean;
  created_at: string;
};

export type RestockSuggestion = {
  rule_uid: string;
  name: string;
  unit: string;
  current_quantity: number;
  minimum_quantity: number;
  target_quantity: number;
  preset_uid: string | null;
};

// Arthur: NarIyirm
// 中文：购物车和库存统一通过 requestApi 进入 Express，因此测试/生产地址、Device-ID 和错误处理只维护一份。
// EN: Cart and inventory share requestApi so environment routing, Device-ID, and error handling have one source of truth.
export const fetchCart = () => requestApi<CartItem[]>('/api/cart');

export const addCartItem = (body: {
  name: string;
  quantity?: number;
  unit?: string;
  category_uid?: string;
  preset_uid?: string;
  source?: CartItem['source'];
}) => requestApi<CartItem>('/api/cart', { method: 'POST', body: JSON.stringify(body) });

export const toggleCartItem = (id: string, is_checked: boolean) =>
  requestApi<CartItem>(`/api/cart/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ is_checked }),
  });

export const deleteCartItem = (id: string) =>
  requestApi<void>(`/api/cart/${id}`, { method: 'DELETE' });

export const fetchRestock = async (): Promise<RestockSuggestion[]> => {
  const rows = await requestApi<RestockSuggestion[]>('/api/restock');
  // Arthur: NarIyirm
  // 中文：Postgres numeric 字段可能以字符串返回，在服务边界统一转换，避免页面计算时出现字符串拼接。
  // EN: PostgreSQL numeric fields may arrive as strings, so coerce them at the service boundary before UI arithmetic.
  return rows.map((r) => ({
    ...r,
    current_quantity: Number(r.current_quantity),
    minimum_quantity: Number(r.minimum_quantity),
    target_quantity: Number(r.target_quantity),
  }));
};
