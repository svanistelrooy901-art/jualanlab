/**
 * The public side of Kedai, served at its own address (kedai.untunglab.space, K-03) so a customer's page never
 * shares an origin with the seller's app. Pages for customers, and one way in for orders: POST /<slug>/pesan.
 */
import { dayKey } from '../../src/domain/day';
import { DEFAULT_ITEM_STORE, FREE_STORE_ITEMS, orderNumber, priceOrder, readableBrand, validateOrderRequest, type ItemStore, type Order, type StoreSettings } from '../../src/domain/kedai';
import { groupByCategory, type Item } from '../../src/domain/items';
import { bestPromo } from '../../src/domain/promo';
import { bestSellers } from '../../src/domain/summary';
import { base64url } from './crypto';
import { checkoutPage, KEDAI_JS, notFoundPage, orderPage, storePage, type StoreItemView } from './kedaiPages';
import type { Store } from './ports';

export interface KedaiDeps {
  store: Store;
  config: { origin: string };
  now: () => Date;
  randomBytes: (n: number) => Uint8Array;
}

const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const SECURITY = { 'content-security-policy': CSP, 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'strict-transport-security': 'max-age=31536000' };

const html = (body: string, status = 200, cache = 'no-store') => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache, ...SECURITY } });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SECURITY } });

const ORDERS_PER_IP_HOUR = 20;
const ORDERS_PER_PHONE_HOUR = 6;

export function createKedaiHandler(d: KedaiDeps) {
  const iso = (ms = 0) => new Date(d.now().getTime() + ms).toISOString();

  async function loadStore(slug: string): Promise<{ shopId: string; shopName: string; settings: StoreSettings; plan: string } | null> {
    const found = await d.store.getStoreBySlug(slug);
    if (!found || !found.settings.published) return null;
    const shop = await d.store.getShopById(found.shopId);
    if (!shop) return null;
    return { shopId: shop.id, shopName: shop.name, settings: found.settings, plan: shop.plan ?? 'free' };
  }

  /** The items the store shows, in counter order; Free plan stores show the first 10 (K-05). */
  async function storeItems(shopId: string, plan: string): Promise<(Item & { store: ItemStore })[]> {
    const extra = await d.store.listItemStore(shopId);
    const items = (await d.store.listItems(shopId)).filter((i) => i.active).map((i) => ({ ...i, store: extra.get(i.id) ?? DEFAULT_ITEM_STORE })).filter((i) => i.store.online);
    const ordered = groupByCategory(items).flatMap((g) => g.items) as (Item & { store: ItemStore })[];
    return plan === 'pos' ? ordered : ordered.slice(0, FREE_STORE_ITEMS);
  }

  async function itemViews(shopId: string, items: (Item & { store: ItemStore })[], base: string): Promise<StoreItemView[]> {
    const promos = await d.store.listPromos(shopId);
    const photos = await d.store.itemPhotoVersions(shopId);
    const today = dayKey(d.now());
    // "Laris": the shop's top sellers over the last 30 days (from real sales, K-plan).
    const top = new Set(bestSellers(await d.store.listSales(shopId, iso(-30 * 864e5), iso()), 3).map((b) => b.itemId));
    return items.map((i) => {
      const m = bestPromo(promos, i, today);
      const label = m ? (m.promo.kind === 'pct' ? `−${m.promo.pct}%` : m.promo.name) : '';
      return {
        id: i.id, name: i.name, description: i.store.description, category: i.category, priceSen: i.priceSen,
        promo: m ? { name: m.promo.name, priceSen: m.priceSen, label } : null,
        badge: i.store.badge ?? (top.has(i.id) ? 'laris' : null), featured: i.store.featured,
        photo: photos.has(i.id) ? `${base}/i/${encodeURIComponent(i.id)}?v=${encodeURIComponent(photos.get(i.id)!)}` : null,
      };
    });
  }

  async function rateLimit(key: string, max: number) {
    if ((await d.store.countHits(key, iso(-3600_000))) >= max) return false;
    await d.store.recordHit(key, iso());
    return true;
  }

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/_k/app.js') return new Response(KEDAI_JS, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=300', ...SECURITY } });
      if (path === '/' ) return Response.redirect('https://smelab.untunglab.space/#jualanlab', 302);
      const m = /^\/([a-z0-9-]{3,40})(?:\/(troli|pesan|qr|logo|cover|p\/([A-Za-z0-9_-]{16,64})(\.json)?|i\/([A-Za-z0-9_-]{1,64})))?$/.exec(path);
      if (!m) return html(notFoundPage(), 404);
      const st = await loadStore(m[1]!);
      if (!st) return html(notFoundPage(), 404);
      const base = `/${m[1]!}`;
      const brand = readableBrand(st.settings.brandColor);
      const sub = m[2] ?? '';

      // Links to the shop's logo and cover carry the time they last changed, so phones may keep them for a day.
      const ver = await d.store.assetVersions(st.shopId);
      const img = (k: 'logo' | 'cover') => (ver[k] ? `${base}/${k}?v=${encodeURIComponent(ver[k]!)}` : null);
      const images = { logo: img('logo'), cover: img('cover') };
      if (req.method === 'GET' && sub === '') {
        const items = await itemViews(st.shopId, await storeItems(st.shopId, st.plan), base);
        return html(storePage({ shopName: st.shopName, base, settings: st.settings, brand, items, ...images, origin: d.config.origin }), 200, 'public, max-age=30');
      }
      if (req.method === 'GET' && sub === 'troli') {
        const items = await itemViews(st.shopId, await storeItems(st.shopId, st.plan), base);
        return html(checkoutPage({ shopName: st.shopName, base, settings: st.settings, brand, items, ...images, origin: d.config.origin }));
      }
      if (req.method === 'GET' && m[5]) {
        // Only photos of items the store shows (hidden items and items past the Free limit stay private).
        if (!(await storeItems(st.shopId, st.plan)).some((i) => i.id === m[5])) return new Response('Not found', { status: 404 });
        const a = await d.store.getItemPhoto(st.shopId, m[5]);
        if (!a) return new Response('Not found', { status: 404 });
        return new Response(Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0)), { headers: { 'content-type': a.mime, 'cache-control': 'public, max-age=86400', ...SECURITY } });
      }
      if (req.method === 'GET' && (sub === 'logo' || sub === 'cover')) {
        const a = await d.store.getAsset(st.shopId, sub);
        if (!a) return new Response('Not found', { status: 404 });
        const bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
        return new Response(bytes, { headers: { 'content-type': a.mime, 'cache-control': 'public, max-age=86400', ...SECURITY } });
      }
      if (req.method === 'GET' && sub === 'qr') {
        const a = await d.store.getAsset(st.shopId, 'qr');
        if (!a) return new Response('Not found', { status: 404 });
        const bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
        return new Response(bytes, { headers: { 'content-type': a.mime, 'cache-control': 'private, max-age=300', 'content-disposition': 'inline', ...SECURITY } });
      }
      if (req.method === 'GET' && m[3]) {
        await d.store.expireOrders(st.shopId, iso());
        const order = await d.store.getOrder(m[3]);
        if (!order || order.shopId !== st.shopId) return m[4] ? json(404, { error: 'not_found' }) : html(notFoundPage(), 404);
        if (m[4]) return json(200, { status: order.status, updatedAt: order.updatedAt });
        return html(orderPage({ shopName: st.shopName, base, brand, settings: st.settings, order, hasQr: ver.qr !== undefined, logo: images.logo, now: d.now() }));
      }
      if (req.method === 'POST' && sub === 'pesan') {
        if (req.headers.get('origin') !== d.config.origin) return json(403, { error: 'bad_origin' });
        if (!(req.headers.get('content-type') ?? '').includes('application/json')) return json(415, { error: 'json_required' });
        const text = await req.text();
        if (text.length > 50_000) return json(413, { error: 'too_large' });
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          return json(400, { error: 'bad_json' });
        }
        const v = validateOrderRequest(raw);
        if (!v.ok) return json(400, { error: 'bad_order', detail: v.error });
        const ip = req.headers.get('cf-connecting-ip') ?? 'local';
        if (!(await rateLimit(`kedai:ip:${ip}`, ORDERS_PER_IP_HOUR)) || !(await rateLimit(`kedai:phone:${v.value.phone}`, ORDERS_PER_PHONE_HOUR))) {
          return json(429, { error: 'too_many_requests' });
        }
        const items = new Map((await storeItems(st.shopId, st.plan)).map((i) => [i.id, i]));
        const priced = priceOrder(v.value, { items, promos: await d.store.listPromos(st.shopId), today: dayKey(d.now()), settings: st.settings });
        if (!priced.ok) return json(409, { error: priced.error });
        const at = iso();
        const qr = v.value.pay === 'qr';
        const order: Omit<Order, 'seq' | 'number'> = {
          id: base64url(d.randomBytes(18)), shopId: st.shopId, createdAt: at, customerName: v.value.name, customerPhone: v.value.phone,
          fulfilment: v.value.fulfilment, area: v.value.area, address: v.value.address, note: v.value.note, pay: v.value.pay,
          subtotalSen: priced.value.subtotalSen, deliverySen: priced.value.deliverySen, totalSen: priced.value.totalSen,
          // Pay at pickup needs no payment check first: it goes straight to the seller as confirmed (plan, order flow).
          status: qr ? 'awaiting_payment' : 'confirmed', expiresAt: qr ? iso(st.settings.unpaidCancelMinutes * 60_000) : null,
          paidAt: null, cancelReason: null, saleId: null, updatedAt: at, lines: priced.value.lines,
        };
        const saved = await d.store.createOrder(order, orderNumber);
        return json(201, { id: saved.id, number: saved.number, url: `${base}/p/${saved.id}` });
      }
      return html(notFoundPage(), 404);
    } catch (e) {
      console.error('kedai', e);
      return html(notFoundPage(), 500);
    }
  };
}
