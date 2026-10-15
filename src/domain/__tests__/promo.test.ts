import { describe, expect, it } from 'vitest';
import { cartTotals, removeOne, setLineDiscount } from '../cart';
import type { Item } from '../items';
import { addItemWithPromos, bestPromo, covers, daysLeft, promoItems, promoPrice, promoStatus, validatePresets, validatePromo, validPct, type Promo } from '../promo';
import { buildSale, lineDiscountText, receiptText, validateSale } from '../sale';
import { salesCsv } from '../csv';

function item(id: string, priceSen: number, marginPct: number | null, category: string | null = 'Kek'): Item {
  return {
    id, source: marginPct === null ? 'own' : 'untunglab', ulMenuId: marginPct === null ? null : `m-${id}`, name: id, category, priceSen,
    ulPriceSen: marginPct === null ? null : priceSen, marginPct, status: null, baseUlMenuId: null, active: true, updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function promo(over: Partial<Promo> = {}): Promo {
  return {
    id: 'p-oct', name: 'Promo Oktober', kind: 'pct', pct: 10, scope: 'all', categories: [], itemIds: [], prices: {},
    startDate: '2026-10-01', endDate: '2026-10-31', on: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...over,
  };
}

const kek = item('kek-batik', 1200, 40); // costs RM7.20
const karipap = item('karipap', 100, 31.2, 'Kuih');
const air = item('air', 150, null, 'Minuman');

describe('promotions', () => {
  it('run between their dates (both included), on business days, and can be switched off', () => {
    const p = promo();
    expect(promoStatus(p, '2026-09-30')).toBe('scheduled');
    expect(promoStatus(p, '2026-10-01')).toBe('running');
    expect(promoStatus(p, '2026-10-31')).toBe('running');
    expect(promoStatus(p, '2026-11-01')).toBe('ended');
    expect(promoStatus({ ...p, endDate: null }, '2030-01-01')).toBe('running');
    expect(promoStatus({ ...p, on: false }, '2026-10-15')).toBe('off');
    expect(daysLeft(p, '2026-10-29')).toBe(3);
    expect(daysLeft({ endDate: null }, '2026-10-29')).toBeNull();
  });

  it('cover all items, some categories (including items added later) or some items', () => {
    expect(covers(promo(), air)).toBe(true);
    const cakes = promo({ scope: 'categories', categories: ['Kek'] });
    expect([kek, karipap, air].map((i) => covers(cakes, i))).toEqual([true, false, false]);
    expect(covers(cakes, item('kek-baru', 900, 30))).toBe(true);
    expect(covers(cakes, item('tiada', 900, 30, null))).toBe(false);
    const picked = promo({ scope: 'items', itemIds: ['karipap'] });
    expect([kek, karipap].map((i) => covers(picked, i))).toEqual([false, true]);
  });

  it('a special price applies only when it is lower than the counter price', () => {
    const p = promo({ kind: 'price', pct: null, scope: 'items', prices: { 'kek-batik': 1000, karipap: 100 } });
    expect(promoPrice(p, kek)).toBe(1000);
    expect(promoPrice(p, karipap)).toBeNull(); // same price: no discount
    expect(promoPrice(p, { ...karipap, priceSen: 90 })).toBeNull(); // the counter price went below it
    expect(promoPrice(p, air)).toBeNull();
  });

  it('the customer gets the lowest price when two promotions cover an item; ties go to the older one', () => {
    const a = promo({ id: 'a', pct: 10, createdAt: '2026-10-02T00:00:00.000Z' });
    const b = promo({ id: 'b', name: 'Kek Raya', scope: 'categories', categories: ['Kek'], pct: 20, createdAt: '2026-10-03T00:00:00.000Z' });
    expect(bestPromo([a, b], kek, '2026-10-15')).toMatchObject({ promo: { id: 'b' }, priceSen: 960 });
    expect(bestPromo([a, b], karipap, '2026-10-15')).toMatchObject({ promo: { id: 'a' }, priceSen: 90 });
    const twin = promo({ id: 'c', createdAt: '2026-10-01T00:00:00.000Z' });
    expect(bestPromo([a, twin], karipap, '2026-10-15')?.promo.id).toBe('c');
    expect(bestPromo([a, b], kek, '2026-11-01')).toBeNull();
    expect(bestPromo([a, b], kek, null)).toBeNull(); // no business day open
    expect(bestPromo([{ ...b, on: false }], kek, '2026-10-15')).toBeNull();
  });

  it('a tap at the counter puts the promotion on the line with its margin from UntungLab\'s cost; more taps add to it', () => {
    const p = promo();
    let lines = addItemWithPromos([], kek, [p], '2026-10-15');
    lines = addItemWithPromos(lines, kek, [p], '2026-10-15');
    lines = addItemWithPromos(lines, air, [], '2026-10-15');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ quantity: 2, unitPriceSen: 1080, listPriceSen: 1200, discountPct: 10, marginPct: 33.33, promoId: 'p-oct', promoName: 'Promo Oktober' });
    expect(cartTotals(lines)).toMatchObject({ subtotalSen: 2310, itemDiscountSen: 240, estProfitSen: 720 }); // (10.80 − 7.20) × 2
    // The cashier changes it for this customer: no longer the promotion's, and the next tap starts a promotion line again.
    lines = setLineDiscount(lines, 0, { kind: 'pct', pct: 15 });
    expect(lines[0]).toMatchObject({ unitPriceSen: 1020, promoId: null, promoName: null });
    lines = addItemWithPromos(lines, kek, [p], '2026-10-15');
    expect(lines.map((l) => [l.quantity, l.unitPriceSen, l.promoId ?? null])).toEqual([[2, 1020, null], [1, 150, null], [1, 1080, 'p-oct']]);
    // The minus on a tile takes from the promotion line before the line changed by hand.
    lines = removeOne(lines, 'kek-batik');
    expect(lines.map((l) => [l.quantity, l.unitPriceSen])).toEqual([[2, 1020], [1, 150]]);
  });

  it('a promotion that is edited while a line is in the cart starts a new line at the new price', () => {
    let lines = addItemWithPromos([], kek, [promo()], '2026-10-15');
    lines = addItemWithPromos(lines, kek, [promo({ pct: 20 })], '2026-10-15');
    expect(lines.map((l) => [l.quantity, l.unitPriceSen])).toEqual([[1, 1080], [1, 960]]);
  });

  it('receipts, CSV and the server check carry the promotion\'s name', () => {
    const lines = addItemWithPromos([], kek, [promo()], '2026-10-15');
    const special = addItemWithPromos([], kek, [promo({ id: 'p2', name: 'Harga Raya', kind: 'price', pct: null, scope: 'items', prices: { 'kek-batik': 1000 } })], '2026-10-15');
    const sale = buildSale({ id: 'sale-0001-aaaa', number: 'A7-0001', deviceId: 'device-0001', createdAt: '2026-10-15T03:00:00.000Z', discountSen: 0, lines: [...lines, ...special], method: 'qr', cashReceivedSen: null });
    expect(lineDiscountText('ms')(sale.lines[0]!)).toBe('Promo Oktober: Diskaun 10% (asal RM12.00)');
    expect(lineDiscountText('en')(sale.lines[1]!)).toBe('Harga Raya: Promo price (was RM12.00)');
    expect(receiptText('Dapur', sale)).toContain('  Harga Raya: Harga promosi (asal RM12.00)');
    const csv = salesCsv([sale]).split('\r\n');
    expect(csv[0]!.endsWith(',Promosi')).toBe(true);
    expect(csv[1]!.endsWith(',Promo Oktober')).toBe(true);
    const v = validateSale(JSON.parse(JSON.stringify(sale)));
    expect(v.ok && v.sale.lines.map((l) => l.promoName)).toEqual(['Promo Oktober', 'Harga Raya']);
    // A plain line never carries a promotion.
    const plain = buildSale({ ...sale, id: 'sale-0002-aaaa', lines: [{ ...lines[0]!, listPriceSen: null, discountPct: null, unitPriceSen: 1200 }] });
    expect(plain.lines[0]).toMatchObject({ promoId: null, promoName: null });
  });

  it('the editor\'s list shows every active item covered and its price', () => {
    const p = promo({ scope: 'categories', categories: ['Kek'] });
    const sold = { ...item('lama', 800, 30), active: false };
    expect(promoItems(p, [kek, karipap, sold]).map((x) => [x.item.id, x.priceSen])).toEqual([['kek-batik', 1080]]);
  });

  it('checks percentages and the three quick buttons', () => {
    expect([10, 12.5, 0.07, 100].every(validPct)).toBe(true);
    expect([0, 100.5, 10.555, NaN, '5'].some(validPct)).toBe(false);
    expect(validatePresets([20, 10, 30])).toEqual([10, 20, 30]);
    expect(validatePresets([10, 10, 30])).toBeNull();
    expect(validatePresets([10, 20])).toBeNull();
    expect(validatePromo({ name: 'X', kind: 'pct', pct: 5, scope: 'all', startDate: '2026-10-01', on: true }, new Set()).ok).toBe(true);
  });
});
