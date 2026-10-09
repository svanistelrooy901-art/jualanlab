/**
 * Cloudflare Worker: serves the app's static files and the /api routes from one origin
 * (jualan.untunglab.space), so the session cookie is first-party. See DEPLOY.md.
 */
import { createHandler } from '../core/api';
import { createBrevoMailer } from '../core/brevo';
import type { D1Database } from '../core/d1';
import { createGoogleVerifier } from '../core/google';
import { SqlStore } from '../core/store';

export interface Env {
  DB: D1Database;
  ASSETS: { fetch(req: Request): Promise<Response> };
  // plain variables (wrangler.toml)
  APP_ORIGINS: string;
  GOOGLE_CLIENT_ID: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  // secrets (wrangler secret put …)
  BREVO_API_KEY: string;
  CODE_PEPPER: string;
}

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
      },
      now: () => new Date(),
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      newId: () => crypto.randomUUID(),
    });
    return handle(request);
  },
};
