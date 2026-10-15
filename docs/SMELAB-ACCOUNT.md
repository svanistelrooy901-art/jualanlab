# smeLab account and sales page

Design for one account across all smeLab apps and one sales page for the suite. Decided by Mamu on 15 Oct 2026
(DECISIONS A-01 to A-04); details below are mine unless marked.

## What Mamu decided (15 Oct)

| # | Decision |
| --- | --- |
| A-01 | **One smeLab account** for every smeLab app: sign in once, every app opens signed in; purchases sit on that account. |
| A-02 | Domain: **smelab.my**, which Mamu will register. Until then the account service and sales page run on `smelab.untunglab.space`. |
| A-03 | **Existing UntungLab buyers keep their licence codes.** Signing in is optional; an account with the same email picks up their licence. |
| A-04 | **Built before the JualanLab launch** (early November 2026). The combo is sold now as early access; JualanLab alone from launch day (A-07). |

## Shape

```
                    smeLab (account service + sales page)        one Worker "smelab", D1 "smelab"
                    smelab.untunglab.space  →  smelab.my later
                      /            sales page: 4 apps, prices, buy
                      /masuk       sign in (email code or Google), then back to the app
                      /akaun       my apps, purchases, UntungLab licence code
                      /beli        checkout (ToyyibPay)
                         │
     service binding (private, no secrets): redeem(code), entitlements(account)
                         │
        ┌────────────────┴──────────────────┐
   JualanLab Worker                    UntungLab licence Worker (beli.untunglab.space)
   jualan.untunglab.space              activates a device from the account's licence (UntungLab update)
```

- **Sign-in happens only at smeLab.** An app sends the person to `/masuk?app=…&redirect_uri=…&state=…`. Signed in
  already: one tap ("Teruskan sebagai …"). Otherwise: email code or Google, as JualanLab has today. smeLab then sends
  them back with a one-time code (2 minutes, single use, bound to that app and address). The app's server turns the
  code into the account through the service binding and starts its own session. Works across domains, so UntungLab can
  stay on untunglab.space (its recipes live on each phone under that address; moving it would strand them).
- **Entitlements** (what an account owns): `untunglab`, `jualanlab` (POS penuh). Sources: purchase, complimentary
  (COMP_EMAILS), or an existing UntungLab licence found by email.
- **Apps keep their own data.** JualanLab keeps shops and sales; UntungLab keeps everything on the phone. smeLab holds
  only the account, sessions, entitlements, orders and the notify-me list.

## Buying (à la carte or combo)

| Offer | Price | When |
| --- | --- | --- |
| UntungLab | RM49 (RM39 early bird) | account owns neither |
| JualanLab POS | RM49 (RM39 early bird) | account owns neither |
| Second app | RM29 | account owns the other one (no code to type any more) |
| UntungLab + JualanLab | RM75 | account owns neither |

Prices are Worker vars. Payment through ToyyibPay (same account). Paid is decided by asking ToyyibPay, never by the
callback alone (as both apps do today). An UntungLab purchase also gets a licence code from the UntungLab licence
server (its admin API), emailed as today, so the current UntungLab app works with it unchanged.

PromoLab and KiraLab show as "In development" with a notify-me email form; no prices.

## Order of work

1. smeLab core: accounts, sign-in, one-time codes, entitlements (tests on SQLite, like JualanLab).
2. Checkout: offers, orders, ToyyibPay, receipts, UntungLab licence issue.
3. Pages: sales page, sign-in, account, privacy and terms (moved here, covering every app).
4. JualanLab: sign in through smeLab, plan from entitlements, Plans page buys at smeLab. Its own email-code and
   checkout code is removed (no real orders exist yet).
5. Deploy: D1 `smelab`, custom domain, CI deploys smeLab before JualanLab (the binding needs it).
6. UntungLab update (pull request, Mamu merges): Beli buttons go to the smeLab page; licence screen gets
   "Log masuk dengan akaun smeLab" next to the code box.
7. When smelab.my is registered: add it as the Worker's domain; old addresses redirect.

## Code layout

The account service lives in this repo (`server/hub`) so it shares the sign-in, email, ToyyibPay and test code with
JualanLab and uses the secrets already set here. It can move to its own repo later without changes to the design.
