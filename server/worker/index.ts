/**
 * Cloudflare Worker: serves the app's static files and the /api routes from one origin
 * (jualan.untunglab.space), so the session cookie is first-party. Sign-in and buying happen at the smeLab account
 * service, reached through the SMELAB service binding (DECISIONS A-05). See DEPLOY.md.
 */
import { createHandler, type SmeLabLink } from '../core/api';
import { createBrevoMailer } from '../core/brevo';
import type { D1Database } from '../core/d1';
import { createGoogleVerifier } from '../core/google';
import type { PhotoBucket } from '../core/ports';
import { SqlStore } from '../core/store';
import { createKedaiHandler } from '../core/kedai';
import { createPusher, deriveVapid, type PushConfig } from '../core/webpush';
import { stockReminderSweep } from '../core/reminders';
import { createWaitlistHandler } from '../core/waitlist';
import { FORGET_CUSTOMER_DAYS } from '../core/kedaiPages';

export interface Env {
  DB: D1Database;
  /** R2 bucket for item photos (jualanlab-photos). Missing = photos stay in D1. */
  PHOTOS?: PhotoBucket;
  ASSETS: { fetch(req: Request): Promise<Response> };
  /** smeLab account service (service binding to the "smelab" Worker's SmeLabAccounts entrypoint). */
  SMELAB?: SmeLabLink;
  // plain variables (wrangler.toml)
  APP_ORIGINS: string;
  GOOGLE_CLIENT_ID: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  PUBLIC_BASE_URL: string;
  /** smeLab's public address, e.g. https://smelab.untunglab.space. Empty = JualanLab's own sign-in (development). */
  SMELAB_URL?: string;
  // secrets (wrangler secret put …)
  BREVO_API_KEY: string;
  CODE_PEPPER: string;
  /** Optional: comma-separated owner/tester emails that get the full POS free (and may sign up before launch). */
  COMP_EMAILS?: string;
  /** The admin API's own token (UntungLab admin page). Unset: the admin API is off. */
  ADMIN_TOKEN?: string;
  ADMIN_ORIGINS?: string;
  /** Optional: comma-separated emails that may sign up before launch but stay on Free (to test buying). */
  TESTER_EMAILS?: string;
  /** "1" until launch: no new accounts except existing ones, COMP_EMAILS and TESTER_EMAILS. */
  PRELAUNCH?: string;
  TRIAL_DAYS?: string;
  /** The stores' public address (Kedai, K-03), e.g. https://kedai.untunglab.space. Empty = Kedai off. */
  KEDAI_URL?: string;
  /** Cloudflare Turnstile (spam check at checkout). Both set = on; either missing = off. */
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
}

let google: ReturnType<typeof createGoogleVerifier> | null = null;
// New-order notifications: the key pair comes from CODE_PEPPER (webpush.ts), worked out once per isolate.
let vapid: Promise<PushConfig | null> | null = null;
async function pusher(env: Env) {
  vapid ??= env.CODE_PEPPER ? deriveVapid(env.CODE_PEPPER, 'mailto:hello@digitalsambal.space').catch((e) => (console.error('vapid', e), null)) : Promise.resolve(null);
  const cfg = await vapid;
  return cfg ? { send: createPusher(cfg), publicKey: cfg.publicKey } : null;
}
/** Asks Cloudflare whether a Turnstile token is real, unused and from our page. */
async function turnstile(secret: string, token: string, ip: string): Promise<boolean> {
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip && ip !== 'local') form.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const j = (await r.json()) as { success?: boolean };
  return j.success === true;
}
const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export default {
  async fetch(request: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    // The stores live on their own address, never sharing an origin (or cookies) with the seller's app (K-03).
    const kedai = env.KEDAI_URL?.replace(/\/+$/, '');
    if (kedai && url.origin === kedai) {
      const run = async () => {
        const push = request.method === 'POST' ? await pusher(env) : null;
        return createKedaiHandler({
          store: new SqlStore(env.DB, env.PHOTOS ?? null), config: { origin: kedai }, now: () => new Date(), randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
          push: push?.send ?? null, waitUntil: ctx ? (p) => ctx.waitUntil(p) : undefined,
          human: env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET ? { siteKey: env.TURNSTILE_SITE_KEY, verify: (token, ip) => turnstile(env.TURNSTILE_SECRET!, token, ip) } : null,
        })(request);
      };
      // Versioned images (?v=) never change, so they are kept in Cloudflare's cache near the customer.
      const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
      if (request.method === 'GET' && cache && url.searchParams.has('v') && /^\/[a-z0-9-]+\/(i\/[A-Za-z0-9_-]+|logo|cover)$/.test(url.pathname)) {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await run();
        if (res.ok) ctx?.waitUntil(cache.put(request, res.clone()));
        return res;
      }
      return run();
    }
    // Pre-launch waiting list: open to everyone, no account needed.
    if (url.pathname === '/waitinglist' || url.pathname === '/waitinglist/') {
      return createWaitlistHandler({ store: new SqlStore(env.DB, null), now: () => new Date() })(request);
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.CODE_PEPPER || !env.BREVO_API_KEY) {
      return new Response(JSON.stringify({ error: 'server_not_configured' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    // One verifier per isolate, so Google's keys are cached between requests.
    google ??= createGoogleVerifier({ clientId: env.GOOGLE_CLIENT_ID });
    const smelabOn = !!(env.SMELAB_URL && env.SMELAB);
    const push = await pusher(env);
    const handle = createHandler({
      store: new SqlStore(env.DB, env.PHOTOS ?? null),
      mailer: createBrevoMailer({ apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL, senderName: env.BREVO_SENDER_NAME }),
      google,
      smelab: smelabOn ? env.SMELAB! : null,
      push: push?.send ?? null,
      config: {
        pushPublicKey: push?.publicKey,
        appOrigins: env.APP_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
        codePepper: env.CODE_PEPPER,
        secureCookies: true,
        devMode: false,
        googleClientId: env.GOOGLE_CLIENT_ID,
        prelaunch: env.PRELAUNCH === '1',
        testerEmails: list(env.TESTER_EMAILS),
        // FT-01: days of the free month for new shops (default 30; "0" turns it off).
        trialDays: env.TRIAL_DAYS !== undefined && env.TRIAL_DAYS !== '' && Number.isInteger(Number(env.TRIAL_DAYS)) ? Number(env.TRIAL_DAYS) : undefined,
        complimentaryEmails: list(env.COMP_EMAILS),
        adminToken: env.ADMIN_TOKEN || undefined,
        adminOrigins: list(env.ADMIN_ORIGINS),
        smelab: smelabOn ? { url: env.SMELAB_URL!.replace(/\/+$/, ''), callbackUrl: `${env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/api/auth/smelab/callback` } : undefined,
        kedaiUrl: env.KEDAI_URL?.replace(/\/+$/, '') || undefined,
      },
      now: () => new Date(),
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      newId: () => crypto.randomUUID(),
    });
    return handle(request);
  },
  /** Cron (wrangler.toml [triggers]): the stock check reminder before closing (OM-04). */
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    const store = new SqlStore(env.DB, env.PHOTOS ?? null);
    const now = Date.now();
    // PDPA housekeeping: customers' details leave finished orders after FORGET_CUSTOMER_DAYS; spam-check hits after 2 days.
    ctx.waitUntil(store.forgetOldCustomers(new Date(now - FORGET_CUSTOMER_DAYS * 864e5).toISOString()).catch((e) => console.error('forget', e)));
    ctx.waitUntil(store.pruneHits(new Date(now - 2 * 864e5).toISOString()).catch((e) => console.error('hits', e)));
    const push = await pusher(env);
    if (!push) return;
    ctx.waitUntil(stockReminderSweep(store, push.send, new Date(now).toISOString()).catch((e) => console.error('reminders', e)));
  },
};
