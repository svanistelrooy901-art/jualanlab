/**
 * Local API for development: the same core handler as the Worker, on SQLite (.dev/jualanlab.sqlite),
 * with dev mode on (sign-in codes are shown on screen and printed here instead of emailed).
 * Run: npm run dev:api   (Vite's dev server proxies /api here)
 */
import { createServer } from 'node:http';
import { mkdirSync, existsSync } from 'node:fs';
import { randomUUID, getRandomValues } from 'node:crypto';
import { createHandler } from '../server/core/api';
import { createGoogleVerifier } from '../server/core/google';
import { SqlStore } from '../server/core/store';
import { migrate, sqliteD1 } from '../server/core/__tests__/sqlite';

const PORT = Number(process.env.PORT ?? 8787);
const ORIGINS = (process.env.APP_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173').split(',');

mkdirSync('.dev', { recursive: true });
const file = '.dev/jualanlab.sqlite';
const fresh = !existsSync(file);
const d1 = sqliteD1(file);
if (fresh) await migrate(d1);

const handle = createHandler({
  store: new SqlStore(d1),
  mailer: { async sendLoginCode(to, code) { console.log(`[dev] sign-in code for ${to}: ${code}`); } },
  google: createGoogleVerifier({ clientId: process.env.GOOGLE_CLIENT_ID ?? '' }),
  config: { appOrigins: ORIGINS, codePepper: 'dev-pepper', secureCookies: false, devMode: true, googleClientId: process.env.GOOGLE_CLIENT_ID ?? '' },
  now: () => new Date(),
  randomBytes: (n) => getRandomValues(new Uint8Array(n)),
  newId: () => randomUUID(),
});

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const response = await handle(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`JualanLab dev API on http://localhost:${PORT} (db ${file}${fresh ? ', new' : ''})`));
