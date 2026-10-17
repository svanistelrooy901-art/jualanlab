# JualanLab decisions log

Every choice the plan does not settle, or that changes it, is recorded here. Product decisions locked on 9 Oct 2026 are summarised in `JUALANLABDEV-NOTES.md`; the full reasoning is in the JualanLab V1 scope doc.

## Timeline (Mamu, 9 Oct 2026)

| # | Decision |
| --- | --- |
| T-01 | UntungLab launch: Sunday 11 Oct 2026 (estimate). JualanLab launch target: 3 to 5 weeks after, about 1 to 15 Nov 2026. POS and online store launch together. |
| T-02 | Backend work waits until UntungLab is live. Phase 1 (link format) goes ahead now because it touches neither app's code. |
| T-03 | **Supersedes the "launch together" part of T-01.** V1 = counter POS (sign-in, price list import, counter, offline queue, Sales Today, Close Day, plans and licensing), launch target unchanged (about 1 to 15 Nov 2026). V1.1 = online store and Kedai Plus (store page, checkout, order inbox, seller ToyyibPay/Billplz, RM19.90/RM199 subscription), released after V1. Prices are unchanged; Kedai Plus is sold from V1.1. |
| T-04 | Batch Selling, Prep List and Send to UntungLab move to **V1.1**, because they are built on online orders. **Bazaar Mode moves into V1**: it is counter-only and uses the V1 offline queue. UntungLab's Plan a Batch still ships in Phase 2 with manual entry and a ready batch-link route, so the V1.1 button needs no UntungLab change. |
| T-05 | **Manual QR checkout on every store plan, Free included (Mamu, 10 Oct).** Customer sees the total, the seller's DuitNow QR, Save QR, and "I have paid, send proof" (opens WhatsApp to the seller with order number and amount). Order number shown for the transfer reference. Orders wait as "Waiting for payment check" until the seller confirms in their bank app. Unpaid orders cancel after a time the seller sets. Amount inside the QR to be tested on real bank apps first. The shop's QR image moves to the server (supersedes P-07 when the store is built). Kedai Plus keeps the gateway (ToyyibPay/Billplz, confirmed automatically) and adds proof upload into the order. "Free: no online payment" now reads "Free: no payment gateway". |
| T-06 | **JualanLab stays closed to the public until launch, expected early November 2026 (Mamu, 14 Oct).** While the `PRELAUNCH` var is "1": no new accounts (email or Google) except testers in `COMP_EMAILS` (full POS free) and `TESTER_EMAILS` (stay on Free, to test buying); accounts that already exist keep working; the sign-in page says it has not launched yet. No sign-in code is sent to other addresses. UntungLab's one-time note says the same and its button opens Rancang Batch, not JualanLab. At launch: set `PRELAUNCH = "0"` and ship an UntungLab update that removes the note and announces the launch. |
| T-07 | **Business days are opened and closed by hand, not by calendar date (Mamu, 15 Oct).** A stall open from 5 pm to 2 am is one day. See D-01 to D-09 below. |

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
| L-13 | **Phase 1 signed off by Mamu, 14 Oct 2026.** Link format v1 is frozen; changes need a new `format` number. | Both apps now depend on it. |

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
| P-07 | The shop's DuitNow QR image is stored on the phone only (Lagi › Tetapan kedai). Superseded by T-05 when the online store is built: one QR per shop on the server. | Small, and only needed at that counter. Moving it to the server waits for the online store, which needs it too. |
| P-08 | Receipts go to WhatsApp as plain text through a `wa.me` link (a Malaysian number like 012-345 6789 becomes 60123456789), or the phone's share sheet. | No WhatsApp API costs; works on every phone. |
| P-09 | The cart survives moving between screens and an accidental reload (kept in localStorage, cleared after the sale). | A reload mid-order should not lose the order. |
| P-10 | Margin badges take UntungLab's status colour (loss red, low/watch amber, healthy green); no margin shows "margin —". | A losing menu should never look healthy at the counter. |
| P-11 | The home card and Sales list count this phone's sales for the Malaysian day (UTC+8). Shop-wide totals, voiding with a reason, and Close Day come in Phase 6. | Phase order in the breakdown; the label says "di telefon ini" so nobody mistakes it for the shop total. |
| P-12 | Signing out keeps unsent sales on the phone (with a warning); they are sent only after the same shop signs in again. | Never mix one shop's sales into another account. |

## Phase 5: offline queue

| # | Decision | Reason |
| --- | --- | --- |
| O-01 | The app asks the browser to keep its storage (`navigator.storage.persist`) after the first sale. | Unsent sales must not be cleared when the phone runs low on space. |
| O-02 | Banner turns red when a sale has waited more than 24 hours. | Scope doc: "firmer after 24 hours". Losing the phone before sending loses those sales. |
| O-03 | Only one tab sends at a time (Web Locks where available). The server's de-duplication covers the rest. | Two open tabs should not double the traffic; correctness never depends on the lock. |
| O-04 | A void made offline travels like a sale: an unsent sale goes out already voided; a sent sale gets a separate void request. If a done sale is resent voided, the server applies the void. | A void must never be lost, whatever order the network delivers things in. |
| O-05 | A sale the server refused stays on the phone as "Masalah" with a "Cuba hantar semula" button. | Never drop a seller's record; let them retry after an update. |
| O-06 | Signing in shows how many unsent sales this phone holds. | They only send once the same shop signs in again (P-12). |
| O-07 | Tested: answer lost after the server saved (resend lands once), void before and after sending, cold start with no internet from the installed app. | The scope doc's "putus talian di tengah jualan" test. |

## Phase 6: Sales Today and Lab features

| # | Decision | Reason |
| --- | --- | --- |
| S-01 | Sales Today shows every phone's sales from the server when online, plus this phone's unsent ones; offline it shows this phone only and says so. Any past day can be opened. | One true total per shop; Close Day after midnight must still be possible. |
| S-02 | Voiding: from the receipt, with a preset or typed reason (up to 120 characters). Voided sales stay listed (struck through, reason shown) and are left out of totals, profit and best sellers. Allowed before and after Close Day. | Scope doc rule: sales are never deleted. |
| S-03 | Close Day: float + cash sales = cash expected; the seller enters cash counted; the difference shows with a sign and a label (over / short / exact). The server works out the totals from its own sales. | The server never trusts a phone's sums (P-02). |
| S-04 | A day can be closed again. Every close is kept; the newest is current. If sales or voids change after closing, Sales Today says by how much and offers "Tutup semula". | A late sale or a void after closing is normal at a stall; no data is hidden or overwritten. |
| S-05 | Close Day needs internet and no unsent sales on this phone, and reminds the seller about other phones. | The close must count every sale. |
| S-06 | Money Envelopes: capital = takings of items with a margin minus estimated profit; profit = estimated profit; items with no margin are "not split". The three always add up to the takings. A loss shows as negative profit labelled Rugi. | One cost engine and no guessed numbers: only UntungLab margins split the money. |
| S-07 | CSV export: one row per item line, Malaysia time, UTF-8 with BOM, typed text guarded against spreadsheet formulas (numbers are never altered). | Opens cleanly in Excel and Google Sheets; safe against formula injection. |

## Phase 7: Bazaar Mode

| # | Decision | Reason |
| --- | --- | --- |
| B-01 | Bazaar Mode is a separate full-screen counter: up to 8 big buttons picked by the seller, one tap per item, one tap to take the money (Exact, the next notes up, or QR). The change shows large right after. | A queue at a Ramadan bazaar leaves no time for the normal cart and payment screens. |
| B-02 | Bazaar sales are ordinary sales with channel `bazaar`: same queue, receipts, voids, Sales Today and Close Day; Sales Today can filter by channel. | One record, no second system to reconcile. |
| B-03 | The float entered at the start is offered to Close Day for that day. The header shows today's bazaar takings and the drawer (float + today's cash). | The seller counts the drawer against the same float. |
| B-04 | Screen kept on with the Screen Wake Lock API and a short tap sound, both switchable. Unsupported phones simply skip them. | Night markets: a dimming screen and a noisy crowd. |
| B-05 | Tapping an item chip in the cart takes one off; Clear empties it. No discounts or notes in Bazaar Mode (use the normal counter). | Speed over options; mistakes after payment are voided from the receipt. |
| B-06 | Settings (buttons, float, screen, sound) are kept per phone. | Each stall phone is set up for its own table. |

## Phase 8: plans and buying

| # | Decision | Reason |
| --- | --- | --- |
| L8-01 | Free: everything, up to 10 active items, no UntungLab link. The limit only stops adding (a new item, or reactivating one); editing and selling are never blocked and nothing is removed. Receiving an UntungLab list needs the full POS; the preview still shows, with an upgrade button. | Mamu, 9 Oct; same rule as UntungLab (free limits only block adding). |
| L8-02 | Full POS is a plan on the shop (`free` / `pos`), stored on the server, one-time payment. | Accounts already exist, so no offline licence keys are needed. |
| L8-03 | Prices are set by the server only (wrangler vars): RM49; early bird RM39 for the first 15 paid early-bird orders; UntungLab users RM29; bundle JualanLab + UntungLab RM75. | Mamu, 9 Oct. The phone never sends a price. |
| L8-04 | Payment through ToyyibPay (FPX), same account as UntungLab with its own category; the client code is UntungLab's, live since 10 Oct. A payment counts only when ToyyibPay confirms the right amount when asked directly; the callback hash is checked but never trusted alone. The return page polls until confirmed. | UntungLab D-64; one ToyyibPay account for Digital Sambal. |
| L8-05 | The UntungLab-user price needs an UntungLab licence code that UntungLab's server says is active (not revoked), checked with UntungLab's admin token. Each code gives the price once (unique on paid orders). Free UntungLab codes count too. | No shared database between the apps; UntungLab stays without accounts. |
| L8-06 | Bundle: after payment, JualanLab asks UntungLab's server to issue a lifetime UntungLab licence for the buyer; UntungLab emails the code itself. If UntungLab is down, it is retried on the next check, and issued once. | Reuses UntungLab's own free-code path (D-91 there); no second licence system. |
| L8-07 | Buying stays closed until the ToyyibPay secret and the JualanLab category are set; the UntungLab price and bundle stay hidden until UntungLab's admin token is set. The page says so instead of failing. | Safe to deploy before the keys exist. |
| L8-08 | Owner and tester accounts listed in the `COMP_EMAILS` secret get the full POS without paying. | Mamu can test the full app, including the UntungLab link, before buying opens. |
| L8-09 | Kedai Plus is shown as "coming soon" (V1.1). | Release split T-03. |

## Business days (T-07, 15 Oct)

| # | Decision | Reason |
| --- | --- | --- |
| D-01 | **Buka Hari** opens a day for the whole shop, with the opening cash optional. Every phone sells into the same open day. Each sale carries the id of that day; Sales, Close Day, the Money Envelopes and the CSV all add up by day, never by calendar date. | Mamu: "Day must have manual opening and closing… some store days operate between 2 calendar days." |
| D-02 | No open day, no selling: the Kaunter and Bazar show the Buka Hari card first (one tap). A cart already taken waits; if the day was closed meanwhile, payment says so and keeps the cart. | Manual opening was asked for; one tap keeps it from slowing a sale. |
| D-03 | **Tutup Hari** ends the day (first close) and records the cash count. Closing again (late sale or void) adds a newer count and does not move the end. The opening cash is offered at close and can be corrected there. | Same close as before (S-03, S-04), now per business day. |
| D-04 | Nothing closes by itself. After 20 hours open, Home, Kaunter and Jualan ask "Terlupa Tutup Hari?". | A wrong automatic close would split a night's takings. |
| D-05 | "Buka semula" reopens the latest day while no newer day exists. | Closed by mistake at 9 pm, still selling at 11 pm. |
| D-06 | Opening works without internet: the day is saved on the phone and sent before its sales. The server keeps at most one open day per shop (database rule). When two phones opened offline, the later arrival is joined to the day that was open at its opening time, and its sales move there; the phone follows. A phone that saw the previous day close always gets a new day, even with its clock a few minutes behind. | Never lose or split a sale because of a bad connection. |
| D-07 | A sale whose day the server has not heard of yet starts that day (filled in when the opening arrives). A sale from an app older than this change goes into the day open when it was made, or starts one. | Order of arrival must not matter; old cached apps keep working until they update. |
| D-08 | Sales made before this change were put into one ended day per shop and Malaysian date (migration 0004). Production had no sales, so nothing moved there. | Keep history readable. |
| D-09 | Days are named by when they opened: the open day is "Hari ini"; others "Rab, 14 Okt" with "9:30 PTG hingga Kha, 15 Okt, 1:40 PG" when they ran past midnight. Jualan moves between days with ‹ ›. | A night's sales read as one day. |

## Receipts (15 Oct)

| # | Decision | Reason |
| --- | --- | --- |
| R-01 | **Receipt picture (PNG) rather than PDF.** Drawn on the phone (works offline): shop name on the dark band, receipt number and time, items with quantity × price and notes, discount, total, cash and change or how it was paid, "Terima kasih!", and a small "Dibuat dengan JualanLab". 1080 px wide. "Kongsi gambar resit" opens the phone's share sheet (WhatsApp, Telegram, gallery); where a browser cannot share files, the button saves the picture instead. The text receipt to a typed number stays as a second option. | Mamu asked for a PDF or picture receipt. WhatsApp shows a picture in the chat; a PDF has to be opened. |
| R-02 | The picture is prepared as soon as the receipt shows, so the share sheet opens straight from the tap. | Phones (Safari especially) only allow sharing right after a tap. |

## Item discounts (15 Oct)

| # | Decision | Reason |
| --- | --- | --- |
| I-01 | **Cost of one unit = UntungLab's price × (1 − UntungLab's margin)**, kept unrounded on each sale line. Profit on a line is the price charged minus that cost. Updates LINK-FORMAT receiver rules 4 and 5 ("JualanLab never calculates cost"): there is still no second cost engine, only UntungLab's two numbers rearranged, so no UntungLab change or new link format is needed. Menus UntungLab reports incomplete and own items still have no cost and stay out of profit. | Mamu: "the margin has to be calculated based on the cost that we receive from UntungLab." |
| I-02 | A discount on one item, from the payment screen: 5%, 10% or 15%, any other percentage, or a special price per unit. Taken off the counter price, never stacked; can be changed or removed. The sheet shows the new price, what the customer saves, and the margin and profit per unit after the discount (amber when lower than before, red with the loss when below cost). | Mamu, 15 Oct. |
| I-03 | A price typed in the catalogue now shows its real margin from UntungLab's cost (was "—" and left out of profit). Badge red below cost, amber below UntungLab's margin. | Same rule as I-01; hiding a margin we can work out exactly helped nobody. |
| I-04 | A discounted line stays separate: tapping the item again adds a full-price line; the counter's minus takes from the full-price line first. | No discount given by accident. |
| I-05 | Each line keeps its counter price, percentage and cost; the server checks the price is not above the counter price and that a percentage gives exactly the price charged. Receipts (text and picture) show "Diskaun 10% (asal RM5.00)" or "Harga khas (asal RM1.00)". CSV adds counter price, discount % and RM. Sales shows "Diskaun diberi" (item and order discounts). | Records stay checkable; customers see what they saved. |
| I-06 | The order discount (RM, whole receipt) stays as it was and works with item discounts. Bazaar Mode has no item discounts (speed first). | Unchanged behaviour where not asked. |

## smeLab account and sales page (15 Oct)

Design: `docs/SMELAB-ACCOUNT.md`.

| # | Decision | Reason |
| --- | --- | --- |
| A-01 | **One smeLab account for every smeLab app** (Mamu). Sign in once at smeLab; apps open signed in. Purchases (entitlements) sit on the account. | Mamu: "all smeLab apps use the same login credentials". |
| A-02 | Domain smelab.my, to be registered by Mamu; meanwhile `smelab.untunglab.space` (Mamu). | One brand for the suite. |
| A-03 | Existing UntungLab licence codes keep working; signing in is optional; an account with the buyer's email picks up the licence (Mamu). | No forced change for live users. |
| A-04 | Built before the JualanLab launch, **early November 2026** (Mamu, 15 Oct; replaces "may move to mid-November"). | Launch once, with one account. |
| A-05 | Sign-in by redirect with a one-time code redeemed over a Cloudflare service binding, not a shared cookie. | Works across domains, so UntungLab stays on untunglab.space (its data lives on phones under that address). No shared secrets to manage. |
| A-06 | One sales page for the suite: UntungLab and JualanLab with details and prices; PromoLab and KiraLab "In development" with a notify-me form. Buy one app, the combo, or the second app at the owner price; no codes to type. Replaces UntungLab's page at beli.untunglab.space (Mamu: "share the sales page with UntungLab"). | One place to buy; owner price applied by account. |
| A-07 | **The combo is sold now as early access; JualanLab alone is sold from launch day** (Mamu, 15 Oct). A combo buyer gets the UntungLab code at once and JualanLab's full POS on the account, usable when JualanLab opens. Sales page, receipt email, `/akaun` and the done page all say "JualanLab opens on launch day, early November". Switches: `COMBO_ON_SALE = "1"` now, `JUALANLAB_ON_SALE = "1"` at launch. | Mamu: "Jualanlab available on launch day. But can start selling bundle now - early access". |
| A-08 | Under the same switch, an UntungLab owner may already take JualanLab at the owner price (RM29) as early access. | The combo is on sale to new buyers; an existing UntungLab owner should not have to wait or pay more than the combo's share. |
| A-09 | Prices on smeLab: each app RM49, RM39 for the first 15 buyers of that app; the second app RM29 for an owner of the other; combo RM75 (Mamu, 9 and 15 Oct). Worked out by the server from what the account owns. | Same prices as before, no codes to type. |
| A-10 | JualanLab signs in through smeLab: the email code comes from smeLab, and the same email links the existing JualanLab account. JualanLab's own Google sign-in and in-app buying are off; Plans links to smeLab. `PRELAUNCH` still keeps JualanLab closed to everyone but testers. | One account, one place to buy. |
| A-11 | ToyyibPay: smeLab has its own category `3x368dnb` (Mamu, 15 Oct; until then it used JualanLab's `d3wex7oj`). Set in `TOYYIB_CATEGORY`, `server/hub/worker/wrangler.toml`. | smeLab payments filed apart from the old JualanLab ones. |
| A-12 | **"Mula Percuma" on the sales page** (Mamu, 15 Oct): on the UntungLab card and at the end of its section, through UntungLab's click counter (`/mula`); on the JualanLab card and section from launch day only (`JUALANLAB_ON_SALE = "1"`), opening JualanLab's Free plan (10 items). | Visitors can try before buying. |
| A-13 | **Claim UntungLab by licence code** (Mamu, 15 Oct). On /akaun, an account without UntungLab can type a licence code; smeLab checks with UntungLab's licence server that it exists and is active, then adds UntungLab to the account (owner price for JualanLab follows). One account per code: a code already on another account is refused (mistakes go to admin@digitalsambal.space), and the email match (A-03) skips a code another account has claimed. 10 tries an hour per account. | Buyers who paid with a different email still get the owner price, without a manual step for Mamu. |
| A-14 | **Real-payment test price** (Mamu, 15 Oct): accounts in the `TESTER_EMAILS` secret can buy JualanLab alone for RM1 (`TEST_PRICE_SEN`), even before launch. Nobody else sees or gets it. Remove the secret (or the var) after testing. | Test FPX end to end for RM1 instead of RM75. |


## Diskaun & Promosi (15 Oct)

Mamu: "we need a dedicated section for discount … a campaign … for this whole month the whole batch of cake will be less 10% … at the counter it should automatically choose the discount on the campaign".

| # | Decision | Reason |
| --- | --- | --- |
| PR-01 | New section **Diskaun & Promosi** (Lagi → Diskaun & Promosi, `/diskaun`): promotions, and the three quick discount buttons at payment. A card on Utama lists the promotions running today. | One place to set discounts once instead of typing them per sale. |
| PR-02 | A promotion is either **a percentage off** all items, chosen categories or chosen items, or **a promo price** for each chosen item. Each has a name (shown on receipts), a start date, an optional end date and an on/off switch. Not in this round: buy X get Y, happy-hour times, days of the week, minimum spend. | Covers "whole batch of cake less 10%" and "Karipap RM0.80 this week"; the rest can follow if asked. |
| PR-03 | A category promotion covers items added to that category later. Categories are matched by name. | "The whole batch of cake" should include a new cake without editing the promotion. |
| PR-04 | Applied by the counter when an item is tapped, with the margin worked out from UntungLab's cost (I-01). The cashier can still change or remove it on one line; that line then no longer counts as the promotion's. A promo price that is not lower than the counter price gives no discount. | Automatic, but the seller stays in control. |
| PR-05 | Dates are Malaysian dates, both included, compared with the **business day's** opening date, not the clock. A stall open 31 Oct to 2 am keeps the 31 Oct promotion all night. | Consistent with T-07. |
| PR-06 | Promotions also apply in Bazaar Mode. Typed item discounts are still not offered there (I-06). | Automatic, so no extra taps. |
| PR-07 | Two promotions on one item: the customer gets the lower price; on a tie, the older promotion. One promotion per line; the order discount still applies on top. | Simple and fair to the customer. |
| PR-08 | Each sale line keeps the promotion's id and name. Receipts say "Promo Oktober: Diskaun 10% (asal RM5.00)"; Jualan shows units and ringgit given away per promotion; CSV gets a "Promosi" column. Deleting a promotion changes no sale. | Records never change after the fact (D-07). |
| PR-09 | Promotions live on the server, per shop (at most 50). They can only be changed online. Each phone keeps a copy, so the counter applies them offline; other phones pick up changes when opened, when brought back to the front, or within 5 minutes. | Same shop, same promotions on every phone. |
| PR-10 | The quick discount buttons at payment are the shop's own three percentages (5, 10, 15 until changed). Promotions are on both plans, Free and POS penuh, unless Mamu decides otherwise. | Mamu: typing the same discount every time is inconvenient. |

## Kedai: the online store (15 Oct)

Plan: "JualanLab Kedai: online store plan" (https://claude.ai/code/artifact/110b8484-3529-4061-9c39-967302ab664e). Mamu agreed all nine recommendations (15 Oct, 20:23).

| # | Decision | Reason |
| --- | --- | --- |
| K-01 | **Kedai launches with the POS in early November** (supersedes the V1.1 timing in T-03 for the store); Kedai Plus follows about two weeks later. | Ahead of schedule (Mamu). |
| K-02 | Design round first: three directions as clickable mockups (store page, item sheet, checkout, status page, order inbox); Mamu picks one, then the build. | The storefront's look matters most (Mamu). |
| K-03 | Store address `kedai.untunglab.space/<nama-kedai>`, moving to smelab.my later with redirects. A separate origin from the seller app. | Customers never touch the seller's sign-in. |
| K-04 | Pre-order batches and Prep List in the launch (from V1.1, T-04); the first large feature to move if late. | Most home bakers sell by pre-order. |
| K-05 | Plan split: Free = store with 10 items, colour and logo; POS penuh = all items, full customisation, pre-orders; Kedai Plus = gateway payments, proof upload, footer can be hidden. | Upgrade path without new prices. |
| K-06 | "Dibuat dengan JualanLab" footer on Free and POS stores, linking to smeLab. | Every store brings sellers. |
| K-07 | Delivery: flat fee or up to 5 areas with their own fee; no couriers. | Simple for home sellers. |
| K-08 | Online prices = counter prices; promotions apply to both. | One price list from UntungLab. |
| K-09 | Pay at pickup off by default; the seller can turn it on. | Fewer no-shows. |
| K-10 | **Kedai Plus gateways: Billplz first, then CHIP**, on the seller's own account; not ToyyibPay (Mamu's market survey). | What sellers prefer. |
| K-11 | smeLab's own checkout stays on ToyyibPay for now and moves to Billplz within about a month (Mamu). | Working today; migrate calmly. |
| K-12 | **Storefront look: direction B, "Warung Moden"** (Mamu, 15 Oct): bold brand-colour header block, chunky rounded cards, promo stickers, dark pill cart bar; Bricolage Grotesque headings with Figtree body. Mockups: "Kedai storefront: three directions" (https://claude.ai/artifact/EGrmaa7AUXddXb4uF3jETZ). | Mamu's pick. |

## Laporan and Penghantaran mockups: Mamu's notes (16 Oct 2026, not started)

- L-01: Laporan headline card: Untung (profit) is the main figure, biggest type; Jualan (sales) beside it, slightly smaller.
- L-02: Keep the Waktu sibuk (busy hours) grid as drawn.
- D-01: Delivery settings: drop "Percuma hantar atas RMxx" (free delivery threshold) to avoid confusion.

## Affiliate program: Mamu's decisions (17 Oct 2026, not started)

- AF-01: Affiliate model only (affiliate shares link or code; seller fulfils; affiliate earns commission). No dropship or agent pricing.
- AF-02: Commission only on online (Kedai) orders, not counter sales.
- AF-03: Part of Kedai Plus.
- AF-04: Cross-store "Cari affiliate" marketplace is part of the long-term vision (Mamu agreed 17 Oct). Built later, once there are enough active stores (about 30–50). From v1, an affiliate is one smeLab account that can join many stores.

## Ordering modes (Mamu, 17 Oct 2026)

- OM-01: Three ways to take store orders, chosen per store: A Biasa (default for new stores), B opening hours with automatic pre-order, C batch pre-order.
- OM-02: B: orders inside opening hours are for today; orders outside are pre-orders for the next opening day only (further ahead = use batches). Normal menu and the item's own stock.
- OM-03: B: holidays (Cuti) are skipped when finding the next opening day.
- OM-04: B: 30 minutes before closing, the seller is asked (banner and phone notification) to check stock for the next day: keep all or edit. Ignoring it keeps current stock.
- OM-05: C: each batch has its own menu (default: all items) and its own stock (default: no limit); optional "also take orders for today" with a last order time.
- OM-06: One order is for one day. The store page says so above the menu (day banner or day tabs), not at checkout; the cart follows the chosen day.
