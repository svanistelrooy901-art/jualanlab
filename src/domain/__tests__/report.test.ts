import { describe, expect, it } from 'vitest';
import { buildReport, change, myDate, previousPeriod } from '../report';
import type { Sale } from '../sale';

let n = 0;
function sale(at: string, lines: { id: string; name: string; price: number; qty: number; cost: number | null }[], over: Partial<Sale> = {}): Sale {
  const subtotal = lines.reduce((t, l) => t + l.price * l.qty, 0);
  const discount = over.discountSen ?? 0;
  return {
    id: `s${++n}`, number: `A-${n}`, deviceId: 'd', createdAt: at, channel: 'counter', subtotalSen: subtotal, discountSen: discount, totalSen: subtotal - discount,
    method: 'cash', cashReceivedSen: null, changeSen: null, status: 'done', voidReason: null, voidedAt: null, dayId: null,
    lines: lines.map((l) => ({ itemId: l.id, name: l.name, unitPriceSen: l.price, quantity: l.qty, marginPct: null, note: '', unitCostSen: l.cost, listPriceSen: null, discountPct: null, promoId: null, promoName: null })),
    ...over,
  };
}
const kek = { id: 'kek', name: 'Kek batik', price: 500, cost: 140 };
const mur = { id: 'mur', name: 'Murtabak', price: 700, cost: 620 };

describe('Laporan', () => {
  it('Malaysian dates and the period before', () => {
    expect(myDate('2026-10-14T16:30:00.000Z')).toBe('2026-10-15');
    expect(previousPeriod('2026-10-01', '2026-10-15')).toEqual({ from: '2026-09-16', to: '2026-09-30' });
    expect(change(112, 100)).toBe(12);
    expect(change(5, 0)).toBeNull();
  });

  it('profit first: from UntungLab cost, after the order discount; voids left out; thin items flagged', () => {
    const sales = [
      sale('2026-10-03T03:00:00.000Z', [{ ...kek, qty: 2 }, { ...mur, qty: 3 }]), // Sat 11am MY
      sale('2026-10-03T12:30:00.000Z', [{ ...mur, qty: 5 }], { channel: 'online', method: 'qr' }), // Sat 8:30pm
      sale('2026-10-05T04:00:00.000Z', [{ ...kek, qty: 1 }, { id: 'air', name: 'Air', price: 150, qty: 2, cost: null }], { discountSen: 100 }),
      sale('2026-10-05T05:00:00.000Z', [{ ...kek, qty: 9 }], { status: 'void' }),
    ];
    const prev = [sale('2026-09-20T03:00:00.000Z', [{ ...kek, qty: 4 }])];
    const r = buildReport(sales, prev, '2026-10-01', '2026-10-07');
    // Sales: 1000+2100, 3500, 800-100 = 7300.
    expect(r.now).toMatchObject({ salesSen: 7300, count: 3, avgBasketSen: 2433 });
    // Profit: kek 2×360 + mur 3×80 = 960; mur 5×80 = 400; kek 360 less its share of RM1 off (500/800 × 100 = 62.5) = 297.5.
    expect(r.now.profitSen).toBe(1658);
    expect(r.prev).toMatchObject({ salesSen: 2000, profitSen: 1440 });
    expect(r.itemsWithoutCost).toBe(1);
    expect(r.items[0]).toMatchObject({ itemId: 'kek', quantity: 3, profitSen: 1018, thin: false });
    expect(r.items.find((i) => i.itemId === 'mur')).toMatchObject({ quantity: 8, profitSen: 640, marginPct: 11.4, thin: true });
    expect(r.items.find((i) => i.itemId === 'air')!.profitSen).toBeNull();
    expect(r.channels).toEqual({ counter: 3800, bazaar: 0, online: 3500 });
    expect(r.methods).toEqual({ cash: 3800, qr: 3500, ewallet: 0 });
    expect(r.heat[6]![11]).toBe(3100);
    expect(r.heat[6]![20]).toBe(3500);
    expect(r.daily.find((d) => d.date === '2026-10-03')).toMatchObject({ salesSen: 6600, profitSen: 1360 });
    expect(r.bestWeekday).toEqual({ day: 6, avgSen: 6600 });
    expect(r.orderDiscountSen).toBe(100);
  });
});
