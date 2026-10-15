/** What the smeLab account service needs from the outside world, so its core runs the same on Workers and in tests. */
import type { GoogleVerifier, ToyyibClient } from '../../core/ports';

export type AppId = 'untunglab' | 'jualanlab';
export const APPS: readonly AppId[] = ['untunglab', 'jualanlab'];
export type Product = AppId;
export type Item = Product | 'combo';
export type PriceKind = 'normal' | 'early' | 'second' | 'combo';

export interface Account {
  id: string;
  email: string;
  name: string | null;
  googleSub: string | null;
  createdAt: string;
}

export interface Entitlement {
  id: string;
  accountId: string;
  product: Product;
  source: 'purchase' | 'untunglab_licence';
  orderId: string | null;
  ulCode: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface Order {
  id: string;
  accountId: string;
  item: Item;
  priceKind: PriceKind;
  amountSen: number;
  name: string;
  phone: string;
  email: string;
  status: 'pending' | 'paid';
  billCode: string;
  ulCode: string | null;
  createdAt: string;
  paidAt: string | null;
  receiptSentAt: string | null;
}

export interface LoginCode {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  sentAt: string;
}

export interface HubStore {
  getAccount(id: string): Promise<Account | null>;
  getAccountByEmail(email: string): Promise<Account | null>;
  getAccountByGoogleSub(sub: string): Promise<Account | null>;
  createAccount(a: Account): Promise<void>;
  linkGoogle(id: string, sub: string, name: string | null): Promise<void>;

  createSession(tokenHash: string, accountId: string, createdAt: string, expiresAt: string): Promise<void>;
  getSession(tokenHash: string): Promise<{ accountId: string; expiresAt: string } | null>;
  extendSession(tokenHash: string, expiresAt: string): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;

  putLoginCode(c: LoginCode): Promise<void>;
  getLoginCode(email: string): Promise<LoginCode | null>;
  countLoginAttempt(email: string): Promise<void>;
  deleteLoginCode(email: string): Promise<void>;

  recordHit(key: string, at: string): Promise<void>;
  countHits(key: string, since: string): Promise<number>;
  pruneHits(before: string): Promise<void>;

  putAppCode(c: { codeHash: string; accountId: string; app: AppId; redirectUri: string; expiresAt: string }): Promise<void>;
  /** Marks the code used and returns it, once; null when unknown or already used. */
  takeAppCode(codeHash: string, usedAt: string): Promise<{ accountId: string; app: string; redirectUri: string; expiresAt: string } | null>;

  listEntitlements(accountId: string): Promise<Entitlement[]>;
  /** Adds an entitlement unless the account already owns that product. True when added. */
  addEntitlement(e: Entitlement): Promise<boolean>;
  setEntitlementUlCode(id: string, ulCode: string): Promise<void>;

  createOrder(o: Order): Promise<void>;
  getOrder(id: string): Promise<Order | null>;
  listOrders(accountId: string): Promise<Order[]>;
  /** Marks paid once; true only for the call that changed it. */
  markOrderPaid(id: string, paidAt: string): Promise<boolean>;
  updateOrder(id: string, patch: Partial<Pick<Order, 'ulCode' | 'receiptSentAt'>>): Promise<void>;
  /** Paid early-bird orders that included this product. */
  countEarly(product: Product): Promise<number>;

  addToWaitlist(email: string, app: string, at: string): Promise<void>;
}

export interface HubMailer {
  sendLoginCode(to: string, code: string, lang: 'ms' | 'en'): Promise<void>;
  sendReceipt(to: string, info: { name: string; item: Item; amountSen: number; orderId: string; ulCode: string | null; baseUrl: string; jualanLabOpen: boolean }): Promise<void>;
}

/** UntungLab's licence server (admin API), to find a buyer's licence by email and to issue one for a purchase. */
export interface UntungLabAdmin {
  /** Active licence codes bought with this email. */
  activeCodes(email: string): Promise<string[]>;
  /** Issues a lifetime licence; UntungLab emails the code to the buyer itself. */
  issue(name: string, email: string, note: string): Promise<string>;
}

export interface HubDeps {
  store: HubStore;
  mailer: HubMailer;
  google: GoogleVerifier;
  toyyib: ToyyibClient | null;
  untungLab: UntungLabAdmin | null;
  config: HubConfig;
  now: () => Date;
  randomBytes: (n: number) => Uint8Array;
  newId: () => string;
}

export interface ProductPrice {
  normalSen: number;
  earlySen: number;
  /** Early-bird places for this product (for UntungLab: those left when smeLab took over its sales). */
  earlySlots: number;
}

export interface HubConfig {
  /** This service's public address, e.g. https://smelab.untunglab.space */
  publicBaseUrl: string;
  codePepper: string;
  secureCookies: boolean;
  /** Local development: sign-in codes come back in the response. Never on in production. */
  devMode: boolean;
  googleClientId: string;
  /** Where each app lives and the exact addresses smeLab may send a signed-in account back to. */
  /** `tryUrl`: the sales page's "try it free" link, when it should differ from `url` (UntungLab counts those clicks at beli.untunglab.space/mula). */
  apps: Record<AppId, { url: string; redirectUris: string[]; tryUrl?: string }>;
  /** Owner and testers: own every app without paying (lower-case emails). */
  complimentaryEmails: string[];
  prices: Record<Product, ProductPrice> & { secondAppSen: number; comboSen: number };
  /**
   * What can be bought now. JualanLab alone (and as the second app) only from its launch; the combo earlier, as early
   * access (Mamu, 15 Oct): UntungLab opens at once, JualanLab on launch day.
   */
  onSale: Record<Item, boolean>;
  toyyibSecret: string;
}
