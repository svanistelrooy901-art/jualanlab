/** The smeLab account service's store on D1 (SQLite). Tests run this same SQL on node:sqlite. */
import type { D1Database } from '../../core/d1';
import type { Account, AppId, Entitlement, HubStats, HubStore, Item, LoginCode, Order, Product } from './ports';

type Row = Record<string, unknown>;

export class SqlHubStore implements HubStore {
  constructor(private db: D1Database) {}

  async getAccount(id: string) {
    return accountRow(await this.db.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first<Row>());
  }
  async getAccountByEmail(email: string) {
    return accountRow(await this.db.prepare('SELECT * FROM accounts WHERE email = ?').bind(email).first<Row>());
  }
  async getAccountByGoogleSub(sub: string) {
    return accountRow(await this.db.prepare('SELECT * FROM accounts WHERE google_sub = ?').bind(sub).first<Row>());
  }
  async createAccount(a: Account) {
    await this.db.prepare('INSERT INTO accounts (id, email, name, google_sub, created_at) VALUES (?, ?, ?, ?, ?)').bind(a.id, a.email, a.name, a.googleSub, a.createdAt).run();
  }
  async linkGoogle(id: string, sub: string, name: string | null) {
    await this.db.prepare('UPDATE accounts SET google_sub = ?, name = COALESCE(name, ?) WHERE id = ?').bind(sub, name, id).run();
  }

  async createSession(tokenHash: string, accountId: string, createdAt: string, expiresAt: string) {
    await this.db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(tokenHash, accountId, createdAt, expiresAt).run();
  }
  async getSession(tokenHash: string) {
    const r = await this.db.prepare('SELECT account_id, expires_at FROM sessions WHERE token_hash = ?').bind(tokenHash).first<Row>();
    return r ? { accountId: r.account_id as string, expiresAt: r.expires_at as string } : null;
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
  async pruneHits(before: string) {
    await this.db.prepare('DELETE FROM hits WHERE at < ?').bind(before).run();
  }

  async putAppCode(c: { codeHash: string; accountId: string; app: AppId; redirectUri: string; expiresAt: string }) {
    await this.db.prepare('INSERT INTO app_codes (code_hash, account_id, app, redirect_uri, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(c.codeHash, c.accountId, c.app, c.redirectUri, c.expiresAt).run();
  }
  async takeAppCode(codeHash: string, usedAt: string) {
    // Single use even when two redemptions race: only the UPDATE that changed the row wins.
    const u = await this.db.prepare('UPDATE app_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL').bind(usedAt, codeHash).run();
    if ((u.meta?.changes ?? 0) === 0) return null;
    const r = await this.db.prepare('SELECT * FROM app_codes WHERE code_hash = ?').bind(codeHash).first<Row>();
    return r ? { accountId: r.account_id as string, app: r.app as string, redirectUri: r.redirect_uri as string, expiresAt: r.expires_at as string } : null;
  }

  async kedaiAccess(accountId: string) {
    const r = await this.db.prepare('SELECT until, source FROM kedai_access WHERE account_id = ?').bind(accountId).first<Row>();
    return r ? { until: (r.until as string | null) ?? null, source: r.source as string } : null;
  }
  async listEntitlements(accountId: string) {
    const r = await this.db.prepare('SELECT * FROM entitlements WHERE account_id = ? ORDER BY created_at').bind(accountId).all<Row>();
    return (r.results ?? []).map(entitlementRow);
  }
  async addEntitlement(e: Entitlement) {
    try {
      await this.db.prepare(`INSERT INTO entitlements (id, account_id, product, source, order_id, ul_code, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(e.id, e.accountId, e.product, e.source, e.orderId, e.ulCode, e.createdAt, e.revokedAt).run();
      return true;
    } catch {
      // Already owned (one live entitlement per product, enforced by the database).
      return false;
    }
  }
  async entitlementByUlCode(ulCode: string) {
    const r = await this.db.prepare("SELECT * FROM entitlements WHERE product = 'untunglab' AND ul_code = ? AND revoked_at IS NULL LIMIT 1").bind(ulCode).first<Row>();
    return r ? entitlementRow(r) : null;
  }
  async setEntitlementUlCode(id: string, ulCode: string) {
    await this.db.prepare('UPDATE entitlements SET ul_code = ? WHERE id = ?').bind(ulCode, id).run();
  }

  async createOrder(o: Order) {
    await this.db.prepare(`INSERT INTO orders (id, account_id, item, price_kind, amount_sen, name, phone, email, status, bill_code, ul_code, created_at, paid_at, receipt_sent_at, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(o.id, o.accountId, o.item, o.priceKind, o.amountSen, o.name, o.phone, o.email, o.status, o.billCode, o.ulCode, o.createdAt, o.paidAt, o.receiptSentAt, o.source ?? null).run();
  }
  async getOrder(id: string) {
    const r = await this.db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Row>();
    return r ? orderRow(r) : null;
  }
  async listOrders(accountId: string) {
    const r = await this.db.prepare('SELECT * FROM orders WHERE account_id = ? ORDER BY created_at DESC').bind(accountId).all<Row>();
    return (r.results ?? []).map(orderRow);
  }
  async markOrderPaid(id: string, paidAt: string) {
    const r = await this.db.prepare(`UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'`).bind(paidAt, id).run();
    return (r.meta?.changes ?? 0) > 0;
  }
  async updateOrder(id: string, patch: Partial<Pick<Order, 'ulCode' | 'receiptSentAt'>>) {
    if ('ulCode' in patch) await this.db.prepare('UPDATE orders SET ul_code = ? WHERE id = ?').bind(patch.ulCode ?? null, id).run();
    if ('receiptSentAt' in patch) await this.db.prepare('UPDATE orders SET receipt_sent_at = ? WHERE id = ?').bind(patch.receiptSentAt ?? null, id).run();
  }
  async countEarly(product: Product) {
    const r = await this.db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE status = 'paid' AND price_kind = 'early' AND item = ?`).bind(product).first<Row>();
    return Number(r?.n ?? 0);
  }

  async addToWaitlist(email: string, app: string, at: string) {
    await this.db.prepare('INSERT OR IGNORE INTO waitlist (email, app, created_at) VALUES (?, ?, ?)').bind(email, app, at).run();
  }

  async adminStats(recent: number): Promise<HubStats> {
    const n = async (sql: string) => Number((await this.db.prepare(sql).first<Row>())?.n ?? 0);
    const o = await this.db
      .prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(status = 'paid'), 0) AS paid, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_sen ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(status = 'paid' AND item = 'untunglab'), 0) AS ul, COALESCE(SUM(status = 'paid' AND item = 'jualanlab'), 0) AS jl, COALESCE(SUM(status = 'paid' AND item = 'combo'), 0) AS combo FROM orders`)
      .first<Row>();
    const ent = await this.db
      .prepare(`SELECT COALESCE(SUM(revoked_at IS NULL AND product = 'untunglab'), 0) AS ul, COALESCE(SUM(revoked_at IS NULL AND product = 'jualanlab'), 0) AS jl, COALESCE(SUM(revoked_at IS NOT NULL), 0) AS revoked FROM entitlements`)
      .first<Row>();
    const wl = await this.db.prepare('SELECT app, COUNT(*) AS n FROM waitlist GROUP BY app').all<Row>();
    const waitlist = { promolab: 0, kiralab: 0, jualanlab: 0 };
    for (const r of wl.results ?? []) if (r.app === 'promolab' || r.app === 'kiralab' || r.app === 'jualanlab') waitlist[r.app] = Number(r.n);
    const src = await this.db.prepare("SELECT source, COUNT(*) AS orders, COALESCE(SUM(status = 'paid'), 0) AS paid FROM orders GROUP BY source ORDER BY orders DESC, source LIMIT 30").all<Row>();
    const recentRows = await this.db.prepare('SELECT * FROM orders ORDER BY created_at DESC, rowid DESC LIMIT ?').bind(recent).all<Row>();
    const total = Number(o?.total ?? 0);
    const paid = Number(o?.paid ?? 0);
    return {
      accounts: await n('SELECT COUNT(*) AS n FROM accounts'),
      orders: { total, paid, pending: total - paid },
      revenueSen: Number(o?.revenue ?? 0),
      byItem: { untunglab: Number(o?.ul ?? 0), jualanlab: Number(o?.jl ?? 0), combo: Number(o?.combo ?? 0) } as Record<Item, number>,
      active: { untunglab: Number(ent?.ul ?? 0), jualanlab: Number(ent?.jl ?? 0) },
      revoked: Number(ent?.revoked ?? 0),
      waitlist,
      bySource: (src.results ?? []).map((r) => ({ source: (r.source as string | null) ?? null, orders: Number(r.orders), paid: Number(r.paid) })),
      recent: (recentRows.results ?? []).map((r) => {
        const x = orderRow(r);
        return { id: x.id, name: x.name, email: x.email, item: x.item, priceKind: x.priceKind, amountSen: x.amountSen, status: x.status, createdAt: x.createdAt, paidAt: x.paidAt, ulCode: x.ulCode, source: x.source ?? null };
      }),
    };
  }
  async getEntitlement(id: string) {
    const r = await this.db.prepare('SELECT * FROM entitlements WHERE id = ?').bind(id).first<Row>();
    return r ? entitlementRow(r) : null;
  }
  async revokeEntitlement(id: string, at: string) {
    const r = await this.db.prepare('UPDATE entitlements SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(at, id).run();
    return (r.meta?.changes ?? 0) > 0;
  }
  async restoreEntitlement(id: string) {
    try {
      const r = await this.db.prepare('UPDATE entitlements SET revoked_at = NULL WHERE id = ? AND revoked_at IS NOT NULL').bind(id).run();
      return (r.meta?.changes ?? 0) > 0;
    } catch {
      // The buyer owns that app again (one live entitlement per app, enforced by the database).
      return false;
    }
  }
  async listWaitlist(app: string, limit: number) {
    const r = await this.db.prepare('SELECT email, created_at FROM waitlist WHERE app = ? ORDER BY created_at DESC LIMIT ?').bind(app, limit).all<Row>();
    return (r.results ?? []).map((x) => ({ email: x.email as string, createdAt: x.created_at as string }));
  }
}

function accountRow(r: Row | null): Account | null {
  return r
    ? { id: r.id as string, email: r.email as string, name: (r.name as string | null) ?? null, googleSub: (r.google_sub as string | null) ?? null, createdAt: r.created_at as string }
    : null;
}

function entitlementRow(r: Row): Entitlement {
  return {
    id: r.id as string, accountId: r.account_id as string, product: r.product as Product, source: r.source as Entitlement['source'],
    orderId: (r.order_id as string | null) ?? null, ulCode: (r.ul_code as string | null) ?? null, createdAt: r.created_at as string, revokedAt: (r.revoked_at as string | null) ?? null,
  };
}

function orderRow(r: Row): Order {
  return {
    id: r.id as string, accountId: r.account_id as string, item: r.item as Order['item'], priceKind: r.price_kind as Order['priceKind'],
    amountSen: Number(r.amount_sen), name: r.name as string, phone: r.phone as string, email: r.email as string, status: r.status as Order['status'],
    billCode: r.bill_code as string, ulCode: (r.ul_code as string | null) ?? null, createdAt: r.created_at as string, paidAt: (r.paid_at as string | null) ?? null,
    receiptSentAt: (r.receipt_sent_at as string | null) ?? null, source: (r.source as string | null) ?? null,
  };
}
