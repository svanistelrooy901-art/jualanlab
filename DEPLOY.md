# Deploy JualanLab and smeLab

Two Cloudflare Workers on the same account as UntungLab, each with its own D1 database:

| Worker | Address | What | Config |
| --- | --- | --- | --- |
| `smelab` | `https://smelab.untunglab.space` (until `smelab.my` is registered) | smeLab sales page, one account for all smeLab apps, checkout and receipts | `server/hub/worker/wrangler.toml` |
| `jualanlab` | `https://jualan.untunglab.space` | the JualanLab app and its API; signs in and checks plans through smeLab | `server/worker/wrangler.toml` |

JualanLab talks to smeLab privately through a service binding (`SMELAB` → `SmeLabAccounts`), so **smeLab deploys first**.

## Already done

- D1 database `jualanlab` created (APAC), id `746fc61a-1529-456c-b655-98f2777a74a2`, already in `wrangler.toml`.
- D1 database `smelab` created, id `38f6227e-486e-417e-95c5-d8944c7a2a71`, already in `server/hub/worker/wrangler.toml`.

## Easiest: automatic deploy from GitHub

`.github/workflows/ci-deploy.yml` runs the tests on every push and deploys `main` once these four repo secrets exist
(GitHub → jualanlab → Settings → Secrets and variables → Actions → New repository secret):

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → Account API tokens → Create Token → template "Edit Cloudflare Workers"; add Account › D1 › Edit; Account Resources = your account; Zone Resources = `untunglab.space`. A separate token from UntungLab's. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID on the right |
| `BREVO_API_KEY` | Brevo → SMTP & API → API keys |
| `CODE_PEPPER` | Any long random text (for example 40 random letters and numbers). Never change it later. |

Optional repository secrets (each one is pushed to the Worker only when set):

| Secret | What it turns on |
| --- | --- |
| `TOYYIB_SECRET` | Buying on smeLab (ToyyibPay category in `TOYYIB_CATEGORY`, `server/hub/worker/wrangler.toml`) |
| `UNTUNGLAB_ADMIN_TOKEN` | UntungLab's `ADMIN_TOKEN`: smeLab finds licences bought before smeLab and issues UntungLab codes for new orders |
| `SMELAB_ADMIN_TOKEN` | smeLab's admin API for the UntungLab admin page (A-15). A long random text, different from the other admin tokens. Pushed to the smeLab Worker as `ADMIN_TOKEN`. Without it the API is off. |
| `JUALANLAB_ADMIN_TOKEN` | The same for JualanLab (pushed to its Worker as `ADMIN_TOKEN`). Another long random text. |
| `COMP_EMAILS` | Comma-separated emails that own every smeLab app free (owner, testers); also lets them into JualanLab before launch |
| `TESTER_EMAILS` | JualanLab before launch: emails that may sign in but get only what they buy, to test buying with a real payment |

With those set, every push to `main` applies new migrations to both databases and deploys smeLab, then JualanLab.
Steps 1, 2 and 4 below still apply; step 3 is replaced by the secrets.

## One-time setup (Mamu)

1. **Brevo sender.** In Brevo → Senders, add and verify `jualanlab@digitalsambal.space` (or tell Claude another address).
   Create an API key (Brevo → SMTP & API → API keys).
2. **Google sign-in (optional, email works without it).** Google Cloud Console → APIs & Services → Credentials →
   Create OAuth client ID → Web application. Authorised JavaScript origins: `https://jualan.untunglab.space`
   (add `http://localhost:5173` for testing). No redirect URI needed. Put the client ID in `GOOGLE_CLIENT_ID` in `wrangler.toml`.
3. **Secrets** (from the repo folder):
   ```
   cd server/worker
   npx wrangler secret put BREVO_API_KEY      # paste the Brevo key
   npx wrangler secret put CODE_PEPPER        # paste any long random text, e.g. from: openssl rand -hex 32
   ```
4. **Domain.** `untunglab.space` must be a zone on this Cloudflare account. The `[[routes]]` blocks with
   `custom_domain = true` create the `jualan` and `smelab` DNS records on first deploy.

## Every deploy

```
npm ci
npm test
npm run build                                           # app into dist/
cd server/hub/worker
npx wrangler d1 migrations apply smelab --remote        # only runs new migrations
npx wrangler deploy                                     # smeLab first
cd ../../worker
npx wrangler d1 migrations apply jualanlab --remote
npx wrangler deploy
```

## Check after deploy (5 minutes)

1. Open `https://smelab.untunglab.space`: four apps, prices, Daftar/Log masuk. Sign in with email; `/akaun` lists what you own.
   Open `https://jualan.untunglab.space` on a phone. Sign in with the same email: the code (from smeLab) arrives (check spam).
2. Name the shop. In UntungLab, tap Send to JualanLab and open the link on the same phone: preview, then Accept.
3. Counter: sell two items in cash, share the receipt to WhatsApp.
4. Airplane mode: sell one item by QR. The bar shows "1 jualan belum dihantar". Turn airplane mode off: it clears.
5. Add to Home Screen; open from the icon in airplane mode: the counter still works.

## Local development

```
npm run dev:api     # JualanLab API on :8787 and smeLab on :8790, SQLite in .dev/, email codes shown on screen,
                    # paying is instant; SMELAB=0 for JualanLab's own sign-in, JUALANLAB_ON_SALE=1 to sell it alone
npm run dev         # app on :5173, /api proxied to :8787
```

## Notes

- `CODE_PEPPER` must never change after launch without accepting that codes in flight stop working (sessions are unaffected).
- Security headers (including Content-Security-Policy) and caching for the app's static files are in `public/_headers`;
  smeLab sets its own headers on every page it serves.
- At JualanLab's launch: `PRELAUNCH = "0"` in `server/worker/wrangler.toml` and `JUALANLAB_ON_SALE = "1"` in
  `server/hub/worker/wrangler.toml`, then push.
- When `smelab.my` is registered: add it as a zone, change the `[[routes]]` pattern and `PUBLIC_BASE_URL` in
  `server/hub/worker/wrangler.toml` and `SMELAB_URL` in `server/worker/wrangler.toml`; keep the old address redirecting.
