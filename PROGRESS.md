# JualanLab progress

Build log for Mamu. The daily 9pm report is written from this file. Newest first.
V1 phases: 1 link format · 2 UntungLab send + Plan a Batch · 3 JualanLab foundation · 4 counter POS · 5 offline queue · 6 Sales Today + Lab features · 7 Bazaar Mode · 8 plans and licensing · 9 QA and V1 launch.

## Status

**Resumed 14 Oct 2026** (UntungLab live since 10 Oct). Working through Phases 5 to 8 on my own; Phase 2 comes as a pull request to UntungLab.

| Phase | Status |
| --- | --- |
| 1 Link format | Done. Signed off by Mamu 14 Oct. |
| 2 UntungLab send + Plan a Batch | Done. Merged and live on untunglab.space 15 Oct (with the one-time JualanLab note). |
| 3 Foundation | Live at https://jualan.untunglab.space since 14 Oct (deploys on every push). Mamu signed in on his phone; email code works. |
| 4 Counter POS | Built and tested locally (full sale on a phone-sized screen, offline sale, WhatsApp receipt). |
| 5 Offline queue | Done and tested (lost answer, void offline, cold start with no internet). |
| 6 Sales Today + Lab features | Done: all phones' sales, void with reason, best sellers, CSV, Close Day, Money Envelopes. |
| 7 Bazaar Mode | Done: big buttons, one-tap payment, drawer total, float to Close Day, screen on, tap sound. |
| 8 Plans and licensing | Done. Since 15 Oct buying happens on smeLab (one account for all smeLab apps); JualanLab reads the plan from it. Needs one real FPX purchase test before launch. |
| Kedai (online store) | First slice live at https://kedai.untunglab.space: store page (direction B), cart, checkout, order page, seller setup (Lagi → Kedai online) and Pesanan inbox. Paid orders become online sales. Next: photos, pre-order batches, QR poster, order alerts. |
| 9 QA and launch | In progress. Live: CSP, privacy and terms, smeLab sales page at https://smelab.untunglab.space (combo sold now as early access). Left: real FPX purchase, second-phone test, launch switches (early November). |

Tests: 249 passing. Typecheck and production build clean. Both Workers (`smelab`, `jualanlab`) checked with `wrangler deploy --dry-run`; CI deploys smeLab first, then JualanLab.

## Log

### Wed 21 Oct 2026
- **Storefront redesign live** (Mamu approved the mockup). White page, one typeface (Plus Jakarta Sans), the seller's colour only on actions. Home: compact header (logo, open/closed line, language, cart with count), search, one banner (cover photo, announcement or promo), day picker, category chips, two-column grid with square photos and a + on each, Habis/Baru/promo tags. Items without a photo get a calm plate tile instead of initials. Item opens as a full sheet with a sticky quantity and Tambah bar. Cart and checkout: thumbnails, pickup pre-selected, savings line, sticky "Hantar pesanan · RMxx". Order page: status timeline, DuitNow card, summary.
- **Order modes live** (OM-01 to OM-06). Kedai online → Cara terima pesanan: A Biasa (default), B Waktu buka + pra-tempah automatik (opening hours per day, holidays; outside hours an order is a pre-order for the next opening day, shown on the store as "Kedai tutup sekarang · Pesanan anda untuk Khamis 22 Okt"), C Batch (each batch has its own Menu & stok; optional "also today" with a last order time; day tabs on the store with "1 pesanan untuk 1 hari"). B: 30 minutes before closing, a banner and a phone notification open "Semak stok untuk esok" (Kekalkan semua or edit). A scheduled check runs every 10 minutes for this.

### Sat 17 Oct 2026
- **Pre-order batches and prep list live.** Kedai online → Pra-tempah: up to 6 batches (name, ready date, closing time, optional order limit). The store shows a PRA-TEMPAH card, checkout asks "Untuk bila?", full or closed batches are refused, and ordering stops when no batch is open. Pesanan filters by batch; Senarai sedia totals what to make per item with customer notes, prints, and sends the quantities to UntungLab's Plan a Batch.
- **QR poster live.** Kedai online → Poster QR kedai: one A4 page with the store's QR code, logo, colour and three steps; print or save as PDF.
- **Laporan live** (L-01, L-02). Lagi → Laporan, or the Laporan button on Jualan. Periods: today, 7 days, this month, last month, pick dates; each compared with the period before. Profit is the main figure, sales beside it; margin, transactions, average basket; daily (or weekly) chart; items ranked by profit with "Laris tapi untung tipis" and a pricing tip; counter/bazaar/online and payment splits; busy-hours grid; discounts and promotions; Save PDF and CSV for the period. Full plan only; Free sees a locked preview.
- Mamu tested new-order notifications on two devices (phone and PC, same shop): both got the notification. Counter sales from both devices showed on both: second-device test passed.

### Thu 15 Oct 2026
- **Stock per item live** (Mamu's request tonight). Kedai online → item → Kira stok, then − / number / +; change it any time. Store orders take stock as they are placed (the last piece can never be sold twice); cancelled and expired orders give it back. At 0 the item stays on the store, greyed, tagged Habis, and cannot be added. 5 or fewer shows "Tinggal N"; more shows "Stok N". Counter sales do not touch store stock yet.
- **New-order alerts live.** App open: within 15 seconds of an order, a two-note chime, a vibration and a banner ("Pesanan baru K-0003 · Aina · RM35.00 · Lihat"); works on every phone. App closed: phone notifications by web push, turned on per phone in Pesanan (Hidupkan notifikasi, then Hantar ujian). iPhones need JualanLab on the Home Screen first; the card explains. The push key is derived from an existing server secret, so nothing new to keep. Checked live: push key served, notification script deployed.
- Mamu tested a real Kedai order end to end on his phone (customer in the browser, seller in the app): order → payment → done, all smooth. A second phone is still to test.
- Mamu switched on R2. Bucket `jualanlab-photos` created; item photos now go there, and the 4 Mentega Butter photos saved earlier move over by themselves when first viewed (first one checked live). Store images are now kept in Cloudflare's cache near customers, so they load fast in Malaysia.
- **Kedai item photos live.** In Kedai online → Item di kedai, tap an item → Tambah gambar (saved at once, cropped square, shrunk on the phone). The store shows photos in the list, the featured card and the item sheet; items without one keep their initials. Photos sit in the database for now because R2 is not switched on for the Cloudflare account (Needs Mamu); moving them later touches one file.
- Mamu tested Kedai live (Mentega Butter) and asked for his own logo and a header photo. Done the same night: Lagi → Kedai online → Rupa kedai has Tambah logo and Tambah gambar muka depan with a live preview. The logo replaces the initials on the store and order pages; the cover photo sits behind the header with a dark fade so the name stays readable, and becomes the link-preview picture on WhatsApp. Photos are shrunk on the phone first.
- **Kedai first slice live** at https://kedai.untunglab.space (pushed tonight, CI green, database migrated with all 7 existing sales and their lines kept). A seller sets up the store from Lagi → Kedai online: address, open/closed, brand colour, tagline, announcement, pickup, delivery areas and fees, minimum order, pay at pickup, unpaid-order timeout, which items show online. Customers browse (promo prices and stickers, "Laris" from real sales), add notes per item, check out with pickup or delivery, pay by the shop's DuitNow QR and follow their order page. The seller works orders from the new Pesanan tab (badge count): payment received, preparing, ready, done, with a WhatsApp message ready for each step; paid orders count as online sales in Jualan and Close Day. The server prices every order itself; unpaid QR orders cancel themselves. Tested end to end in a browser at phone and desktop sizes.
- First deploy failed on the database step (D1 refused to drop the sales table while sale lines pointed at it). Fixed the migration the same evening; nothing was lost.
- Kedai design round done early: three directions mocked up (store, item, checkout, order page, seller inbox). Mamu picked B, Warung Moden (K-12). Build starts.
- Kedai (online store) planned and agreed by Mamu: launches with the POS in early November, Kedai Plus (Billplz, then CHIP) two weeks after. Design round starts 16 Oct. Decisions K-01 to K-11.
- RM1 test price for JualanLab on smeLab, for TESTER_EMAILS accounts only (A-14). Waiting for Mamu to add the tester email to the GitHub secret `TESTER_EMAILS`.
- smeLab /akaun: "Sudah beli UntungLab dengan emel lain?" box. Typing a licence code adds UntungLab to the account (checked live with UntungLab's licence server; one account per code), which unlocks the RM29 JualanLab owner price. Decision A-13.
- Sales page: "Mula Percuma" button on the UntungLab card (counted on UntungLab's dashboard) and, from launch day, on the JualanLab card. Decision A-12.
- UntungLab PR #2 merged on Mamu's go-ahead (15:33). All checks green on UntungLab main (tests, GitHub Pages, Cloudflare). beli.untunglab.space/beli now redirects to the smeLab sales page; the app's Buy button opens it after users tap Muat semula. UntungLab is sold in one place only.
- smeLab ToyyibPay category `3x368dnb` from Mamu set; smeLab payments are now filed under it. The real purchase test (Needs Mamu) confirms it end to end.
- **Diskaun & Promosi** (Mamu's request this afternoon). Set a promotion once and the counter applies it by itself: a percentage off all items, some categories (new items in them included) or some items, or a promo price per item, between two dates (end optional), with an on/off switch. The editor previews every item covered with its new price and margin from UntungLab's cost, and warns about items that would sell below cost. Tiles show the promo price, the old price struck through and the promotion's name; it works in Bazaar Mode and offline; receipts, Jualan (units and ringgit per promotion) and CSV carry the promotion's name. The three quick discount buttons at payment are now the shop's own. Decisions PR-01 to PR-10.
- **smeLab is live at https://smelab.untunglab.space** (Mamu agreed the proposal; launch early November). One sales page for the four apps (UntungLab and JualanLab with details and prices, PromoLab and KiraLab "Dalam pembangunan" with a notify-me form), one smeLab account (email code), checkout by ToyyibPay, receipt email, and /akaun listing what you own with your UntungLab code. The combo (RM75) is on sale now as early access; JualanLab alone goes on sale at launch. Buyers get the UntungLab code at once; JualanLab's full POS waits on their account until launch. Database migrated, CI green. Decisions A-07 to A-11.
- UntungLab pull request #2 (D-99): beli.untunglab.space and the app's Buy button go to the smeLab sales page; licences, activation and /admin stay where they are. Tests pass; Cloudflare's branch-preview build fails as it did on PR #1 (main builds fine). Waiting for Mamu's go-ahead. smeLab's "try UntungLab free" link goes through beli.untunglab.space/mula so the dashboard keeps counting it.
- JualanLab now signs in through smeLab: same screen, the code email comes from smeLab, and an existing JualanLab account links by email on the next sign-in. Plans shows what the account owns and links to smeLab to buy. The pre-launch gate is unchanged.
- Mamu asked for one smeLab sales page (all 4 apps, 2 "in development", buy each app or the combo) and one login for every smeLab app. Proposal written as a doc ("smeLab sales page and one login: proposal") with the decisions needed.
- Phase 9 started: Content-Security-Policy and HSTS (checked the whole app under it: no violations), privacy notice and terms of use in BM and EN at /privasi and /terma (linked from sign-in and Lagi; drafts for Mamu to review), rate-limit records with IP addresses now kept 2 days at most.
- Mamu tested the full day flow on his phone: all good (second phone still to do). Item discounts added at his request: 5/10/15%, other %, or a special price, with margin and profit after the discount worked out from UntungLab's cost; shown on receipts, CSV and Sales ("Diskaun diberi"). Typed catalogue prices now show their real margin too. Decisions I-01 to I-06.
- Receipt picture (Mamu's request): "Kongsi gambar resit" on every receipt shares a PNG receipt to WhatsApp or the gallery (saves it where sharing files is not supported). Checked the picture with a long shop name, long item name, a note, a discount and cash with change. Decisions R-01, R-02.
- Business days (T-07, Mamu's request this morning): Buka Hari and Tutup Hari by hand, one open day for the whole shop, a day can run past midnight, nothing sold until a day is open, "Terlupa Tutup Hari?" after 20 hours, Buka semula for a day closed by mistake, opening works offline (two phones that opened offline are joined into one day). Jualan moves between business days. Bazar opens the day with its float. Checked on a phone-sized screen: open 9:30 pm, sell at 9:30 pm and 12:40 am, close, reopen. Decisions D-01 to D-09.
- Mamu's test: the counter could only add. Each tile in the cart now has a round minus button (takes one off; at zero the item leaves the cart). Checked on a phone-sized screen.
- `UNTUNGLAB_ADMIN_TOKEN` added by Mamu; redeployed: the RM29 UntungLab-user price (licence code checked live) and the RM75 bundle (UntungLab code issued automatically) are on.
- New optional secret `TESTER_EMAILS`: before launch, these emails may sign up but stay on Free, so a real FPX purchase can be tried end to end (COMP_EMAILS accounts already have the full POS and cannot buy).
- ToyyibPay category `d3wex7oj` set and `TOYYIB_SECRET` added by Mamu; redeployed: buying is open (only testers can sign in before launch). Real FPX purchase test goes on the launch checklist.
- COMP_EMAILS added by Mamu; redeployed (01:15). His shop moves to the full POS the next time he opens JualanLab.
- UntungLab PR #1 merged on Mamu's go-ahead (01:07). All checks green on main, including Cloudflare's Workers Build; GitHub Pages deploy done. UntungLab users get Hantar ke JualanLab, Rancang Batch and the one-time note after tapping Muat semula.

### Wed 14 Oct 2026
- Pre-launch gate (T-06): JualanLab accepts no new accounts until launch, except existing ones and COMP_EMAILS testers; sign-in page says "belum dilancarkan, awal November 2026". UntungLab pop-up button now opens Rancang Batch instead of JualanLab.
- UntungLab PR #1 now also has a one-time pop-up for every UntungLab user about JualanLab (D-98), with the note "JualanLab belum dilancarkan. Dijangka dilancarkan awal November 2026." (also on the Hantar ke JualanLab screen). Remove the note and announce the launch when JualanLab goes live.
- Evening: Mamu signed off Phase 1 and signed in on the live app (email code arrives). He is creating the JualanLab category in ToyyibPay.
- UntungLab PR #1: GitHub tests pass. Cloudflare's own "Workers Builds" check failed on the branch; the PR changes no server code and the licence server bundles fine, so it looks like Cloudflare's branch-preview build, not the code. Safe to merge.
- Resumed. Push access to UntungLab granted.
- Phase 5: storage kept by the browser, red banner after 24 h unsent, one tab sends at a time, voids queue offline like sales, refused sales can be retried, sign-in warns about unsent sales. Browser-tested a cold start with no internet from the installed app.
- Phase 6: Sales Today for every phone (any past day), void with reason from the receipt, payment-method totals, best sellers, CSV export, Close Day (float, cash counted, over/short), Money Envelopes (capital / profit / not split), close again when sales change after closing.
- Decisions O-01 to O-07, S-01 to S-07.
- Phase 7: Bazaar Mode (setup with float and up to 8 big buttons; selling screen with one-tap Exact / notes / QR, large change, today's bazaar takings and drawer; float offered to Close Day). Decisions B-01 to B-06.
- Deploy workflow now waits for all four secrets and names the missing ones.
- Phase 8: Free plan (10 active items, no UntungLab link; only adding is blocked), full POS bought once through ToyyibPay (RM49, early bird RM39 for 15, UntungLab users RM29 with a checked licence code, bundle RM75 with an UntungLab code issued automatically), payment confirmed by asking ToyyibPay, owner/tester accounts free via COMP_EMAILS, Plans page. Decisions L8-01 to L8-09.
- All four secrets added by Mamu; first deploy passed; database migrated. JualanLab is live at jualan.untunglab.space.
- Phase 2: UntungLab pull request #1 (Hantar ke JualanLab with link / QR / file; Rancang Batch with batches, shopping list, packs to buy). 693 UntungLab tests pass. Shared link folder made identical in both repos.

### Sat 10 Oct 2026
- Decided (T-05): manual DuitNow QR checkout on every store plan, gateway stays Kedai Plus. Recorded in the V1 scope doc, DEVNOTES and DECISIONS.md.
- Development paused by Mamu.

### Fri 9 Oct 2026
- Phase 3: sign-in by email code (Brevo) and Google; session cookie; shop setup; bilingual BM/EN app with update banner; app icon (flask + banknote) and black/neon look.
- Phase 3: receive the UntungLab price list from the link or a file, with a preview (new / changed / same / no longer listed) that is exactly what the server saves; catalogue with categories, variations, own items, inactive items, and own counter price (margin hidden when the price differs from UntungLab).
- Phase 4: counter grid by category with search and margin badges coloured by UntungLab status; cart with quantity, notes and RM discount; cash with change and quick-cash buttons, DuitNow QR (shop's QR image shown to the customer), e-wallet; receipt with WhatsApp share; Sales Today list and Profit Today card for this phone.
- Phase 4: every sale is saved on the phone first and sent to the server when online (retries on reconnect and every 30 s); the server re-adds every total and ignores duplicates.
- Cloudflare: created the D1 database `jualanlab` (APAC) on Mamu's account. Added automatic test + deploy from GitHub (deploys once the secrets below are set).
- Decisions F-01 to F-14 and P-01 to P-12 logged in DECISIONS.md.

## Issues

- No real FPX purchase yet: every payment path is tested against a fake ToyyibPay, not the real one. Needs one real purchase before launch (item 2 below).
- Not yet checked on Mamu's phone: a real UntungLab list sent into JualanLab and sold at the counter.

## Needs Mamu

1. **Look at the sales page** on your phone: https://smelab.untunglab.space (wording, prices, screenshots, the "Akses awal" note). Tell me anything to change.
2. **Real purchase test (15 min):** at smeLab, sign up with a second email you own (not in COMP_EMAILS) and buy the combo by FPX (RM75; the money lands in your ToyyibPay less its fee). Check: the receipt email, the UntungLab code in it works in UntungLab, and /akaun shows both apps. To also sign in to JualanLab with that email before launch, add it to the GitHub secret `TESTER_EMAILS`.
4. **smelab.my:** when registered, add it to Cloudflare (same account) and tell me; I move smeLab there and keep the old address redirecting.
5. Optional: a Brevo sender for smeLab (for example hello@smelab.my once the domain exists). Emails now come from jualanlab@digitalsambal.space under the name "smeLab".
6. Optional: **Google sign-in client ID**. Email sign-in works without it.

## 22 Oct 2026

- Waiting list page at jualan.untunglab.space/waitinglist (Mamu's request): name, email, type of business (Bakery, Packed food, Street food, Fashion and apparel, Hobbies, Others). BM first, EN with ?lang=en; works without JavaScript; hidden bot trap; same email again updates the row. Saved to D1 table `waitlist` (migration 0015). Owner accounts (COMP_EMAILS) download it at /api/admin/waitlist.csv while signed in.
- ST-01 live: a counter or bazaar sale lowers today's store stock (stops at 0, never blocks the counter); voiding it the same day puts back exactly what it took, once. Sales synced on a later day leave stock alone. Migration 0016 (`sales.stock_taken`).
- Spam check at checkout: Cloudflare Turnstile, off until the GitHub secrets TURNSTILE_SITE_KEY and TURNSTILE_SECRET are set (needs Mamu: create the widget in Cloudflare for kedai.untunglab.space). Rate limits per IP and phone stay as before.
- Store-customer privacy notice at kedai.untunglab.space/privasi (BM/EN), linked under the checkout button, the store footer and the order page. Customers' name, phone, address and note are removed from finished orders after 90 days (daily cron); spam-check hits after 2 days. Seller privacy notice updated (22 Oct) for Kedai orders, photos, QR and the waiting list. Slugs privasi/privacy/terma/terms reserved.
- Pesanan: "Tempah rider" on delivery orders: copies pickup, customer, address and the amount to collect, with Lalamove and Grab buttons.
- Home: store card with today's orders and total, orders needing action, Pesanan and Kongsi pautan (or a setup prompt when the store is not open).

## 23 Oct 2026

- 22–23 Oct night: untunglab.space went dark because Namecheap suspended it (contact details not verified within 15 days of registration; nameservers swapped to verify-contact-details/failed-whois-verification). Mamu verified; back on Cloudflare (dante/nancy) by 6 am. Turnstile confirmed live on checkout (invisible unless Cloudflare needs a click).
- New logos (Mamu's 3D renders): JualanLab home-screen icons (192, 512, maskable, Apple) and the JualanLab and UntungLab icons on smeLab; the waiting list uses the new icon. UntungLab's own icons on a branch for Mamu's go-ahead.
- Store page, mode auto outside opening hours: the pre-order notice now says when the store opens next and shows the week's opening hours.
- Free month (FT-01 to FT-07): every new shop gets the full version for 30 days (`TRIAL_DAYS`), then Free, which now has no online store (closed page with the seller's WhatsApp; placed orders keep working). Days-left note on Home, free-month card on Pelan, locked Kedai card on Free. Own items take a margin % when the owner has UntungLab; otherwise "Untung tak diketahui". Migration 0017. Terms updated. Sales page hero is now the free-month offer (waiting list until launch). Kedai Plus bonus for early buyers (FT-04) waits for Kedai Plus billing.
