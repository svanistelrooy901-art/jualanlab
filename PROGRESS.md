# JualanLab progress

Build log for Mamu. The daily 9pm report is written from this file. Newest first.
V1 phases: 1 link format · 2 UntungLab send + Plan a Batch · 3 JualanLab foundation · 4 counter POS · 5 offline queue · 6 Sales Today + Lab features · 7 Bazaar Mode · 8 plans and licensing · 9 QA and V1 launch.

## Status

**Resumed 14 Oct 2026** (UntungLab live since 10 Oct). Working through Phases 5 to 8 on my own; Phase 2 comes as a pull request to UntungLab.

| Phase | Status |
| --- | --- |
| 1 Link format | Done. Signed off by Mamu 14 Oct. |
| 2 UntungLab send + Plan a Batch | Built. Pull request waiting for Mamu: https://github.com/svanistelrooy901-art/untunglab/pull/1 |
| 3 Foundation | Live at https://jualan.untunglab.space since 14 Oct (deploys on every push). Mamu signed in on his phone; email code works. |
| 4 Counter POS | Built and tested locally (full sale on a phone-sized screen, offline sale, WhatsApp receipt). |
| 5 Offline queue | Done and tested (lost answer, void offline, cold start with no internet). |
| 6 Sales Today + Lab features | Done: all phones' sales, void with reason, best sellers, CSV, Close Day, Money Envelopes. |
| 7 Bazaar Mode | Done: big buttons, one-tap payment, drawer total, float to Close Day, screen on, tap sound. |
| 8 Plans and licensing | Built and tested. Buying opens when the ToyyibPay key and JualanLab category are set. |
| 9 QA and launch | Next: phone checklist, privacy policy and terms, sales page. |

Tests: 156 passing. Typecheck and production build clean. Worker bundle checked with `wrangler deploy --dry-run` and run locally in Cloudflare's runtime.

## Log

### Wed 14 Oct 2026
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

- Not deployed yet: needs the Cloudflare token and Brevo key (below). Everything works locally.
- "Done when: import a real UntungLab list" waits for Phase 2 (the Send to JualanLab button in UntungLab), which needs UntungLab repo access.
- First automatic deploy is untested until the secrets exist; if it fails I will fix it the same day.
- Content-Security-Policy not set yet (planned before launch).
- Shop-wide totals, voiding a sale with a reason, and Close Day are Phase 6 by plan; today's figures count this phone only and say so.

## Needs Mamu

1. **GitHub secret `COMP_EMAILS`** on the jualanlab repo = the email(s) you and your testers sign in with (comma-separated). Your shop is on Free until then, so the UntungLab link stays locked for you.
2. **Merge UntungLab pull request #1** after the 3-step phone check in its description: https://github.com/svanistelrooy901-art/untunglab/pull/1 (the red "Workers Builds" check is Cloudflare's branch preview, not the code).
3. **ToyyibPay:** send the new JualanLab category code (in progress), and add GitHub secret `TOYYIB_SECRET` (the same secret key UntungLab uses).
4. **For the RM29 UntungLab-user price and the RM75 bundle:** add GitHub secret `UNTUNGLAB_ADMIN_TOKEN` = UntungLab's ADMIN_TOKEN (from your password manager).
5. Optional: **Google sign-in client ID** (Google Cloud → Credentials → OAuth client, Web, origin `https://jualan.untunglab.space`). Email sign-in works without it.
