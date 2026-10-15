import { describe, expect, it } from 'vitest';
import type { Item } from '../items';
import {
  defaultSettings, isSlug, orderNumber, priceOrder, readableBrand, slugFrom, validateItemStore, validateOrderRequest, validateSettings, waNumber,
  DEFAULT_ITEM_STORE, type ItemStore, type StoreSettings,
} from '../kedai';
import type { Promo } from '../promo';

function item(id: string, priceSen: number, marginPct: number | null, over: Partial<Item & { store: ItemStore }> = {}): Item & { store: ItemStore } {
  return {
    id, source: marginPct === null ? 'own' : 'untunglab', ulMenuId: marginPct === null ? null : `m-${id}`, name: id, category: 'Kek', priceSen,
    ulPriceSen: marginPct === null ? null : priceSen, marginPct, status: null, baseUlMenuId: null, active: true, updatedAt: '2026-10-01T00:00:00.000Z',
    store: { ...DEFAULT_ITEM_STORE }, ...over,
  };
}

const store = (over: Partial<StoreSettings> = {}): StoreSettings => ({
  ...defaultSettings('dapur-mak-long'), published: true,
  pickup: { on: true, address: 'Taman Sri Rambai', mapUrl: '', hours: '10 pg hingga 6 ptg' },
  delivery: { on: true, areas: [{ name: 'Bukit Mertajam', feeSen: 500 }], note: '' },
  ...over,
});

const req = (over: Record<string, unknown> = {}) => ({
  lines: [{ itemId: 'kek', quantity: 2, note: '' }, { itemId: 'brownies', quantity: 1, note: 'kurang manis' }],
  name: 'Aina', phone: '012-345 6789', fulfilment: 'delivery', area: 'Bukit Mertajam', address: '12, Jalan Rambai 3', note: '', pay: 'qr', ...over,
});

describe('store settings', () => {
  it('store addresses are short, lower case and not reserved', () => {
    expect(['dapur-mak-long', 'kek123', 'abc'].every(isSlug)).toBe(true);
    expect(['ab', 'Dapur', 'dapur--mak', '-dapur', 'dapur-', 'api', 'smelab', 'a'.repeat(41)].some(isSlug)).toBe(false);
    expect(slugFrom('Dapur Mak Long!')).toBe('dapur-mak-long');
    expect(slugFrom('Café Ñam')).toBe('cafe-nam');
    expect(isSlug(slugFrom('AB'))).toBe(true);
  });
  it('WhatsApp numbers are Malaysian mobiles in international form', () => {
    expect(waNumber('012-345 6789')).toBe('60123456789');
    expect(waNumber('+60 11-2345 6789')).toBe('601123456789');
    expect(waNumber('03-1234 5678')).toBeNull();
    expect(waNumber('12345')).toBeNull();
  });
  it('settings are checked field by field', () => {
    const ok = validateSettings({ ...store(), brandColor: '#b4351c', whatsapp: '012-345 6789', instagram: '@dapurmaklong' });
    expect(ok.ok && ok.value).toMatchObject({ brandColor: '#B4351C', whatsapp: '60123456789', instagram: 'dapurmaklong' });
    const bad = (over: Record<string, unknown>) => {
      const r = validateSettings({ ...store(), ...over });
      return r.ok ? 'ok' : r.error;
    };
    expect(bad({ slug: 'API' })).toBe('slug');
    expect(bad({ brandColor: 'red' })).toBe('brandColor');
    expect(bad({ delivery: { on: true, areas: [], note: '' } })).toBe('delivery');
    expect(bad({ pickup: { on: false, address: '', mapUrl: '', hours: '' }, delivery: { on: false, areas: [], note: '' } })).toBe('fulfilment');
    expect(bad({ pickup: { on: true, address: '', mapUrl: 'http://maps.example', hours: '' } })).toBe('pickup');
    expect(bad({ unpaidCancelMinutes: 10 })).toBe('unpaidCancelMinutes');
    expect(bad({ whatsapp: '03-1234 5678' })).toBe('whatsapp');
    expect(bad({ tagline: 'x'.repeat(121) })).toBe('tagline');
  });
  it('item store fields', () => {
    expect(validateItemStore({ description: ' Sedap ', online: false, badge: 'baru', featured: true })).toEqual({ description: 'Sedap', online: false, badge: 'baru', featured: true });
    expect(validateItemStore({ description: '', online: true, badge: 'hot', featured: false })).toBeNull();
  });
  it('a light brand colour is darkened until white text on it is readable', () => {
    expect(readableBrand('#B4351C')).toBe('#B4351C');
    const y = readableBrand('#FFD23F');
    expect(y).not.toBe('#FFD23F');
    expect(parseInt(y.slice(1, 3), 16)).toBeLessThan(0xff);
  });
});

describe('pricing an order', () => {
  const items = new Map([
    ['kek', item('kek', 500, 40)],
    ['brownies', item('brownies', 2500, 30, { category: 'Brownies' })],
    ['hidden', item('hidden', 100, null, { store: { ...DEFAULT_ITEM_STORE, online: false } })],
    ['old', item('old', 100, null, { active: false })],
  ]);
  const oct: Promo = {
    id: 'p1', name: 'Promo Oktober', kind: 'pct', pct: 10, scope: 'categories', categories: ['Kek'], itemIds: [], prices: {},
    startDate: '2026-10-01', endDate: '2026-10-31', on: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  };
  const ctx = (over: Partial<StoreSettings> = {}) => ({ items, promos: [oct], today: '2026-10-18', settings: store(over) });
  const price = (r: Record<string, unknown>, over: Partial<StoreSettings> = {}) => {
    const v = validateOrderRequest(req(r));
    if (!v.ok) return v.error;
    const p = priceOrder(v.value, ctx(over));
    return p.ok ? p.value : p.error;
  };

  it('uses the catalogue price, the running promotion and the area fee; never the page\'s numbers', () => {
    const p = price({ lines: [{ itemId: 'kek', quantity: 2, note: '', priceSen: 1 }, { itemId: 'brownies', quantity: 1, note: 'kurang manis' }] });
    expect(p).toMatchObject({ subtotalSen: 3400, deliverySen: 500, totalSen: 3900, savedSen: 100 });
    if (typeof p === 'string') throw new Error(p);
    expect(p.lines[0]).toMatchObject({ itemId: 'kek', unitPriceSen: 450, listPriceSen: 500, promoName: 'Promo Oktober', quantity: 2 });
    expect(p.lines[1]).toMatchObject({ itemId: 'brownies', unitPriceSen: 2500, note: 'kurang manis' });
  });
  it('joins repeated lines and keeps notes apart', () => {
    const p = price({ lines: [{ itemId: 'kek', quantity: 1, note: '' }, { itemId: 'kek', quantity: 2, note: '' }, { itemId: 'kek', quantity: 1, note: 'tanpa kacang' }], fulfilment: 'pickup' });
    if (typeof p === 'string') throw new Error(p);
    expect(p.lines.map((l) => [l.quantity, l.note])).toEqual([[3, ''], [1, 'tanpa kacang']]);
    expect(p.deliverySen).toBe(0);
  });
  it('refuses what the store does not offer', () => {
    expect(price({ lines: [{ itemId: 'nope', quantity: 1, note: '' }] })).toBe('unknown_item');
    expect(price({ lines: [{ itemId: 'hidden', quantity: 1, note: '' }] })).toBe('unavailable');
    expect(price({ lines: [{ itemId: 'old', quantity: 1, note: '' }] })).toBe('unavailable');
    expect(price({ area: 'Penang Island' })).toBe('bad_area');
    expect(price({}, { open: false })).toBe('store_closed');
    expect(price({}, { published: false })).toBe('store_closed');
    expect(price({ pay: 'at_pickup' })).toBe('pay_not_allowed');
    expect(price({ pay: 'at_pickup' }, { payAtPickup: true })).toMatchObject({ totalSen: 3900 });
    expect(price({}, { minOrderSen: 5000 })).toBe('below_minimum');
    expect(price({}, { delivery: { on: false, areas: [], note: '' } })).toBe('no_delivery');
  });
  it('checks the customer\'s details', () => {
    expect(price({ name: ' ' })).toBe('name');
    expect(price({ phone: '1234' })).toBe('phone');
    expect(price({ address: '' })).toBe('address');
    expect(price({ lines: [] })).toBe('lines');
    expect(price({ lines: [{ itemId: 'kek', quantity: 0, note: '' }] })).toBe('lines');
    expect(orderNumber(42)).toBe('K-0042');
  });
});
