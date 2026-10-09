/** Counter cart arithmetic. Everything in sen; every rounding happens here, once. */
import type { Item } from './items';
import { effectiveMargin } from './items';

export interface CartLine {
  itemId: string;
  name: string;
  unitPriceSen: number;
  quantity: number;
  /** Margin snapshot taken when the line was added; null = not counted in profit. */
  marginPct: number | null;
  note: string;
}

export const MAX_LINE_QTY = 9999;
export const MAX_NOTE = 80;

export function lineFor(item: Item): CartLine {
  return { itemId: item.id, name: item.name, unitPriceSen: item.priceSen, quantity: 1, marginPct: effectiveMargin(item), note: '' };
}

/** Adds one of the item; a second tap on the same item (with no note) raises its quantity. */
export function addItem(lines: CartLine[], item: Item): CartLine[] {
  const i = lines.findIndex((l) => l.itemId === item.id && l.note === '');
  if (i < 0) return [...lines, lineFor(item)];
  return lines.map((l, j) => (j === i ? { ...l, quantity: Math.min(MAX_LINE_QTY, l.quantity + 1) } : l));
}

export function setQuantity(lines: CartLine[], index: number, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((_, j) => j !== index);
  return lines.map((l, j) => (j === index ? { ...l, quantity: Math.min(MAX_LINE_QTY, Math.floor(quantity)) } : l));
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
  for (const l of lines) {
    if (l.marginPct === null) {
      without++;
      continue;
    }
    profit += (lineTotal(l) * l.marginPct) / 100;
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
