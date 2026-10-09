/**
 * A completed sale. Created on the phone first (with its own id), then sent to the server, which stores it once
 * however many times it is sent (DECISIONS D-07). A sale is never deleted; a mistake is voided with a reason.
 */
import type { CartLine } from './cart';
import { cartTotals, changeDue, lineTotal, MAX_LINE_QTY, MAX_NOTE } from './cart';
import { formatRM } from './money';

export type PayMethod = 'cash' | 'qr' | 'ewallet';
export const PAY_METHODS: readonly PayMethod[] = ['cash', 'qr', 'ewallet'];

export interface SaleLine {
  itemId: string;
  name: string;
  unitPriceSen: number;
  quantity: number;
  marginPct: number | null;
  note: string;
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
}

export function buildSale(input: {
  id: string;
  number: string;
  deviceId: string;
  createdAt: string;
  channel?: Sale['channel'];
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
    lines: input.lines.map((l) => ({ ...l, note: l.note.trim() })),
    subtotalSen: t.subtotalSen,
    discountSen: t.discountSen,
    totalSen: t.totalSen,
    method: input.method,
    cashReceivedSen: cash,
    changeSen: change,
    status: 'done',
    voidReason: null,
    voidedAt: null,
  };
}

/** Receipt numbers: a short device tag and a running number, "A7-0012". */
export function receiptNumber(deviceTag: string, seq: number): string {
  return `${deviceTag}-${String(seq).padStart(4, '0')}`;
}

const ID = /^[A-Za-z0-9_-]{8,64}$/;
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
    lines.push({ itemId: l.itemId, name: l.name.trim(), unitPriceSen: l.unitPriceSen as number, quantity: l.quantity as number, marginPct: l.marginPct as number | null, note: l.note });
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
  if (s.status === 'void' && (typeof s.voidReason !== 'string' || s.voidReason.trim() === '')) return bad('voidReason');
  return {
    ok: true,
    sale: {
      id: s.id, number: s.number, deviceId: s.deviceId, createdAt: s.createdAt, channel: s.channel, lines,
      subtotalSen: subtotal, discountSen: s.discountSen as number, totalSen: s.totalSen as number, method: s.method as PayMethod,
      cashReceivedSen: (s.cashReceivedSen as number | null) ?? null, changeSen: (s.changeSen as number | null) ?? null,
      status: s.status, voidReason: s.status === 'void' ? (s.voidReason as string).trim() : null,
      voidedAt: typeof s.voidedAt === 'string' ? s.voidedAt : null,
    },
  };
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
  const when = new Date(sale.createdAt).toLocaleString(lang === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
  });
  const out = [`*${shopName}*`, `${L.receipt} ${sale.number} · ${when}`, ''];
  for (const l of sale.lines) {
    out.push(`${l.name} × ${l.quantity}  ${formatRM(lineTotal(l))}`);
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

export function methodLabel(m: PayMethod, lang: 'ms' | 'en'): string {
  return METHOD_LABEL[lang][m];
}
