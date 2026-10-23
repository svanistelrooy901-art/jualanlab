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
  /**
   * UntungLab items: UntungLab's margin for ulPriceSen (null when incomplete). Own items: a margin % the seller typed,
   * only possible when the owner has UntungLab (DECISIONS FT-03); null otherwise ("Untung tak diketahui").
   */
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

type CostFields = Pick<Item, 'source' | 'ulPriceSen' | 'marginPct'> & { priceSen?: number };

/**
 * Cost of one unit in sen, from UntungLab's own numbers: the price it sent and its margin for that price
 * (cost = price × (1 − margin), DECISIONS I-01). Not rounded, so profit at UntungLab's price matches its margin
 * exactly. Own items: from the seller's own margin % at the counter price (FT-03). Null when there is no margin:
 * JualanLab never estimates a cost otherwise.
 */
export function unitCost(item: CostFields): number | null {
  if (item.marginPct === null) return null;
  if (item.source === 'own') return item.priceSen !== undefined && item.priceSen > 0 ? (item.priceSen * (100 - item.marginPct)) / 100 : null;
  if (item.ulPriceSen === null || item.ulPriceSen <= 0) return null;
  return (item.ulPriceSen * (100 - item.marginPct)) / 100;
}

/** Margin (%) when selling at this price, given the unit cost; null without a cost or at a price of 0. */
export function marginAt(priceSen: number, costSen: number | null): number | null {
  if (costSen === null || priceSen <= 0) return null;
  return Math.round(((priceSen - costSen) / priceSen) * 10000) / 100;
}

/**
 * The margin at the counter price. At UntungLab's price it is UntungLab's margin as sent; at a price typed in
 * JualanLab it is worked out from UntungLab's cost. Own items have none ("—", left out of profit).
 */
export function effectiveMargin(item: Pick<Item, 'source' | 'priceSen' | 'ulPriceSen' | 'marginPct'>): number | null {
  if (item.source === 'own') return item.marginPct !== null && item.priceSen > 0 ? item.marginPct : null;
  if (item.marginPct === null || item.ulPriceSen === null) return null;
  return item.priceSen === item.ulPriceSen ? item.marginPct : marginAt(item.priceSen, unitCost(item));
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
