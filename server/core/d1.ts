/** The small part of Cloudflare's D1 API the store uses. Kept local so core code and tests need no Workers types. */
export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  meta: { changes: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  /** Runs the statements in one transaction: all or nothing. */
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
