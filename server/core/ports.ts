/** What the server core needs from outside. Real versions live in server/worker; tests use SQLite and fakes. */
import type { Item } from '../../src/domain/items';
import type { Sale } from '../../src/domain/sale';

export interface User {
  id: string;
  email: string;
  name: string | null;
  googleSub: string | null;
  createdAt: string;
  /** The smeLab account this user signs in with (null for accounts from before smeLab, until they sign in there). */
  smelabId?: string | null;
}

export type Plan = 'free' | 'pos';

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  plan?: Plan;
  planSince?: string | null;
}

export interface ToyyibTransaction {
  orderId: string;
  status: string;
  amountSen: number | null;
}

export interface ToyyibClient {
  createBill(input: {
    amountSen: number; orderId: string; name: string; email: string; phone: string; billName: string; description: string; callbackUrl: string; returnUrl: string;
    /** Line in ToyyibPay's own payment email. */
    contentEmail?: string;
  }): Promise<{ billCode: string; payUrl: string }>;
  getTransactions(billCode: string): Promise<ToyyibTransaction[]>;
}

export interface LoginCode {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  sentAt: string;
}

export interface PriceImport {
  sentAt: string;
  receivedAt: string;
  menus: number;
}

export interface Store {
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByGoogleSub(sub: string): Promise<User | null>;
  createUser(user: User): Promise<void>;
  linkGoogle(userId: string, sub: string, name: string | null): Promise<void>;
  getUserBySmelabId(smelabId: string): Promise<User | null>;
  linkSmelab(userId: string, smelabId: string, name: string | null): Promise<void>;

  createSession(tokenHash: string, userId: string, createdAt: string, expiresAt: string): Promise<void>;
  getSession(tokenHash: string): Promise<{ userId: string; expiresAt: string } | null>;
  extendSession(tokenHash: string, expiresAt: string): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;

  /** Replaces any earlier code for this email and resets its attempts. */
  putLoginCode(code: LoginCode): Promise<void>;
  getLoginCode(email: string): Promise<LoginCode | null>;
  countLoginAttempt(email: string): Promise<void>;
  deleteLoginCode(email: string): Promise<void>;

  recordHit(key: string, at: string): Promise<void>;
  countHits(key: string, since: string): Promise<number>;
  /** Forgets rate-limit records older than this time. */
  pruneHits(before: string): Promise<void>;

  getShopByOwner(userId: string): Promise<Shop | null>;
  getShopById(id: string): Promise<Shop | null>;
  createShop(shop: Shop): Promise<void>;
  renameShop(shopId: string, name: string): Promise<void>;

  listItems(shopId: string): Promise<Item[]>;
  getItem(shopId: string, id: string): Promise<Item | null>;
  /** Inserts or replaces items, all in one transaction. */
  saveItems(shopId: string, items: Item[]): Promise<void>;
  /** Saves the import's item changes and its record together, in one transaction. */
  saveImport(shopId: string, items: Item[], record: PriceImport & { id: string }): Promise<void>;
  lastImport(shopId: string): Promise<PriceImport | null>;

  /** Stores a sale once. A second call with the same id returns 'exists' and changes nothing. */
  saveSale(shopId: string, sale: Sale, receivedAt: string): Promise<'created' | 'exists'>;
  getSale(shopId: string, id: string): Promise<Sale | null>;
  listSales(shopId: string, fromIso: string, toIso: string): Promise<Sale[]>;
  /** Marks a sale void. 'already' when it was void before; 'not_found' when the shop has no such sale. */
  voidSale(shopId: string, id: string, reason: string, voidedAt: string): Promise<'voided' | 'already' | 'not_found'>;

  saveDayClose(close: DayClose): Promise<void>;

  // ---- business days (T-07) ----
  getDay(shopId: string, id: string): Promise<ServerDay | null>;
  /** The shop's open day, if any (never a merged one). */
  openDay(shopId: string): Promise<ServerDay | null>;
  /** The (not merged) day that was open at that moment: opened at or before it and not closed before it. */
  dayAt(shopId: string, at: string): Promise<ServerDay | null>;
  /** Inserts a day. Throws when the shop already has an open day (one open day per shop is enforced by the database). */
  insertDay(day: ServerDay, receivedAt: string): Promise<void>;
  updateDay(shopId: string, id: string, patch: Partial<Pick<ServerDay, 'openedAt' | 'openedDeviceId' | 'floatSen' | 'closedAt' | 'mergedInto'>>): Promise<void>;
  /** Newest first, merged days left out, with whether each has a close record. */
  listDays(shopId: string, limit: number): Promise<(ServerDay & { counted: boolean })[]>;
  /** True when a (not merged) day was opened after this time. */
  dayOpenedAfter(shopId: string, at: string): Promise<boolean>;
  /** Moves sales from a day joined into another. */
  moveSales(shopId: string, fromDayId: string, toDayId: string): Promise<void>;
  listSalesOfDay(shopId: string, dayId: string): Promise<Sale[]>;
  listClosesOfDay(shopId: string, dayId: string): Promise<DayClose[]>;

  setShopPlan(shopId: string, plan: Plan, since: string): Promise<void>;
  countActiveItems(shopId: string): Promise<number>;
  /** Every close of that day, newest first. */
  listDayCloses(shopId: string, day: string): Promise<DayClose[]>;
}

export interface ServerDay {
  id: string;
  shopId: string;
  openedAt: string;
  openedDeviceId: string;
  floatSen: number;
  closedAt: string | null;
  mergedInto: string | null;
}

export interface DayClose {
  id: string;
  shopId: string;
  /** Malaysian date the business day was opened on. */
  day: string;
  /** The business day closed (null on closes made before business days). */
  bizDayId: string | null;
  closedAt: string;
  deviceId: string;
  floatSen: number;
  expectedCashSen: number;
  countedCashSen: number;
  totals: unknown;
  note: string;
}

export interface Mailer {
  sendLoginCode(to: string, code: string, lang: 'ms' | 'en'): Promise<void>;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleVerifier {
  /** Returns the identity in a valid Google ID token for this app, or null. */
  verify(idToken: string): Promise<GoogleIdentity | null>;
}
