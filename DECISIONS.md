# JualanLab decisions log

Every choice the plan does not settle, or that changes it, is recorded here. Product decisions locked on 9 Oct 2026 are summarised in `JUALANLABDEV-NOTES.md`; the full reasoning is in the JualanLab V1 scope doc.

## Timeline (Mamu, 9 Oct 2026)

| # | Decision |
| --- | --- |
| T-01 | UntungLab launch: Sunday 11 Oct 2026 (estimate). JualanLab launch target: 3 to 5 weeks after, about 1 to 15 Nov 2026. POS and online store launch together. |
| T-02 | Backend work waits until UntungLab is live. Phase 1 (link format) goes ahead now because it touches neither app's code. |
| T-03 | **Supersedes the "launch together" part of T-01.** V1 = counter POS (sign-in, price list import, counter, offline queue, Sales Today, Close Day, plans and licensing), launch target unchanged (about 1 to 15 Nov 2026). V1.1 = online store and Kedai Plus (store page, checkout, order inbox, seller ToyyibPay/Billplz, RM19.90/RM199 subscription), released after V1. Prices are unchanged; Kedai Plus is sold from V1.1. |
| T-04 | Batch Selling, Prep List and Send to UntungLab move to **V1.1**, because they are built on online orders. **Bazaar Mode moves into V1**: it is counter-only and uses the V1 offline queue. UntungLab's Plan a Batch still ships in Phase 2 with manual entry and a ready batch-link route, so the V1.1 button needs no UntungLab change. |

## Phase 1: link format

| # | Decision | Reason |
| --- | --- | --- |
| L-01 | JualanLab address for V1: `https://jualan.untunglab.space`. The price list opens `/terima#d=…`. | Mamu, 9 Oct. |
| L-02 | The batch list opens UntungLab at `https://untunglab.space/#/rancang-batch?d=…`. | UntungLab uses a HashRouter, so the route and the data both sit in the fragment and never reach a server. Phase 2 adds the route. |
| L-03 | Envelope `1.` + base64url(raw DEFLATE(UTF-8 JSON)), using `fflate`. | UntungLab already ships `fflate` (its D-87), so no new library. Raw DEFLATE is also what browsers' `CompressionStream('deflate-raw')` produces. The `1.` prefix lets the encoding change later without touching the JSON format number. |
| L-04 | Prices travel as integer sen (`priceSen`), not ringgit. | No floating-point drift between apps; the licence server already uses sen. UntungLab converts with `ringgitToSen` (tested on 1.15, 4.35, 0.1 + 0.2). |
| L-05 | Margin is sent rounded to 2 decimals; `null` for an incomplete menu, with `status` also `null`. | UntungLab's "no guessed numbers" rule carried across. JualanLab shows "—". |
| L-06 | Status values are UntungLab's own codes (`loss`, `low`, `watch`, `healthy`). JualanLab never recalculates them. | One cost engine; the bands live only in UntungLab. |
| L-07 | Matching is by UntungLab menu id, never by name. | Names change; ids do not. |
| L-08 | A variation whose base is missing from the list is accepted with a `base_missing` warning and shown standalone. A variation of a variation is rejected. | Mirrors UntungLab (D-86): a variation cannot have variations; a base can be archived while its variation stays active. |
| L-09 | QR offered up to 1,600 characters (about QR version 29, level L). About 22 menus with real UUID ids fit; larger lists use the file `untunglab-harga-YYYY-MM-DD.json`. | 1,200 characters fitted only 14 menus because UUIDs do not compress. Scan reliability must be checked on real phones in Phase 2. |
| L-10 | Hard limits: 500 menus or items, 200,000-character payload, 1 MB decoded JSON, stopped while inflating. | Keeps a crafted link from freezing the phone; far above any home business. |
| L-11 | Unknown fields are ignored within format 1; a higher `format` is refused with `newer_format`. | Lets UntungLab add optional fields without breaking older JualanLab installs, and tells the user to update when the meaning changes. |
| L-12 | The reference code (`src/link/`) and fixtures (`spec/fixtures/`) are copied into UntungLab in Phase 2, and both apps run the same tests. | The fixtures are the contract between two separate repos. |

## Phase 3: foundation

| # | Decision | Reason |
| --- | --- | --- |
| F-01 | Stack mirrors UntungLab: Vite + React + TypeScript + Tailwind 4 + vite-plugin-pwa (update banner, never a silent reload) + Vitest + Dexie. BrowserRouter with real paths (`/terima`, `/kaunter`). | Same tools on both apps. Real paths because UntungLab's link opens `/terima#d=…` (L-01) and the Worker serves the app for any unknown path. |
| F-02 | One Cloudflare Worker serves the app and `/api` from `jualan.untunglab.space`; data in D1. | One origin means a first-party session cookie and no CORS. Steps in `DEPLOY.md`. |
| F-03 | Server code is platform-neutral (`server/core`, Request → Response) and tested on real SQL through Node's built-in SQLite. A local dev server (`npm run dev:api`) runs the same code. | Every route is tested with the real schema without a Cloudflare account; the Worker is a thin wrapper. |
| F-04 | Sign-in: Google, or a 6-digit email code sent by Brevo. Codes are hashed with a secret pepper, live 10 minutes, allow 5 tries, and are limited to 5 emails an hour per address and 20 per IP. | Mamu's choice (no passwords). Limits stop a stranger from using our Brevo quota to spam someone. |
| F-05 | Session: random 32-byte token in an HttpOnly, Secure, SameSite=Lax cookie; only its SHA-256 is stored. 60 days, renewed when less than 30 days are left. | A seller should not be signed out at the bazaar. A stolen database cannot be used to sign in. |
| F-06 | Every change request must carry the app's own `Origin`, and bodies must be JSON. | CSRF protection without tokens. |
| F-07 | The Google client id lives only in the Worker settings; the sign-in page reads it from `GET /api/config`. Empty = Google button hidden. | One place to set it, and email sign-in works before Google is set up. |
| F-08 | V1: one account, one shop. | Matches the plans (one licence per shop). Staff logins can come later. |
| F-09 | The catalogue is kept on the server and copied to the phone, so the counter works without internet. Catalogue changes (import, edit, new item) need internet. | One source of truth for prices; selling never waits for the network. |
| F-10 | The import preview and the server run the same `planImport` function. | What the seller previews is exactly what is saved. |
| F-11 | UntungLab menus: name and category can only change in UntungLab; the counter price can be changed in JualanLab. A changed price hides the margin and leaves the item out of profit until it matches UntungLab again; a new list keeps the seller's price and says so. | One cost engine: JualanLab never works out a margin for a price UntungLab did not cost. |
| F-12 | Menus missing from a new list become inactive, never deleted. Inactive items are hidden from the counter. | Past sales still point at them. |
| F-13 | Brand: black (`#05070A`) with neon blue (`#3AB4FF`) on dark surfaces; deeper blue (`#0B63CE`) for buttons on white. Plus Jakarta Sans. Icon = lab flask with a banknote. | Mamu's mockup feedback, 9 Oct. The neon fails contrast on white, so it stays on dark surfaces. |
| F-14 | Bahasa Melayu by default, English from Lagi › Bahasa. A test checks both languages have the same keys and placeholders. | Same rule as UntungLab. |

## Phase 4: counter POS

| # | Decision | Reason |
| --- | --- | --- |
| P-01 | A sale is saved on the phone first (IndexedDB), then sent; the server ignores a second copy of the same sale id. Sending is retried on start, on reconnect, when the app comes to the front, and every 30 seconds. | A sale must never be lost to a bad connection. Phase 5 hardens this (multiple tabs, long offline stretches). |
| P-02 | The server recomputes every total from the lines and rejects a sale that does not add up. A sale it refuses stays on the phone, marked "Masalah", never dropped. | The server never trusts a phone's sums; the seller's record is never thrown away. |
| P-03 | Receipt numbers: two-character device tag plus a running number per phone (`6L-0001`). | Two phones in one shop never print the same number, with no server round trip. |
| P-04 | Each sale line keeps a snapshot of the name, price and margin at the time of sale. | Later price changes do not rewrite past sales or profit. |
| P-05 | Order discount in RM, shared across lines by value; only the share on lines with a margin lowers estimated profit. | Cost does not change with a discount; profit does. |
| P-06 | Payment methods: cash (with change and quick-cash buttons), DuitNow QR, e-wallet. QR and e-wallet are confirmed by hand after the seller checks the bank notification. | No payment gateway at the counter in V1 (online payment is Kedai Plus, V1.1). |
| P-07 | The shop's DuitNow QR image is stored on the phone only (Lagi › Tetapan kedai). | Small, and only needed at that counter. Moving it to the server waits for the online store, which needs it too. |
| P-08 | Receipts go to WhatsApp as plain text through a `wa.me` link (a Malaysian number like 012-345 6789 becomes 60123456789), or the phone's share sheet. | No WhatsApp API costs; works on every phone. |
| P-09 | The cart survives moving between screens and an accidental reload (kept in localStorage, cleared after the sale). | A reload mid-order should not lose the order. |
| P-10 | Margin badges take UntungLab's status colour (loss red, low/watch amber, healthy green); no margin shows "margin —". | A losing menu should never look healthy at the counter. |
| P-11 | The home card and Sales list count this phone's sales for the Malaysian day (UTC+8). Shop-wide totals, voiding with a reason, and Close Day come in Phase 6. | Phase order in the breakdown; the label says "di telefon ini" so nobody mistakes it for the shop total. |
| P-12 | Signing out keeps unsent sales on the phone (with a warning); they are sent only after the same shop signs in again. | Never mix one shop's sales into another account. |
