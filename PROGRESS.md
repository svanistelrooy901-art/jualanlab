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
| 8 Plans and licensing | Built and tested; ToyyibPay connected 15 Oct. Needs one real FPX purchase test before launch. |
| 9 QA and launch | Next: phone checklist, privacy policy and terms, sales page. |

Tests: 179 passing. Typecheck and production build clean. Worker bundle checked with `wrangler deploy --dry-run` and run locally in Cloudflare's runtime.

## Log

### Thu 15 Oct 2026
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
- Not yet checked on Mamu's phone: a real UntungLab list sent into JualanLab and sold at the counter (item 1 below).

## Needs Mamu

1. **Phone check (10 min):** open JualanLab → Lagi should say "Pelan: POS penuh". Then UntungLab → Hantar ke JualanLab → Buka di JualanLab → Terima → Kaunter → make one sale → Jualan.
2. **Real purchase test (when you have 15 min):** add GitHub secret `TESTER_EMAILS` = a second email you own that is not in COMP_EMAILS, tell me, then sign in with it and buy POS penuh by FPX (RM49, or RM29 with an unused UntungLab code). The money lands in your own ToyyibPay account, less ToyyibPay's fee.
3. Optional: **Google sign-in client ID** (Google Cloud → Credentials → OAuth client, Web, origin `https://jualan.untunglab.space`). Email sign-in works without it.
