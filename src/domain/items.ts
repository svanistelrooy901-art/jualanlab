/** A sellable item in a shop's catalogue: from an UntungLab price list, or the shop's own. */
import type { MenuStatus } from '../link/types';

export type ItemSource = 'untunglab' | 'own';

export interface Item {
  id: string;
  source: ItemSource;
  /** UntungLab menu id; null for own items. The matching key for imports (DECISIONS L-07). */
  ulMenuId: string | null;
  name: string;
  category: string | null;
  /** Price the counter charges, in sen. */
  priceSen: number;
  /** Last price UntungLab sent; null for own items. A different priceSen means a hand-typed price. */
  ulPriceSen: number | null;
  /** UntungLab margin for ulPriceSen; null when incomplete or for own items. */
  marginPct: number | null;
  status: MenuStatus | null;
  /** UntungLab id of the base menu when this item is a variation. */
  baseUlMenuId: string | null;
  active: boolean;
  updatedAt: string;
}

export const MAX_ITEM_NAME = 120;
export const MAX_CATEGORY = 60;
export const MAX_PRICE_SEN = 10_000_000;

/** True when the counter price was typed by hand and differs from what UntungLab sent. */
export function isPriceOverridden(item: Item): boolean {
  return item.source === 'untunglab' && item.ulPriceSen !== null && item.priceSen !== item.ulPriceSen;
}

/**
 * The margin profit may be estimated with. Only an UntungLab margin for the price actually charged counts;
 * a hand-typed price or an own item has none, so it shows "—" and is left out of profit (never guessed).
 */
export function effectiveMargin(item: Pick<Item, 'source' | 'priceSen' | 'ulPriceSen' | 'marginPct'>): number | null {
  if (item.source !== 'untunglab' || item.marginPct === null || item.ulPriceSen === null) return null;
  return item.priceSen === item.ulPriceSen ? item.marginPct : null;
}

/** Groups active items by category for the counter. Items without a category come last under null. */
export function groupByCategory(items: Item[]): { category: string | null; items: Item[] }[] {
  const groups = new Map<string | null, Item[]>();
  for (const it of items) {
    const key = it.category;
    const list = groups.get(key) ?? [];
    list.push(it);
    groups.set(key, list);
  }
  const named = [...groups.keys()].filter((k): k is string => k !== null).sort((a, b) => a.localeCompare(b, 'ms'));
  const order: (string | null)[] = groups.has(null) ? [...named, null] : named;
  return order.map((category) => ({
    category,
    items: (groups.get(category) ?? []).slice().sort(byBaseThenName(items)),
  }));
}

/** Base menus first, each followed by its variations, then by name. */
function byBaseThenName(all: Item[]) {
  const byUl = new Map(all.filter((i) => i.ulMenuId).map((i) => [i.ulMenuId as string, i]));
  const key = (i: Item) => {
    const base = i.baseUlMenuId ? byUl.get(i.baseUlMenuId) : undefined;
    return base ? `${base.name}\u0000${i.name}` : `${i.name}\u0000`;
  };
  return (a: Item, b: Item) => key(a).localeCompare(key(b), 'ms');
}
