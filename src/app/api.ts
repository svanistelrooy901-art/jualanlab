/** Client for the JualanLab API (same origin; the session is an HttpOnly cookie). */
import type { Item } from '../domain/items';
import type { Promo, PromoInput } from '../domain/promo';
import type { ItemStore, Order, OrderStatus, StoreSettings } from '../domain/kedai';
import type { Sale } from '../domain/sale';
import type { PriceList } from '../link/types';
import type { Envelopes, SalesSummary } from '../domain/summary';
import type { BizDay } from '../domain/bizday';

export interface Me {
  user: { id: string; email: string; name: string | null };
  shop: { id: string; name: string; plan?: 'free' | 'pos' } | null;
  lastImport: LastImport | null;
}

export interface LastImport {
  id: string;
  sentAt: string;
  receivedAt: string;
  menus: number;
}

export interface DayClose {
  id: string;
  day: string;
  bizDayId: string | null;
  closedAt: string;
  deviceId: string;
  floatSen: number;
  expectedCashSen: number;
  countedCashSen: number;
  totals: { summary: SalesSummary; envelopes: Envelopes };
  note: string;
}

export interface Billing {
  plan: 'free' | 'pos';
  planSince: string | null;
  freeItemLimit: number;
  activeItems: number;
  /** Where to buy the full POS (smeLab), or null when buying is not open here. */
  buyUrl: string | null;
  pricesUrl: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
  /** No answer from the server: no internet, or the request never arrived. */
  get offline(): boolean {
    return this.status === 0;
  }
}

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);

/** Tests swap the network for the real server core. */
export function setFetch(f: Fetch): void {
  fetchImpl = f;
}

export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline');
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty or not JSON (for example a captive portal page) */
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new ApiError(res.ok ? 0 : res.status, res.ok ? 'offline' : 'server_error');
  }
  if (!res.ok) {
    const { error, ...extra } = data;
    throw new ApiError(res.status, typeof error === 'string' ? error : 'server_error', extra);
  }
  return data as T;
}

export const Api = {
  config: () => api<{ googleClientId: string | null; devMode: boolean; prelaunch?: boolean; smelab?: { url: string } | null; pushKey?: string | null }>('GET', '/api/config'),
  pushSubscribe: (endpoint: string) => api<{ ok: true }>('POST', '/api/push', { endpoint }),
  pushUnsubscribe: (endpoint: string) => api<{ ok: true }>('DELETE', '/api/push', { endpoint }),
  pushTest: () => api<{ sent: number }>('POST', '/api/push/test'),
  me: () => api<Me>('GET', '/api/me'),
  startEmail: (email: string, lang: 'ms' | 'en') => api<{ ok: true; devCode?: string }>('POST', '/api/auth/email/start', { email, lang }),
  verifyEmail: (email: string, code: string) => api<Me>('POST', '/api/auth/email/verify', { email, code }),
  google: (credential: string) => api<Me>('POST', '/api/auth/google', { credential }),
  logout: () => api<{ ok: true }>('POST', '/api/auth/logout', {}),
  saveShop: (name: string) => api<Me>('POST', '/api/shop', { name }),
  items: () => api<{ items: Item[]; lastImport: LastImport | null }>('GET', '/api/items'),
  importPrices: (priceList: PriceList) =>
    api<{ added: number; changed: number; same: number; deactivated: number; items: Item[]; lastImport: LastImport | null }>('POST', '/api/items/import', { priceList }),
  addItem: (v: { name: string; category: string | null; priceSen: number }) => api<{ item: Item }>('POST', '/api/items', v),
  updateItem: (id: string, v: Partial<Pick<Item, 'name' | 'category' | 'priceSen' | 'active'>>) => api<{ item: Item }>('PATCH', `/api/items/${encodeURIComponent(id)}`, v),
  sendSale: (sale: Sale) => api<{ status: 'created' | 'exists'; dayId?: string }>('POST', '/api/sales', { sale }),
  voidSale: (id: string, reason: string, voidedAt: string | null) =>
    api<{ status: 'voided' | 'already' }>('POST', `/api/sales/${encodeURIComponent(id)}/void`, { reason, voidedAt }),
  billing: () => api<Billing>('GET', '/api/billing'),
  getSale: (id: string) => api<{ sale: Sale }>('GET', `/api/sales/${encodeURIComponent(id)}`),
  days: () => api<{ days: BizDay[]; open: BizDay | null }>('GET', '/api/days'),
  openDay: (v: { id: string; openedAt: string; floatSen: number; deviceId: string; lastSeenDayId: string | null }) =>
    api<{ day: BizDay; joined: boolean }>('POST', '/api/days/open', v),
  day: (id: string) => api<{ day: BizDay; sales: Sale[]; closes: DayClose[] }>('GET', `/api/days/${encodeURIComponent(id)}`),
  closeDay: (id: string, v: { floatSen: number; countedCashSen: number; note: string; deviceId: string }) =>
    api<{ close: DayClose; day: BizDay }>('POST', `/api/days/${encodeURIComponent(id)}/close`, v),
  reopenDay: (id: string) => api<{ day: BizDay }>('POST', `/api/days/${encodeURIComponent(id)}/reopen`, {}),
  promos: () => api<{ promos: Promo[]; presets: number[] }>('GET', '/api/promos'),
  createPromo: (p: PromoInput) => api<{ promo: Promo }>('POST', '/api/promos', p),
  updatePromo: (id: string, p: PromoInput) => api<{ promo: Promo }>('PUT', `/api/promos/${encodeURIComponent(id)}`, p),
  deletePromo: (id: string) => api<{ ok: true }>('DELETE', `/api/promos/${encodeURIComponent(id)}`),
  setPresets: (presets: number[]) => api<{ presets: number[] }>('PUT', '/api/discount-presets', { presets }),
  kedai: () => api<KedaiInfo>('GET', '/api/kedai'),
  kedaiSummary: () => api<KedaiSummary>('GET', '/api/kedai/summary'),
  saveKedai: (s: StoreSettings) => api<{ store: StoreSettings }>('PUT', '/api/kedai', s),
  saveItemStore: (itemId: string, s: Omit<ItemStore, 'stock'> & { stock?: number | null }) => api<{ itemStore: ItemStore }>('PUT', `/api/kedai/items/${encodeURIComponent(itemId)}`, s),
  putKedaiImage: (kind: 'logo' | 'cover', image: string) => api<{ images: KedaiImages }>('PUT', `/api/kedai/images/${kind}`, { image }),
  deleteKedaiImage: (kind: 'logo' | 'cover') => api<{ images: KedaiImages }>('DELETE', `/api/kedai/images/${kind}`),
  putItemPhoto: (itemId: string, image: string) => api<{ version: string }>('PUT', `/api/kedai/items/${encodeURIComponent(itemId)}/photo`, { image }),
  deleteItemPhoto: (itemId: string) => api<{ ok: true }>('DELETE', `/api/kedai/items/${encodeURIComponent(itemId)}/photo`),
  putQr: (image: string) => api<{ ok: true }>('PUT', '/api/kedai/qr', { image }),
  orders: (status: 'open' | 'done' | 'cancelled') => api<{ orders: Order[]; counts: Record<OrderStatus, number> }>('GET', `/api/kedai/orders?status=${status}`),
  orderStep: (id: string, from: OrderStatus, method?: 'cash' | 'qr' | 'ewallet') => api<{ order: Order }>('POST', `/api/kedai/orders/${encodeURIComponent(id)}/step`, { from, method }),
  orderCancel: (id: string, reason: string) => api<{ order: Order }>('POST', `/api/kedai/orders/${encodeURIComponent(id)}/cancel`, { reason }),
};

export interface KedaiInfo {
  store: StoreSettings | null;
  suggested: StoreSettings | null;
  itemStore: Record<string, ItemStore>;
  counts: Record<OrderStatus, number>;
  hasQr: boolean;
  /** When the logo and cover photo last changed; missing when there is none. */
  images: KedaiImages;
  /** item id → when its photo last changed. */
  photos: Record<string, string>;
  kedaiUrl: string | null;
}

export type KedaiImages = Partial<Record<'qr' | 'logo' | 'cover', string>>;

export interface KedaiSummary {
  set: boolean;
  published: boolean;
  needsAction: number;
  awaiting: number;
  /** The newest order that is not cancelled (for new-order alerts). */
  latest: { id: string; number: string; customerName: string; totalSen: number; createdAt: string } | null;
}
