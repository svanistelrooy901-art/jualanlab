import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PriceList } from '../../link';
import { addItem, cartTotals, discountedPrice, DISCOUNT_PRESETS, removeOne, setLineDiscount, cashSuggestions, changeDue, setNote, setQuantity, type CartLine } from '../cart';
import { planImport, planIsEmpty, planWrites } from '../importPlan';
import { effectiveMargin, groupByCategory, isPriceOverridden, marginAt, unitCost, type Item } from '../items';
import { formatPct, formatRM, formatRMShort, parseRinggit } from '../money';
import { buildSale, receiptNumber, receiptText, validateSale } from '../sale';
import { receiptDoc, receiptFileName } from '../receiptDoc';
import { salesCsv } from '../csv';
import { wrap } from '../../app/receiptImage';

const price = JSON.parse(readFileSync(new URL('../../../spec/fixtures/price-list.valid.json', import.meta.url), 'utf8')) as PriceList;
const NOW = '2026-10-10T09:00:00.000Z';
let n = 0;
const newId = () => `item-${String(++n).padStart(4, '0')}`;

describe('money', () => {
  it('formats sen as ringgit with a real minus sign', () => {
    expect(formatRM(0)).toBe('RM0.00');
    expect(formatRM(100)).toBe('RM1.00');
    expect(formatRM(123456)).toBe('RM1,234.56');
    expect(formatRM(-500)).toBe('−RM5.00');
    expect(formatRM(-0.4)).toBe('RM0.00');
    expect(formatRMShort(700)).toBe('RM7');
    expect(formatRMShort(350)).toBe('RM3.50');
  });
  it.each([
    ['5', 500], ['5.5', 550], ['5,50', 550], ['RM 1,000', 100000], ['1,000.50', 100050], ['0', 0], ['rm3', 300], [' 12.05 ', 1205], ['1,00', 100],
  ])('reads "%s" as %i sen', (s, sen) => expect(parseRinggit(s)).toBe(sen));
  it.each(['', 'abc', '-5', '5.555', '1,0000', '1,000,0', '5..5', '1.000,50'])('rejects "%s"', (s) => expect(parseRinggit(s)).toBeNull());
  it('formats a percentage, and "—" for unknown', () => {
    expect(formatPct(31.24)).toBe('31.2%');
    expect(formatPct(-4.5)).toBe('−4.5%');
    expect(formatPct(null)).toBe('—');
  });
});

function ulItem(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', source: 'untunglab', ulMenuId: 'm-karipap-01', name: 'Karipap', category: 'Kuih', priceSen: 100, ulPriceSen: 100,
    marginPct: 31.2, status: 'watch', baseUlMenuId: null, active: true, updatedAt: '2026-10-01T00:00:00.000Z', ...over,
  };
}

describe('items', () => {
  it('uses UntungLab\'s margin at its price, and UntungLab\'s cost at a price typed here', () => {
    expect(effectiveMargin(ulItem())).toBe(31.2);
    // Cost from UntungLab: RM1.00 × (1 − 31.2%) = 68.8 sen. Sold at RM1.20: (120 − 68.8) / 120 = 42.67%.
    expect(unitCost(ulItem())).toBeCloseTo(68.8, 10);
    expect(effectiveMargin(ulItem({ priceSen: 120 }))).toBe(42.67);
    expect(effectiveMargin(ulItem({ priceSen: 60 }))).toBe(-14.67);
    expect(isPriceOverridden(ulItem({ priceSen: 120 }))).toBe(true);
    expect(effectiveMargin(ulItem({ source: 'own', ulMenuId: null, ulPriceSen: null, marginPct: null }))).toBeNull();
    // No cost when UntungLab reports the menu incomplete, or for an own item: never guessed.
    expect(unitCost(ulItem({ marginPct: null, status: null }))).toBeNull();
    expect(effectiveMargin(ulItem({ marginPct: null, status: null, priceSen: 150 }))).toBeNull();
    expect(marginAt(0, 50)).toBeNull();
  });
  it('groups by category with uncategorised last and variations after their base', () => {
    const items = [
      ulItem({ id: 'a', name: 'Kopi', category: null, ulMenuId: 'k' }),
      ulItem({ id: 'b', name: 'Brownies kacang', category: 'Kek', ulMenuId: 'b2', baseUlMenuId: 'b1' }),
      ulItem({ id: 'c', name: 'Brownies', category: 'Kek', ulMenuId: 'b1' }),
      ulItem({ id: 'd', name: 'Apam', category: 'Kek', ulMenuId: 'a1' }),
      ulItem({ id: 'e', name: 'Karipap', category: 'Kuih' }),
    ];
    const g = groupByCategory(items);
    expect(g.map((x) => x.category)).toEqual(['Kek', 'Kuih', null]);
    expect(g[0]!.items.map((i) => i.name)).toEqual(['Apam', 'Brownies', 'Brownies kacang']);
  });
});

describe('import plan', () => {
  it('adds everything to an empty catalogue', () => {
    const p = planImport([], price, { now: NOW, newId });
    expect(p.add).toHaveLength(7);
    expect(p.add[4]).toMatchObject({ name: 'Puding roti', marginPct: null, status: null, priceSen: 300, ulPriceSen: 300 });
    expect(p.add[3]).toMatchObject({ baseUlMenuId: 'm-brownies-01' });
  });
  it('the same list twice changes nothing', () => {
    const first = planWrites(planImport([], price, { now: NOW, newId }));
    const again = planImport(first, price, { now: NOW, newId });
    expect(planIsEmpty(again)).toBe(true);
    expect(again.same).toHaveLength(7);
  });
  it('a new UntungLab price replaces the counter price, and marks the fields that changed', () => {
    const items = planWrites(planImport([], price, { now: NOW, newId }));
    const next = structuredClone(price);
    next.menus[0]!.priceSen = 120;
    next.menus[0]!.marginPct = 40;
    next.menus[0]!.status = 'healthy';
    const p = planImport(items, next, { now: NOW, newId });
    expect(p.change).toHaveLength(1);
    expect(p.change[0]!.fields.sort()).toEqual(['marginPct', 'priceSen', 'status', 'ulPriceSen']);
    expect(p.change[0]!.after).toMatchObject({ priceSen: 120, ulPriceSen: 120, marginPct: 40 });
    expect(p.change[0]!.keptOwnPrice).toBe(false);
  });
  it('keeps a hand-typed price, with its margin worked out from UntungLab\'s new cost', () => {
    const items = planWrites(planImport([], price, { now: NOW, newId })).map((i) => (i.ulMenuId === 'm-karipap-01' ? { ...i, priceSen: 150 } : i));
    const next = structuredClone(price);
    next.menus[0]!.priceSen = 120;
    const p = planImport(items, next, { now: NOW, newId });
    expect(p.change[0]!.after).toMatchObject({ priceSen: 150, ulPriceSen: 120 });
    expect(p.change[0]!.keptOwnPrice).toBe(true);
    // UntungLab now sells at RM1.20 with 31.2%: cost 82.56 sen; at the shop's RM1.50 the margin is 44.96%.
    expect(effectiveMargin(p.change[0]!.after)).toBe(44.96);
  });
  it('a menu missing from the new list is deactivated, never deleted; it comes back when sent again', () => {
    const items = planWrites(planImport([], price, { now: NOW, newId }));
    const smaller = { ...price, menus: price.menus.slice(1) };
    const p = planImport(items, smaller, { now: NOW, newId });
    expect(p.deactivate).toHaveLength(1);
    expect(p.deactivate[0]!.after).toMatchObject({ name: 'Karipap', active: false });
    const afterDeactivate = items.map((i) => (i.ulMenuId === 'm-karipap-01' ? { ...i, active: false } : i));
    expect(planImport(afterDeactivate, smaller, { now: NOW, newId }).deactivate).toHaveLength(0);
    const back = planImport(afterDeactivate, price, { now: NOW, newId });
    expect(back.change[0]).toMatchObject({ fields: ['active'] });
  });
  it('never touches own items', () => {
    const own = ulItem({ id: 'own1', source: 'own', ulMenuId: null, ulPriceSen: null, marginPct: null, status: null, name: 'Air botol' });
    const p = planImport([own], price, { now: NOW, newId });
    expect(p.deactivate).toHaveLength(0);
    expect(planWrites(p).some((i) => i.id === 'own1')).toBe(false);
  });
});

const item = (id: string, priceSen: number, marginPct: number | null): Item =>
  ulItem({ id, ulMenuId: id, name: id, priceSen, ulPriceSen: priceSen, marginPct });

describe('cart', () => {
  it('a second tap raises the quantity; a line with a note stays separate', () => {
    let lines: CartLine[] = [];
    lines = addItem(lines, item('karipap', 100, 31.2));
    lines = addItem(lines, item('karipap', 100, 31.2));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.quantity).toBe(2);
    lines = setNote(lines, 0, '2 pedas');
    lines = addItem(lines, item('karipap', 100, 31.2));
    expect(lines.map((l) => l.quantity)).toEqual([2, 1]);
    expect(setQuantity(lines, 0, 0)).toHaveLength(1);
  });
  it('the minus takes one off, plain line first, and drops a line at zero', () => {
    let lines: CartLine[] = [];
    lines = addItem(lines, item('karipap', 100, 31.2));
    lines = setNote(lines, 0, 'pedas');
    lines = addItem(lines, item('karipap', 100, 31.2));
    lines = addItem(lines, item('karipap', 100, 31.2));
    lines = addItem(lines, item('kuih', 50, 40));
    expect(lines.map((l) => [l.itemId, l.quantity, l.note])).toEqual([['karipap', 1, 'pedas'], ['karipap', 2, ''], ['kuih', 1, '']]);
    lines = removeOne(lines, 'karipap');
    lines = removeOne(lines, 'karipap');
    expect(lines.map((l) => [l.itemId, l.quantity, l.note])).toEqual([['karipap', 1, 'pedas'], ['kuih', 1, '']]);
    lines = removeOne(lines, 'karipap');
    expect(lines.map((l) => l.itemId)).toEqual(['kuih']);
    expect(removeOne(lines, 'nothing')).toBe(lines);
  });
  it('a discount on one item: 5, 10, 15%, any percentage, or a price; profit falls by exactly the discount', () => {
    expect(DISCOUNT_PRESETS).toEqual([5, 10, 15]);
    // Kek batik: RM10.00 at UntungLab's 40% margin, so one costs RM6.00.
    const kek = item('kek', 1000, 40);
    let lines = addItem(addItem([], kek), kek); // 2 × RM10.00
    expect(cartTotals(lines).estProfitSen).toBe(800);
    lines = setLineDiscount(lines, 0, { kind: 'pct', pct: 10 });
    expect(lines[0]).toMatchObject({ unitPriceSen: 900, listPriceSen: 1000, discountPct: 10, marginPct: 33.33 });
    expect(cartTotals(lines)).toMatchObject({ subtotalSen: 1800, totalSen: 1800, estProfitSen: 600, itemDiscountSen: 200 });
    // A different percentage replaces the first one (taken off the counter price, never stacked).
    lines = setLineDiscount(lines, 0, { kind: 'pct', pct: 12.5 });
    expect(lines[0]).toMatchObject({ unitPriceSen: 875, listPriceSen: 1000, discountPct: 12.5 });
    // A custom price.
    lines = setLineDiscount(lines, 0, { kind: 'price', priceSen: 650 });
    expect(lines[0]).toMatchObject({ unitPriceSen: 650, listPriceSen: 1000, discountPct: null, marginPct: 7.69 });
    expect(cartTotals(lines).estProfitSen).toBe(100);
    // Below cost: a loss, shown as such.
    lines = setLineDiscount(lines, 0, { kind: 'price', priceSen: 500 });
    expect(lines[0]!.marginPct).toBe(-20);
    expect(cartTotals(lines).estProfitSen).toBe(-200);
    // Free: the whole cost is the loss.
    lines = setLineDiscount(lines, 0, { kind: 'pct', pct: 100 });
    expect(lines[0]).toMatchObject({ unitPriceSen: 0, marginPct: null });
    expect(cartTotals(lines).estProfitSen).toBe(-1200);
    // Removing the discount restores the counter price and UntungLab's margin.
    lines = setLineDiscount(lines, 0, null);
    expect(lines[0]).toMatchObject({ unitPriceSen: 1000, listPriceSen: null, discountPct: null, marginPct: 40 });
    // Not a discount: refused, line unchanged.
    expect(setLineDiscount(lines, 0, { kind: 'price', priceSen: 1200 })).toEqual(lines);
    expect(setLineDiscount(lines, 0, { kind: 'pct', pct: 0 })).toEqual(lines);
    expect(discountedPrice(999, { kind: 'pct', pct: 15 })).toBe(849);
  });
  it('a tap after a discount adds a full-price line; an own item\'s discount stays out of profit', () => {
    const kek = item('kek', 1000, 40);
    let lines = setLineDiscount(addItem([], kek), 0, { kind: 'pct', pct: 5 });
    lines = addItem(lines, kek);
    expect(lines.map((l) => [l.unitPriceSen, l.quantity])).toEqual([[950, 1], [1000, 1]]);
    lines = removeOne(lines, 'kek');
    expect(lines.map((l) => l.unitPriceSen)).toEqual([950]);
    const own = { ...kek, id: 'air', source: 'own' as const, ulMenuId: null, ulPriceSen: null, marginPct: null, status: null };
    const o = setLineDiscount(addItem([], own), 0, { kind: 'pct', pct: 10 });
    expect(o[0]).toMatchObject({ unitPriceSen: 900, marginPct: null, unitCostSen: null });
    expect(cartTotals(o)).toMatchObject({ estProfitSen: 0, linesWithoutMargin: 1, itemDiscountSen: 100 });
  });
  it('totals, discount and estimated profit', () => {
    const lines: CartLine[] = [
      { itemId: 'a', name: 'Karipap', unitPriceSen: 100, quantity: 5, marginPct: 30, note: '' },
      { itemId: 'b', name: 'Kek batik', unitPriceSen: 500, quantity: 1, marginPct: 40, note: '' },
    ];
    expect(cartTotals(lines)).toMatchObject({ itemCount: 6, subtotalSen: 1000, totalSen: 1000, estProfitSen: 350 });
    expect(cartTotals(lines, 200)).toMatchObject({ discountSen: 200, totalSen: 800, estProfitSen: 150 });
    expect(cartTotals(lines, 5000)).toMatchObject({ discountSen: 1000, totalSen: 0 });
  });
  it('a line without margin is counted in sales, not in profit, and takes its share of the discount', () => {
    const lines: CartLine[] = [
      { itemId: 'a', name: 'Karipap', unitPriceSen: 100, quantity: 5, marginPct: 30, note: '' },
      { itemId: 'w', name: 'Air botol', unitPriceSen: 500, quantity: 1, marginPct: null, note: '' },
    ];
    const t = cartTotals(lines, 100);
    expect(t).toMatchObject({ totalSen: 900, linesWithoutMargin: 1 });
    expect(t.estProfitSen).toBe(150 - 50);
  });
  it('change and quick cash buttons', () => {
    expect(changeDue(1000, 2000)).toBe(1000);
    expect(changeDue(1000, 1000)).toBe(0);
    expect(changeDue(1000, 999)).toBeNull();
    expect(cashSuggestions(1000)).toEqual([1000, 2000, 5000, 10000]);
    expect(cashSuggestions(1250)).toEqual([1250, 1500, 2000, 5000]);
    expect(cashSuggestions(4720)).toEqual([4720, 5000, 10000]);
    expect(cashSuggestions(0)).toEqual([]);
  });
});

describe('sale', () => {
  const lines: CartLine[] = [
    { itemId: 'item-0001', name: 'Karipap', unitPriceSen: 100, quantity: 5, marginPct: 31.2, note: ' 2 pedas ' },
    { itemId: 'item-0002', name: 'Kek batik', unitPriceSen: 500, quantity: 1, marginPct: 42.1, note: '' },
  ];
  const base = { id: 'sale-0000-0001', number: receiptNumber('A7', 12), deviceId: 'device-abcdef01', createdAt: '2026-10-11T07:42:00.000Z', lines, discountSen: 0 };
  it('builds a cash sale with change, and the server accepts it', () => {
    const s = buildSale({ ...base, method: 'cash', cashReceivedSen: 2000 });
    expect(s).toMatchObject({ number: 'A7-0012', totalSen: 1000, changeSen: 1000, status: 'done' });
    expect(s.lines[0]!.note).toBe('2 pedas');
    expect(validateSale(JSON.parse(JSON.stringify(s)))).toEqual({ ok: true, sale: s });
  });
  it('refuses cash below the total, and QR with cash fields', () => {
    expect(() => buildSale({ ...base, method: 'cash', cashReceivedSen: 500 })).toThrow();
    const qr = buildSale({ ...base, method: 'qr', cashReceivedSen: 2000 });
    expect(qr.cashReceivedSen).toBeNull();
    expect(validateSale({ ...qr, cashReceivedSen: 2000 })).toMatchObject({ ok: false });
  });
  it('the server recomputes totals and rejects a total it did not add up', () => {
    const s = buildSale({ ...base, method: 'qr', cashReceivedSen: null });
    expect(validateSale({ ...s, totalSen: 1 })).toMatchObject({ ok: false, error: 'totalSen does not match' });
    expect(validateSale({ ...s, subtotalSen: 1 })).toMatchObject({ ok: false });
    expect(validateSale({ ...s, lines: [{ ...s.lines[0], quantity: 0 }] })).toMatchObject({ ok: false });
    expect(validateSale({ ...s, status: 'void', voidReason: ' ' })).toMatchObject({ ok: false, error: 'voidReason' });
  });
  it('the server checks a discounted line: no higher than its counter price, and the percentage gives that price', () => {
    const kek = { itemId: 'item-0003', name: 'Kek', unitPriceSen: 1000, quantity: 1, marginPct: 40, note: '', unitCostSen: 600, listPriceSen: null, discountPct: null };
    const d = setLineDiscount([kek], 0, { kind: 'pct', pct: 10 });
    const s = buildSale({ ...base, lines: d, method: 'qr', cashReceivedSen: null });
    expect(s.lines[0]).toMatchObject({ unitPriceSen: 900, listPriceSen: 1000, discountPct: 10, unitCostSen: 600 });
    expect(validateSale(JSON.parse(JSON.stringify(s)))).toEqual({ ok: true, sale: s });
    const line = s.lines[0]!;
    const withLine = (l: object) => ({ ...s, lines: [{ ...line, ...l }] });
    expect(validateSale(withLine({ discountPct: 20 }))).toMatchObject({ ok: false, error: 'lines[0].discountPct' });
    expect(validateSale(withLine({ listPriceSen: 800 }))).toMatchObject({ ok: false, error: 'lines[0].listPriceSen' });
    expect(validateSale(withLine({ listPriceSen: null }))).toMatchObject({ ok: false, error: 'lines[0].discountPct' });
    expect(validateSale(withLine({ unitCostSen: -1 }))).toMatchObject({ ok: false, error: 'lines[0].unitCostSen' });
    // A custom price needs no percentage.
    expect(validateSale(withLine({ discountPct: null })).ok).toBe(true);
    expect(receiptText('Kedai', s, 'ms')).toContain('  Diskaun 10% (asal RM10.00)');
    expect(receiptText('Kedai', { ...s, lines: [{ ...line, discountPct: null }] }, 'en')).toContain('  Special price (was RM10.00)');
    expect(receiptDoc('Kedai', s, 'ms').lines[0]).toMatchObject({ detail: '1 × RM9.00', discount: 'Diskaun 10% (asal RM10.00)' });
    expect(salesCsv([s]).split('\r\n')[1]!.endsWith(',10.00,10,1.00')).toBe(true);
  });
  it('writes a WhatsApp receipt', () => {
    const s = buildSale({ ...base, discountSen: 100, method: 'cash', cashReceivedSen: 1000 });
    const text = receiptText('Dapur Mak Long', s, 'ms');
    expect(text).toContain('*Dapur Mak Long*');
    expect(text).toContain('Resit A7-0012');
    expect(text).toContain('Karipap × 5  RM5.00');
    expect(text).toContain('  (2 pedas)');
    expect(text).toContain('Diskaun: −RM1.00');
    expect(text).toContain('*Jumlah: RM9.00*');
    expect(text).toContain('Dibayar: Tunai RM10.00');
    expect(text).toContain('Baki: RM1.00');
  });
  it('lays out a receipt picture: items, discount, total, payment, and a voided mark', () => {
    const s = buildSale({ ...base, discountSen: 100, method: 'cash', cashReceivedSen: 1000 });
    const d = receiptDoc('Dapur Mak Long', s, 'ms');
    expect(d).toMatchObject({
      shopName: 'Dapur Mak Long', heading: 'Resit A7-0012', voided: null, totalLabel: 'JUMLAH', total: 'RM9.00', thanks: 'Terima kasih!',
      adjustments: [{ label: 'Jumlah kecil', value: 'RM10.00' }, { label: 'Diskaun', value: '−RM1.00' }],
      payment: [{ label: 'Tunai diterima', value: 'RM10.00' }, { label: 'Baki', value: 'RM1.00' }],
    });
    expect(d.lines[0]).toEqual({ name: 'Karipap', detail: '5 × RM1.00', amount: 'RM5.00', note: '2 pedas', discount: null });
    expect(d.lines[1]).toMatchObject({ name: 'Kek batik', note: null });
    const qr = receiptDoc('Kedai', { ...buildSale({ ...base, method: 'qr', cashReceivedSen: null }), status: 'void', voidReason: 'Salah tekan' }, 'en');
    expect(qr.payment).toEqual([{ label: 'Paid by', value: 'DuitNow QR' }]);
    expect(qr.voided).toBe('VOIDED · Salah tekan');
    expect(qr.adjustments).toEqual([]);
    expect(receiptFileName(s)).toBe('resit-A7-0012.png');
  });
  it('wraps long names on the picture, splitting a word too long for a line', () => {
    const measure = (t: string) => t.length * 10;
    expect(wrap(measure, 'Nasi lemak ayam berempah special', 120)).toEqual(['Nasi lemak', 'ayam', 'berempah', 'special']);
    expect(wrap(measure, 'Supercalifragilistic', 80)).toEqual(['Supercal', 'ifragili', 'stic']);
    expect(wrap(measure, '', 80)).toEqual(['']);
  });
});
