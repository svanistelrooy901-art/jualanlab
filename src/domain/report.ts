/**
 * Laporan (sales reports, DECISIONS L-01, L-02): a period's sales and profit, compared with the period just before
 * it. Profit comes only from UntungLab's cost or margin on each line (lines without one are counted in sales but
 * not in profit, and the report says how many). Voided sales are left out. Times are Malaysian (UTC+8, no DST).
 */
import { cartTotals, lineDiscountSen, lineProfit, lineTotal } from './cart';
import type { PayMethod, Sale } from './sale';
import { promoTotals, type PromoTotal } from './summary';

const MY_MS = 8 * 3600_000;

export interface Headline {
  profitSen: number;
  salesSen: number;
  /** Profit ÷ sales of lines with a cost (null when none had one). */
  marginPct: number | null;
  count: number;
  avgBasketSen: number;
}

export interface ReportItem {
  itemId: string;
  name: string;
  quantity: number;
  /** Takings after item and order discounts. */
  revenueSen: number;
  /** Null when the item has no cost from UntungLab. */
  profitSen: number | null;
  marginPct: number | null;
  /** Sells a lot but earns little: top half by quantity and margin under 20%. */
  thin: boolean;
}

export interface Report {
  from: string;
  to: string;
  days: number;
  now: Headline;
  prev: Headline;
  /** Distinct items sold without a cost, so not in profit. */
  itemsWithoutCost: number;
  daily: { date: string; salesSen: number; profitSen: number }[];
  items: ReportItem[];
  channels: Record<Sale['channel'], number>;
  prevChannels: Record<Sale['channel'], number>;
  methods: Record<PayMethod, number>;
  /** Sales by Malaysian weekday (0 = Sunday) and hour (0–23). */
  heat: number[][];
  promos: PromoTotal[];
  itemDiscountSen: number;
  orderDiscountSen: number;
  /** The weekday with the highest average day, and its average. */
  bestWeekday: { day: number; avgSen: number } | null;
}

/** "YYYY-MM-DD" in Malaysia for an instant. */
export function myDate(iso: string): string {
  return new Date(Date.parse(iso) + MY_MS).toISOString().slice(0, 10);
}

/** The instant a Malaysian date starts. */
export function myDayStart(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - MY_MS).toISOString();
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) + 1;
}

/** The period of the same length just before [from, to]. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const n = daysBetween(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

function headline(sales: readonly Sale[]): Headline & { marginRevenueSen: number } {
  let profit = 0, salesSen = 0, marginRevenue = 0, count = 0;
  for (const s of sales) {
    if (s.status !== 'done') continue;
    const t = cartTotals(s.lines, s.discountSen);
    profit += t.estProfitSen;
    marginRevenue += t.marginRevenueSen;
    salesSen += s.totalSen;
    count++;
  }
  return {
    profitSen: Math.round(profit), salesSen, count, avgBasketSen: count ? Math.round(salesSen / count) : 0,
    marginPct: marginRevenue > 0 ? Math.round((profit / marginRevenue) * 1000) / 10 : null, marginRevenueSen: marginRevenue,
  };
}

export function buildReport(sales: readonly Sale[], prevSales: readonly Sale[], from: string, to: string): Report {
  const done = sales.filter((s) => s.status === 'done');
  const days = daysBetween(from, to);
  const daily = Array.from({ length: days }, (_, i) => ({ date: addDays(from, i), salesSen: 0, profitSen: 0 }));
  const dayIndex = new Map(daily.map((d, i) => [d.date, i]));
  const items = new Map<string, { itemId: string; name: string; quantity: number; revenue: number; profit: number; hasCost: boolean }>();
  const channels: Record<Sale['channel'], number> = { counter: 0, bazaar: 0, online: 0 };
  const methods: Record<PayMethod, number> = { cash: 0, qr: 0, ewallet: 0 };
  const heat = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  let itemDiscountSen = 0, orderDiscountSen = 0;
  const noCost = new Set<string>();

  for (const s of done) {
    const t = cartTotals(s.lines, s.discountSen);
    const i = dayIndex.get(myDate(s.createdAt));
    if (i !== undefined) {
      daily[i]!.salesSen += s.totalSen;
      daily[i]!.profitSen += t.estProfitSen;
    }
    channels[s.channel] += s.totalSen;
    methods[s.method] += s.totalSen;
    const local = new Date(Date.parse(s.createdAt) + MY_MS);
    heat[local.getUTCDay()]![local.getUTCHours()]! += s.totalSen;
    orderDiscountSen += t.discountSen;
    // The order discount is shared across lines by value, as at the counter (cart.ts).
    const share = t.subtotalSen > 0 ? t.discountSen / t.subtotalSen : 0;
    for (const l of s.lines) {
      itemDiscountSen += lineDiscountSen(l);
      const value = lineTotal(l);
      const p = lineProfit(l);
      const e = items.get(l.itemId) ?? { itemId: l.itemId, name: l.name, quantity: 0, revenue: 0, profit: 0, hasCost: false };
      e.name = l.name;
      e.quantity += l.quantity;
      e.revenue += value * (1 - share);
      if (p !== null) {
        e.profit += p - value * share;
        e.hasCost = true;
      } else noCost.add(l.itemId);
      items.set(l.itemId, e);
    }
  }

  const list = [...items.values()];
  const byQty = [...list].sort((a, b) => b.quantity - a.quantity);
  const topHalf = new Set(byQty.slice(0, Math.max(1, Math.ceil(byQty.length / 2))).map((x) => x.itemId));
  const reportItems: ReportItem[] = list
    .map((x) => {
      const revenueSen = Math.round(x.revenue);
      const profitSen = x.hasCost ? Math.round(x.profit) : null;
      const marginPct = profitSen !== null && revenueSen > 0 ? Math.round((profitSen / revenueSen) * 1000) / 10 : null;
      return { itemId: x.itemId, name: x.name, quantity: x.quantity, revenueSen, profitSen, marginPct, thin: marginPct !== null && marginPct < 20 && topHalf.has(x.itemId) && list.length > 1 };
    })
    .sort((a, b) => (b.profitSen ?? -Infinity) - (a.profitSen ?? -Infinity) || b.revenueSen - a.revenueSen);

  // Best weekday: average of the days in the period falling on it (days with no sales count as zero).
  const perWeekday = Array.from({ length: 7 }, () => ({ total: 0, n: 0 }));
  for (const d of daily) {
    const w = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    perWeekday[w]!.total += d.salesSen;
    perWeekday[w]!.n++;
  }
  let bestWeekday: Report['bestWeekday'] = null;
  if (days >= 7) {
    perWeekday.forEach((w, day) => {
      const avg = w.n ? Math.round(w.total / w.n) : 0;
      if (avg > 0 && (!bestWeekday || avg > bestWeekday.avgSen)) bestWeekday = { day, avgSen: avg };
    });
  }

  const prevChannels: Record<Sale['channel'], number> = { counter: 0, bazaar: 0, online: 0 };
  for (const s of prevSales) if (s.status === 'done') prevChannels[s.channel] += s.totalSen;
  const { marginRevenueSen: _a, ...now } = headline(sales);
  const { marginRevenueSen: _b, ...prev } = headline(prevSales);

  return {
    from, to, days, now, prev, itemsWithoutCost: noCost.size, daily, items: reportItems, channels, prevChannels, methods, heat,
    promos: promoTotals([...sales]), itemDiscountSen, orderDiscountSen, bestWeekday,
  };
}

/** Change against the previous period in percent (one decimal); null when there was nothing before. */
export function change(now: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((now - prev) / Math.abs(prev)) * 1000) / 10;
}
