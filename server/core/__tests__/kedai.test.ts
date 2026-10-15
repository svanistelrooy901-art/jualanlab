import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PriceList } from '../../../src/link';
import type { Item } from '../../../src/domain/items';
import { defaultSettings, type StoreSettings } from '../../../src/domain/kedai';
import { makeWorld } from './world';

const price = JSON.parse(readFileSync(new URL('../../../spec/fixtures/price-list.valid.json', import.meta.url), 'utf8')) as PriceList;

const SETTINGS: StoreSettings = {
  ...defaultSettings('dapur-mak-long'), published: true, tagline: 'Kek dan kuih rumah', whatsapp: '60123456789',
  pickup: { on: true, address: 'Taman Sri Rambai, Bukit Mertajam', mapUrl: '', hours: '10 pg hingga 6 ptg' },
  delivery: { on: true, areas: [{ name: 'Bukit Mertajam', feeSen: 500 }], note: '' },
};

async function shop(plan: 'free' | 'pos' = 'pos') {
  const w = await makeWorld();
  await w.signIn();
  const me = await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' });
  if (plan === 'pos') await w.store.setShopPlan(me.body.shop.id, 'pos', '2026-10-01T00:00:00.000Z');
  const items = (await w.call('POST', '/api/items/import', { priceList: price })).body.items as Item[];
  const byUl = (id: string) => items.find((i) => i.ulMenuId === id)!;
  return { w, items, byUl };
}

const order = (lines: { itemId: string; quantity: number }[], over: Record<string, unknown> = {}) => ({
  lines: lines.map((l) => ({ ...l, note: '' })), name: 'Aina', phone: '012-345 6789', fulfilment: 'delivery', area: 'Bukit Mertajam', address: '12, Jalan Rambai 3', note: '', pay: 'qr', ...over,
});

describe('Kedai: the seller sets up the store', () => {
  it('suggests an address from the shop name, saves settings, and refuses an address another shop has', async () => {
    const { w } = await shop();
    const first = await w.call('GET', '/api/kedai');
    expect(first.body).toMatchObject({ store: null, suggested: { slug: 'dapur-mak-long', published: false } });
    expect((await w.call('PUT', '/api/kedai', { ...SETTINGS, brandColor: 'red' })).body).toMatchObject({ error: 'bad_settings', detail: 'brandColor' });
    expect((await w.call('PUT', '/api/kedai', SETTINGS)).status).toBe(200);
    expect((await w.call('GET', '/api/kedai')).body.store).toMatchObject({ slug: 'dapur-mak-long', published: true });

    const mine = w.cookie;
    w.cookie = '';
    await w.signIn('other@example.com');
    await w.call('POST', '/api/shop', { name: 'Kedai Lain' });
    expect((await w.call('PUT', '/api/kedai', SETTINGS)).body.error).toBe('slug_taken');
    w.cookie = mine;
  });

  it('a store is only visible once published; unknown addresses are a plain 404', async () => {
    const { w } = await shop();
    expect((await w.kcall('GET', '/dapur-mak-long')).status).toBe(404);
    await w.call('PUT', '/api/kedai', { ...SETTINGS, published: false });
    expect((await w.kcall('GET', '/dapur-mak-long')).status).toBe(404);
    await w.call('PUT', '/api/kedai', SETTINGS);
    const page = await w.kcall('GET', '/dapur-mak-long');
    expect(page.status).toBe(200);
    expect(page.body).toContain('Dapur Mak Long');
    expect(page.body).toContain('Karipap');
    expect(page.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect((await w.kcall('GET', '/tiada-kedai')).status).toBe(404);
  });

  it('items can be hidden from the store, described, and the running promotion shows', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    const kek = byUl('m-kekbatik-01');
    await w.call('PUT', `/api/kedai/items/${byUl('m-murtabak-01').id}`, { description: '', online: false, badge: null, featured: false });
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { description: 'Coklat Belgium <b>', online: true, badge: 'baru', featured: true });
    await w.call('POST', '/api/promos', { name: 'Promo Oktober', kind: 'pct', pct: 10, scope: 'all', startDate: '2026-10-01', endDate: null, on: true });
    const page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(page).not.toContain('Murtabak');
    expect(page).toContain('Coklat Belgium &lt;b&gt;');
    expect(page).toContain('RM4.50<s>RM5.00</s>');
    expect(page).toContain('−10%');
  });

  it('logo and cover photo: the seller adds them, the store header and link preview use them, removing them goes back', async () => {
    const { w } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect((await w.call('PUT', '/api/kedai/images/logo', { image: 'data:text/html;base64,PGI+' })).body.error).toBe('bad_image');
    expect((await w.call('PUT', '/api/kedai/images/banner', { image: png })).status).toBe(404);
    expect(Object.keys((await w.call('PUT', '/api/kedai/images/logo', { image: png })).body.images)).toEqual(['logo']);
    await w.call('PUT', '/api/kedai/images/cover', { image: png.replace('image/png', 'image/jpeg') });
    expect((await w.call('GET', '/api/kedai')).body.images).toHaveProperty('cover');
    expect((await w.call('GET', '/api/kedai/images/logo')).status).toBe(200);

    const page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(page).toMatch(/<img src="\/dapur-mak-long\/logo\?v=[^"]+" alt="Dapur Mak Long">/);
    expect(page).toContain('class="top cov"');
    expect(page).toMatch(/og:image" content="https:\/\/[^"]+\/dapur-mak-long\/cover\?v=/);
    const img = await w.kcall('GET', '/dapur-mak-long/cover');
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/jpeg');

    await w.call('DELETE', '/api/kedai/images/cover');
    await w.call('DELETE', '/api/kedai/images/logo');
    const plain = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(plain).not.toContain('top cov');
    expect(plain).toContain('<div class="logo h">DM</div>');
    expect((await w.kcall('GET', '/dapur-mak-long/logo')).status).toBe(404);
  });

  it('item photos: added by the seller, shown on the store and sheet data, private for hidden items, removable', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    const kek = byUl('m-kekbatik-01');
    const jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQ==';
    expect((await w.call('PUT', '/api/kedai/items/nope/photo', { image: jpg })).status).toBe(404);
    expect((await w.call('PUT', `/api/kedai/items/${kek.id}/photo`, { image: 'data:image/gif;base64,R0lG' })).body.error).toBe('bad_image');
    const v = (await w.call('PUT', `/api/kedai/items/${kek.id}/photo`, { image: jpg })).body.version as string;
    expect((await w.call('GET', '/api/kedai')).body.photos).toEqual({ [kek.id]: v });

    const page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    const src = `/dapur-mak-long/i/${kek.id}?v=${encodeURIComponent(v)}`;
    expect(page).toContain(`<img src="${src.replace(/&/g, '&amp;')}" alt="" loading="lazy"`);
    const data = JSON.parse(/<script type="application\/json" id="kd">(.*?)<\/script>/s.exec(page)![1]!);
    expect(data.items.find((i: { id: string }) => i.id === kek.id).photo).toBe(src);
    const img = await w.kcall('GET', `/dapur-mak-long/i/${kek.id}`);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/jpeg');

    // Hidden from the store: its photo is not served either.
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { online: false, description: '', badge: null, featured: false });
    expect((await w.kcall('GET', `/dapur-mak-long/i/${kek.id}`)).status).toBe(404);
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { online: true, description: '', badge: null, featured: false });
    await w.call('DELETE', `/api/kedai/items/${kek.id}/photo`);
    expect((await w.kcall('GET', `/dapur-mak-long/i/${kek.id}`)).status).toBe(404);
    expect((await w.call('GET', '/api/kedai')).body.photos).toEqual({});
  });

  it('a Free store shows 10 items at most', async () => {
    const { w } = await shop('free');
    await w.call('PUT', '/api/kedai', SETTINGS);
    const data = /<script type="application\/json" id="kd">(.*?)<\/script>/s.exec((await w.kcall('GET', '/dapur-mak-long')).body)![1]!;
    expect(JSON.parse(data).items.length).toBeLessThanOrEqual(10);
  });
});

describe('Kedai: ordering', () => {
  it('a customer orders; the server prices it, numbers it and shows the payment page', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    const kek = byUl('m-kekbatik-01'), karipap = byUl('m-karipap-01');
    const r = await w.kcall('POST', '/dapur-mak-long/pesan', { ...order([{ itemId: kek.id, quantity: 2 }, { itemId: karipap.id, quantity: 3 }]), totalSen: 1 });
    expect(r).toMatchObject({ status: 201, body: { number: 'K-0001', url: expect.stringMatching(/^\/dapur-mak-long\/p\/[A-Za-z0-9_-]{24}$/) } });
    const pageHtml = (await w.kcall('GET', r.body.url)).body as string;
    expect(pageHtml).toContain('K-0001');
    expect(pageHtml).toContain('RM18.00'); // 2 × 5.00 + 3 × 1.00 + 5.00 delivery
    expect(pageHtml).toContain('wa.me/60123456789');
    expect((await w.kcall('GET', `${r.body.url}.json`)).body).toMatchObject({ status: 'awaiting_payment' });
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }]))).body.number).toBe('K-0002');
  });

  it('refuses orders from another origin, for hidden items, or below the minimum; and limits spam', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', { ...SETTINGS, minOrderSen: 1000 });
    const kek = byUl('m-kekbatik-01');
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }]), { origin: 'https://evil.example' })).status).toBe(403);
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }]))).body.error).toBe('below_minimum');
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }], { phone: '123' }))).body).toMatchObject({ error: 'bad_order', detail: 'phone' });
    for (let i = 0; i < 6; i++) await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }]));
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }]))).status).toBe(429);
  });

  it('the seller confirms payment: the order becomes an online sale in the business day, then moves step by step', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    const kek = byUl('m-kekbatik-01');
    const r = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }]));
    const list = (await w.call('GET', '/api/kedai/orders')).body;
    expect(list.counts.awaiting_payment).toBe(1);
    const id = list.orders[0].id as string;
    expect(id).toBe(r.body.url.split('/').pop());
    expect((await w.call('POST', `/api/kedai/orders/${id}/step`, { from: 'confirmed' })).status).toBe(409);
    const paid = await w.call('POST', `/api/kedai/orders/${id}/step`, { from: 'awaiting_payment', method: 'qr' });
    expect(paid.body.order).toMatchObject({ status: 'confirmed', paidAt: expect.any(String), saleId: expect.any(String) });
    // A second phone pressing the same button gets the current order back, and no second sale is made.
    expect((await w.call('POST', `/api/kedai/orders/${id}/step`, { from: 'awaiting_payment' })).body.error).toBe('order_changed');
    const sale = await w.store.getSale((await w.call('GET', '/api/me')).body.shop.id, paid.body.order.saleId);
    expect(sale).toMatchObject({ channel: 'online', number: 'K-0001', totalSen: 1500, method: 'qr', dayId: expect.any(String) });
    expect(sale!.lines.map((l) => [l.name, l.quantity, l.unitPriceSen])).toEqual([[kek.name, 2, 500], ['Penghantaran (Bukit Mertajam)', 1, 500]]);
    for (const [from, to] of [['confirmed', 'preparing'], ['preparing', 'ready'], ['ready', 'done']]) {
      expect((await w.call('POST', `/api/kedai/orders/${id}/step`, { from })).body.order.status).toBe(to);
    }
    expect((await w.kcall('GET', `${r.body.url}.json`)).body.status).toBe('done');
    expect((await w.call('POST', `/api/kedai/orders/${id}/cancel`, { reason: 'x' })).body.error).toBe('order_finished');
  });

  it('pay at pickup: confirmed at once, the sale is made when handed over; cancelling a paid order voids its sale', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', { ...SETTINGS, payAtPickup: true });
    const kek = byUl('m-kekbatik-01');
    await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }], { pay: 'at_pickup', fulfilment: 'pickup' }));
    let o = (await w.call('GET', '/api/kedai/orders')).body.orders[0];
    expect(o).toMatchObject({ status: 'confirmed', expiresAt: null, saleId: null });
    for (const from of ['confirmed', 'preparing']) o = (await w.call('POST', `/api/kedai/orders/${o.id}/step`, { from })).body.order;
    expect(o.saleId).toBeNull();
    o = (await w.call('POST', `/api/kedai/orders/${o.id}/step`, { from: 'ready', method: 'cash' })).body.order;
    expect(o).toMatchObject({ status: 'done', saleId: expect.any(String) });

    const shopId = (await w.call('GET', '/api/me')).body.shop.id;
    await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }]));
    let q = (await w.call('GET', '/api/kedai/orders')).body.orders[0];
    q = (await w.call('POST', `/api/kedai/orders/${q.id}/step`, { from: 'awaiting_payment' })).body.order;
    expect((await w.call('POST', `/api/kedai/orders/${q.id}/cancel`, { reason: '' })).body.error).toBe('bad_reason');
    expect((await w.call('POST', `/api/kedai/orders/${q.id}/cancel`, { reason: 'Pelanggan batal' })).body.order).toMatchObject({ status: 'cancelled', cancelReason: 'Pelanggan batal' });
    expect(await w.store.getSale(shopId, q.saleId)).toMatchObject({ status: 'void', voidReason: 'Pesanan K-0002 dibatalkan: Pelanggan batal' });
  });

  it('unpaid QR orders cancel themselves after the seller\'s time', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', { ...SETTINGS, unpaidCancelMinutes: 60 });
    const r = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: byUl('m-kekbatik-01').id, quantity: 2 }]));
    w.advance(59 * 60_000);
    expect((await w.kcall('GET', `${r.body.url}.json`)).body.status).toBe('awaiting_payment');
    w.advance(2 * 60_000);
    expect((await w.kcall('GET', `${r.body.url}.json`)).body.status).toBe('cancelled');
    expect((await w.call('GET', '/api/kedai/orders?status=cancelled')).body.orders[0]).toMatchObject({ cancelReason: 'expired' });
  });

  it('one shop cannot see or move another shop\'s orders', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: byUl('m-kekbatik-01').id, quantity: 2 }]));
    const id = (await w.call('GET', '/api/kedai/orders')).body.orders[0].id;
    w.cookie = '';
    await w.signIn('other@example.com');
    await w.call('POST', '/api/shop', { name: 'Kedai Lain' });
    expect((await w.call('GET', '/api/kedai/orders')).body.orders).toEqual([]);
    expect((await w.call('POST', `/api/kedai/orders/${id}/step`, { from: 'awaiting_payment' })).status).toBe(404);
    expect((await w.call('POST', `/api/kedai/orders/${id}/cancel`, { reason: 'x' })).status).toBe(404);
  });

  it('the shop\'s QR image is served to the payment page', async () => {
    const { w } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    expect((await w.kcall('GET', '/dapur-mak-long/qr')).status).toBe(404);
    expect((await w.call('PUT', '/api/kedai/qr', { image: 'data:text/html;base64,PGI+' })).body.error).toBe('bad_image');
    expect((await w.call('PUT', '/api/kedai/qr', { image: 'data:image/png;base64,iVBORw0KGgo=' })).status).toBe(200);
    const qr = await w.kcall('GET', '/dapur-mak-long/qr');
    expect(qr.status).toBe(200);
    expect(qr.headers.get('content-type')).toBe('image/png');
  });
});
