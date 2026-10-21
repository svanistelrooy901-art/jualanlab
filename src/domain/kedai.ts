/**
 * Kedai, the online store (DECISIONS K-01 to K-12). The rules shared by the seller's app and the server:
 * store settings and their limits, and how an order is priced. The server prices every order again from its own
 * catalogue, promotions and settings; nothing the customer's page sends about money is trusted.
 */
import { lineFor, lineTotal, MAX_LINE_QTY, MAX_NOTE, type CartLine } from './cart';
import type { Item } from './items';
import { bestPromo, promoLine, type Promo } from './promo';

export const MAX_TAGLINE = 120;
export const MAX_ABOUT = 600;
export const MAX_ANNOUNCEMENT = 140;
export const MAX_ADDRESS = 200;
export const MAX_AREAS = 5;
export const MAX_ITEM_DESC = 400;
export const MAX_ORDER_LINES = 50;
export const MAX_CUSTOMER_NAME = 60;
/** Free plan: the store shows this many items, as the counter (K-05). */
export const FREE_STORE_ITEMS = 10;

export type Fulfilment = 'pickup' | 'delivery';
export type OrderPay = 'qr' | 'at_pickup';
export type OrderStatus = 'awaiting_payment' | 'confirmed' | 'preparing' | 'ready' | 'done' | 'cancelled';

export interface DeliveryArea {
  name: string;
  feeSen: number;
}

/**
 * A pre-order batch (Mamu, 17 Oct): "Sabtu 25 Okt, closes Thursday 8pm". Customers order for a batch until it
 * closes or fills up; the seller makes and hands over everything on the ready date.
 */
export interface Batch {
  id: string;
  /** What customers see: "Sabtu 25 Okt" or "Raya batch 1". */
  label: string;
  /** The day orders are ready (pickup or delivery), "YYYY-MM-DD". */
  readyDate: string;
  /** Orders close at this moment (ISO with offset, Malaysian time when set from the app). */
  closesAt: string;
  /** Most orders this batch takes; null = no limit. */
  maxOrders: number | null;
}

export const MAX_BATCHES = 6;
export const MAX_BATCH_LABEL = 40;

export interface StoreSettings {
  /** The store's address: kedai.untunglab.space/<slug>. */
  slug: string;
  /** Visible to customers. A store can be prepared before it is published. */
  published: boolean;
  /** Taking orders now ("Kedai tutup sementara" when false; the page still shows). */
  open: boolean;
  tagline: string;
  about: string;
  announcement: string;
  /** "#RRGGBB"; the page adjusts shades to stay readable (K-12). */
  brandColor: string;
  pickup: { on: boolean; address: string; mapUrl: string; hours: string };
  delivery: { on: boolean; areas: DeliveryArea[]; note: string };
  minOrderSen: number;
  /** Customers may choose to pay when they collect or receive the order (K-09: off by default). */
  payAtPickup: boolean;
  /** Unpaid QR orders cancel themselves after this many minutes (T-05). */
  unpaidCancelMinutes: number;
  /** Seller's WhatsApp, digits only with country code ("60123456789"). */
  whatsapp: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  /**
   * How orders are taken (OM-01): 'normal' = for now, while the store is open; 'auto' = within opening hours for
   * today, outside them a pre-order for the next opening day (OM-02); 'batch' = for one of the pre-order batches,
   * and for today too when preorder.today is on (OM-05).
   */
  orderMode: OrderMode;
  /** Opening hours per weekday, Sunday first (mode 'auto'). */
  hours: DayHours[];
  /** Days the store is closed ("YYYY-MM-DD"), skipped when finding the next opening day (OM-03). */
  holidays: string[];
  /** Batches; `on` mirrors orderMode === 'batch' (kept for older apps). */
  preorder: { on: boolean; batches: Batch[]; today: boolean; todayCutoff: string };
}

export type OrderMode = 'normal' | 'auto' | 'batch';

export interface DayHours {
  open: boolean;
  /** "HH:MM", Malaysian time. */
  from: string;
  to: string;
}

export const MAX_HOLIDAYS = 60;

export const DEFAULT_HOURS: DayHours[] = Array.from({ length: 7 }, () => ({ open: true, from: '09:00', to: '18:00' }));

/** Settings saved before ordering modes existed lack the newer fields. */
export function withDefaults(s: StoreSettings): StoreSettings {
  const po = s.preorder ?? { on: false, batches: [], today: false, todayCutoff: '' };
  return {
    ...s,
    orderMode: s.orderMode ?? (po.on ? 'batch' : 'normal'),
    hours: s.hours?.length === 7 ? s.hours : DEFAULT_HOURS,
    holidays: s.holidays ?? [],
    preorder: { on: po.on, batches: po.batches ?? [], today: po.today ?? false, todayCutoff: po.todayCutoff ?? '' },
  };
}

// ---------------------------------------------------------------- which day an order is for (OM-02, OM-05)

const MY = 8 * 3600_000;
/** Malaysian date "YYYY-MM-DD", weekday (0 = Sunday) and minutes since midnight for an instant. */
export function myClock(iso: string): { date: string; weekday: number; minutes: number } {
  const t = new Date(Date.parse(iso) + MY);
  return { date: t.toISOString().slice(0, 10), weekday: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const nextDate = (d: string, n = 1) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const weekdayOf = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

function openOn(s: StoreSettings, date: string): DayHours | null {
  if (s.holidays.includes(date)) return null;
  const h = s.hours[weekdayOf(date)];
  return h?.open ? h : null;
}

/** Mode 'auto': open now (orders for today)? */
export function isOpenNow(s: StoreSettings, nowIso: string): boolean {
  const c = myClock(nowIso);
  const h = openOn(s, c.date);
  return !!h && c.minutes >= mins(h.from) && c.minutes < mins(h.to);
}

/** Mode 'auto': the next opening day after now when the store is closed (looks up to 31 days ahead). */
export function nextOpenDay(s: StoreSettings, nowIso: string): string | null {
  const c = myClock(nowIso);
  const today = openOn(s, c.date);
  if (today && c.minutes < mins(today.from)) return c.date; // before opening this morning
  for (let n = 1; n <= 31; n++) {
    const d = nextDate(c.date, n);
    if (openOn(s, d)) return d;
  }
  return null;
}

/** Mode 'auto': today's closing time, when the store opens today. */
export function closingToday(s: StoreSettings, nowIso: string): string | null {
  const h = openOn(s, myClock(nowIso).date);
  return h ? h.to : null;
}

/** Mode 'batch': today's orders are taken (today on, before the last order time). */
export function todayOpen(s: StoreSettings, nowIso: string): boolean {
  if (s.orderMode !== 'batch' || !s.preorder.today) return false;
  return !s.preorder.todayCutoff || myClock(nowIso).minutes < mins(s.preorder.todayCutoff);
}

/**
 * The day an order is for. Today: { id: '' }. Mode 'auto' after hours: { id: 'auto-YYYY-MM-DD' }, a pre-order for the
 * next opening day. Mode 'batch': the chosen batch (or today when allowed). Null = no ordering possible now.
 */
export interface OrderDay {
  id: string;
  /** Pre-orders: what to call the day; '' for today. */
  label: string;
  readyDate: string;
  batch: Batch | null;
}

const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
/** "Isnin 20 Okt" for "2026-10-20" (the name a next-day pre-order is filed under). */
export function dayLabelMs(date: string): string {
  const t = new Date(`${date}T00:00:00Z`);
  return `${HARI[t.getUTCDay()]} ${t.getUTCDate()} ${BULAN[t.getUTCMonth()]}`;
}

export function autoDayId(date: string): string {
  return `auto-${date}`;
}

/** The days a customer can order for right now, in the order shown (today first). */
export function orderDays(s: StoreSettings, nowIso: string): OrderDay[] {
  const c = myClock(nowIso);
  if (s.orderMode === 'normal') return [{ id: '', label: '', readyDate: c.date, batch: null }];
  if (s.orderMode === 'auto') {
    if (isOpenNow(s, nowIso)) return [{ id: '', label: '', readyDate: c.date, batch: null }];
    const d = nextOpenDay(s, nowIso);
    return d ? [{ id: autoDayId(d), label: d, readyDate: d, batch: null }] : [];
  }
  const out: OrderDay[] = todayOpen(s, nowIso) ? [{ id: '', label: '', readyDate: c.date, batch: null }] : [];
  for (const b of openBatches(s, nowIso)) out.push({ id: b.id, label: b.label, readyDate: b.readyDate, batch: b });
  return out;
}

/** Batches customers can order for at this moment, soonest first (full ones are filtered by the server). */
export function openBatches(s: StoreSettings, nowIso: string): Batch[] {
  if (s.orderMode !== 'batch') return [];
  const now = Date.parse(nowIso);
  return s.preorder.batches.filter((b) => Date.parse(b.closesAt) > now).sort((a, b) => a.readyDate.localeCompare(b.readyDate) || a.closesAt.localeCompare(b.closesAt));
}

export const DEFAULT_BRAND = '#B4351C';

export function defaultSettings(slug: string): StoreSettings {
  return {
    slug, published: false, open: true, tagline: '', about: '', announcement: '', brandColor: DEFAULT_BRAND,
    pickup: { on: true, address: '', mapUrl: '', hours: '' },
    delivery: { on: false, areas: [], note: '' },
    minOrderSen: 0, payAtPickup: false, unpaidCancelMinutes: 120, whatsapp: '', instagram: '', tiktok: '', facebook: '',
    orderMode: 'normal', hours: DEFAULT_HOURS, holidays: [],
    preorder: { on: false, batches: [], today: false, todayCutoff: '' },
  };
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
/** Addresses that would clash with the store's own pages or look official. */
const RESERVED = new Set(['api', 'admin', 'kedai', 'jualanlab', 'untunglab', 'smelab', 'help', 'bantuan', 'login', 'masuk', 'static', 'assets', 'www', 'pesanan', 'order']);

export function isSlug(v: unknown): v is string {
  return typeof v === 'string' && SLUG.test(v) && !v.includes('--') && !RESERVED.has(v);
}

/** A suggested address from the shop's name: "Dapur Mak Long" → "dapur-mak-long". */
export function slugFrom(name: string): string {
  const s = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s.length >= 3 ? s : `${s || 'kedai'}-${'kedai'}`.slice(0, 40);
}

/** Malaysian phone to WhatsApp digits: "012-345 6789" → "60123456789"; null when it is not a Malaysian mobile. */
export function waNumber(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let d = v.replace(/[^0-9]/g, '');
  if (d.startsWith('0')) d = `6${d}`;
  return /^601\d{8,9}$/.test(d) ? d : null;
}

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim().length <= max ? v.trim().replace(/[\u0000-\u0008\u000b-\u001f]/g, '') : null);
const sen = (v: unknown, max = 1_000_000): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null);
const url = (v: unknown): string | null => {
  if (v === '' || v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > 300) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};
const handle = (v: unknown): string | null => (v === undefined || v === '' ? '' : typeof v === 'string' && /^@?[A-Za-z0-9._]{1,40}$/.test(v.trim()) ? v.trim().replace(/^@/, '') : null);

/** Checks settings sent by the seller's app. Returns the clean settings, or the name of the first bad field. */
export function validateSettings(json: unknown): { ok: true; value: StoreSettings } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  if (typeof json !== 'object' || json === null) return bad('settings');
  const s = json as Record<string, unknown>;
  if (!isSlug(s.slug)) return bad('slug');
  if (typeof s.published !== 'boolean') return bad('published');
  if (typeof s.open !== 'boolean') return bad('open');
  const tagline = text(s.tagline ?? '', MAX_TAGLINE);
  if (tagline === null) return bad('tagline');
  const about = text(s.about ?? '', MAX_ABOUT);
  if (about === null) return bad('about');
  const announcement = text(s.announcement ?? '', MAX_ANNOUNCEMENT);
  if (announcement === null) return bad('announcement');
  if (typeof s.brandColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(s.brandColor)) return bad('brandColor');
  const p = (s.pickup ?? {}) as Record<string, unknown>;
  const pickupAddress = text(p.address ?? '', MAX_ADDRESS);
  const pickupHours = text(p.hours ?? '', 80);
  const mapUrl = url(p.mapUrl);
  if (typeof p.on !== 'boolean' || pickupAddress === null || pickupHours === null || mapUrl === null) return bad('pickup');
  const dl = (s.delivery ?? {}) as Record<string, unknown>;
  if (typeof dl.on !== 'boolean' || !Array.isArray(dl.areas) || dl.areas.length > MAX_AREAS) return bad('delivery');
  const areas: DeliveryArea[] = [];
  for (const a of dl.areas as unknown[]) {
    const r = a as Record<string, unknown>;
    const name = text(r?.name, 40);
    const fee = sen(r?.feeSen, 100_000);
    if (!name || fee === null) return bad('delivery');
    areas.push({ name, feeSen: fee });
  }
  if (dl.on && areas.length === 0) return bad('delivery');
  const note = text(dl.note ?? '', 140);
  if (note === null) return bad('delivery');
  if (!p.on && !dl.on) return bad('fulfilment');
  const minOrderSen = sen(s.minOrderSen ?? 0);
  if (minOrderSen === null) return bad('minOrderSen');
  if (typeof s.payAtPickup !== 'boolean') return bad('payAtPickup');
  const mins = s.unpaidCancelMinutes;
  if (typeof mins !== 'number' || !Number.isInteger(mins) || mins < 30 || mins > 2880) return bad('unpaidCancelMinutes');
  const whatsapp = s.whatsapp === '' || s.whatsapp === undefined ? '' : waNumber(s.whatsapp);
  if (whatsapp === null) return bad('whatsapp');
  const instagram = handle(s.instagram), tiktok = handle(s.tiktok), facebook = handle(s.facebook);
  if (instagram === null || tiktok === null || facebook === null) return bad('links');
  const orderMode = (s.orderMode ?? ((s.preorder as { on?: boolean } | undefined)?.on ? 'batch' : 'normal')) as OrderMode;
  if (orderMode !== 'normal' && orderMode !== 'auto' && orderMode !== 'batch') return bad('orderMode');
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const rawHours = s.hours ?? DEFAULT_HOURS;
  if (!Array.isArray(rawHours) || rawHours.length !== 7) return bad('hours');
  const hours: DayHours[] = [];
  for (const raw of rawHours as unknown[]) {
    const h = raw as Record<string, unknown>;
    if (typeof h?.open !== 'boolean' || typeof h.from !== 'string' || typeof h.to !== 'string' || !HHMM.test(h.from) || !HHMM.test(h.to)) return bad('hours');
    if (h.open && h.to <= h.from) return bad('hours');
    hours.push({ open: h.open, from: h.from, to: h.to });
  }
  if (orderMode === 'auto' && !hours.some((h) => h.open)) return bad('hours');
  const rawHol = s.holidays ?? [];
  if (!Array.isArray(rawHol) || rawHol.length > MAX_HOLIDAYS || rawHol.some((d) => typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d))) return bad('holidays');
  const holidays = [...new Set(rawHol as string[])].sort();
  const po = (s.preorder ?? { on: false, batches: [] }) as Record<string, unknown>;
  if (!Array.isArray(po.batches) || po.batches.length > MAX_BATCHES) return bad('preorder');
  const poToday = po.today ?? false;
  const todayCutoff = po.todayCutoff ?? '';
  if (typeof poToday !== 'boolean' || typeof todayCutoff !== 'string' || (todayCutoff !== '' && !HHMM.test(todayCutoff))) return bad('preorder');
  const batches: Batch[] = [];
  for (const raw of po.batches as unknown[]) {
    const b = raw as Record<string, unknown>;
    const label = text(b?.label, MAX_BATCH_LABEL);
    const okId = typeof b?.id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(b.id);
    const okDate = typeof b?.readyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.readyDate) && !Number.isNaN(Date.parse(b.readyDate));
    const okClose = typeof b?.closesAt === 'string' && b.closesAt.length <= 40 && !Number.isNaN(Date.parse(b.closesAt));
    const max = b?.maxOrders ?? null;
    const okMax = max === null || (typeof max === 'number' && Number.isInteger(max) && max >= 1 && max <= 10_000);
    if (!label || !okId || !okDate || !okClose || !okMax) return bad('preorder');
    if (batches.some((x) => x.id === b.id)) return bad('preorder');
    batches.push({ id: b.id as string, label, readyDate: b.readyDate as string, closesAt: new Date(b.closesAt as string).toISOString(), maxOrders: max as number | null });
  }
  if (orderMode === 'batch' && batches.length === 0 && !poToday) return bad('preorder');
  return {
    ok: true,
    value: {
      slug: s.slug, published: s.published, open: s.open, tagline, about, announcement, brandColor: s.brandColor.toUpperCase(),
      pickup: { on: p.on, address: pickupAddress, mapUrl, hours: pickupHours },
      delivery: { on: dl.on, areas, note },
      minOrderSen, payAtPickup: s.payAtPickup, unpaidCancelMinutes: mins, whatsapp, instagram, tiktok, facebook,
      orderMode, hours, holidays,
      preorder: { on: orderMode === 'batch', batches, today: poToday, todayCutoff },
    },
  };
}

/** What a seller sets per item for the store (photos come in a later step). */
export interface ItemStore {
  description: string;
  /** Shown in the store (false = counter only). */
  online: boolean;
  badge: 'baru' | 'pedas' | null;
  featured: boolean;
  /** How many the store can still sell; null = not counted. At 0 the item shows "Habis" and cannot be ordered. */
  stock: number | null;
}

export const MAX_STOCK = 99_999;

export const DEFAULT_ITEM_STORE: ItemStore = { description: '', online: true, badge: null, featured: false, stock: null };

export function validateItemStore(json: unknown): ItemStore | null {
  if (typeof json !== 'object' || json === null) return null;
  const s = json as Record<string, unknown>;
  const description = text(s.description ?? '', MAX_ITEM_DESC);
  if (description === null || typeof s.online !== 'boolean' || typeof s.featured !== 'boolean') return null;
  if (s.badge !== null && s.badge !== 'baru' && s.badge !== 'pedas') return null;
  const stock = s.stock ?? null;
  if (stock !== null && !(Number.isInteger(stock) && (stock as number) >= 0 && (stock as number) <= MAX_STOCK)) return null;
  return { description, online: s.online, badge: s.badge as ItemStore['badge'], featured: s.featured, stock: stock as number | null };
}

// ---------------------------------------------------------------- ordering

export interface OrderRequest {
  lines: { itemId: string; quantity: number; note: string }[];
  name: string;
  phone: string;
  fulfilment: Fulfilment;
  /** Delivery: the area's name as listed by the store, and the address. */
  area: string;
  address: string;
  note: string;
  pay: OrderPay;
  /** Pre-order stores: the batch chosen; '' otherwise. */
  batchId: string;
}

export function validateOrderRequest(json: unknown): { ok: true; value: OrderRequest } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  if (typeof json !== 'object' || json === null) return bad('order');
  const o = json as Record<string, unknown>;
  if (!Array.isArray(o.lines) || o.lines.length === 0 || o.lines.length > MAX_ORDER_LINES) return bad('lines');
  const lines: OrderRequest['lines'] = [];
  for (const raw of o.lines as unknown[]) {
    const l = raw as Record<string, unknown>;
    if (typeof l?.itemId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(l.itemId)) return bad('lines');
    if (typeof l.quantity !== 'number' || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_LINE_QTY) return bad('lines');
    const note = text(l.note ?? '', MAX_NOTE);
    if (note === null) return bad('lines');
    lines.push({ itemId: l.itemId, quantity: l.quantity, note });
  }
  const name = text(o.name, MAX_CUSTOMER_NAME);
  if (!name) return bad('name');
  const phone = waNumber(o.phone);
  if (!phone) return bad('phone');
  if (o.fulfilment !== 'pickup' && o.fulfilment !== 'delivery') return bad('fulfilment');
  const area = text(o.area ?? '', 40);
  const address = text(o.address ?? '', MAX_ADDRESS);
  if (area === null || address === null) return bad('address');
  if (o.fulfilment === 'delivery' && (!area || address.length < 5)) return bad('address');
  const note = text(o.note ?? '', 200);
  if (note === null) return bad('note');
  if (o.pay !== 'qr' && o.pay !== 'at_pickup') return bad('pay');
  const batchId = o.batchId ?? '';
  if (typeof batchId !== 'string' || !/^[A-Za-z0-9_-]{0,24}$/.test(batchId)) return bad('batch');
  return { ok: true, value: { lines, name, phone, fulfilment: o.fulfilment, area: o.fulfilment === 'delivery' ? area : '', address: o.fulfilment === 'delivery' ? address : '', note, pay: o.pay, batchId } };
}

export interface PricedOrder {
  lines: CartLine[];
  subtotalSen: number;
  deliverySen: number;
  totalSen: number;
  /** Ringgit taken off by promotions. */
  savedSen: number;
  /** The pre-order batch (mode 'batch' only). */
  batch: Batch | null;
  /** The day the order is for: today (id '') or a pre-order day. */
  day: OrderDay;
}

export type PriceRefusal = 'not_in_batch' | 'batch_required' | 'batch_closed' | 'unknown_item' | 'unavailable' | 'store_closed' | 'no_pickup' | 'no_delivery' | 'bad_area' | 'below_minimum' | 'pay_not_allowed';

/**
 * Prices an order from the store's own data: the catalogue price, the best promotion running on the given
 * Malaysian date, and the delivery fee of the chosen area. Lines for the same item and note are joined.
 */
export function priceOrder(
  req: OrderRequest,
  ctx: {
    items: ReadonlyMap<string, Item & { store: ItemStore }>; promos: readonly Promo[]; today: string; settings: StoreSettings; now?: string;
    /** The chosen batch's menu: item id → stock left (null = no limit); null = every item (OM-05). */
    batchMenu?: ReadonlyMap<string, number | null> | null;
  },
): { ok: true; value: PricedOrder } | { ok: false; error: PriceRefusal } {
  const settings = withDefaults(ctx.settings);
  if (!settings.published || !settings.open) return { ok: false, error: 'store_closed' };
  // One order, one day (OM-06). 'auto' decides the day itself; 'batch' needs the customer's choice.
  const days = orderDays(settings, ctx.now ?? new Date().toISOString());
  if (days.length === 0) return { ok: false, error: settings.orderMode === 'batch' ? 'batch_closed' : 'store_closed' };
  let day: OrderDay;
  if (settings.orderMode === 'batch') {
    const chosen = days.find((d) => d.id === req.batchId);
    if (!chosen) return { ok: false, error: req.batchId || days.some((d) => d.id === '') ? 'batch_closed' : 'batch_required' };
    day = chosen;
  } else day = days[0]!;
  const batch = day.batch;
  if (req.fulfilment === 'pickup' && !settings.pickup.on) return { ok: false, error: 'no_pickup' };
  if (req.fulfilment === 'delivery' && !settings.delivery.on) return { ok: false, error: 'no_delivery' };
  if (req.pay === 'at_pickup' && !settings.payAtPickup) return { ok: false, error: 'pay_not_allowed' };
  let deliverySen = 0;
  if (req.fulfilment === 'delivery') {
    const area = settings.delivery.areas.find((a) => a.name === req.area);
    if (!area) return { ok: false, error: 'bad_area' };
    deliverySen = area.feeSen;
  }
  const lines: CartLine[] = [];
  for (const want of req.lines) {
    const item = ctx.items.get(want.itemId);
    if (!item) return { ok: false, error: 'unknown_item' };
    if (!item.active || !item.store.online) return { ok: false, error: 'unavailable' };
    if (batch && ctx.batchMenu && !ctx.batchMenu.has(item.id)) return { ok: false, error: 'not_in_batch' };
    const m = bestPromo(ctx.promos, item, ctx.today);
    const base = m ? promoLine(item, m) : lineFor(item);
    const same = lines.findIndex((l) => l.itemId === item.id && l.note === want.note);
    if (same >= 0) lines[same] = { ...lines[same]!, quantity: Math.min(MAX_LINE_QTY, lines[same]!.quantity + want.quantity) };
    else lines.push({ ...base, quantity: want.quantity, note: want.note });
  }
  const subtotalSen = lines.reduce((t, l) => t + lineTotal(l), 0);
  if (subtotalSen < settings.minOrderSen) return { ok: false, error: 'below_minimum' };
  const savedSen = lines.reduce((t, l) => t + (l.listPriceSen != null ? (l.listPriceSen - l.unitPriceSen) * l.quantity : 0), 0);
  return { ok: true, value: { lines, subtotalSen, deliverySen, totalSen: subtotalSen + deliverySen, savedSen, batch, day } };
}

/** Order numbers per shop: "K-0042". */
export function orderNumber(seq: number): string {
  return `K-${String(seq).padStart(4, '0')}`;
}

/** Steps an order moves through by the seller's hand; cancelling is possible until it is done. */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  awaiting_payment: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'done',
  done: null,
  cancelled: null,
};

export const MAX_CANCEL_REASON = 120;

/**
 * A readable brand colour on white for text and buttons: very light colours are darkened until white text on them
 * reaches a 4.5:1 contrast (K-12, "the seller's colour, kept readable").
 */
export function readableBrand(hex: string): string {
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  for (let i = 0; i < 20 && contrastWithWhite(r, g, b) < 4.5; i++) {
    r = Math.round(r * 0.9);
    g = Math.round(g * 0.9);
    b = Math.round(b * 0.9);
  }
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function contrastWithWhite(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (l + 0.05);
}

export interface Order {
  id: string;
  shopId: string;
  seq: number;
  number: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  fulfilment: Fulfilment;
  area: string;
  address: string;
  note: string;
  pay: OrderPay;
  subtotalSen: number;
  deliverySen: number;
  totalSen: number;
  status: OrderStatus;
  /** Unpaid QR orders cancel themselves after this time. */
  expiresAt: string | null;
  paidAt: string | null;
  cancelReason: string | null;
  saleId: string | null;
  updatedAt: string;
  lines: CartLine[];
  /** Pre-orders: the batch, its name and ready date as they were when ordered. */
  batchId: string | null;
  batchLabel: string | null;
  readyDate: string | null;
}

// ---------------------------------------------------------------- prep list

export interface PrepLine {
  itemId: string;
  name: string;
  /** Everything ordered (paid or not yet). */
  quantity: number;
  /** Of which still waiting for payment (may expire). */
  unpaid: number;
  /** Customer notes for this item: "kurang manis" ×2. */
  notes: { note: string; quantity: number }[];
}

export interface PrepList {
  orders: number;
  unpaidOrders: number;
  pickup: number;
  delivery: number;
  lines: PrepLine[];
}

/** What to make for a set of orders (a batch, or every open order): totals per item, biggest first. */
export function prepList(orders: readonly Order[]): PrepList {
  const by = new Map<string, PrepLine>();
  let unpaidOrders = 0, pickup = 0, delivery = 0;
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const unpaid = o.status === 'awaiting_payment';
    if (unpaid) unpaidOrders++;
    if (o.fulfilment === 'pickup') pickup++;
    else delivery++;
    for (const l of o.lines) {
      const p = by.get(l.itemId) ?? { itemId: l.itemId, name: l.name, quantity: 0, unpaid: 0, notes: [] };
      p.quantity += l.quantity;
      if (unpaid) p.unpaid += l.quantity;
      const note = l.note.trim();
      if (note) {
        const n = p.notes.find((x) => x.note.toLowerCase() === note.toLowerCase());
        if (n) n.quantity += l.quantity;
        else p.notes.push({ note, quantity: l.quantity });
      }
      by.set(l.itemId, p);
    }
  }
  const lines = [...by.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
  return { orders: orders.filter((o) => o.status !== 'cancelled').length, unpaidOrders, pickup, delivery, lines };
}
