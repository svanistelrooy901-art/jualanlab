# JualanLab

Counter POS and online store for Malaysian home and small food businesses. Sister app to UntungLab.

**Status:** Phases 1, 3 and 4 built (link format, foundation, counter POS). Progress for Mamu: `PROGRESS.md`. Deploy: `DEPLOY.md`.

| Path | What |
| --- | --- |
| `JUALANLABDEV-NOTES.md` | Background notes and the decisions locked on 9 Oct 2026 |
| `DECISIONS.md` | Decisions log |
| `spec/LINK-FORMAT.md` | UntungLab ⇄ JualanLab hand-off format, v1 |
| `spec/fixtures/` | Contract fixtures both apps must pass |
| `src/link/` | Reference encoder, decoder and validator |
| `src/domain/` | Money, catalogue, import plan, cart, sale, summary (pure, tested) |
| `src/app/`, `src/db/`, `src/i18n/` | The PWA: pages, phone storage (Dexie), BM/EN copy |
| `server/core/` | API (auth, shop, items, sales), platform-neutral, tested on real SQL |
| `server/worker/` | Cloudflare Worker wrapper and `wrangler.toml` |
| `server/migrations/` | D1 schema |
| `source/context/` | Project breakdown PDF |

```
npm install
npm test          # all tests (link contract, domain, API, phone sync)
npm run typecheck # app + worker
npm run dev:api   # local API (SQLite) on :8787
npm run dev       # app on :5173
npx tsx scripts/gen-fixtures.ts   # regenerate derived fixtures
```
