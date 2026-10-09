/** The Store on D1 (SQLite). Tests run this same SQL on node:sqlite, so what is tested is what ships. */
import type { Item } from '../../src/domain/items';
import type { Sale, SaleLine } from '../../src/domain/sale';
import type { D1Database } from './d1';
import type { LoginCode, PriceImport, Shop, Store, User } from './ports';

type Row = Record<string, unknown>;

const user = (r: Row): User => ({
  id: r.id as string, email: r.email as string, name: (r.name as string | null) ?? null,
  googleSub: (r.google_sub as string | null) ?? null, createdAt: r.created_at as string,
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
  constructor(private readonly db: D1Database) {}

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
    await this.db.prepare('INSERT INTO users (id, email, name, google_sub, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(u.id, u.email, u.name, u.googleSub, u.createdAt).run();
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
  async countHits(key: string, since: string) {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM hits WHERE key = ? AND at >= ?').bind(key, since).first<Row>();
    return Number(r?.n ?? 0);
  }

  async getShopByOwner(userId: string) {
    const r = await this.db.prepare('SELECT * FROM shops WHERE owner_id = ?').bind(userId).first<Row>();
    return r ? ({ id: r.id, ownerId: r.owner_id, name: r.name, createdAt: r.created_at } as Shop) : null;
  }
  async createShop(s: Shop) {
    await this.db.prepare('INSERT INTO shops (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').bind(s.id, s.ownerId, s.name, s.createdAt).run();
  }
  async renameShop(shopId: string, name: string) {
    await this.db.prepare('UPDATE shops SET name = ? WHERE id = ?').bind(name, shopId).run();
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
        cash_received_sen, change_sen, status, void_reason, voided_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(s.id, shopId, s.number, s.deviceId, s.createdAt, s.channel, s.subtotalSen, s.discountSen, s.totalSen, s.method,
          s.cashReceivedSen, s.changeSen, s.status, s.voidReason, s.voidedAt, receivedAt),
      ...s.lines.map((l, n) => this.db.prepare(`INSERT INTO sale_lines (sale_id, line_no, item_id, name, unit_price_sen, quantity, margin_pct, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(s.id, n, l.itemId, l.name, l.unitPriceSen, l.quantity, l.marginPct, l.note)),
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
      }));
      out.push({
        id: r.id as string, number: r.number as string, deviceId: r.device_id as string, createdAt: r.created_at as string,
        channel: r.channel as Sale['channel'], lines, subtotalSen: Number(r.subtotal_sen), discountSen: Number(r.discount_sen),
        totalSen: Number(r.total_sen), method: r.method as Sale['method'],
        cashReceivedSen: r.cash_received_sen === null ? null : Number(r.cash_received_sen),
        changeSen: r.change_sen === null ? null : Number(r.change_sen), status: r.status as Sale['status'],
        voidReason: (r.void_reason as string | null) ?? null, voidedAt: (r.voided_at as string | null) ?? null,
      });
    }
    return out;
  }
}
