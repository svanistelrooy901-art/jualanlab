# JualanLab progress

Build log for Mamu. The daily 9pm report is written from this file. Newest first.
V1 phases: 1 link format · 2 UntungLab send + Plan a Batch · 3 JualanLab foundation · 4 counter POS · 5 offline queue · 6 Sales Today + Lab features · 7 Bazaar Mode · 8 plans and licensing · 9 QA and V1 launch.

## Status

| Phase | Status |
| --- | --- |
| 1 Link format | Built and tested. Waiting for Mamu's sign-off. |
| 2 UntungLab send + Plan a Batch | Not started. Needs push access to the UntungLab repo. |
| 3 Foundation | Built and tested locally. Not deployed yet (needs the keys below). |
| 4 Counter POS | Built and tested locally (full sale on a phone-sized screen, offline sale, WhatsApp receipt). |
| 5 Offline queue | Basic version already inside Phase 4. Hardening next. |
| 6 to 9 | Not started. |

Tests: 128 passing. Typecheck and production build clean. Worker bundle checked with `wrangler deploy --dry-run` and run locally in Cloudflare's runtime.

## Log

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

1. **Sign off Phase 1 (link format)**: reply "Phase 1 OK", or tell me what to change.
2. **UntungLab repo push access** for Claude (GitHub → untunglab → Settings → Collaborators, or the Claude GitHub app with write access). Unblocks Phase 2.
3. **Brevo**: verify sender `jualanlab@digitalsambal.space` (Brevo → Senders), create an API key.
4. **GitHub secrets** on the jualanlab repo (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers" + D1 Edit), `CLOUDFLARE_ACCOUNT_ID`, `BREVO_API_KEY`, `CODE_PEPPER` (any long random text). After this, every push deploys to jualan.untunglab.space by itself.
5. **Confirm** `untunglab.space` is on the same Cloudflare account (the UntungLab worker is, so probably yes).
6. **Decide (V1.1 online store):** manual DuitNow QR checkout ("I have paid, send proof") on every store plan, with the payment gateway kept for Kedai Plus (recommended), or manual QR on Kedai Plus only. Proposed in chat on 10 Oct.
7. Optional: **Google sign-in client ID** (Google Cloud → Credentials → OAuth client, Web, origin `https://jualan.untunglab.space`). Email sign-in works without it.
