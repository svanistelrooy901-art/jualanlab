/** A D1-shaped wrapper over node:sqlite, so tests run the store's real SQL (not a copy of its logic). */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement, D1Result } from '../d1';

export function sqliteD1(file = ':memory:'): D1Database {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  const statement = (sql: string, values: unknown[] = []): D1PreparedStatement & { exec(): D1Result } => {
    const exec = (): D1Result => {
      const r = db.prepare(sql).run(...(values as never[]));
      return { meta: { changes: Number(r.changes) } };
    };
    return {
      bind: (...v) => statement(sql, v),
      exec,
      async run() {
        return exec();
      },
      async first<T>() {
        return (db.prepare(sql).get(...(values as never[])) as T | undefined) ?? null;
      },
      async all<T>() {
        return { results: db.prepare(sql).all(...(values as never[])) as T[], meta: { changes: 0 } };
      },
    };
  };
  return {
    prepare: (sql) => statement(sql),
    async batch(list) {
      // D1 runs a batch as one transaction; so does this.
      db.exec('BEGIN');
      try {
        const out = list.map((s) => (s as ReturnType<typeof statement>).exec());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

export function migrate(d1: D1Database): Promise<void> {
  const sql = readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8');
  // node:sqlite has exec on the raw database; reach it through a statement-free path.
  return (async () => {
    for (const stmt of sql.split(/;\s*\n/).map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean)) {
      await d1.prepare(stmt).run();
    }
  })();
}
