/** The Store on D1 (SQLite). Tests run this same SQL on node:sqlite, so what is tested is what ships. */
import type { Item } from '../../src/domain/items';
import type { Sale, SaleLine } from '../../src/domain/sale';
import type { Promo } from '../../src/domain/promo';
import type { ItemStore, Order, OrderStatus, StoreSettings } from '../../src/domain/kedai';
import type { D1Database } from './d1';
import type { AssetKind, PhotoBucket, DayClose, LoginCode, Plan, PriceImport, ServerDay, Shop, Store, User } from './ports';

type Row = Record<string, unknown>;

const user = (r: Row): User => ({
  id: r.id as string, email: r.email as string, name: (r.name as string | null) ?? null,
  googleSub: (r.google_sub as string | null) ?? null, createdAt: r.created_at as string, smelabId: (r.smelab_id as string | null) ?? null,
});

const item = (r: Row): Item => ({
  id: r.id as string,
  source: r.source as Item['source'],
  ulMenuId: (r.ul_menu_id as string | null) ?? null,
  name: r.name as string,
  category: (r.category as string | null) ?? null,
  priceSen: Number(r.price_sen),
  ulPriceSen: r.ul_price_sen === null || r.ul_price_sen === undefined ? null : Number(r.ul_price_sen),
  marginPct: r.margin_pct === null || r.margin_pct === undefined ? null : Number(r.margin_pct),
  status: (r.status as Item['status']) ?? null,
  baseUlMenuId: (r.base_ul_menu_id as string | null) ?? null,
  active: Number(r.active) === 1,
  updatedAt: r.updated_at as string,
});

const ITEM_UPSERT = `INSERT INTO items (id, shop_id, source, ul_menu_id, name, category, price_sen, ul_price_sen, margin_pct, status, base_ul_menu_id, active, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET name = excluded.name, category = excluded.category, price_sen = excluded.price_sen,
    ul_price_sen = excluded.ul_price_sen, margin_pct = excluded.margin_pct, status = excluded.status,
    base_ul_menu_id = excluded.base_ul_menu_id, active = excluded.active, updated_at = excluded.updated_at
  WHERE items.shop_id = excluded.shop_id`;

export class SqlStore implements Store {
  /** Without a bucket (development, or before R2 was switched on) photos are kept in D1 as base64. */
  constructor(private readonly db: D1Database, private readonly photos: PhotoBucket | null = null) {}

  async getUserById(id: string) {
    const r = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<Row>();
    return r ? user(r) : null;
  }
  async getUserByEmail(email: string) {
    const r = await this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<Row>();
    return r ? user(r) : null;
  }
  async getUserByGoogleSub(sub: string) {
    const r = await this.db.prepare('SELECT * FROM users WHERE google_sub = ?').bind(sub).first<Row>();
    return r ? user(r) : null;
  }
  async createUser(u: User) {
    await this.db.prepare('INSERT INTO users (id, email, name, google_sub, created_at, smelab_id) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(u.id, u.email, u.name, u.googleSub, u.createdAt, u.smelabId ?? null).run();
  }
  async getUserBySmelabId(smelabId: string) {
    const r = await this.db.prepare('SELECT * FROM users WHERE smelab_id = ?').bind(smelabId).first<Row>();
    return r ? user(r) : null;
  }
  async linkSmelab(userId: string, smelabId: string, name: string | null) {
    await this.db.prepare('UPDATE users SET smelab_id = ?, name = COALESCE(name, ?) WHERE id = ?').bind(smelabId, name, userId).run();
  }
  async linkGoogle(userId: string, sub: string, name: string | null) {
    await this.db.prepare('UPDATE users SET google_sub = ?, name = COALESCE(name, ?) WHERE id = ?').bind(sub, name, userId).run();
  }

  async createSession(tokenHash: string, userId: string, createdAt: string, expiresAt: string) {
    await this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(tokenHash, userId, createdAt, expiresAt).run();
  }
  async getSession(tokenHash: string) {
    const r = await this.db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').bind(tokenHash).first<Row>();
    return r ? { userId: r.user_id as string, expiresAt: r.expires_at as string } : null;
  }
  async extendSession(tokenHash: string, expiresAt: string) {
    await this.db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').bind(expiresAt, tokenHash).run();
  }
  async deleteSession(tokenHash: string) {
    await this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  async putLoginCode(c: LoginCode) {
    await this.db.prepare(`INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
      ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`)
      .bind(c.email, c.codeHash, c.expiresAt, c.sentAt).run();
  }
  async getLoginCode(email: string) {
    const r = await this.db.prepare('SELECT * FROM login_codes WHERE email = ?').bind(email).first<Row>();
    return r ? { email: r.email as string, codeHash: r.code_hash as string, expiresAt: r.expires_at as string, attempts: Number(r.attempts), sentAt: r.sent_at as string } : null;
  }
  async countLoginAttempt(email: string) {
    await this.db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
  }
  async deleteLoginCode(email: string) {
    await this.db.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
  }

  async recordHit(key: string, at: string) {
    await this.db.prepare('INSERT INTO hits (key, at) VALUES (?, ?)').bind(key, at).run();
  }
  async pruneHits(before: string) {
    await this.db.prepare('DELETE FROM hits WHERE at < ?').bind(before).run();
  }
  async countHits(key: string, since: string) {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM hits WHERE key = ? AND at >= ?').bind(key, since).first<Row>();
    return Number(r?.n ?? 0);
  }

  async getShopByOwner(userId: string) {
    return this.shopRow(await this.db.prepare('SELECT * FROM shops WHERE owner_id = ?').bind(userId).first<Row>());
  }
  async getShopById(id: string) {
    return this.shopRow(await this.db.prepare('SELECT * FROM shops WHERE id = ?').bind(id).first<Row>());
  }
  private shopRow(r: Row | null): Shop | null {
    return r ? ({ id: r.id, ownerId: r.owner_id, name: r.name, createdAt: r.created_at, plan: (r.plan as Plan) ?? 'free', planSince: (r.plan_since as string) ?? null } as Shop) : null;
  }
  async createShop(s: Shop) {
    await this.db.prepare('INSERT INTO shops (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').bind(s.id, s.ownerId, s.name, s.createdAt).run();
  }
  async setShopPlan(shopId: string, plan: Plan, since: string) {
    await this.db.prepare('UPDATE shops SET plan = ?, plan_since = ? WHERE id = ?').bind(plan, since, shopId).run();
  }
  async countActiveItems(shopId: string) {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM items WHERE shop_id = ? AND active = 1').bind(shopId).first<Row>();
    return Number(r?.n ?? 0);
  }
  async renameShop(shopId: string, name: string) {
    await this.db.prepare('UPDATE shops SET name = ? WHERE id = ?').bind(name, shopId).run();
  }

  // ---- Kedai ----
  async getStore(shopId: string) {
    const r = await this.db.prepare('SELECT settings FROM stores WHERE shop_id = ?').bind(shopId).first<Row>();
    return r ? (JSON.parse(r.settings as string) as StoreSettings) : null;
  }
  async getStoreBySlug(slug: string) {
    const r = await this.db.prepare('SELECT shop_id, settings FROM stores WHERE slug = ?').bind(slug).first<Row>();
    return r ? { shopId: r.shop_id as string, settings: JSON.parse(r.settings as string) as StoreSettings } : null;
  }
  async saveStore(shopId: string, s: StoreSettings, at: string): Promise<'saved' | 'slug_taken'> {
    const other = await this.db.prepare('SELECT shop_id FROM stores WHERE slug = ? AND shop_id <> ?').bind(s.slug, shopId).first<Row>();
    if (other) return 'slug_taken';
    try {
      await this.db.prepare(`INSERT INTO stores (shop_id, slug, settings, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT (shop_id) DO UPDATE SET slug = excluded.slug, settings = excluded.settings, updated_at = excluded.updated_at`)
        .bind(shopId, s.slug, JSON.stringify(s), at).run();
      return 'saved';
    } catch {
      return 'slug_taken'; // another shop took the address at the same moment
    }
  }
  async listItemStore(shopId: string) {
    const r = await this.db.prepare('SELECT item_id, settings FROM item_store WHERE shop_id = ?').bind(shopId).all<Row>();
    return new Map((r.results ?? []).map((x) => [x.item_id as string, JSON.parse(x.settings as string) as ItemStore]));
  }
  async saveItemStore(shopId: string, itemId: string, s: ItemStore, at: string) {
    await this.db.prepare(`INSERT INTO item_store (item_id, shop_id, settings, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (item_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at WHERE item_store.shop_id = excluded.shop_id`)
      .bind(itemId, shopId, JSON.stringify(s), at).run();
  }
  async createOrder(o: Omit<Order, 'seq' | 'number'>, numberOf: (seq: number) => string): Promise<Order> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await this.db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM store_orders WHERE shop_id = ?').bind(o.shopId).first<Row>();
      const seq = Number(r?.n ?? 1);
      const order: Order = { ...o, seq, number: numberOf(seq) };
      try {
        await this.db.batch([
          this.db.prepare(`INSERT INTO store_orders (id, shop_id, seq, number, created_at, customer_name, customer_phone, fulfilment, area, address, note, pay,
            subtotal_sen, delivery_sen, total_sen, status, expires_at, paid_at, cancel_reason, sale_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(order.id, order.shopId, seq, order.number, order.createdAt, order.customerName, order.customerPhone, order.fulfilment, order.area, order.address, order.note, order.pay,
              order.subtotalSen, order.deliverySen, order.totalSen, order.status, order.expiresAt, order.paidAt, order.cancelReason, order.saleId, order.updatedAt),
          ...order.lines.map((l, n) => this.db.prepare(`INSERT INTO store_order_lines (order_id, line_no, item_id, name, unit_price_sen, quantity, margin_pct, note, unit_cost_sen,
            list_price_sen, discount_pct, promo_id, promo_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(order.id, n, l.itemId, l.name, l.unitPriceSen, l.quantity, l.marginPct, l.note, l.unitCostSen ?? null, l.listPriceSen ?? null, l.discountPct ?? null, l.promoId ?? null, l.promoName ?? null)),
        ]);
        return order;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
    throw new Error('unreachable');
  }
  async getOrder(id: string) {
    const r = await this.db.prepare('SELECT * FROM store_orders WHERE id = ?').bind(id).first<Row>();
    return r ? (await this.withOrderLines([r]))[0]! : null;
  }
  async listOrders(shopId: string, statuses: OrderStatus[], limit: number) {
    if (statuses.length === 0) return [];
    const r = await this.db.prepare(`SELECT * FROM store_orders WHERE shop_id = ? AND status IN (${statuses.map(() => '?').join(', ')}) ORDER BY created_at DESC LIMIT ?`)
      .bind(shopId, ...statuses, limit).all<Row>();
    return this.withOrderLines(r.results ?? []);
  }
  async moveOrder(id: string, from: OrderStatus[], patch: Partial<Pick<Order, 'status' | 'paidAt' | 'cancelReason' | 'saleId' | 'updatedAt'>>) {
    const cols: Record<string, string> = { status: 'status', paidAt: 'paid_at', cancelReason: 'cancel_reason', saleId: 'sale_id', updatedAt: 'updated_at' };
    const keys = Object.keys(patch) as (keyof typeof patch)[];
    const r = await this.db.prepare(`UPDATE store_orders SET ${keys.map((k) => `${cols[k]} = ?`).join(', ')} WHERE id = ? AND status IN (${from.map(() => '?').join(', ')})`)
      .bind(...keys.map((k) => patch[k] ?? null), id, ...from).run();
    return (r.meta?.changes ?? 0) > 0;
  }
  async expireOrders(shopId: string, now: string) {
    const r = await this.db.prepare(`UPDATE store_orders SET status = 'cancelled', cancel_reason = 'expired', updated_at = ?
      WHERE shop_id = ? AND status = 'awaiting_payment' AND expires_at IS NOT NULL AND expires_at < ?`).bind(now, shopId, now).run();
    return r.meta?.changes ?? 0;
  }
  async countOrdersByStatus(shopId: string) {
    const r = await this.db.prepare('SELECT status, COUNT(*) AS n FROM store_orders WHERE shop_id = ? GROUP BY status').bind(shopId).all<Row>();
    const out = { awaiting_payment: 0, confirmed: 0, preparing: 0, ready: 0, done: 0, cancelled: 0 } as Record<OrderStatus, number>;
    for (const x of r.results ?? []) out[x.status as OrderStatus] = Number(x.n);
    return out;
  }
  async getAsset(shopId: string, kind: AssetKind) {
    const r = await this.db.prepare('SELECT mime, data, updated_at FROM store_assets WHERE shop_id = ? AND kind = ?').bind(shopId, kind).first<Row>();
    return r ? { mime: r.mime as string, data: r.data as string, updatedAt: r.updated_at as string } : null;
  }
  // Item photos: the row in item_photos says a photo exists, its type and version; the picture itself is in the
  // bucket (data '') or, without a bucket, in the row as base64. A row from before R2 moves to the bucket when read.
  private photoKey(shopId: string, itemId: string) {
    return `items/${shopId}/${itemId}`;
  }
  async getItemPhoto(shopId: string, itemId: string) {
    const r = await this.db.prepare('SELECT mime, data FROM item_photos WHERE shop_id = ? AND item_id = ?').bind(shopId, itemId).first<Row>();
    if (!r) return null;
    const mime = r.mime as string;
    if (r.data) {
      const bytes = Uint8Array.from(atob(r.data as string), (c) => c.charCodeAt(0));
      if (this.photos) {
        await this.photos.put(this.photoKey(shopId, itemId), bytes, { httpMetadata: { contentType: mime } });
        await this.db.prepare("UPDATE item_photos SET data = '' WHERE shop_id = ? AND item_id = ?").bind(shopId, itemId).run();
      }
      return { mime, bytes };
    }
    const o = this.photos ? await this.photos.get(this.photoKey(shopId, itemId)) : null;
    return o ? { mime, bytes: new Uint8Array(await o.arrayBuffer()) } : null;
  }
  async putItemPhoto(shopId: string, itemId: string, mime: string, data: string, at: string) {
    let stored = data;
    if (this.photos) {
      await this.photos.put(this.photoKey(shopId, itemId), Uint8Array.from(atob(data), (c) => c.charCodeAt(0)), { httpMetadata: { contentType: mime } });
      stored = '';
    }
    await this.db.prepare(`INSERT INTO item_photos (item_id, shop_id, mime, data, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (item_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`).bind(itemId, shopId, mime, stored, at).run();
  }
  async deleteItemPhoto(shopId: string, itemId: string) {
    await this.db.prepare('DELETE FROM item_photos WHERE shop_id = ? AND item_id = ?').bind(shopId, itemId).run();
    if (this.photos) await this.photos.delete(this.photoKey(shopId, itemId));
  }
  async itemPhotoVersions(shopId: string) {
    const r = await this.db.prepare('SELECT item_id, updated_at FROM item_photos WHERE shop_id = ?').bind(shopId).all<Row>();
    return new Map((r.results ?? []).map((x) => [x.item_id as string, x.updated_at as string]));
  }
  async deleteAsset(shopId: string, kind: AssetKind) {
    await this.db.prepare('DELETE FROM store_assets WHERE shop_id = ? AND kind = ?').bind(shopId, kind).run();
  }
  async assetVersions(shopId: string) {
    const r = await this.db.prepare('SELECT kind, updated_at FROM store_assets WHERE shop_id = ?').bind(shopId).all<Row>();
    return Object.fromEntries((r.results ?? []).map((x) => [x.kind as string, x.updated_at as string])) as Partial<Record<AssetKind, string>>;
  }
  async putAsset(shopId: string, kind: AssetKind, mime: string, data: string, at: string) {
    await this.db.prepare(`INSERT INTO store_assets (shop_id, kind, mime, data, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (shop_id, kind) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`).bind(shopId, kind, mime, data, at).run();
  }
  private async withOrderLines(rows: Row[]): Promise<Order[]> {
    const out: Order[] = [];
    for (const r of rows) {
      const lr = await this.db.prepare('SELECT * FROM store_order_lines WHERE order_id = ? ORDER BY line_no').bind(r.id).all<Row>();
      out.push({
        id: r.id as string, shopId: r.shop_id as string, seq: Number(r.seq), number: r.number as string, createdAt: r.created_at as string,
        customerName: r.customer_name as string, customerPhone: r.customer_phone as string, fulfilment: r.fulfilment as Order['fulfilment'],
        area: r.area as string, address: r.address as string, note: r.note as string, pay: r.pay as Order['pay'],
        subtotalSen: Number(r.subtotal_sen), deliverySen: Number(r.delivery_sen), totalSen: Number(r.total_sen), status: r.status as OrderStatus,
        expiresAt: (r.expires_at as string | null) ?? null, paidAt: (r.paid_at as string | null) ?? null, cancelReason: (r.cancel_reason as string | null) ?? null,
        saleId: (r.sale_id as string | null) ?? null, updatedAt: r.updated_at as string,
        lines: (lr.results ?? []).map((l) => ({
          itemId: l.item_id as string, name: l.name as string, unitPriceSen: Number(l.unit_price_sen), quantity: Number(l.quantity),
          marginPct: l.margin_pct == null ? null : Number(l.margin_pct), note: l.note as string,
          unitCostSen: l.unit_cost_sen == null ? null : Number(l.unit_cost_sen), listPriceSen: l.list_price_sen == null ? null : Number(l.list_price_sen),
          discountPct: l.discount_pct == null ? null : Number(l.discount_pct), promoId: (l.promo_id as string | null) ?? null, promoName: (l.promo_name as string | null) ?? null,
        })),
      });
    }
    return out;
  }

  // ---- promotions ----
  async listPromos(shopId: string) {
    const r = await this.db.prepare('SELECT * FROM promos WHERE shop_id = ? ORDER BY created_at, id').bind(shopId).all<Row>();
    return (r.results ?? []).map(promoOf);
  }
  async getPromo(shopId: string, id: string) {
    const r = await this.db.prepare('SELECT * FROM promos WHERE shop_id = ? AND id = ?').bind(shopId, id).first<Row>();
    return r ? promoOf(r) : null;
  }
  async savePromo(shopId: string, p: Promo) {
    const { id, createdAt, updatedAt, ...body } = p;
    await this.db.prepare(`INSERT INTO promos (id, shop_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at WHERE promos.shop_id = excluded.shop_id`)
      .bind(id, shopId, JSON.stringify(body), createdAt, updatedAt).run();
  }
  async deletePromo(shopId: string, id: string) {
    const r = await this.db.prepare('DELETE FROM promos WHERE shop_id = ? AND id = ?').bind(shopId, id).run();
    return (r.meta?.changes ?? 0) > 0;
  }
  async getDiscountPresets(shopId: string) {
    const r = await this.db.prepare('SELECT discount_presets FROM shops WHERE id = ?').bind(shopId).first<Row>();
    if (!r || typeof r.discount_presets !== 'string') return null;
    try {
      const v = JSON.parse(r.discount_presets) as unknown;
      return Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : null;
    } catch {
      return null;
    }
  }
  async setDiscountPresets(shopId: string, presets: number[]) {
    await this.db.prepare('UPDATE shops SET discount_presets = ? WHERE id = ?').bind(JSON.stringify(presets), shopId).run();
  }

  async listItems(shopId: string) {
    const r = await this.db.prepare('SELECT * FROM items WHERE shop_id = ? ORDER BY name').bind(shopId).all<Row>();
    return (r.results ?? []).map(item);
  }
  async getItem(shopId: string, id: string) {
    const r = await this.db.prepare('SELECT * FROM items WHERE shop_id = ? AND id = ?').bind(shopId, id).first<Row>();
    return r ? item(r) : null;
  }
  private upserts(shopId: string, items: Item[]) {
    return items.map((i) => this.db.prepare(ITEM_UPSERT).bind(
      i.id, shopId, i.source, i.ulMenuId, i.name, i.category, i.priceSen, i.ulPriceSen, i.marginPct, i.status, i.baseUlMenuId, i.active ? 1 : 0, i.updatedAt,
    ));
  }
  async saveItems(shopId: string, items: Item[]) {
    if (items.length) await this.db.batch(this.upserts(shopId, items));
  }
  async saveImport(shopId: string, items: Item[], rec: PriceImport & { id: string }) {
    await this.db.batch([
      ...this.upserts(shopId, items),
      this.db.prepare('INSERT INTO price_imports (id, shop_id, sent_at, received_at, menus) VALUES (?, ?, ?, ?, ?)').bind(rec.id, shopId, rec.sentAt, rec.receivedAt, rec.menus),
    ]);
  }
  async lastImport(shopId: string) {
    const r = await this.db.prepare('SELECT sent_at, received_at, menus FROM price_imports WHERE shop_id = ? ORDER BY received_at DESC LIMIT 1').bind(shopId).first<Row>();
    return r ? { sentAt: r.sent_at as string, receivedAt: r.received_at as string, menus: Number(r.menus) } : null;
  }

  async saveSale(shopId: string, s: Sale, receivedAt: string): Promise<'created' | 'exists'> {
    if (await this.saleExists(s.id)) return 'exists';
    const stmts = [
      this.db.prepare(`INSERT INTO sales (id, shop_id, number, device_id, created_at, channel, subtotal_sen, discount_sen, total_sen, method,
        cash_received_sen, change_sen, status, void_reason, voided_at, received_at, day_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(s.id, shopId, s.number, s.deviceId, s.createdAt, s.channel, s.subtotalSen, s.discountSen, s.totalSen, s.method,
          s.cashReceivedSen, s.changeSen, s.status, s.voidReason, s.voidedAt, receivedAt, s.dayId),
      ...s.lines.map((l, n) => this.db.prepare(`INSERT INTO sale_lines (sale_id, line_no, item_id, name, unit_price_sen, quantity, margin_pct, note,
        unit_cost_sen, list_price_sen, discount_pct, promo_id, promo_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(s.id, n, l.itemId, l.name, l.unitPriceSen, l.quantity, l.marginPct, l.note, l.unitCostSen ?? null, l.listPriceSen ?? null, l.discountPct ?? null,
          l.promoId ?? null, l.promoName ?? null)),
    ];
    try {
      await this.db.batch(stmts);
      return 'created';
    } catch (e) {
      // Two sends of the same sale at the same moment: the second insert hits the primary key.
      if (await this.saleExists(s.id)) return 'exists';
      throw e;
    }
  }
  private async saleExists(id: string) {
    return (await this.db.prepare('SELECT 1 AS x FROM sales WHERE id = ?').bind(id).first<Row>()) !== null;
  }
  async getSale(shopId: string, id: string) {
    const r = await this.db.prepare('SELECT * FROM sales WHERE shop_id = ? AND id = ?').bind(shopId, id).first<Row>();
    return r ? (await this.withLines([r]))[0]! : null;
  }
  async voidSale(shopId: string, id: string, reason: string, voidedAt: string): Promise<'voided' | 'already' | 'not_found'> {
    const r = await this.db.prepare(`UPDATE sales SET status = 'void', void_reason = ?, voided_at = ? WHERE shop_id = ? AND id = ? AND status = 'done'`)
      .bind(reason, voidedAt, shopId, id).run();
    if ((r.meta?.changes ?? 0) > 0) return 'voided';
    const row = await this.db.prepare('SELECT status FROM sales WHERE shop_id = ? AND id = ?').bind(shopId, id).first<Row>();
    return row ? 'already' : 'not_found';
  }
  async saveDayClose(c: DayClose) {
    await this.db.prepare(`INSERT INTO day_closes (id, shop_id, day, closed_at, device_id, float_sen, expected_cash_sen, counted_cash_sen, totals_json, note, biz_day_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(c.id, c.shopId, c.day, c.closedAt, c.deviceId, c.floatSen, c.expectedCashSen, c.countedCashSen, JSON.stringify(c.totals), c.note, c.bizDayId).run();
  }
  async listDayCloses(shopId: string, day: string): Promise<DayClose[]> {
    const r = await this.db.prepare('SELECT * FROM day_closes WHERE shop_id = ? AND day = ? ORDER BY closed_at DESC, id DESC').bind(shopId, day).all<Row>();
    return (r.results ?? []).map(closeRow);
  }
  async listClosesOfDay(shopId: string, dayId: string): Promise<DayClose[]> {
    const r = await this.db.prepare('SELECT * FROM day_closes WHERE shop_id = ? AND biz_day_id = ? ORDER BY closed_at DESC, id DESC').bind(shopId, dayId).all<Row>();
    return (r.results ?? []).map(closeRow);
  }

  async getDay(shopId: string, id: string) {
    const r = await this.db.prepare('SELECT * FROM biz_days WHERE shop_id = ? AND id = ?').bind(shopId, id).first<Row>();
    return r ? dayRow(r) : null;
  }
  async openDay(shopId: string) {
    const r = await this.db.prepare('SELECT * FROM biz_days WHERE shop_id = ? AND closed_at IS NULL AND merged_into IS NULL LIMIT 1').bind(shopId).first<Row>();
    return r ? dayRow(r) : null;
  }
  async dayAt(shopId: string, at: string) {
    const r = await this.db.prepare(`SELECT * FROM biz_days WHERE shop_id = ? AND merged_into IS NULL AND opened_at <= ? AND (closed_at IS NULL OR closed_at > ?)
      ORDER BY opened_at DESC LIMIT 1`).bind(shopId, at, at).first<Row>();
    return r ? dayRow(r) : null;
  }
  async insertDay(d: ServerDay, receivedAt: string) {
    await this.db.prepare(`INSERT INTO biz_days (id, shop_id, opened_at, opened_device_id, float_sen, closed_at, merged_into, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(d.id, d.shopId, d.openedAt, d.openedDeviceId, d.floatSen, d.closedAt, d.mergedInto, receivedAt).run();
  }
  async updateDay(shopId: string, id: string, patch: Partial<Pick<ServerDay, 'openedAt' | 'openedDeviceId' | 'floatSen' | 'closedAt' | 'mergedInto'>>) {
    const cols: Record<string, string> = { openedAt: 'opened_at', openedDeviceId: 'opened_device_id', floatSen: 'float_sen', closedAt: 'closed_at', mergedInto: 'merged_into' };
    const keys = Object.keys(patch).filter((k) => k in cols) as (keyof typeof patch)[];
    if (keys.length === 0) return;
    await this.db.prepare(`UPDATE biz_days SET ${keys.map((k) => `${cols[k]} = ?`).join(', ')} WHERE shop_id = ? AND id = ?`)
      .bind(...keys.map((k) => patch[k] ?? null), shopId, id).run();
  }
  async listDays(shopId: string, limit: number) {
    const r = await this.db.prepare(`SELECT d.*, EXISTS (SELECT 1 FROM day_closes c WHERE c.biz_day_id = d.id) AS counted FROM biz_days d
      WHERE d.shop_id = ? AND d.merged_into IS NULL ORDER BY d.opened_at DESC LIMIT ?`).bind(shopId, limit).all<Row>();
    return (r.results ?? []).map((x) => ({ ...dayRow(x), counted: Number(x.counted) === 1 }));
  }
  async dayOpenedAfter(shopId: string, at: string) {
    return (await this.db.prepare('SELECT 1 AS x FROM biz_days WHERE shop_id = ? AND merged_into IS NULL AND opened_at > ? LIMIT 1').bind(shopId, at).first<Row>()) !== null;
  }
  async moveSales(shopId: string, fromDayId: string, toDayId: string) {
    await this.db.prepare('UPDATE sales SET day_id = ? WHERE shop_id = ? AND day_id = ?').bind(toDayId, shopId, fromDayId).run();
  }
  async listSalesOfDay(shopId: string, dayId: string) {
    const r = await this.db.prepare('SELECT * FROM sales WHERE shop_id = ? AND day_id = ? ORDER BY created_at DESC LIMIT 5000').bind(shopId, dayId).all<Row>();
    return this.withLines(r.results ?? []);
  }
  async listSales(shopId: string, fromIso: string, toIso: string) {
    const r = await this.db.prepare('SELECT * FROM sales WHERE shop_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT 2000')
      .bind(shopId, fromIso, toIso).all<Row>();
    return this.withLines(r.results ?? []);
  }
  private async withLines(rows: Row[]): Promise<Sale[]> {
    const out: Sale[] = [];
    for (const r of rows) {
      const lr = await this.db.prepare('SELECT * FROM sale_lines WHERE sale_id = ? ORDER BY line_no').bind(r.id).all<Row>();
      const lines: SaleLine[] = (lr.results ?? []).map((l) => ({
        itemId: l.item_id as string, name: l.name as string, unitPriceSen: Number(l.unit_price_sen), quantity: Number(l.quantity),
        marginPct: l.margin_pct === null ? null : Number(l.margin_pct), note: l.note as string,
        unitCostSen: l.unit_cost_sen == null ? null : Number(l.unit_cost_sen),
        listPriceSen: l.list_price_sen == null ? null : Number(l.list_price_sen),
        discountPct: l.discount_pct == null ? null : Number(l.discount_pct),
        promoId: (l.promo_id as string | null) ?? null,
        promoName: (l.promo_name as string | null) ?? null,
      }));
      out.push({
        id: r.id as string, number: r.number as string, deviceId: r.device_id as string, createdAt: r.created_at as string,
        channel: r.channel as Sale['channel'], lines, subtotalSen: Number(r.subtotal_sen), discountSen: Number(r.discount_sen),
        totalSen: Number(r.total_sen), method: r.method as Sale['method'],
        cashReceivedSen: r.cash_received_sen === null ? null : Number(r.cash_received_sen),
        changeSen: r.change_sen === null ? null : Number(r.change_sen), status: r.status as Sale['status'],
        voidReason: (r.void_reason as string | null) ?? null, voidedAt: (r.voided_at as string | null) ?? null,
        dayId: (r.day_id as string | null) ?? null,
      });
    }
    return out;
  }
}

function closeRow(x: Row): DayClose {
  return {
    id: x.id as string, shopId: x.shop_id as string, day: x.day as string, bizDayId: (x.biz_day_id as string | null) ?? null,
    closedAt: x.closed_at as string, deviceId: x.device_id as string,
    floatSen: Number(x.float_sen), expectedCashSen: Number(x.expected_cash_sen), countedCashSen: Number(x.counted_cash_sen),
    totals: JSON.parse(x.totals_json as string) as unknown, note: x.note as string,
  };
}

function dayRow(x: Row): ServerDay {
  return {
    id: x.id as string, shopId: x.shop_id as string, openedAt: x.opened_at as string, openedDeviceId: x.opened_device_id as string,
    floatSen: Number(x.float_sen), closedAt: (x.closed_at as string | null) ?? null, mergedInto: (x.merged_into as string | null) ?? null,
  };
}

function promoOf(r: Row): Promo {
  const body = JSON.parse(r.body as string) as Omit<Promo, 'id' | 'createdAt' | 'updatedAt'>;
  return { id: r.id as string, ...body, createdAt: r.created_at as string, updatedAt: r.updated_at as string };
}
