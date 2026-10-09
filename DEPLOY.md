# Deploy JualanLab

One Cloudflare Worker serves the app and its API at `https://jualan.untunglab.space`, with data in D1.
Everything is in `server/worker/wrangler.toml`. Same Cloudflare account as UntungLab.

## Already done

- D1 database `jualanlab` created (APAC), id `746fc61a-1529-456c-b655-98f2777a74a2`, already in `wrangler.toml`.

## Easiest: automatic deploy from GitHub

`.github/workflows/ci-deploy.yml` runs the tests on every push and deploys `main` once these four repo secrets exist
(GitHub → jualanlab → Settings → Secrets and variables → Actions → New repository secret):

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token → template "Edit Cloudflare Workers", then add permission Account › D1 › Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID on the right |
| `BREVO_API_KEY` | Brevo → SMTP & API → API keys |
| `CODE_PEPPER` | Any long random text (for example 40 random letters and numbers). Never change it later. |

With those set, every push to `main` applies new migrations and deploys. Steps 1, 2 and 4 below still apply; step 3 is replaced by the secrets.

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
4. **Domain.** `untunglab.space` must be a zone on this Cloudflare account. The `[[routes]]` block with
   `custom_domain = true` creates the `jualan` DNS record on first deploy.

## Every deploy

```
npm ci
npm test
npm run build                                           # app into dist/
cd server/worker
npx wrangler d1 migrations apply jualanlab --remote     # only runs new migrations
npx wrangler deploy
```

## Check after deploy (5 minutes)

1. Open `https://jualan.untunglab.space` on a phone. Sign in with email: the code arrives (check spam).
2. Name the shop. In UntungLab, tap Send to JualanLab and open the link on the same phone: preview, then Accept.
3. Counter: sell two items in cash, share the receipt to WhatsApp.
4. Airplane mode: sell one item by QR. The bar shows "1 jualan belum dihantar". Turn airplane mode off: it clears.
5. Add to Home Screen; open from the icon in airplane mode: the counter still works.

## Local development

```
npm run dev:api     # API on :8787 with SQLite in .dev/, email codes shown on screen
npm run dev         # app on :5173, /api proxied to :8787
```

## Notes

- `CODE_PEPPER` must never change after launch without accepting that codes in flight stop working (sessions are unaffected).
- Content-Security-Policy is not set yet; it needs Google's sign-in script allowed. Planned before launch.
- Security headers and caching for the static files are in `public/_headers`.
