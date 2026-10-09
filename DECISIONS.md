# JualanLab decisions log

Every choice the plan does not settle, or that changes it, is recorded here. Product decisions locked on 9 Oct 2026 are summarised in `JUALANLABDEV-NOTES.md`; the full reasoning is in the JualanLab V1 scope doc.

## Timeline (Mamu, 9 Oct 2026)

| # | Decision |
| --- | --- |
| T-01 | UntungLab launch: Sunday 11 Oct 2026 (estimate). JualanLab launch target: 3 to 5 weeks after, about 1 to 15 Nov 2026. POS and online store launch together. |
| T-02 | Backend work waits until UntungLab is live. Phase 1 (link format) goes ahead now because it touches neither app's code. |
| T-03 | **Supersedes the "launch together" part of T-01.** V1 = counter POS (sign-in, price list import, counter, offline queue, Sales Today, Close Day, plans and licensing), launch target unchanged (about 1 to 15 Nov 2026). V1.1 = online store and Kedai Plus (store page, checkout, order inbox, seller ToyyibPay/Billplz, RM19.90/RM199 subscription), released after V1. Prices are unchanged; Kedai Plus is sold from V1.1. |

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
