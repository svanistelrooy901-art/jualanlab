/** Counter cart arithmetic. Everything in sen; every rounding happens here, once. */
import type { Item } from './items';
import { effectiveMargin, marginAt, unitCost } from './items';

export interface CartLine {
  itemId: string;
  name: string;
  /** Price charged for one, after any discount on this line. */
  unitPriceSen: number;
  quantity: number;
  /** Margin at the price charged (snapshot); null = not counted in profit. */
  marginPct: number | null;
  note: string;
  /** Cost of one from UntungLab (snapshot, may have a fraction of a sen); null for own items. Older lines lack it. */
  unitCostSen?: number | null;
  /** Counter price before the discount on this line; null when the line has no discount. */
  listPriceSen?: number | null;
  /** The percentage taken off; null for a custom price (or no discount). */
  discountPct?: number | null;
  /** The promotion that set this line's discount by itself (Diskaun & Promosi); null when none or changed by hand. */
  promoId?: string | null;
  promoName?: string | null;
}


export const MAX_LINE_QTY = 9999;
export const MAX_NOTE = 80;

export function lineFor(item: Item): CartLine {
  return {
    itemId: item.id, name: item.name, unitPriceSen: item.priceSen, quantity: 1, marginPct: effectiveMargin(item), note: '',
    unitCostSen: unitCost(item), listPriceSen: null, discountPct: null,
  };
}

/** A line with no note and no discount: further taps on the item add to it. */
export function isPlainLine(l: CartLine): boolean {
  return l.note === '' && (l.listPriceSen ?? null) === null;
}

/** A line made by taps alone: plain, or carrying only a promotion's discount. */
export function isTapLine(l: CartLine): boolean {
  return isPlainLine(l) || (l.note === '' && (l.promoId ?? null) !== null);
}

/** Adds one of the item; a second tap raises the quantity of its plain line (a discounted line stays as it is). */
export function addItem(lines: CartLine[], item: Item): CartLine[] {
  const i = lines.findIndex((l) => l.itemId === item.id && isPlainLine(l));
  if (i < 0) return [...lines, lineFor(item)];
  return lines.map((l, j) => (j === i ? { ...l, quantity: Math.min(MAX_LINE_QTY, l.quantity + 1) } : l));
}

/**
 * Takes one of the item off (the minus on a counter tile). Uses the plain line first, so a line the
 * cashier wrote a note on is kept as long as possible; a line that reaches zero is removed.
 */
export function removeOne(lines: CartLine[], itemId: string): CartLine[] {
  const last = (ok: (l: CartLine) => boolean) => {
    for (let j = lines.length - 1; j >= 0; j--) if (ok(lines[j]!)) return j;
    return -1;
  };
  let i = last((l) => l.itemId === itemId && isTapLine(l));
  if (i < 0) i = last((l) => l.itemId === itemId);
  return i < 0 ? lines : setQuantity(lines, i, lines[i]!.quantity - 1);
}

export function setQuantity(lines: CartLine[], index: number, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((_, j) => j !== index);
  return lines.map((l, j) => (j === index ? { ...l, quantity: Math.min(MAX_LINE_QTY, Math.floor(quantity)) } : l));
}

export type LineDiscount = { kind: 'pct'; pct: number } | { kind: 'price'; priceSen: number };

export const MAX_DISCOUNT_PCT = 100;

/** The price one unit sells for after a discount on its counter price; null when the discount is not valid. */
export function discountedPrice(listPriceSen: number, d: LineDiscount): number | null {
  if (d.kind === 'pct') {
    if (!Number.isFinite(d.pct) || d.pct <= 0 || d.pct > MAX_DISCOUNT_PCT) return null;
    return Math.round((listPriceSen * (100 - d.pct)) / 100);
  }
  if (!Number.isInteger(d.priceSen) || d.priceSen < 0 || d.priceSen > listPriceSen) return null;
  return d.priceSen;
}

/**
 * Gives one line a discount (or removes it with null). The margin is worked out again from UntungLab's cost, so
 * profit falls by exactly the discount; a line without an UntungLab cost stays out of profit.
 */
export function setLineDiscount(lines: CartLine[], index: number, d: LineDiscount | null): CartLine[] {
  return lines.map((l, j) => {
    if (j !== index) return l;
    const list = l.listPriceSen ?? l.unitPriceSen;
    const price = d === null ? list : discountedPrice(list, d);
    if (price === null) return l;
    // A line from before costs were kept carries only its margin at the counter price: the cost follows from it.
    const cost = l.unitCostSen ?? (l.listPriceSen == null && l.marginPct !== null ? (list * (100 - l.marginPct)) / 100 : null);
    const discounted = price !== list;
    return {
      ...l,
      unitPriceSen: price,
      unitCostSen: cost,
      marginPct: cost === null ? null : marginAt(price, cost),
      listPriceSen: discounted ? list : null,
      discountPct: discounted && d?.kind === 'pct' ? d.pct : null,
      // Changed by hand: no longer the promotion's.
      promoId: null,
      promoName: null,
    };
  });
}

/** Ringgit taken off this line by its own discount (0 when none). */
export function lineDiscountSen(l: Pick<CartLine, 'unitPriceSen' | 'quantity' | 'listPriceSen'>): number {
  return l.listPriceSen == null ? 0 : (l.listPriceSen - l.unitPriceSen) * l.quantity;
}

/** Profit on one line before any order discount; null when the line has no cost or margin from UntungLab. */
export function lineProfit(l: Pick<CartLine, 'unitPriceSen' | 'quantity' | 'marginPct' | 'unitCostSen'>): number | null {
  if (l.unitCostSen != null) return lineTotal(l) - l.unitCostSen * l.quantity;
  if (l.marginPct !== null) return (lineTotal(l) * l.marginPct) / 100;
  return null;
}

export function setNote(lines: CartLine[], index: number, note: string): CartLine[] {
  return lines.map((l, j) => (j === index ? { ...l, note: note.slice(0, MAX_NOTE) } : l));
}

export interface CartTotals {
  itemCount: number;
  subtotalSen: number;
  discountSen: number;
  totalSen: number;
  /** Estimated profit after discount, from lines that have a margin. */
  estProfitSen: number;
  /** Lines left out of the profit estimate because they have no margin. */
  linesWithoutMargin: number;
  /** Takings (after their share of the discount) from lines that have a margin. The rest is not split into cost and profit. */
  marginRevenueSen: number;
  /** Ringgit taken off by discounts on single items (the order discount is discountSen). */
  itemDiscountSen: number;
}

export function lineTotal(l: Pick<CartLine, 'unitPriceSen' | 'quantity'>): number {
  return l.unitPriceSen * l.quantity;
}

/**
 * The discount is shared across lines in proportion to their value, so lines without a margin take their
 * part of it too. Only the share on lines with a margin reduces estimated profit (cost does not change).
 */
export function cartTotals(lines: CartLine[], discountSen = 0): CartTotals {
  const subtotalSen = lines.reduce((s, l) => s + lineTotal(l), 0);
  const discount = Math.max(0, Math.min(Math.round(discountSen), subtotalSen));
  let profit = 0;
  let marginRevenue = 0;
  let without = 0;
  let itemDiscount = 0;
  for (const l of lines) {
    itemDiscount += lineDiscountSen(l);
    const p = lineProfit(l);
    if (p === null) {
      without++;
      continue;
    }
    profit += p;
    marginRevenue += lineTotal(l);
  }
  const discountOnMarginLines = subtotalSen === 0 ? 0 : (discount * marginRevenue) / subtotalSen;
  return {
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    subtotalSen,
    discountSen: discount,
    totalSen: subtotalSen - discount,
    estProfitSen: Math.round(profit - discountOnMarginLines),
    linesWithoutMargin: without,
    marginRevenueSen: Math.round(marginRevenue - discountOnMarginLines),
    itemDiscountSen: itemDiscount,
  };
}

/** Change owed for cash, or null when the cash given is not enough. */
export function changeDue(totalSen: number, receivedSen: number): number | null {
  return receivedSen >= totalSen ? receivedSen - totalSen : null;
}

/**
 * Quick cash buttons: the exact amount, then the common notes and round amounts above it.
 * RM1, 5, 10, 20, 50, 100 notes, plus the next whole RM5 and RM10 above the total.
 */
export function cashSuggestions(totalSen: number, max = 4): number[] {
  if (totalSen <= 0) return [];
  const out = new Set<number>([totalSen]);
  const up = (step: number) => Math.ceil(totalSen / step) * step;
  for (const v of [up(500), up(1000), 2000, 5000, 10000, up(5000), up(10000)]) {
    if (v > totalSen) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, max);
}
