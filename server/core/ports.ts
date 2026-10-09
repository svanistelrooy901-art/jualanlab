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

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
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
