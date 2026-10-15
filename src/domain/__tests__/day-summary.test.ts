import { describe, expect, it } from 'vitest';
import { salesCsv } from '../csv';
import { addDays, dayKey, dayRange, isDayKey } from '../day';
import { buildSale, voidSale, type Sale } from '../sale';
import { bestSellers, envelopes, expectedCash, summarise } from '../summary';

const line = (itemId: string, name: string, unitPriceSen: number, quantity: number, marginPct: number | null, note = '') => ({ itemId, name, unitPriceSen, quantity, marginPct, note });

function sale(id: string, lines: ReturnType<typeof line>[], method: 'cash' | 'qr' = 'cash', discountSen = 0, createdAt = '2026-10-11T07:42:00.000Z'): Sale {
  const total = lines.reduce((t, l) => t + l.unitPriceSen * l.quantity, 0) - discountSen;
  return buildSale({ id, number: 'AB-0001', deviceId: 'device-0001', createdAt, lines, discountSen, method, cashReceivedSen: method === 'cash' ? total : null });
}

describe('Malaysian business day', () => {
  it('starts at midnight Malaysia time', () => {
    expect(dayKey(new Date('2026-10-10T15:59:59Z'))).toBe('2026-10-10');
    expect(dayKey(new Date('2026-10-10T16:00:00Z'))).toBe('2026-10-11');
    expect(dayRange('2026-10-11')).toEqual({ from: '2026-10-10T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z' });
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('accepts only real dates', () => {
    expect(isDayKey('2026-02-29')).toBe(false);
    expect(isDayKey('2028-02-29')).toBe(true);
    expect(isDayKey('2026-1-01')).toBe(false);
    expect(() => dayRange('nope')).toThrow();
  });
});

describe('Money Envelopes', () => {
  it('splits takings into capital, profit and the part with no margin, adding up exactly', () => {
    const s = summarise([
      sale('sale-0001', [line('a', 'Karipap', 100, 10, 30), line('b', 'Air', 150, 2, null)]), // 10.00 at 30% + 3.00 no margin
      sale('sale-0002', [line('c', 'Kek', 500, 2, 40)], 'qr', 100), // 10.00 - 1.00 discount
    ]);
    expect(s).toMatchObject({ count: 2, totalSen: 2200, cashSen: 1300, otherSen: 900, byMethod: { cash: 1300, qr: 900, ewallet: 0 } });
    // profit: 300 + (400 - 100) = 600; margin takings: 1000 + 900 = 1900
    expect(s.estProfitSen).toBe(600);
    const e = envelopes(s);
    expect(e).toEqual({ capitalSen: 1300, profitSen: 600, unsplitSen: 300 });
    expect(e.capitalSen + e.profitSen + e.unsplitSen).toBe(s.totalSen);
  });
  it('shows a loss as negative profit, never hidden', () => {
    const e = envelopes(summarise([sale('sale-0003', [line('m', 'Murtabak', 700, 2, -4.5)])]));
    expect(e).toEqual({ capitalSen: 1463, profitSen: -63, unsplitSen: 0 });
  });
  it('leaves voided sales out of every total and counts them apart', () => {
    const v = voidSale(sale('sale-0004', [line('a', 'Karipap', 100, 5, 30)]), 'Salah tekan', '2026-10-11T08:00:00.000Z');
    const s = summarise([v, sale('sale-0005', [line('a', 'Karipap', 100, 1, 30)])]);
    expect(s).toMatchObject({ count: 1, totalSen: 100, voidCount: 1, voidSen: 500 });
    expect(expectedCash(s, 5000)).toBe(5100);
    expect(() => voidSale(v, ' ', '')).toThrow();
    expect(voidSale(v, 'Lagi', 'x')).toBe(v);
  });
  it('best sellers by quantity, voids left out', () => {
    const list = bestSellers([
      sale('sale-0006', [line('a', 'Karipap', 100, 10, 30), line('c', 'Kek', 500, 2, 40)]),
      sale('sale-0007', [line('c', 'Kek', 500, 3, 40)]),
      voidSale(sale('sale-0008', [line('c', 'Kek', 500, 50, 40)]), 'Salah', 'x'),
    ]);
    expect(list.map((b) => [b.name, b.quantity, b.revenueSen])).toEqual([['Karipap', 10, 1000], ['Kek', 5, 2500]]);
  });
});

describe('CSV export', () => {
  it('one row per line, Malaysia time, BOM, quoted and formula-safe', () => {
    const csv = salesCsv([
      sale('sale-0009', [line('a', 'Karipap, pedas', 100, 2, 30, '=SUM(A1)')], 'cash', 0, '2026-10-11T16:30:00.000Z'),
      voidSale(sale('sale-0010', [line('b', 'Air "sejuk"', 150, 1, null)], 'qr', 0, '2026-10-11T01:00:00.000Z'), 'Salah tekan', 'x'),
      sale('sale-0011', [line('m', 'Murtabak', 700, 1, -4.5)], 'qr', 0, '2026-10-11T02:00:00.000Z'),
    ]);
    expect(csv.startsWith('﻿Tarikh,Masa,Resit')).toBe(true);
    const rows = csv.trim().split('\r\n');
    expect(rows).toHaveLength(4);
    expect(rows[2]).toContain(',-4.5,'); // numbers are never escaped
    expect(rows[1]).toBe('2026-10-11,09:00,AB-0001,Kaunter,QR DuitNow,Batal,Salah tekan,"Air ""sejuk""",1,1.50,1.50,,,0.00,1.50,,,0.00');
    expect(rows[3]).toBe("2026-10-12,00:30,AB-0001,Kaunter,Tunai,Selesai,,\"Karipap, pedas\",2,1.00,2.00,30,'=SUM(A1),0.00,2.00,,,0.00");
  });
});
