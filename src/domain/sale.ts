/**
 * A completed sale. Created on the phone first (with its own id), then sent to the server, which stores it once
 * however many times it is sent (DECISIONS D-07). A sale is never deleted; a mistake is voided with a reason.
 */
import type { CartLine } from './cart';
import { cartTotals, changeDue, discountedPrice, lineTotal, MAX_LINE_QTY, MAX_NOTE } from './cart';
import { formatRM } from './money';
import { MAX_PROMO_NAME } from './promo';

export type PayMethod = 'cash' | 'qr' | 'ewallet';
export const PAY_METHODS: readonly PayMethod[] = ['cash', 'qr', 'ewallet'];

export interface SaleLine {
  itemId: string;
  name: string;
  /** Price charged for one, after any discount on this line. */
  unitPriceSen: number;
  quantity: number;
  marginPct: number | null;
  note: string;
  /** Cost of one from UntungLab at the time of sale; null for own items and sales made before costs were kept. */
  unitCostSen?: number | null;
  /** Counter price before this line's discount; null when the line had none. */
  listPriceSen?: number | null;
  /** Percentage taken off; null for a custom price or no discount. */
  discountPct?: number | null;
  /** The promotion that gave this line its discount (Diskaun & Promosi), with its name at the time of sale. */
  promoId?: string | null;
  promoName?: string | null;
}

export interface Sale {
  id: string;
  /** Receipt number shown to the customer, for example "A7-0012". Unique per device. */
  number: string;
  deviceId: string;
  createdAt: string;
  channel: 'counter' | 'bazaar';
  lines: SaleLine[];
  subtotalSen: number;
  discountSen: number;
  totalSen: number;
  method: PayMethod;
  cashReceivedSen: number | null;
  changeSen: number | null;
  status: 'done' | 'void';
  voidReason: string | null;
  voidedAt: string | null;
  /**
   * The business day this sale belongs to (T-07). Set by the phone from the day open at the time; null only on
   * sales made by an app from before business days, which the server places in the right day itself.
   */
  dayId: string | null;
}

export function buildSale(input: {
  id: string;
  number: string;
  deviceId: string;
  createdAt: string;
  channel?: Sale['channel'];
  dayId?: string | null;
  lines: CartLine[];
  discountSen: number;
  method: PayMethod;
  cashReceivedSen: number | null;
}): Sale {
  if (input.lines.length === 0) throw new Error('empty sale');
  const t = cartTotals(input.lines, input.discountSen);
  const cash = input.method === 'cash' ? input.cashReceivedSen : null;
  const change = cash === null ? null : changeDue(t.totalSen, cash);
  if (input.method === 'cash' && (cash === null || change === null)) throw new Error('cash received is less than the total');
  return {
    id: input.id,
    number: input.number,
    deviceId: input.deviceId,
    createdAt: input.createdAt,
    channel: input.channel ?? 'counter',
    lines: input.lines.map((l) => ({
      itemId: l.itemId, name: l.name, unitPriceSen: l.unitPriceSen, quantity: l.quantity, marginPct: l.marginPct, note: l.note.trim(),
      unitCostSen: l.unitCostSen ?? null, listPriceSen: l.listPriceSen ?? null, discountPct: l.discountPct ?? null,
      promoId: l.listPriceSen != null ? (l.promoId ?? null) : null, promoName: l.listPriceSen != null && l.promoId ? (l.promoName ?? null) : null,
    })),
    subtotalSen: t.subtotalSen,
    discountSen: t.discountSen,
    totalSen: t.totalSen,
    method: input.method,
    cashReceivedSen: cash,
    changeSen: change,
    status: 'done',
    voidReason: null,
    voidedAt: null,
    dayId: input.dayId ?? null,
  };
}

/** Receipt numbers: a short device tag and a running number, "A7-0012". */
export function receiptNumber(deviceTag: string, seq: number): string {
  return `${deviceTag}-${String(seq).padStart(4, '0')}`;
}

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const ID_ANY = /^[A-Za-z0-9_-]{1,64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Server-side check of a sale sent by a phone. Totals are recomputed from the lines and must match;
 * the server never trusts a total it did not add up itself.
 */
export function validateSale(json: unknown): { ok: true; sale: Sale } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error });
  if (typeof json !== 'object' || json === null) return bad('sale must be an object');
  const s = json as Record<string, unknown>;
  if (typeof s.id !== 'string' || !ID.test(s.id)) return bad('id');
  if (typeof s.number !== 'string' || !/^[A-Z0-9]{2,4}-\d{4,6}$/.test(s.number)) return bad('number');
  if (typeof s.deviceId !== 'string' || !ID.test(s.deviceId)) return bad('deviceId');
  if (typeof s.createdAt !== 'string' || !ISO.test(s.createdAt) || !Number.isFinite(Date.parse(s.createdAt))) return bad('createdAt');
  if (s.channel !== 'counter' && s.channel !== 'bazaar') return bad('channel');
  if (!Array.isArray(s.lines) || s.lines.length === 0 || s.lines.length > 200) return bad('lines');
  const lines: SaleLine[] = [];
  for (const [i, raw] of (s.lines as unknown[]).entries()) {
    const l = raw as Record<string, unknown>;
    if (typeof l !== 'object' || l === null) return bad(`lines[${i}]`);
    if (typeof l.itemId !== 'string' || !ID.test(l.itemId)) return bad(`lines[${i}].itemId`);
    if (typeof l.name !== 'string' || l.name.trim() === '' || l.name.length > 120) return bad(`lines[${i}].name`);
    if (!isInt(l.unitPriceSen, 0, 10_000_000)) return bad(`lines[${i}].unitPriceSen`);
    if (!isInt(l.quantity, 1, MAX_LINE_QTY)) return bad(`lines[${i}].quantity`);
    if (l.marginPct !== null && (typeof l.marginPct !== 'number' || !Number.isFinite(l.marginPct) || l.marginPct > 100)) return bad(`lines[${i}].marginPct`);
    if (typeof l.note !== 'string' || l.note.length > MAX_NOTE) return bad(`lines[${i}].note`);
    const cost = l.unitCostSen ?? null;
    if (cost !== null && (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0 || cost > 10_000_000)) return bad(`lines[${i}].unitCostSen`);
    const list = l.listPriceSen ?? null;
    const pct = l.discountPct ?? null;
    if (list !== null) {
      // A discounted line: charged no more than its counter price, and a percentage must give exactly that price.
      if (!isInt(list, l.unitPriceSen as number, 10_000_000) || list === l.unitPriceSen) return bad(`lines[${i}].listPriceSen`);
      if (pct !== null && (typeof pct !== 'number' || discountedPrice(list as number, { kind: 'pct', pct }) !== l.unitPriceSen)) return bad(`lines[${i}].discountPct`);
    } else if (pct !== null) {
      return bad(`lines[${i}].discountPct`);
    }
    // A promotion's name rides along with its discount, for receipts and the promotions report.
    const promoId = l.promoId ?? null;
    const promoName = l.promoName ?? null;
    if (promoId !== null && (typeof promoId !== 'string' || !ID_ANY.test(promoId) || list === null)) return bad(`lines[${i}].promoId`);
    if (promoId === null ? promoName !== null : typeof promoName !== 'string' || promoName.trim() === '' || promoName.length > MAX_PROMO_NAME) return bad(`lines[${i}].promoName`);
    lines.push({
      itemId: l.itemId, name: l.name.trim(), unitPriceSen: l.unitPriceSen as number, quantity: l.quantity as number, marginPct: l.marginPct as number | null, note: l.note,
      unitCostSen: cost as number | null, listPriceSen: list as number | null, discountPct: pct as number | null,
      promoId: promoId as string | null, promoName: promoName === null ? null : (promoName as string).trim(),
    });
  }
  const subtotal = lines.reduce((t, l) => t + lineTotal(l), 0);
  if (s.subtotalSen !== subtotal) return bad('subtotalSen does not match the lines');
  if (!isInt(s.discountSen, 0, subtotal)) return bad('discountSen');
  if (s.totalSen !== subtotal - (s.discountSen as number)) return bad('totalSen does not match');
  if (typeof s.method !== 'string' || !(PAY_METHODS as readonly string[]).includes(s.method)) return bad('method');
  if (s.method === 'cash') {
    if (!isInt(s.cashReceivedSen, s.totalSen as number, 100_000_000)) return bad('cashReceivedSen');
    if (s.changeSen !== (s.cashReceivedSen as number) - (s.totalSen as number)) return bad('changeSen');
  } else if (s.cashReceivedSen !== null || s.changeSen !== null) {
    return bad('cash fields are only for cash');
  }
  if (s.status !== 'done' && s.status !== 'void') return bad('status');
  if (s.status === 'void' && !validVoidReason(s.voidReason)) return bad('voidReason');
  if (s.dayId !== undefined && s.dayId !== null && (typeof s.dayId !== 'string' || !ID.test(s.dayId))) return bad('dayId');
  return {
    ok: true,
    sale: {
      id: s.id, number: s.number, deviceId: s.deviceId, createdAt: s.createdAt, channel: s.channel, lines,
      subtotalSen: subtotal, discountSen: s.discountSen as number, totalSen: s.totalSen as number, method: s.method as PayMethod,
      cashReceivedSen: (s.cashReceivedSen as number | null) ?? null, changeSen: (s.changeSen as number | null) ?? null,
      status: s.status, voidReason: s.status === 'void' ? (s.voidReason as string).trim() : null,
      voidedAt: typeof s.voidedAt === 'string' ? s.voidedAt : null,
      dayId: typeof s.dayId === 'string' ? s.dayId : null,
    },
  };
}

export const MAX_VOID_REASON = 120;

export function validVoidReason(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= MAX_VOID_REASON;
}

/** A void is a change of status with a reason; the sale and its lines stay in the record. */
export function voidSale(sale: Sale, reason: string, at: string): Sale {
  if (!validVoidReason(reason)) throw new Error('a void needs a reason');
  if (sale.status === 'void') return sale;
  return { ...sale, status: 'void', voidReason: reason.trim(), voidedAt: at };
}

function isInt(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

const METHOD_LABEL: Record<'ms' | 'en', Record<PayMethod, string>> = {
  ms: { cash: 'Tunai', qr: 'QR DuitNow', ewallet: 'E-wallet' },
  en: { cash: 'Cash', qr: 'DuitNow QR', ewallet: 'E-wallet' },
};

/** Plain-text receipt for WhatsApp. */
export function receiptText(shopName: string, sale: Sale, lang: 'ms' | 'en' = 'ms'): string {
  const L = lang === 'ms'
    ? { receipt: 'Resit', total: 'Jumlah', discount: 'Diskaun', paid: 'Dibayar', change: 'Baki', thanks: 'Terima kasih!' }
    : { receipt: 'Receipt', total: 'Total', discount: 'Discount', paid: 'Paid', change: 'Change', thanks: 'Thank you!' };
  const off = lineDiscountText(lang);
  const when = new Date(sale.createdAt).toLocaleString(lang === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
  });
  const out = [`*${shopName}*`, `${L.receipt} ${sale.number} · ${when}`, ''];
  for (const l of sale.lines) {
    out.push(`${l.name} × ${l.quantity}  ${formatRM(lineTotal(l))}`);
    const d = off(l);
    if (d) out.push(`  ${d}`);
    if (l.note) out.push(`  (${l.note})`);
  }
  out.push('');
  if (sale.discountSen > 0) out.push(`${L.discount}: ${formatRM(-sale.discountSen)}`);
  out.push(`*${L.total}: ${formatRM(sale.totalSen)}*`);
  out.push(`${L.paid}: ${METHOD_LABEL[lang][sale.method]}${sale.cashReceivedSen !== null ? ` ${formatRM(sale.cashReceivedSen)}` : ''}`);
  if (sale.changeSen) out.push(`${L.change}: ${formatRM(sale.changeSen)}`);
  out.push('', L.thanks);
  return out.join('\n');
}

/**
 * "Diskaun 10% (asal RM2.50)" or "Harga khas (asal RM2.50)" for a discounted line, led by the promotion's name when
 * a promotion gave it ("Promo Oktober: Diskaun 10% (asal RM2.50)"); null for a line without a discount.
 */
export function lineDiscountText(lang: 'ms' | 'en') {
  return (l: Pick<SaleLine, 'listPriceSen' | 'discountPct' | 'promoName'>): string | null => {
    if (l.listPriceSen == null) return null;
    const was = formatRM(l.listPriceSen);
    const promo = l.promoName ? `${l.promoName}: ` : '';
    if (l.discountPct != null) {
      const pct = `${Math.round(l.discountPct * 100) / 100}%`;
      return lang === 'ms' ? `${promo}Diskaun ${pct} (asal ${was})` : `${promo}${pct} off (was ${was})`;
    }
    if (promo) return lang === 'ms' ? `${promo}Harga promosi (asal ${was})` : `${promo}Promo price (was ${was})`;
    return lang === 'ms' ? `Harga khas (asal ${was})` : `Special price (was ${was})`;
  };
}

export function methodLabel(m: PayMethod, lang: 'ms' | 'en'): string {
  return METHOD_LABEL[lang][m];
}
