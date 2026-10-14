/**
 * Cloudflare Worker: serves the app's static files and the /api routes from one origin
 * (jualan.untunglab.space), so the session cookie is first-party. See DEPLOY.md.
 */
import { createHandler } from '../core/api';
import { createBrevoMailer } from '../core/brevo';
import type { D1Database } from '../core/d1';
import { createGoogleVerifier } from '../core/google';
import { SqlStore } from '../core/store';
import { createToyyibClient } from '../core/toyyibpay';
import { createUntungLabLicences } from '../core/untunglab';

export interface Env {
  DB: D1Database;
  ASSETS: { fetch(req: Request): Promise<Response> };
  // plain variables (wrangler.toml)
  APP_ORIGINS: string;
  GOOGLE_CLIENT_ID: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  PUBLIC_BASE_URL: string;
  PRICE_SEN: string;
  EARLY_BIRD_PRICE_SEN: string;
  EARLY_BIRD_SLOTS: string;
  UNTUNGLAB_USER_PRICE_SEN: string;
  BUNDLE_PRICE_SEN: string;
  TOYYIB_BASE_URL: string;
  TOYYIB_CATEGORY: string;
  UNTUNGLAB_API: string;
  // secrets (wrangler secret put …)
  BREVO_API_KEY: string;
  CODE_PEPPER: string;
  /** Optional until buying opens. */
  TOYYIB_SECRET?: string;
  /** Optional: UntungLab's ADMIN_TOKEN, for the UntungLab-user price and the bundle. */
  UNTUNGLAB_ADMIN_TOKEN?: string;
  /** Optional: comma-separated owner/tester emails that get the full POS free (and may sign up before launch). */
  COMP_EMAILS?: string;
  /** "1" until launch: no new accounts except existing ones and COMP_EMAILS. */
  PRELAUNCH?: string;
}

const int = (v: string | undefined, fallback: number) => (v && /^\d+$/.test(v) ? Number(v) : fallback);

let google: ReturnType<typeof createGoogleVerifier> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.CODE_PEPPER || !env.BREVO_API_KEY) {
      return new Response(JSON.stringify({ error: 'server_not_configured' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    // One verifier per isolate, so Google's keys are cached between requests.
    google ??= createGoogleVerifier({ clientId: env.GOOGLE_CLIENT_ID });
    const handle = createHandler({
      store: new SqlStore(env.DB),
      mailer: createBrevoMailer({ apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL, senderName: env.BREVO_SENDER_NAME }),
      google,
      config: {
        appOrigins: env.APP_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
        codePepper: env.CODE_PEPPER,
        secureCookies: true,
        devMode: false,
        googleClientId: env.GOOGLE_CLIENT_ID,
        prelaunch: env.PRELAUNCH === '1',
        complimentaryEmails: (env.COMP_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        billing: {
          priceSen: int(env.PRICE_SEN, 4900),
          earlyBirdPriceSen: int(env.EARLY_BIRD_PRICE_SEN, 3900),
          earlyBirdSlots: int(env.EARLY_BIRD_SLOTS, 15),
          untungLabUserPriceSen: int(env.UNTUNGLAB_USER_PRICE_SEN, 2900),
          bundlePriceSen: int(env.BUNDLE_PRICE_SEN, 7500),
          publicBaseUrl: env.PUBLIC_BASE_URL,
          toyyibSecret: env.TOYYIB_SECRET ?? '',
        },
      },
      // Buying opens once the ToyyibPay key and category are set.
      toyyib: env.TOYYIB_SECRET && env.TOYYIB_CATEGORY
        ? createToyyibClient({ baseUrl: env.TOYYIB_BASE_URL, secretKey: env.TOYYIB_SECRET, categoryCode: env.TOYYIB_CATEGORY })
        : null,
      untungLab: env.UNTUNGLAB_ADMIN_TOKEN ? createUntungLabLicences({ baseUrl: env.UNTUNGLAB_API, adminToken: env.UNTUNGLAB_ADMIN_TOKEN }) : null,
      now: () => new Date(),
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      newId: () => crypto.randomUUID(),
    });
    return handle(request);
  },
};
