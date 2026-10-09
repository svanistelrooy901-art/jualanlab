/** Client for the JualanLab API (same origin; the session is an HttpOnly cookie). */
import type { Item } from '../domain/items';
import type { Sale } from '../domain/sale';
import type { PriceList } from '../link/types';

export interface Me {
  user: { id: string; email: string; name: string | null };
  shop: { id: string; name: string } | null;
  lastImport: LastImport | null;
}

export interface LastImport {
  id: string;
  sentAt: string;
  receivedAt: string;
  menus: number;
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

export async function api<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
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
  config: () => api<{ googleClientId: string | null; devMode: boolean }>('GET', '/api/config'),
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
  sendSale: (sale: Sale) => api<{ status: 'created' | 'exists' }>('POST', '/api/sales', { sale }),
};
