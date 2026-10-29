/** The cart (Troli) loads fast: it reads items and stock only, not 30 days of sales. The shop page still shows "Laris". */
import { describe, expect, it } from 'vitest';
import { buildSale } from '../../../src/domain/sale';
import { defaultSettings, type StoreSettings } from '../../../src/domain/kedai';
import { makeWorld } from './world';

const SETTINGS: StoreSettings = {
  ...defaultSettings('dapur-mak-long'), published: true,
  pickup: { on: true, address: 'Taman Sri Rambai', mapUrl: '', hours: '10 pg hingga 6 ptg' },
  delivery: { on: false, areas: [], note: '' },
};

async function setup() {
  const w = await makeWorld();
  await w.signIn();
  const me = await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' });
  await w.store.setShopPlan(me.body.shop.id, 'pos', '2026-10-01T00:00:00.000Z');
  await w.store.setShopKedai(me.body.shop.id, '9999-12-31T00:00:00.000Z');
  const kek = (await w.call('POST', '/api/items', { name: 'Kek batik', priceSen: 1200, category: 'Kek' })).body.item as { id: string; name: string; priceSen: number };
  const kuih = (await w.call('POST', '/api/items', { name: 'Karipap', priceSen: 300, category: 'Kuih' })).body.item as { id: string; name: string; priceSen: number };
  await w.call('PUT', '/api/kedai', SETTINGS);
  await w.call('PUT', `/api/kedai/items/${kek.id}`, { description: '', online: true, badge: null, featured: false });
  await w.call('PUT', `/api/kedai/items/${kuih.id}`, { description: '', online: true, badge: null, featured: false });
  // Three sales in the last 30 days; Kek batik sells most, so it is the one "Laris".
  const at = ['2026-10-10T04:00:00.000Z', '2026-10-12T04:00:00.000Z', '2026-10-14T04:00:00.000Z'];
  const plan = [[kek, 3], [kek, 2], [kuih, 1]] as const;
  for (let n = 0; n < at.length; n++) {
    const [item, qty] = plan[n]!;
    const sale = buildSale({
      id: `sale-troli-${n + 1}`, number: `A7-000${n + 1}`, deviceId: 'device-aaaaaaa1', createdAt: at[n]!, dayId: null, discountSen: 0,
      lines: [{ itemId: item.id, name: item.name, unitPriceSen: item.priceSen, quantity: qty, marginPct: 40, note: '' }], method: 'cash', cashReceivedSen: 99999,
    });
    const r = await w.call("POST", "/api/sales", { sale }); if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  }
  w.setNow('2026-10-20T04:00:00.000Z');
  return { w, kek, kuih, shopId: me.body.shop.id as string };
}

/** Counts the SQL statements that touch a table, by wrapping the test database. */
function countQueries(w: Awaited<ReturnType<typeof setup>>['w'], pattern: RegExp) {
  const db = w.d1 as unknown as { prepare: (sql: string) => unknown };
  const orig = db.prepare.bind(db);
  let n = 0;
  db.prepare = (sql: string) => {
    if (pattern.test(sql)) n++;
    return orig(sql);
  };
  return { count: () => n, restore: () => (db.prepare = orig) };
}

describe('Kedai: the cart loads fast', () => {
  it('the cart reads no sales at all and still lists the items with their prices', async () => {
    const { w, kek } = await setup();
    const q = countQueries(w, /FROM sales\b|FROM sale_lines/);
    try {
      const page = await w.kcall('GET', '/dapur-mak-long/troli');
      expect(page.status).toBe(200);
      expect(page.body).toContain('Kek batik');
      expect(page.body).toContain(`"id":"${kek.id}"`);
      expect(q.count()).toBe(0);
    } finally {
      q.restore();
    }
  });

  it('the shop page still shows "Laris" on the best seller, and reads sales for it', async () => {
    const { w } = await setup();
    const q = countQueries(w, /FROM sales\b/);
    try {
      const page = await w.kcall('GET', '/dapur-mak-long');
      expect(page.body).toContain('Laris');
      expect(q.count()).toBeGreaterThan(0);
    } finally {
      q.restore();
    }
  });

  it('listing sales reads their lines in one query, however many sales there are, and keeps each sale\'s own lines', async () => {
    const { w, shopId } = await setup();
    const q = countQueries(w, /FROM sale_lines/);
    const sales = await w.store.listSales(shopId, '2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z');
    expect(q.count()).toBe(1);
    q.restore();
    expect(sales).toHaveLength(3);
    const byId = Object.fromEntries(sales.map((s) => [s.id, s.lines.map((l) => [l.name, l.quantity])]));
    expect(byId['sale-troli-1']).toEqual([['Kek batik', 3]]);
    expect(byId['sale-troli-2']).toEqual([['Kek batik', 2]]);
    expect(byId['sale-troli-3']).toEqual([['Karipap', 1]]);
  });
});
