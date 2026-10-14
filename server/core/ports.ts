/** What the server core needs from outside. Real versions live in server/worker; tests use SQLite and fakes. */
import type { Item } from '../../src/domain/items';
import type { Sale } from '../../src/domain/sale';

export interface User {
  id: string;
  email: string;
  name: string | null;
  googleSub: string | null;
  createdAt: string;
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

export type Product = 'pos' | 'bundle';
export type PriceKind = 'normal' | 'early' | 'untunglab' | 'bundle';

export interface Order {
  id: string;
  shopId: string;
  email: string;
  name: string;
  phone: string;
  product: Product;
  priceKind: PriceKind;
  amountSen: number;
  ulCode: string | null;
  status: 'pending' | 'paid';
  billCode: string;
  ulIssuedCode: string | null;
  createdAt: string;
  paidAt: string | null;
  emailSentAt: string | null;
}

export interface ToyyibTransaction {
  orderId: string;
  status: string;
  amountSen: number | null;
}

export interface ToyyibClient {
  createBill(input: { amountSen: number; orderId: string; name: string; email: string; phone: string; billName: string; description: string; callbackUrl: string; returnUrl: string }): Promise<{ billCode: string; payUrl: string }>;
  getTransactions(billCode: string): Promise<ToyyibTransaction[]>;
}

/** UntungLab's licence server, reached with its admin token (optional: without it, no UntungLab price and no bundle). */
export interface UntungLabLicences {
  /** 'active' for a code that exists and is not revoked. */
  check(code: string): Promise<'active' | 'revoked' | 'unknown'>;
  /** Issues a lifetime UntungLab licence; UntungLab emails it to the buyer itself. */
  issue(name: string, email: string): Promise<string>;
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

  setShopPlan(shopId: string, plan: Plan, since: string): Promise<void>;
  countActiveItems(shopId: string): Promise<number>;
  createOrder(order: Order): Promise<void>;
  getOrder(id: string): Promise<Order | null>;
  /** Marks paid once; true only for the call that changed it (so the email is sent once). */
  markOrderPaid(id: string, paidAt: string): Promise<boolean>;
  updateOrder(id: string, patch: Partial<Pick<Order, 'ulIssuedCode' | 'emailSentAt'>>): Promise<void>;
  /** Paid orders of the early-bird kind, for the "first 15 buyers" count. */
  countPaidOrders(priceKind: PriceKind): Promise<number>;
  /** True when this UntungLab code already gave the UntungLab-user price on a paid order. */
  ulCodeUsed(code: string): Promise<boolean>;
  /** Every close of that day, newest first. */
  listDayCloses(shopId: string, day: string): Promise<DayClose[]>;
}

export interface DayClose {
  id: string;
  shopId: string;
  day: string;
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
  /** Receipt after the full POS is paid. */
  sendPurchaseReceipt(to: string, info: { name: string; shopName: string; amountSen: number; orderId: string; bundle: boolean }): Promise<void>;
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
