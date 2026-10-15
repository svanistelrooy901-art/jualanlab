/**
 * Promotions (DECISIONS PR-01 to PR-10): set once under Diskaun & Promosi, then applied by the counter by itself.
 * A promotion takes a percentage off every item it covers (all items, some categories or some items), or gives
 * chosen items a special price. It runs between two Malaysian dates (the end is optional) and can be switched off.
 */
import { addItem, discountedPrice, lineFor, MAX_DISCOUNT_PCT, MAX_LINE_QTY, setLineDiscount, type CartLine, type LineDiscount } from './cart';
import { MAX_CATEGORY, MAX_PRICE_SEN, type Item } from './items';

export type PromoKind = 'pct' | 'price';
export type PromoScope = 'all' | 'categories' | 'items';

export interface Promo {
  id: string;
  name: string;
  kind: PromoKind;
  /** Percentage off, for kind 'pct'. */
  pct: number | null;
  /** What a 'pct' promotion covers. A 'price' promotion covers exactly the items in `prices`. */
  scope: PromoScope;
  categories: string[];
  itemIds: string[];
  /** Kind 'price': the special price of each item, by item id, in sen. */
  prices: Record<string, number>;
  /** First and last Malaysian date it runs, "YYYY-MM-DD", both included. No end date = until switched off. */
  startDate: string;
  endDate: string | null;
  on: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PromoInput = Omit<Promo, 'id' | 'createdAt' | 'updatedAt'>;

export const MAX_PROMO_NAME = 40;
export const MAX_PROMOS = 50;
export const MAX_PROMO_ITEMS = 500;
export const MAX_PROMO_CATEGORIES = 50;

/** Ready-made discount buttons at payment until the shop sets its own (Mamu, 15 Oct). */
export const DEFAULT_PRESETS = [5, 10, 15] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** A percentage the counter can use: more than 0, at most 100, two decimals at most. */
export function validPct(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_DISCOUNT_PCT && Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
}

/** Checks a promotion sent by a phone (the server never trusts the page). */
export function validatePromo(json: unknown, knownItemIds: ReadonlySet<string>): { ok: true; value: PromoInput } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return bad('promo');
  const p = json as Record<string, unknown>;
  const name = typeof p.name === 'string' ? p.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > MAX_PROMO_NAME) return bad('name');
  if (p.kind !== 'pct' && p.kind !== 'price') return bad('kind');
  if (!isDate(p.startDate)) return bad('startDate');
  const endDate = p.endDate ?? null;
  if (endDate !== null && (!isDate(endDate) || endDate < p.startDate)) return bad('endDate');
  if (typeof p.on !== 'boolean') return bad('on');
  const base = { name, kind: p.kind as PromoKind, startDate: p.startDate, endDate: endDate as string | null, on: p.on };

  if (p.kind === 'price') {
    const prices = p.prices;
    if (typeof prices !== 'object' || prices === null || Array.isArray(prices)) return bad('prices');
    const entries = Object.entries(prices as Record<string, unknown>);
    if (entries.length === 0 || entries.length > MAX_PROMO_ITEMS) return bad('prices');
    const out: Record<string, number> = {};
    for (const [id, sen] of entries) {
      if (!ID.test(id) || !knownItemIds.has(id)) return bad('unknown_item');
      if (typeof sen !== 'number' || !Number.isInteger(sen) || sen < 0 || sen > MAX_PRICE_SEN) return bad('price');
      out[id] = sen;
    }
    return { ok: true, value: { ...base, pct: null, scope: 'items', categories: [], itemIds: [], prices: out } };
  }

  if (!validPct(p.pct)) return bad('pct');
  if (p.scope !== 'all' && p.scope !== 'categories' && p.scope !== 'items') return bad('scope');
  let categories: string[] = [];
  let itemIds: string[] = [];
  if (p.scope === 'categories') {
    if (!Array.isArray(p.categories) || p.categories.length === 0 || p.categories.length > MAX_PROMO_CATEGORIES) return bad('categories');
    for (const c of p.categories) if (typeof c !== 'string' || c.trim() === '' || c.length > MAX_CATEGORY) return bad('categories');
    categories = [...new Set((p.categories as string[]).map((c) => c.trim()))];
  }
  if (p.scope === 'items') {
    if (!Array.isArray(p.itemIds) || p.itemIds.length === 0 || p.itemIds.length > MAX_PROMO_ITEMS) return bad('itemIds');
    for (const id of p.itemIds) if (typeof id !== 'string' || !ID.test(id) || !knownItemIds.has(id)) return bad('unknown_item');
    itemIds = [...new Set(p.itemIds as string[])];
  }
  return { ok: true, value: { ...base, pct: p.pct, scope: p.scope, categories, itemIds, prices: {} } };
}

export type PromoStatus = 'running' | 'scheduled' | 'ended' | 'off';

/** Where a promotion stands on a Malaysian date. Switched off wins over the dates. */
export function promoStatus(p: Pick<Promo, 'on' | 'startDate' | 'endDate'>, today: string): PromoStatus {
  if (!p.on) return 'off';
  if (today < p.startDate) return 'scheduled';
  if (p.endDate !== null && today > p.endDate) return 'ended';
  return 'running';
}

export function covers(p: Promo, item: Pick<Item, 'id' | 'category'>): boolean {
  if (p.kind === 'price') return item.id in p.prices;
  if (p.scope === 'all') return true;
  if (p.scope === 'categories') return item.category !== null && p.categories.includes(item.category);
  return p.itemIds.includes(item.id);
}

export function promoDiscount(p: Promo, itemId: string): LineDiscount {
  return p.kind === 'pct' ? { kind: 'pct', pct: p.pct ?? 0 } : { kind: 'price', priceSen: p.prices[itemId] ?? -1 };
}

/** The price this promotion gives the item, or null when it does not cover it or would not lower the price. */
export function promoPrice(p: Promo, item: Pick<Item, 'id' | 'category' | 'priceSen'>): number | null {
  if (!covers(p, item)) return null;
  const price = discountedPrice(item.priceSen, promoDiscount(p, item.id));
  return price === null || price >= item.priceSen ? null : price;
}

export interface PromoMatch {
  promo: Promo;
  priceSen: number;
}

/** The promotion running today that gives this item the lowest price (the customer's best deal); ties go to the older one. */
export function bestPromo(promos: readonly Promo[], item: Pick<Item, 'id' | 'category' | 'priceSen'>, today: string | null): PromoMatch | null {
  if (today === null) return null;
  let best: PromoMatch | null = null;
  for (const p of promos) {
    if (promoStatus(p, today) !== 'running') continue;
    const priceSen = promoPrice(p, item);
    if (priceSen === null) continue;
    if (!best || priceSen < best.priceSen || (priceSen === best.priceSen && (p.createdAt < best.promo.createdAt || (p.createdAt === best.promo.createdAt && p.id < best.promo.id)))) {
      best = { promo: p, priceSen };
    }
  }
  return best;
}

/** A new cart line for the item with the promotion on it: the discount, its margin from UntungLab's cost, and the promotion's name. */
export function promoLine(item: Item, m: PromoMatch): CartLine {
  const line = setLineDiscount([lineFor(item)], 0, promoDiscount(m.promo, item.id))[0]!;
  return { ...line, promoId: m.promo.id, promoName: m.promo.name };
}

/**
 * A tap on an item at the counter: with a promotion running for it, the line carries the promotion (further taps
 * add to that line); without one, it is the plain add. A line the cashier changed by hand is left alone.
 */
export function addItemWithPromos(lines: CartLine[], item: Item, promos: readonly Promo[], today: string | null): CartLine[] {
  const m = bestPromo(promos, item, today);
  if (!m) return addItem(lines, item);
  const i = lines.findIndex((l) => l.itemId === item.id && l.note === '' && l.promoId === m.promo.id && l.unitPriceSen === m.priceSen);
  if (i < 0) return [...lines, promoLine(item, m)];
  return lines.map((l, j) => (j === i ? { ...l, quantity: Math.min(MAX_LINE_QTY, l.quantity + 1) } : l));
}

/** Items a promotion covers among the active ones, with the price it gives them (for the preview and the list). */
export function promoItems(p: Promo, items: readonly Item[]): { item: Item; priceSen: number | null }[] {
  return items.filter((i) => i.active && covers(p, i)).map((item) => ({ item, priceSen: promoPrice(p, item) }));
}

/** Days left including today, for "ends in 3 days"; null without an end date. */
export function daysLeft(p: Pick<Promo, 'endDate'>, today: string): number | null {
  if (p.endDate === null) return null;
  return Math.round((Date.parse(`${p.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Validates the shop's three quick discount buttons and puts them in order. */
export function validatePresets(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(validPct)) return null;
  const sorted = [...(v as number[])].sort((a, b) => a - b);
  return new Set(sorted).size === sorted.length ? sorted : null;
}
