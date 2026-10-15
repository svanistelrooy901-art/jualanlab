/** Totals for a set of sales (a day, a bazaar). Voided sales are counted separately, never in the totals. */
import { cartTotals, lineTotal } from './cart';
import type { PayMethod, Sale } from './sale';

export interface SalesSummary {
  count: number;
  itemCount: number;
  totalSen: number;
  estProfitSen: number;
  /** Takings from lines with a margin (after discount). Split into capital and profit by Money Envelopes. */
  marginRevenueSen: number;
  /** Distinct items sold without a margin (not counted in profit). */
  itemsWithoutMargin: number;
  cashSen: number;
  otherSen: number;
  byMethod: Record<PayMethod, number>;
  voidCount: number;
  voidSen: number;
  /** Discounts given on single items, and on whole orders (done sales only). */
  itemDiscountSen: number;
  orderDiscountSen: number;
}

export function summarise(sales: Sale[]): SalesSummary {
  const out: SalesSummary = {
    count: 0, itemCount: 0, totalSen: 0, estProfitSen: 0, marginRevenueSen: 0, itemsWithoutMargin: 0,
    cashSen: 0, otherSen: 0, byMethod: { cash: 0, qr: 0, ewallet: 0 }, voidCount: 0, voidSen: 0,
    itemDiscountSen: 0, orderDiscountSen: 0,
  };
  const noMargin = new Set<string>();
  for (const s of sales) {
    if (s.status !== 'done') {
      out.voidCount++;
      out.voidSen += s.totalSen;
      continue;
    }
    const t = cartTotals(s.lines, s.discountSen);
    out.count++;
    out.itemCount += t.itemCount;
    out.totalSen += s.totalSen;
    out.estProfitSen += t.estProfitSen;
    out.marginRevenueSen += t.marginRevenueSen;
    out.itemDiscountSen += t.itemDiscountSen;
    out.orderDiscountSen += s.discountSen;
    out.byMethod[s.method] += s.totalSen;
    if (s.method === 'cash') out.cashSen += s.totalSen;
    else out.otherSen += s.totalSen;
    for (const l of s.lines) if (l.marginPct === null) noMargin.add(l.itemId);
  }
  out.itemsWithoutMargin = noMargin.size;
  return out;
}

/**
 * Money Envelopes: today's takings split into capital (to buy ingredients again), profit, and the part with no
 * margin from UntungLab, which is not split because nothing is guessed. The three always add up to the takings.
 * A loss shows as negative profit (and capital above the takings of those items), never hidden.
 */
export interface Envelopes {
  capitalSen: number;
  profitSen: number;
  unsplitSen: number;
}

export function envelopes(s: SalesSummary): Envelopes {
  return {
    capitalSen: s.marginRevenueSen - s.estProfitSen,
    profitSen: s.estProfitSen,
    unsplitSen: s.totalSen - s.marginRevenueSen,
  };
}

export interface BestSeller {
  itemId: string;
  name: string;
  quantity: number;
  revenueSen: number;
}

/** Most sold items by quantity (ties by takings, then name). Voided sales are left out. */
export function bestSellers(sales: Sale[], limit = 5): BestSeller[] {
  const by = new Map<string, BestSeller>();
  for (const s of sales) {
    if (s.status !== 'done') continue;
    for (const l of s.lines) {
      const b = by.get(l.itemId) ?? { itemId: l.itemId, name: l.name, quantity: 0, revenueSen: 0 };
      b.quantity += l.quantity;
      b.revenueSen += lineTotal(l);
      by.set(l.itemId, b);
    }
  }
  return [...by.values()].sort((a, b) => b.quantity - a.quantity || b.revenueSen - a.revenueSen || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Cash expected in the drawer: the float plus cash takings. Change given is already netted (total, not cash received). */
export function expectedCash(s: SalesSummary, floatSen: number): number {
  return floatSen + s.cashSen;
}
