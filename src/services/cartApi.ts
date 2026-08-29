// src/services/cartApi.ts
// Client for both sides of the shopping screen:
//   - the editable cart  (shopping_cart_items)
//   - the derived restock suggestions (get_restock_suggestions)
// Uses the SAME base URL and device header convention as src/api.ts, so the
// whole app points at one backend and the server reads one header name.
import { getDeviceId } from './deviceId';

// Same source as api.ts. On a real device this must be your machine's LAN IP
// (e.g. http://192.168.x.x:3000), set in the app's env as EXPO_PUBLIC_API_URL.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured');
  const deviceId = await getDeviceId();
  // NOTE: header name matches api.ts ('Device-ID'). The server routers must
  // read this same header when resolving fridge membership.
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Device-ID': deviceId,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

// --- editable cart ---
export const fetchCart = () => request<CartItem[]>('/api/cart');

export const addCartItem = (body: {
  name: string;
  quantity?: number;
  unit?: string;
  category_uid?: string;
  preset_uid?: string;
  source?: CartItem['source'];
}) => request<CartItem>('/api/cart', { method: 'POST', body: JSON.stringify(body) });

export const toggleCartItem = (id: string, is_checked: boolean) =>
  request<CartItem>(`/api/cart/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ is_checked }),
  });

export const deleteCartItem = (id: string) =>
  request<void>(`/api/cart/${id}`, { method: 'DELETE' });

// --- derived restock suggestions ---
export const fetchRestock = async (): Promise<RestockSuggestion[]> => {
  const rows = await request<RestockSuggestion[]>('/api/restock');
  // numeric columns can arrive as strings from Postgres; coerce for arithmetic
  return rows.map((r) => ({
    ...r,
    current_quantity: Number(r.current_quantity),
    minimum_quantity: Number(r.minimum_quantity),
    target_quantity: Number(r.target_quantity),
  }));
};