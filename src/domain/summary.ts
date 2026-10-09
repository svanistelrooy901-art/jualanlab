/** Totals for a set of sales (a day, a shift). Voided sales are left out. */
import { cartTotals } from './cart';
import type { Sale } from './sale';

export interface SalesSummary {
  count: number;
  itemCount: number;
  totalSen: number;
  estProfitSen: number;
  /** Distinct items sold without a margin (not counted in profit). */
  itemsWithoutMargin: number;
  cashSen: number;
  otherSen: number;
}

export function summarise(sales: Sale[]): SalesSummary {
  const out: SalesSummary = { count: 0, itemCount: 0, totalSen: 0, estProfitSen: 0, itemsWithoutMargin: 0, cashSen: 0, otherSen: 0 };
  const noMargin = new Set<string>();
  for (const s of sales) {
    if (s.status !== 'done') continue;
    const t = cartTotals(s.lines, s.discountSen);
    out.count++;
    out.itemCount += t.itemCount;
    out.totalSen += s.totalSen;
    out.estProfitSen += t.estProfitSen;
    if (s.method === 'cash') out.cashSen += s.totalSen;
    else out.otherSen += s.totalSen;
    for (const l of s.lines) if (l.marginPct === null) noMargin.add(l.itemId);
  }
  out.itemsWithoutMargin = noMargin.size;
  return out;
}
