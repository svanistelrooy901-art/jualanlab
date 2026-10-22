import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PriceList } from '../../../src/link';
import type { Item } from '../../../src/domain/items';
import { defaultSettings, type StoreSettings } from '../../../src/domain/kedai';
import { makeWorld, memoryBucket } from './world';
import { stockReminderSweep } from '../reminders';
import { buildSale } from '../../../src/domain/sale';

const price = JSON.parse(readFileSync(new URL('../../../spec/fixtures/price-list.valid.json', import.meta.url), 'utf8')) as PriceList;

const SETTINGS: StoreSettings = {
  ...defaultSettings('dapur-mak-long'), published: true, tagline: 'Kek dan kuih rumah', whatsapp: '60123456789',
  pickup: { on: true, address: 'Taman Sri Rambai, Bukit Mertajam', mapUrl: '', hours: '10 pg hingga 6 ptg' },
  delivery: { on: true, areas: [{ name: 'Bukit Mertajam', feeSen: 500 }], note: '' },
};

async function shop(plan: 'free' | 'pos' = 'pos', opts: Parameters<typeof makeWorld>[1] = {}) {
  const w = await makeWorld({}, opts);
  await w.signIn();
  const me = await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' });
  if (plan === 'pos') await w.store.setShopPlan(me.body.shop.id, 'pos', '2026-10-01T00:00:00.000Z');
  const items = (await w.call('POST', '/api/items/import', { priceList: price })).body.items as Item[];
  const byUl = (id: string) => items.find((i) => i.ulMenuId === id)!;
  return { w, items, byUl };
}

const order = (lines: { itemId: string; quantity: number; note?: string }[], over: Record<string, unknown> = {}) => ({
  lines: lines.map((l) => ({ note: '', ...l })), name: 'Aina', phone: '012-345 6789', fulfilment: 'delivery', area: 'Bukit Mertajam', address: '12, Jalan Rambai 3', note: '', pay: 'qr', ...over,
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
    expect(page).toContain('class="hero cov"');
    expect(page).toMatch(/og:image" content="https:\/\/[^"]+\/dapur-mak-long\/cover\?v=/);
    const img = await w.kcall('GET', '/dapur-mak-long/cover');
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/jpeg');

    await w.call('DELETE', '/api/kedai/images/cover');
    await w.call('DELETE', '/api/kedai/images/logo');
    const plain = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(plain).not.toContain('hero cov');
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

  it('item photos go to the bucket when there is one; photos kept in the database move there when first read', async () => {
    const { bucket, objects } = memoryBucket();
    const w = await makeWorld({}, { photos: bucket });
    await w.signIn();
    const shopId = (await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' })).body.shop.id as string;
    await w.store.setShopPlan(shopId, 'pos', '2026-10-01T00:00:00.000Z');
    const items = (await w.call('POST', '/api/items/import', { priceList: price })).body.items as Item[];
    await w.call('PUT', '/api/kedai', SETTINGS);
    const [a, b] = [items[0]!, items[1]!];
    const jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQ==';
    await w.call('PUT', `/api/kedai/items/${a.id}/photo`, { image: jpg });
    expect([...objects.keys()]).toEqual([`items/${shopId}/${a.id}`]);
    expect((await w.d1.prepare('SELECT data FROM item_photos WHERE item_id = ?').bind(a.id).first<{ data: string }>())!.data).toBe('');
    const img = await w.kcall('GET', `/dapur-mak-long/i/${a.id}`);
    expect(img.status).toBe(200);

    // A photo saved before R2 was switched on: still served, and moved to the bucket on the way.
    await w.d1.prepare("INSERT INTO item_photos (item_id, shop_id, mime, data, updated_at) VALUES (?, ?, 'image/jpeg', ?, 't')").bind(b.id, shopId, jpg.split(',')[1]!).run();
    expect((await w.kcall('GET', `/dapur-mak-long/i/${b.id}`)).status).toBe(200);
    expect(objects.has(`items/${shopId}/${b.id}`)).toBe(true);
    expect((await w.d1.prepare('SELECT data FROM item_photos WHERE item_id = ?').bind(b.id).first<{ data: string }>())!.data).toBe('');

    await w.call('DELETE', `/api/kedai/items/${a.id}/photo`);
    expect(objects.has(`items/${shopId}/${a.id}`)).toBe(false);
  });

  it('a Free store shows 10 items at most', async () => {
    const { w } = await shop('free');
    await w.call('PUT', '/api/kedai', SETTINGS);
    const data = /<script type="application\/json" id="kd">(.*?)<\/script>/s.exec((await w.kcall('GET', '/dapur-mak-long')).body)![1]!;
    expect(JSON.parse(data).items.length).toBeLessThanOrEqual(10);
  });
});

describe('Kedai: pre-order batches', () => {
  // The world's clock starts 2026-10-10T01:00Z (Saturday 9am in Malaysia).
  const sat = { id: 'sat17', label: 'Sabtu 17 Okt', readyDate: '2026-10-17', closesAt: '2026-10-15T20:00:00+08:00', maxOrders: 2 };
  const sun = { id: 'sun18', label: 'Ahad 18 Okt', readyDate: '2026-10-18', closesAt: '2026-10-16T20:00:00+08:00', maxOrders: null };
  it('orders must pick an open batch; full and closed batches are refused; the prep list adds up what to make', async () => {
    const { w, byUl } = await shop();
    expect((await w.call('PUT', '/api/kedai', { ...SETTINGS, orderMode: 'batch', preorder: { on: true, batches: [] } })).body).toMatchObject({ error: 'bad_settings', detail: 'preorder' });
    await w.call('PUT', '/api/kedai', { ...SETTINGS, orderMode: 'batch', preorder: { on: true, batches: [sat, sun] } });
    const page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(page).toContain('PILIH HARI DAHULU');
    expect(page).toContain('Sabtu 17 Okt');
    expect(page).toContain('Khamis 15 Okt, 8:00 mlm');
    expect(page).toContain('tinggal 2 tempahan');

    const kek = byUl('m-kekbatik-01');
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }]))).body.error).toBe('batch_required');
    const a = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }], { batchId: 'sat17', fulfilment: 'pickup', area: '', address: '' }));
    expect(a.status).toBe(201);
    await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1, note: 'kurang manis' }], { batchId: 'sat17', phone: '0129998888' }));
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }], { batchId: 'sat17', phone: '0127776666' }))).body.error).toBe('batch_full');
    // Full batches are no longer offered.
    expect((await w.kcall('GET', '/dapur-mak-long')).body).not.toContain('tinggal 0');

    const o = (await w.call('GET', '/api/kedai/orders?status=open')).body.orders[0];
    expect(o).toMatchObject({ batchId: 'sat17', batchLabel: 'Sabtu 17 Okt', readyDate: '2026-10-17' });
    expect((await w.kcall('GET', a.body.url)).body).toContain('Sabtu 17 Okt');

    const prep = (await w.call('GET', '/api/kedai/prep?batch=sat17')).body.prep;
    expect(prep).toMatchObject({ orders: 2, unpaidOrders: 2, pickup: 1, delivery: 1 });
    expect(prep.lines[0]).toMatchObject({ itemId: kek.id, quantity: 3, unpaid: 3, notes: [{ note: 'kurang manis', quantity: 1 }] });
    expect((await w.call('GET', '/api/kedai/prep?batch=sun18')).body.prep.orders).toBe(0);

    // After Thursday 8pm the Saturday batch closes by itself; after Friday 8pm nothing is open.
    w.setNow('2026-10-15T12:00:01.000Z');
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }], { batchId: 'sun18', phone: '0125554444' }))).status).toBe(201);
    w.setNow('2026-10-16T12:00:01.000Z');
    const closed = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(closed).toContain('Tempahan ditutup buat masa ini');
    expect(closed).not.toContain('data-add=');
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }], { batchId: 'sun18', phone: '0123332222' }))).body.error).toBe('batch_closed');
  });
});

describe('Kedai: stock', () => {
  const base = { description: '', online: true, badge: null, featured: false };
  it('counter sales lower store stock without ever blocking; a same-day void puts back what was taken, once (ST-01)', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    const kek = byUl('m-kekbatik-01');
    const kari = byUl('m-karipap-01');
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { ...base, stock: 3 });
    const stock = async (id: string) => (await w.call('GET', '/api/kedai')).body.itemStore[id]?.stock ?? null;
    const sale = (id: string, qty: number, at = '2026-10-10T01:30:00.000Z') => buildSale({
      id, number: 'A7-0001', deviceId: 'device-abcdef01', createdAt: at, discountSen: 0, method: 'cash', cashReceivedSen: 100000,
      lines: [{ itemId: kek.id, name: kek.name, unitPriceSen: kek.priceSen, quantity: qty, marginPct: 30, note: '' },
        { itemId: kari.id, name: kari.name, unitPriceSen: kari.priceSen, quantity: 1, marginPct: 30, note: '' }],
    });
    w.advance(60 * 60_000);
    expect((await w.call('POST', '/api/sales', { sale: sale('sale-aaaa-0001', 2) })).status).toBe(201);
    expect(await stock(kek.id)).toBe(1);
    expect(await stock(kari.id)).toBe(null); // not counted: untouched
    // More than is left still sells; the store just shows Habis.
    expect((await w.call('POST', '/api/sales', { sale: sale('sale-aaaa-0002', 4) })).status).toBe(201);
    expect(await stock(kek.id)).toBe(0);
    // Sent again: no second take.
    await w.call('POST', '/api/sales', { sale: sale('sale-aaaa-0002', 4) });
    expect(await stock(kek.id)).toBe(0);
    // The void gives back only the 1 it really took, and only once.
    await w.call('POST', '/api/sales/sale-aaaa-0002/void', { reason: 'Salah tekan' });
    await w.call('POST', '/api/sales/sale-aaaa-0002/void', { reason: 'Salah tekan' });
    expect(await stock(kek.id)).toBe(1);
    // A sale from yesterday synced today leaves today's count alone.
    await w.call('POST', '/api/sales', { sale: sale('sale-aaaa-0003', 1, '2026-10-09T05:00:00.000Z') });
    expect(await stock(kek.id)).toBe(1);
    // A sale voided on a later day does not change that day's count.
    w.advance(24 * 60 * 60_000);
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { ...base, stock: 10 });
    await w.call('POST', '/api/sales/sale-aaaa-0001/void', { reason: 'Pulang' });
    expect(await stock(kek.id)).toBe(10);
  });
  it('orders take stock, never more than is left; 0 shows Habis; cancelled and expired orders give it back', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', { ...SETTINGS, unpaidCancelMinutes: 30 });
    const kek = byUl('m-kekbatik-01');
    expect((await w.call('PUT', `/api/kedai/items/${kek.id}`, { ...base, stock: -1 })).status).toBe(400);
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { ...base, stock: 3 });
    expect((await w.kcall('GET', '/dapur-mak-long')).body).toContain('Tinggal 3');

    const first = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }]));
    expect(first.status).toBe(201);
    expect((await w.call('GET', '/api/kedai')).body.itemStore[kek.id].stock).toBe(1);
    const tooMany = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }]));
    expect(tooMany.status).toBe(409);
    expect(tooMany.body).toMatchObject({ error: 'out_of_stock', itemId: kek.id, left: 1 });
    expect((await w.call('GET', '/api/kedai')).body.itemStore[kek.id].stock).toBe(1);

    // Saving the item without touching stock keeps what orders left.
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { ...base, description: 'Kek batik Mak Long' });
    expect((await w.call('GET', '/api/kedai')).body.itemStore[kek.id]).toMatchObject({ stock: 1, description: 'Kek batik Mak Long' });

    const second = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }]));
    expect(second.status).toBe(201);
    const page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(page).toContain('class="it out"');
    expect(page).toContain('Habis');
    expect(page).toContain(`class="it out" data-open="${kek.id}"`);

    // The seller cancels the first order: its 2 come back.
    await w.call('POST', `/api/kedai/orders/${first.body.id}/cancel`, { reason: 'Pelanggan batal' });
    expect((await w.call('GET', '/api/kedai')).body.itemStore[kek.id].stock).toBe(2);
    // The second order is never paid and expires: its 1 comes back too, once.
    w.advance(31 * 60_000);
    await w.call('GET', '/api/kedai/orders?status=open');
    await w.call('GET', '/api/kedai/orders?status=open');
    expect((await w.call('GET', '/api/kedai')).body.itemStore[kek.id].stock).toBe(3);

    // Not counted: no limit.
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { ...base, stock: null });
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 20 }]))).status).toBe(201);
  });

  it('an order with two counted items takes neither when one is short', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    const kek = byUl('m-kekbatik-01');
    const other = byUl('m-murtabak-01');
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { ...base, stock: 5 });
    await w.call('PUT', `/api/kedai/items/${other.id}`, { ...base, stock: 1 });
    const r = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }, { itemId: other.id, quantity: 2 }]));
    expect(r.body).toMatchObject({ error: 'out_of_stock', itemId: other.id, left: 1 });
    const st = (await w.call('GET', '/api/kedai')).body.itemStore;
    expect([st[kek.id].stock, st[other.id].stock]).toEqual([5, 1]);
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

describe('Laporan API', () => {
  it('Free shops get the locked preview; the full plan gets the report and a CSV for the period', async () => {
    const { w, byUl } = await shop();
    const shopId = (await w.call('GET', '/api/me')).body.shop.id as string;
    await w.store.setShopPlan(shopId, 'free', '2026-10-01T00:00:00.000Z');
    expect((await w.call('GET', '/api/reports?from=2026-10-01&to=2026-10-10')).body).toEqual({ locked: true });
    await w.store.setShopPlan(shopId, 'pos', '2026-10-01T00:00:00.000Z');
    expect((await w.call('GET', '/api/reports?from=2026-10-10&to=2026-10-01')).body.error).toBe('bad_period');
    await w.call('PUT', '/api/kedai', SETTINGS);
    const kek = byUl('m-kekbatik-01');
    const r = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }]));
    await w.call('POST', `/api/kedai/orders/${r.body.id}/step`, { from: 'awaiting_payment' });
    const rep = (await w.call('GET', '/api/reports?from=2026-10-01&to=2026-10-10')).body;
    expect(rep.locked).toBe(false);
    expect(rep.report.now.count).toBe(1);
    expect(rep.report.channels.online).toBeGreaterThan(0);
    expect(rep.report.daily).toHaveLength(10);
    const csv = await w.handle(new Request('https://jualan.untunglab.space/api/reports/csv?from=2026-10-01&to=2026-10-10', { headers: { cookie: w.cookie } }));
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(await csv.text()).toContain('Kek batik');
  });
});

describe('Kedai: ordering modes (OM-01 to OM-06)', () => {
  const hours = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ open: d !== 0, from: '10:00', to: '18:00' })); // closed Sunday
  const base = { description: '', online: true, badge: null, featured: false };

  it('auto: inside hours for today; outside, a pre-order for the next opening day, skipping Sunday and holidays', async () => {
    const { w, byUl } = await shop();
    expect((await w.call('PUT', '/api/kedai', { ...SETTINGS, orderMode: 'auto', hours: hours.map((h) => ({ ...h, open: false })) })).body.detail).toBe('hours');
    await w.call('PUT', '/api/kedai', { ...SETTINGS, orderMode: 'auto', hours, holidays: ['2026-10-12'] });
    const kek = byUl('m-kekbatik-01');
    // Sat 10 Oct, 9am MY: before opening → today, later.
    let page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(page).toContain('KEDAI TUTUP SEKARANG');
    expect(page).toContain('Sabtu 10 Okt');
    w.setNow('2026-10-10T04:00:00.000Z'); // Sat noon
    page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(page).toContain('BUKA HARI INI');
    const today = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }]));
    expect((await w.call('GET', '/api/kedai/orders?status=open')).body.orders.find((o: { id: string }) => o.id === today.body.id)).toMatchObject({ batchId: null, readyDate: null });
    // Sat 8pm MY: closed; Sunday closed, Monday 12 Oct a holiday → Tuesday 13 Oct.
    w.setNow('2026-10-10T12:00:00.000Z');
    page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(page).toContain('Selasa 13 Okt');
    const later = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }], { phone: '0129998888' }));
    expect((await w.call('GET', '/api/kedai/orders?status=open')).body.orders.find((o: { id: string }) => o.id === later.body.id)).toMatchObject({ batchId: 'auto-2026-10-13', batchLabel: 'Selasa 13 Okt', readyDate: '2026-10-13' });
    expect((await w.call('GET', '/api/kedai/prep?batch=auto-2026-10-13')).body.prep.orders).toBe(1);
  });

  it('auto: the stock check is due 30 minutes before closing, once; keeping or editing answers it', async () => {
    const { w, byUl } = await shop();
    const rang: string[] = [];
    await w.call('PUT', '/api/kedai', { ...SETTINGS, orderMode: 'auto', hours });
    const kek = byUl('m-kekbatik-01');
    w.setNow('2026-10-10T09:00:00.000Z'); // 5:00pm MY, closes 6pm
    expect((await w.call('GET', '/api/kedai/summary')).body.stockCheck).toBeNull(); // nothing counts stock yet
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { ...base, stock: 4 });
    expect((await w.call('GET', '/api/kedai/summary')).body.stockCheck).toBeNull(); // too early
    w.setNow('2026-10-10T09:35:00.000Z'); // 5:35pm
    expect((await w.call('GET', '/api/kedai/summary')).body.stockCheck).toMatchObject({ closesAt: '18:00', nextDay: '2026-10-12' });
    const send = async (e: string) => (rang.push(e), 'sent' as const);
    await w.store.savePushSub('https://fcm.googleapis.com/fcm/send/x', (await w.call('GET', '/api/me')).body.shop.id, (await w.call('GET', '/api/me')).body.user.id, 't');
    expect(await stockReminderSweep(w.store, send, '2026-10-10T09:35:00.000Z')).toBe(1);
    expect(await stockReminderSweep(w.store, send, '2026-10-10T09:45:00.000Z')).toBe(0); // once a day
    await w.call('PUT', '/api/kedai/stock-check', { stock: { [kek.id]: 30 } });
    expect((await w.call('GET', '/api/kedai')).body.itemStore[kek.id].stock).toBe(30);
    expect((await w.call('GET', '/api/kedai/summary')).body.stockCheck).toBeNull();
  });

  it('batch: own menu and stock per batch, today alongside with a last order time; one order is for one day', async () => {
    const { w, byUl } = await shop();
    const kek = byUl('m-kekbatik-01'), mur = byUl('m-murtabak-01');
    const sat = { id: 'sat17', label: 'Sabtu 17 Okt', readyDate: '2026-10-17', closesAt: '2026-10-15T20:00:00+08:00', maxOrders: null };
    await w.call('PUT', '/api/kedai', { ...SETTINGS, orderMode: 'batch', preorder: { on: true, batches: [sat], today: true, todayCutoff: '17:00' } });
    await w.call('PUT', `/api/kedai/items/${kek.id}`, { ...base, stock: 5 });
    expect((await w.call('PUT', '/api/kedai/batches/sat17/menu', { menu: [{ itemId: 'nope', stock: 1 }] })).body.error).toBe('bad_menu');
    await w.call('PUT', '/api/kedai/batches/sat17/menu', { menu: [{ itemId: kek.id, stock: 2 }] });
    const page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(page).toContain('PILIH HARI DAHULU');
    expect(page).toContain('Pesanan terakhir');
    expect(page).toContain('1 pesanan untuk 1 hari');

    // Saturday: only kek batik, from the batch's 2; today's stock (5) untouched.
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: mur.id, quantity: 1 }], { batchId: 'sat17' }))).body.error).toBe('not_in_batch');
    const a = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 2 }], { batchId: 'sat17' }));
    expect(a.status).toBe(201);
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }], { batchId: 'sat17', phone: '0129998888' }))).body).toMatchObject({ error: 'out_of_stock', left: 0 });
    expect((await w.call('GET', '/api/kedai')).body.itemStore[kek.id].stock).toBe(5);
    expect((await w.call('GET', '/api/kedai/batches/sat17/menu')).body).toMatchObject({ menu: [{ itemId: kek.id, stock: 0 }], ordered: { [kek.id]: 2 } });
    // Today: full menu, today's stock.
    const t1 = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }, { itemId: mur.id, quantity: 1 }], { batchId: '', phone: '0127776666' }));
    expect(t1.status).toBe(201);
    expect((await w.call('GET', '/api/kedai')).body.itemStore[kek.id].stock).toBe(4);
    // Cancelling the Saturday order gives back to the batch, not to today.
    await w.call('POST', `/api/kedai/orders/${a.body.id}/cancel`, { reason: 'batal' });
    expect((await w.call('GET', '/api/kedai/batches/sat17/menu')).body.menu[0].stock).toBe(2);
    expect((await w.call('GET', '/api/kedai')).body.itemStore[kek.id].stock).toBe(4);
    // After 5pm MY today is gone; only the batch remains.
    w.setNow('2026-10-10T09:30:00.000Z');
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }], { batchId: '', phone: '0125554444' }))).body.error).toBe('batch_required');
  });
});

describe('Kedai: the store script', () => {
  it('is valid JavaScript (a stray quote once stopped day switching and adding to cart)', async () => {
    const { KEDAI_JS } = await import('../kedaiPages');
    expect(() => new Function(KEDAI_JS)).not.toThrow();
  });
});

describe('Kedai: spam check', () => {
  it('with Turnstile on, the checkout shows the check and an order needs a good token', async () => {
    const seen: string[] = [];
    const { w, byUl } = await shop('pos', { human: { siteKey: 'site-key-1', verify: async (t) => (seen.push(t), t === 'good') } });
    await w.call('PUT', '/api/kedai', SETTINGS);
    const page = await w.kcall('GET', '/dapur-mak-long/troli');
    expect(page.body).toContain('data-sitekey="site-key-1"');
    expect(page.body).toContain('challenges.cloudflare.com/turnstile/v0/api.js');
    const kek = byUl('m-kekbatik-01');
    expect(await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }]))).toMatchObject({ status: 403, body: { error: 'human_check' } });
    expect(await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }], { human: 'bad' }))).toMatchObject({ status: 403, body: { error: 'human_check' } });
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }], { human: 'good' }))).status).toBe(201);
    expect(seen).toEqual(['bad', 'good']);
  });
  it('with Turnstile off, nothing changes', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    expect((await w.kcall('GET', '/dapur-mak-long/troli')).body).not.toContain('cf-turnstile');
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: byUl('m-kekbatik-01').id, quantity: 1 }]))).status).toBe(201);
  });
});

describe('Kedai: customer privacy', () => {
  it('serves the notice and links it from checkout; finished orders forget the customer after 90 days', async () => {
    const { w, byUl } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    const notice = await w.kcall('GET', '/privasi');
    expect(notice.status).toBe(200);
    expect(notice.body).toContain('Notis Privasi Pelanggan');
    expect(notice.body).toContain('90 hari');
    expect((await w.kcall('GET', '/dapur-mak-long/troli')).body).toContain('href="/privasi"');
    const kek = byUl('m-kekbatik-01');
    const a = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }]));
    const b = await w.kcall('POST', '/dapur-mak-long/pesan', order([{ itemId: kek.id, quantity: 1 }]));
    await w.call('POST', `/api/kedai/orders/${a.body.id}/cancel`, { reason: 'Pelanggan batal' });
    const now = () => new Date(Date.parse('2026-10-10T01:00:00.000Z')).toISOString();
    // Too recent: kept.
    expect(await w.store.forgetOldCustomers(now())).toBe(0);
    w.advance(91 * 864e5);
    const cutoff = new Date(Date.parse(now()) + 1 * 864e5).toISOString();
    expect(await w.store.forgetOldCustomers(cutoff)).toBe(1);
    const gone = await w.store.getOrder(a.body.id);
    expect(gone).toMatchObject({ customerName: '', customerPhone: '', address: '', note: '', totalSen: expect.any(Number) });
    // Still open: kept.
    expect((await w.store.getOrder(b.body.id))?.customerName).toBe('Aina');
  });
});

describe('Kedai: Home store card', () => {
  it('says whether customers can order now, not just whether the store is published', async () => {
    const { w } = await shop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    expect((await w.call('GET', '/api/kedai/summary')).body).toMatchObject({ taking: 'yes', today: { count: 0, totalSen: 0 } });
    await w.call('PUT', '/api/kedai', { ...SETTINGS, orderMode: 'batch', preorder: { on: true, today: false, todayCutoff: '', batches: [{ id: 'old1', label: 'Ahad 4 Okt', readyDate: '2026-10-04', closesAt: '2026-10-03T08:00:00.000Z', maxOrders: null }] } });
    expect((await w.call('GET', '/api/kedai/summary')).body.taking).toBe('no_batch');
    await w.call('PUT', '/api/kedai', { ...SETTINGS, open: false });
    expect((await w.call('GET', '/api/kedai/summary')).body.taking).toBe('paused');
  });
});

describe('Kedai: pre-order notice shows opening hours', () => {
  it('outside opening hours (mode auto), the notice says when the store opens and its hours', async () => {
    const { w } = await shop();
    const day = (open: boolean) => ({ open, from: '10:00', to: '18:00' });
    // The test clock is Saturday 9:00 am in Malaysia, before opening.
    await w.call('PUT', '/api/kedai', { ...SETTINGS, orderMode: 'auto', hours: [day(false), day(true), day(true), day(true), day(true), day(true), { open: true, from: '10:00', to: '13:00' }] });
    const page = (await w.kcall('GET', '/dapur-mak-long')).body as string;
    expect(page).toContain('KEDAI TUTUP SEKARANG');
    expect(page).toContain('Waktu buka');
    expect(page).toContain('Isnin</span><span lang="en">Mon</span>–<span lang="ms">Jumaat');
    expect(page).toContain('10:00 pg');
  });
});
