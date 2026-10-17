/** What the server core needs from outside. Real versions live in server/worker; tests use SQLite and fakes. */
import type { Item } from '../../src/domain/items';
import type { Sale } from '../../src/domain/sale';
import type { Promo } from '../../src/domain/promo';
import type { ItemStore, Order, OrderStatus, StoreSettings } from '../../src/domain/kedai';

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

/** Where item photos live: Cloudflare R2 in production (the binding fits this shape as it is), memory in tests. */
export interface PhotoBucket {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export type AssetKind = 'qr' | 'logo' | 'cover';

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

  /** Promotions (Diskaun & Promosi), oldest first. */
  listPromos(shopId: string): Promise<Promo[]>;
  getPromo(shopId: string, id: string): Promise<Promo | null>;
  /** Inserts or replaces one promotion. */
  savePromo(shopId: string, promo: Promo): Promise<void>;
  deletePromo(shopId: string, id: string): Promise<boolean>;
  /** The shop's three quick discount percentages; null = the defaults. */
  getDiscountPresets(shopId: string): Promise<number[] | null>;
  setDiscountPresets(shopId: string, presets: number[]): Promise<void>;

  // ---- Kedai (online store) ----
  getStore(shopId: string): Promise<StoreSettings | null>;
  getStoreBySlug(slug: string): Promise<{ shopId: string; settings: StoreSettings } | null>;
  /** Saves the store; 'slug_taken' when another shop has that address. */
  saveStore(shopId: string, settings: StoreSettings, at: string): Promise<'saved' | 'slug_taken'>;
  listItemStore(shopId: string): Promise<Map<string, ItemStore>>;
  saveItemStore(shopId: string, itemId: string, s: ItemStore, at: string): Promise<void>;
  /** Inserts an order with the shop's next number; retries when two orders race for the same number. */
  createOrder(o: Omit<Order, 'seq' | 'number'>, numberOf: (seq: number) => string): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  listOrders(shopId: string, statuses: OrderStatus[], limit: number): Promise<Order[]>;
  /** Changes an order's status only if it is still in `from` (so two phones cannot both confirm it). */
  moveOrder(id: string, from: OrderStatus[], patch: Partial<Pick<Order, 'status' | 'paidAt' | 'cancelReason' | 'saleId' | 'updatedAt'>>): Promise<boolean>;
  /** Cancels unpaid QR orders of a shop that passed their time (cancel reason 'expired'). */
  expireOrders(shopId: string, now: string): Promise<number>;
  countOrdersByStatus(shopId: string): Promise<Record<OrderStatus, number>>;
  getAsset(shopId: string, kind: AssetKind): Promise<{ mime: string; data: string; updatedAt: string } | null>;
  putAsset(shopId: string, kind: AssetKind, mime: string, data: string, at: string): Promise<void>;
  deleteAsset(shopId: string, kind: AssetKind): Promise<void>;
  /** Takes stock for an order (items not counted are skipped). All or nothing: names the first item short. */
  takeStock(shopId: string, lines: readonly { itemId: string; quantity: number }[]): Promise<{ ok: true } | { ok: false; itemId: string; left: number }>;
  /** Gives stock back (a cancelled or expired order). */
  returnStock(shopId: string, lines: readonly { itemId: string; quantity: number }[]): Promise<void>;
  /** A period's sales (done and void) with their lines, for reports. */
  salesBetween(shopId: string, fromIso: string, toIso: string): Promise<Sale[]>;
  /** Orders placed for a pre-order batch, cancelled ones left out (for "full" and the prep list). */
  countBatchOrders(shopId: string, batchId: string): Promise<number>;
  /** The orders a prep list covers: one batch's (not cancelled), or every open order when batchId is null. */
  batchOrders(shopId: string, batchId: string | null): Promise<Order[]>;
  /** The shop's newest order that is not cancelled, for new-order alerts. */
  latestOrder(shopId: string): Promise<Pick<Order, 'id' | 'number' | 'customerName' | 'totalSen' | 'createdAt'> | null>;
  savePushSub(endpoint: string, shopId: string, userId: string, at: string): Promise<void>;
  deletePushSub(endpoint: string): Promise<void>;
  listPushSubs(shopId: string): Promise<string[]>;
  getItemPhoto(shopId: string, itemId: string): Promise<{ mime: string; bytes: Uint8Array<ArrayBuffer> } | null>;
  putItemPhoto(shopId: string, itemId: string, mime: string, data: string, at: string): Promise<void>;
  deleteItemPhoto(shopId: string, itemId: string): Promise<void>;
  /** item id → when its photo last changed, for the shop's items that have one. */
  itemPhotoVersions(shopId: string): Promise<Map<string, string>>;
  /** When each of the shop's images last changed, for cache-busting links. */
  assetVersions(shopId: string): Promise<Partial<Record<AssetKind, string>>>;
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
