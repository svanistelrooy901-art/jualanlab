/**
 * Cloudflare Worker: serves the app's static files and the /api routes from one origin
 * (jualan.untunglab.space), so the session cookie is first-party. Sign-in and buying happen at the smeLab account
 * service, reached through the SMELAB service binding (DECISIONS A-05). See DEPLOY.md.
 */
import { createHandler, type SmeLabLink } from '../core/api';
import { createBrevoMailer } from '../core/brevo';
import type { D1Database } from '../core/d1';
import { createGoogleVerifier } from '../core/google';
import { SqlStore } from '../core/store';
import { createKedaiHandler } from '../core/kedai';

export interface Env {
  DB: D1Database;
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
  /** Optional: comma-separated emails that may sign up before launch but stay on Free (to test buying). */
  TESTER_EMAILS?: string;
  /** "1" until launch: no new accounts except existing ones, COMP_EMAILS and TESTER_EMAILS. */
  PRELAUNCH?: string;
  /** The stores' public address (Kedai, K-03), e.g. https://kedai.untunglab.space. Empty = Kedai off. */
  KEDAI_URL?: string;
}

let google: ReturnType<typeof createGoogleVerifier> | null = null;
const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // The stores live on their own address, never sharing an origin (or cookies) with the seller's app (K-03).
    const kedai = env.KEDAI_URL?.replace(/\/+$/, '');
    if (kedai && url.origin === kedai) {
      return createKedaiHandler({ store: new SqlStore(env.DB), config: { origin: kedai }, now: () => new Date(), randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)) })(request);
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.CODE_PEPPER || !env.BREVO_API_KEY) {
      return new Response(JSON.stringify({ error: 'server_not_configured' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    // One verifier per isolate, so Google's keys are cached between requests.
    google ??= createGoogleVerifier({ clientId: env.GOOGLE_CLIENT_ID });
    const smelabOn = !!(env.SMELAB_URL && env.SMELAB);
    const handle = createHandler({
      store: new SqlStore(env.DB),
      mailer: createBrevoMailer({ apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL, senderName: env.BREVO_SENDER_NAME }),
      google,
      smelab: smelabOn ? env.SMELAB! : null,
      config: {
        appOrigins: env.APP_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
        codePepper: env.CODE_PEPPER,
        secureCookies: true,
        devMode: false,
        googleClientId: env.GOOGLE_CLIENT_ID,
        prelaunch: env.PRELAUNCH === '1',
        testerEmails: list(env.TESTER_EMAILS),
        complimentaryEmails: list(env.COMP_EMAILS),
        smelab: smelabOn ? { url: env.SMELAB_URL!.replace(/\/+$/, ''), callbackUrl: `${env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/api/auth/smelab/callback` } : undefined,
        kedaiUrl: env.KEDAI_URL?.replace(/\/+$/, '') || undefined,
      },
      now: () => new Date(),
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      newId: () => crypto.randomUUID(),
    });
    return handle(request);
  },
};
