/**
 * Sales export: one row per item line, with the sale's own columns repeated, so a spreadsheet can total by item
 * or by receipt. UTF-8 with a BOM so Excel shows Malay text correctly; amounts in ringgit with 2 decimals.
 */
import { lineDiscountSen, lineTotal } from './cart';
import type { Sale } from './sale';

const HEADERS = [
  'Tarikh', 'Masa', 'Resit', 'Saluran', 'Cara bayar', 'Status', 'Sebab batal', 'Item', 'Kuantiti', 'Harga seunit (RM)', 'Jumlah item (RM)', 'Margin (%)', 'Nota',
  'Diskaun resit (RM)', 'Jumlah resit (RM)', 'Harga asal seunit (RM)', 'Diskaun item (%)', 'Diskaun item (RM)', 'Promosi',
];

const rm = (sen: number) => (sen / 100).toFixed(2);

/** Free text typed by people (names, notes, reasons): a leading = + - @ would run as a formula in a spreadsheet. */
const text = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

function cell(safe: string): string {
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function salesCsv(sales: Sale[]): string {
  const rows = [HEADERS];
  const sorted = [...sales].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const s of sorted) {
    const local = new Date(Date.parse(s.createdAt) + 8 * 3600_000).toISOString();
    for (const l of s.lines) {
      rows.push([
        local.slice(0, 10), local.slice(11, 16), s.number, s.channel === 'bazaar' ? 'Bazar' : 'Kaunter',
        { cash: 'Tunai', qr: 'QR DuitNow', ewallet: 'E-wallet' }[s.method], s.status === 'void' ? 'Batal' : 'Selesai', text(s.voidReason ?? ''),
        text(l.name), String(l.quantity), rm(l.unitPriceSen), rm(lineTotal(l)), l.marginPct === null ? '' : String(l.marginPct), text(l.note),
        rm(s.discountSen), rm(s.totalSen),
        l.listPriceSen == null ? '' : rm(l.listPriceSen), l.discountPct == null ? '' : String(l.discountPct), rm(lineDiscountSen(l)),
        text(l.promoName ?? ''),
      ]);
    }
  }
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
