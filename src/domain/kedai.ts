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
  /** Pre-order mode: every order is for one of the open batches. Off = orders are for as soon as possible. */
  preorder: { on: boolean; batches: Batch[] };
}

/** Settings saved before pre-orders existed lack the field. */
export function withDefaults(s: StoreSettings): StoreSettings {
  return { ...s, preorder: s.preorder ?? { on: false, batches: [] } };
}

/** Batches customers can order for at this moment, soonest first (full ones are filtered by the server). */
export function openBatches(s: StoreSettings, nowIso: string): Batch[] {
  if (!s.preorder?.on) return [];
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
    preorder: { on: false, batches: [] },
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
  const po = (s.preorder ?? { on: false, batches: [] }) as Record<string, unknown>;
  if (typeof po.on !== 'boolean' || !Array.isArray(po.batches) || po.batches.length > MAX_BATCHES) return bad('preorder');
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
  if (po.on && batches.length === 0) return bad('preorder');
  return {
    ok: true,
    value: {
      slug: s.slug, published: s.published, open: s.open, tagline, about, announcement, brandColor: s.brandColor.toUpperCase(),
      pickup: { on: p.on, address: pickupAddress, mapUrl, hours: pickupHours },
      delivery: { on: dl.on, areas, note },
      minOrderSen, payAtPickup: s.payAtPickup, unpaidCancelMinutes: mins, whatsapp, instagram, tiktok, facebook,
      preorder: { on: po.on, batches },
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
  /** The pre-order batch (pre-order stores only). */
  batch: Batch | null;
}

export type PriceRefusal = 'batch_required' | 'batch_closed' | 'unknown_item' | 'unavailable' | 'store_closed' | 'no_pickup' | 'no_delivery' | 'bad_area' | 'below_minimum' | 'pay_not_allowed';

/**
 * Prices an order from the store's own data: the catalogue price, the best promotion running on the given
 * Malaysian date, and the delivery fee of the chosen area. Lines for the same item and note are joined.
 */
export function priceOrder(
  req: OrderRequest,
  ctx: { items: ReadonlyMap<string, Item & { store: ItemStore }>; promos: readonly Promo[]; today: string; settings: StoreSettings; now?: string },
): { ok: true; value: PricedOrder } | { ok: false; error: PriceRefusal } {
  const { settings } = ctx;
  if (!settings.published || !settings.open) return { ok: false, error: 'store_closed' };
  let batch: Batch | null = null;
  if (settings.preorder?.on) {
    if (!req.batchId) return { ok: false, error: 'batch_required' };
    batch = openBatches(settings, ctx.now ?? new Date().toISOString()).find((b) => b.id === req.batchId) ?? null;
    if (!batch) return { ok: false, error: 'batch_closed' };
  }
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
    const m = bestPromo(ctx.promos, item, ctx.today);
    const base = m ? promoLine(item, m) : lineFor(item);
    const same = lines.findIndex((l) => l.itemId === item.id && l.note === want.note);
    if (same >= 0) lines[same] = { ...lines[same]!, quantity: Math.min(MAX_LINE_QTY, lines[same]!.quantity + want.quantity) };
    else lines.push({ ...base, quantity: want.quantity, note: want.note });
  }
  const subtotalSen = lines.reduce((t, l) => t + lineTotal(l), 0);
  if (subtotalSen < settings.minOrderSen) return { ok: false, error: 'below_minimum' };
  const savedSen = lines.reduce((t, l) => t + (l.listPriceSen != null ? (l.listPriceSen - l.unitPriceSen) * l.quantity : 0), 0);
  return { ok: true, value: { lines, subtotalSen, deliverySen, totalSen: subtotalSen + deliverySen, savedSen, batch } };
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
