// src/services/cartApi.ts
// Cart + restock endpoints. Reuses the shared requestApi client (Device-ID,
// base URL, error handling) so every service module goes through one place.
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

// --- editable cart ---
// Arthur: NarIyirm
// 中文：购物车页面读取当前 fridgeUid 的共享清单；服务端按未购买优先和创建时间排序。
// EN: The cart screen reads the current fridgeUid's shared list, ordered by unchecked state and creation time on the server.
export const fetchCart = () => requestApi<CartItem[]>('/api/cart');

// Arthur: NarIyirm
// 中文：手动或补货建议从这里创建购物项；手动项会记录 owner_device_id，便于退出共享时随设备迁移。
// EN: Manual entry or restock suggestions create cart items here; manual items receive owner_device_id so they can follow a device leaving sharing.
export const addCartItem = (body: {
  name: string;
  quantity?: number;
  unit?: string;
  category_uid?: string;
  preset_uid?: string;
  source?: CartItem['source'];
}) => requestApi<CartItem>('/api/cart', { method: 'POST', body: JSON.stringify(body) });

// Arthur: NarIyirm
// 中文：数量编辑映射到 cart.js 的 quantity 路由；数量为零时应调用删除而不是这个函数。
// EN: Quantity edits map to cart.js's quantity route; callers delete the item instead of sending zero here.
export const updateCartQuantity = (id: string, quantity: number) =>
  requestApi<CartItem>(`/api/cart/${id}/quantity`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });

// Arthur: NarIyirm
// 中文：勾选状态属于整个冰箱并同步给所有成员；后端同时记录操作者和完成时间。
// EN: Checked state belongs to the fridge and syncs to every member; the backend also records the actor and completion time.
export const toggleCartItem = (id: string, is_checked: boolean) =>
  requestApi<CartItem>(`/api/cart/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ is_checked }),
  });

// Arthur: NarIyirm
// 中文：删除共享购物项并返回 204；requestApi 会把无响应体正常转换为 void。
// EN: This deletes a shared cart item and receives 204; requestApi converts the empty response to void.
export const deleteCartItem = (id: string) =>
  requestApi<void>(`/api/cart/${id}`, { method: 'DELETE' });

// --- derived restock suggestions ---
// Arthur: NarIyirm
// 中文：补货页调用数据库 get_restock_suggestions RPC 的派生结果；这里把 PostgreSQL numeric 字符串统一转成 number。
// EN: The restock page reads derived get_restock_suggestions results and normalizes PostgreSQL numeric strings to numbers here.
export const fetchRestock = async (): Promise<RestockSuggestion[]> => {
  const rows = await requestApi<RestockSuggestion[]>('/api/restock');
  // numeric columns can arrive as strings from Postgres; coerce for arithmetic
  return rows.map((r: RestockSuggestion) => ({
    ...r,
    current_quantity: Number(r.current_quantity),
    minimum_quantity: Number(r.minimum_quantity),
    target_quantity: Number(r.target_quantity),
  }));
};
