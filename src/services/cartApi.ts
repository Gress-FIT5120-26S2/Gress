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
export const fetchCart = () => requestApi<CartItem[]>('/api/cart');

export const addCartItem = (body: {
  name: string;
  quantity?: number;
  unit?: string;
  category_uid?: string;
  preset_uid?: string;
  source?: CartItem['source'];
}) => requestApi<CartItem>('/api/cart', { method: 'POST', body: JSON.stringify(body) });

export const updateCartQuantity = (id: string, quantity: number) =>
  requestApi<CartItem>(`/api/cart/${id}/quantity`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });

export const toggleCartItem = (id: string, is_checked: boolean) =>
  requestApi<CartItem>(`/api/cart/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ is_checked }),
  });

export const deleteCartItem = (id: string) =>
  requestApi<void>(`/api/cart/${id}`, { method: 'DELETE' });

// --- derived restock suggestions ---
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