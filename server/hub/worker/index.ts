/**
 * Cloudflare Worker for the smeLab account service (smelab.untunglab.space, later smelab.my): the sales page,
 * sign-in, account and checkout over HTTP, and — through `SmeLabAccounts` — the private calls the apps make over
 * a service binding (never reachable from the internet). Images in ../public are served by Workers Assets.
 */
import { WorkerEntrypoint } from 'cloudflare:workers';
import type { D1Database } from '../../core/d1';
import { createGoogleVerifier } from '../../core/google';
import { createToyyibClient } from '../../core/toyyibpay';
import { createHub, type Hub } from '../core/api';
import { createHubMailer } from '../core/mail';
import type { AppId, HubConfig } from '../core/ports';
import { SqlHubStore } from '../core/store';
import { createUntungLabAdmin } from '../core/untunglab';

export interface Env {
  DB: D1Database;
  PUBLIC_BASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  JUALANLAB_URL: string;
  JUALANLAB_REDIRECTS: string;
  UNTUNGLAB_URL: string;
  UNTUNGLAB_REDIRECTS: string;
  UNTUNGLAB_TRY_URL?: string;
  UNTUNGLAB_PRICE_SEN: string;
  UNTUNGLAB_EARLY_PRICE_SEN: string;
  UNTUNGLAB_EARLY_SLOTS: string;
  JUALANLAB_PRICE_SEN: string;
  JUALANLAB_EARLY_PRICE_SEN: string;
  JUALANLAB_EARLY_SLOTS: string;
  SECOND_APP_PRICE_SEN: string;
  COMBO_PRICE_SEN: string;
  /** "1" when JualanLab can be bought (from its launch). */
  JUALANLAB_ON_SALE: string;
  /** "0" stops selling the combo; otherwise it is on sale, before the launch as early access. */
  COMBO_ON_SALE?: string;
  TOYYIB_BASE_URL: string;
  TOYYIB_CATEGORY: string;
  UNTUNGLAB_API: string;
  // secrets
  BREVO_API_KEY: string;
  CODE_PEPPER: string;
  TOYYIB_SECRET?: string;
  UNTUNGLAB_ADMIN_TOKEN?: string;
  COMP_EMAILS?: string;
  TESTER_EMAILS?: string;
  TEST_PRICE_SEN?: string;
}

const int = (v: string | undefined, fallback: number) => (v && /^\d+$/.test(v) ? Number(v) : fallback);
const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

let google: ReturnType<typeof createGoogleVerifier> | null = null;

function config(env: Env): HubConfig {
  return {
    publicBaseUrl: env.PUBLIC_BASE_URL,
    codePepper: env.CODE_PEPPER,
    secureCookies: true,
    devMode: false,
    googleClientId: env.GOOGLE_CLIENT_ID,
    apps: {
      jualanlab: { url: env.JUALANLAB_URL, redirectUris: list(env.JUALANLAB_REDIRECTS) },
      untunglab: { url: env.UNTUNGLAB_URL, redirectUris: list(env.UNTUNGLAB_REDIRECTS), tryUrl: env.UNTUNGLAB_TRY_URL?.trim() || undefined },
    } satisfies Record<AppId, unknown>,
    complimentaryEmails: list(env.COMP_EMAILS).map((s) => s.toLowerCase()),
    testers: { emails: list(env.TESTER_EMAILS).map((s) => s.toLowerCase()), jualanlabSen: int(env.TEST_PRICE_SEN, 100) },
    prices: {
      untunglab: { normalSen: int(env.UNTUNGLAB_PRICE_SEN, 4900), earlySen: int(env.UNTUNGLAB_EARLY_PRICE_SEN, 3900), earlySlots: int(env.UNTUNGLAB_EARLY_SLOTS, 0) },
      jualanlab: { normalSen: int(env.JUALANLAB_PRICE_SEN, 4900), earlySen: int(env.JUALANLAB_EARLY_PRICE_SEN, 3900), earlySlots: int(env.JUALANLAB_EARLY_SLOTS, 0) },
      secondAppSen: int(env.SECOND_APP_PRICE_SEN, 2900),
      comboSen: int(env.COMBO_PRICE_SEN, 7500),
    },
    onSale: { untunglab: true, jualanlab: env.JUALANLAB_ON_SALE === '1', combo: env.COMBO_ON_SALE !== '0' },
    toyyibSecret: env.TOYYIB_SECRET ?? '',
  };
}

function hubFor(env: Env): Hub {
  google ??= createGoogleVerifier({ clientId: env.GOOGLE_CLIENT_ID });
  return createHub({
    store: new SqlHubStore(env.DB),
    mailer: createHubMailer({ apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL, senderName: env.BREVO_SENDER_NAME }),
    google,
    toyyib: env.TOYYIB_SECRET && env.TOYYIB_CATEGORY ? createToyyibClient({ baseUrl: env.TOYYIB_BASE_URL, secretKey: env.TOYYIB_SECRET, categoryCode: env.TOYYIB_CATEGORY }) : null,
    untungLab: env.UNTUNGLAB_ADMIN_TOKEN ? createUntungLabAdmin({ baseUrl: env.UNTUNGLAB_API, adminToken: env.UNTUNGLAB_ADMIN_TOKEN }) : null,
    config: config(env),
    now: () => new Date(),
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    newId: () => crypto.randomUUID().replace(/-/g, ''),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.CODE_PEPPER || !env.BREVO_API_KEY) return new Response('smeLab is not configured yet', { status: 503 });
    return hubFor(env).fetch(request);
  },
};

/** Private calls for the smeLab apps, reached only through a service binding. */
export class SmeLabAccounts extends WorkerEntrypoint<Env> {
  redeem(code: string, app: AppId, redirectUri: string) {
    return hubFor(this.env).redeem(code, app, redirectUri);
  }
  productsOf(accountId: string) {
    return hubFor(this.env).productsOf(accountId);
  }
  untungLabCodeOf(accountId: string) {
    return hubFor(this.env).untungLabCodeOf(accountId);
  }
  startEmailCode(email: string, lang: 'ms' | 'en', ip: string) {
    return hubFor(this.env).startEmailCode(email, lang, ip);
  }
  verifyEmailCode(email: string, code: string) {
    return hubFor(this.env).verifyEmailCode(email, code);
  }
}
