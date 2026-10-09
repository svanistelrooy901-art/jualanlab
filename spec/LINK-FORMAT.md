# UntungLab ⇄ JualanLab link format, version 1

Status: **draft for Mamu's approval** (Phase 1). Date: 9 Oct 2026.

Two hand-offs connect the apps. Each one starts with a tap. There is no background sync.

| Hand-off | From → To | Carries | Opens |
| --- | --- | --- | --- |
| Price list | UntungLab → JualanLab | Name, category, price, margin, status, base menu of every active menu | `https://jualan.untunglab.space/terima#d=…` |
| Batch list | JualanLab → UntungLab | Menu id, quantity and date of one batch | `https://untunglab.space/#/rancang-batch?d=…` |

UntungLab keeps no account and no server. Recipes, ingredient costs and Price History never leave UntungLab. Actual sales, customers and payments never leave JualanLab.

The reference code is `src/link/` in this repo. UntungLab copies the same folder in Phase 2. The test fixtures in `spec/fixtures/` are the contract: both apps must pass them.

---

## 1. Envelope (both directions)

```
payload = "1." + base64url( deflateRaw( utf8( JSON ) ) )
```

- `1.` is the **encoding scheme**: raw DEFLATE (RFC 1951), then base64url without padding (RFC 4648 §5). A different scheme gets a different prefix. The JSON's own `format` number is versioned separately.
- The payload goes in the URL **fragment** (after `#`), in a `d=` parameter. Browsers do not send the fragment to any server, so the data stays between the two apps on the phone.
- Limits: payload at most **200,000 characters**; decoded JSON at most **1,000,000 bytes**. The decoder stops inflating as soon as the limit is passed, so a crafted link cannot fill the phone's memory.
- A sender always validates its own list before encoding, and refuses to send an invalid one.

### Finding the payload

A receiver accepts any of these and takes the `d=` value:

- a full link: `https://jualan.untunglab.space/terima#d=1.xxxx`
- a fragment: `#d=1.xxxx` or `#/rancang-batch?d=1.xxxx`
- the payload on its own: `1.xxxx`

No `d=` means `not_a_link`.

### QR and file fallback

- The sender offers a **QR code** only when the full link is at most **1,600 characters**. That's about QR version 29 at error level L, shown full screen. Measured: about **22 menus** with real UUID ids fit, which covers a typical home business. Confirm with a real-phone scan in Phase 2.
- Larger price lists use the **file fallback**: `untunglab-harga-YYYY-MM-DD.json`, holding the same JSON in plain text. JualanLab's import screen accepts the file and applies the same rules. The link itself still works on the same phone at any size up to the limits.
- Batch lists are small, so they need no file fallback.

---

## 2. Price list (UntungLab → JualanLab)

```json
{
  "app": "untunglab",
  "kind": "price-list",
  "format": 1,
  "sentAt": "2026-10-09T20:42:00+08:00",
  "currency": "MYR",
  "menus": [
    { "id": "m-karipap-01", "name": "Karipap", "category": "Kuih",
      "priceSen": 100, "marginPct": 31.2, "status": "watch", "baseMenuId": null }
  ]
}
```

| Field | Type | Rule |
| --- | --- | --- |
| `app` | `"untunglab"` | Anything else: `wrong_app` |
| `kind` | `"price-list"` | Anything else: `wrong_kind` |
| `format` | integer | `1`. Higher: `newer_format` (the receiver asks the user to update the app). Below 1: `invalid` |
| `sentAt` | string | ISO 8601 date-time **with** a time zone |
| `currency` | `"MYR"` | Only value in v1 |
| `menus` | array | 1 to 500 menus. Every **active** menu, variations included. Archived menus are left out |
| `menus[].id` | string | UntungLab menu id; 1–64 characters of `A-Z a-z 0-9 _ -`; unique in the list. The matching key on both sides |
| `menus[].name` | string | The recipe name; trimmed, inner spaces collapsed; 1–120 characters; no control characters |
| `menus[].category` | string or null | 1–60 characters; blank becomes `null` |
| `menus[].priceSen` | integer | Selling price per unit in sen, 0 to 10,000,000. The sender converts with `ringgitToSen` |
| `menus[].marginPct` | number or null | UntungLab's margin rounded to 2 decimals (`roundMargin`); at most 100; may be negative (a loss). **`null` when UntungLab reports the menu incomplete. Never guessed, never 0 for "unknown"** |
| `menus[].status` | `loss` `low` `watch` `healthy` or null | UntungLab's band, sent as is. `null` exactly when `marginPct` is `null` |
| `menus[].baseMenuId` | string or null | Set only on a variation: the base menu's id. A menu cannot be its own base, and a variation cannot be the base of another variation |

Extra rules:

- `priceSen` 0 (a draft menu with no price) must have `marginPct: null`.
- A variation whose base is **not** in the list (for example the base was archived) is accepted with the warning `base_missing`. JualanLab shows it as a standalone menu.
- Unknown fields are ignored, so a sender can add optional fields inside format 1 without breaking older receivers. Removing or changing the meaning of a field needs format 2.

### What JualanLab does with it (Phase 3)

1. Matches menus by `id`, never by name.
2. Shows a preview with three groups: **new**, **changed** (any field differs) and **same**. Nothing is saved until the user taps Accept.
3. A menu JualanLab already has that is **missing** from the new list is marked inactive, never deleted, because past sales refer to it.
4. A price typed by hand in JualanLab is kept, but flagged "different from UntungLab", and its margin shows "—". Profit is never estimated from a price UntungLab did not send.
5. JualanLab never calculates cost. "Estimated profit" is quantity × price × `marginPct`, only for menus whose margin is not `null`.
6. Shows "Prices from UntungLab, updated <sentAt>".

---

## 3. Batch list (JualanLab → UntungLab)

```json
{
  "app": "jualanlab",
  "kind": "batch-list",
  "format": 1,
  "sentAt": "2026-10-17T21:05:00+08:00",
  "batchDate": "2026-10-18",
  "items": [ { "menuId": "m-karipap-01", "name": "Karipap", "quantity": 50 } ],
  "notInUntungLab": [ { "name": "Air botol", "quantity": 10 } ]
}
```

| Field | Type | Rule |
| --- | --- | --- |
| `app` / `kind` / `format` | | `"jualanlab"`, `"batch-list"`, `1`; same errors as the price list |
| `sentAt` | string | ISO 8601 date-time with a time zone |
| `batchDate` | string | `YYYY-MM-DD`, a real calendar date (pickup or delivery day) |
| `items` | array | 0 to 500 items whose menu came from UntungLab |
| `items[].menuId` | string | The UntungLab id received in a price list; unique in the list |
| `items[].name` | string | JualanLab's name for it, 1–120 characters; used only to label an item UntungLab cannot find |
| `items[].quantity` | integer | Pieces ordered, 1 to 100,000 |
| `notInUntungLab` | array | Optional; 0 to 500 items that exist only in JualanLab, with `name` and `quantity` |

`items` and `notInUntungLab` together must hold at least one entry.

### What UntungLab does with it (Phase 2)

1. Opens Plan a Batch for `batchDate` with the quantities filled in. The user can still change them.
2. Builds the shopping list and estimated ingredient cost from its own recipes and prices.
3. An `items` entry whose `menuId` is not in UntungLab (deleted or archived) and every `notInUntungLab` entry are listed by name as "not in UntungLab" and are not calculated. Nothing is guessed.
4. Plan a Batch is a planning view. It changes no cost, no menu and no Price History, and saves nothing unless the user taps Save.

---

## 4. Errors

Every failure returns one code. Field failures also name the JSON path, for example `menus[2].priceSen`.

| Code | Meaning | What the user sees |
| --- | --- | --- |
| `not_a_link` | No `d=` found | "This link has no data. Send it again from the other app." |
| `bad_encoding` | Unknown scheme, damaged base64url or damaged DEFLATE data | "The link is damaged or cut off. Send it again." |
| `too_large` | Over the size limits | "This list is too big for a link. Use the file instead." |
| `bad_json` | Not JSON after decoding | as `bad_encoding` |
| `wrong_app` | Payload from the wrong app | "This link is for UntungLab / JualanLab, not this app." |
| `wrong_kind` | Right app, other kind of data | "This is not a price list / batch list." |
| `newer_format` | `format` is higher than this app knows | "Update this app to open this link." |
| `invalid` | A field breaks a rule above | "Something in the list is not right" plus the field, so support can fix it |

App, kind and format are checked first, so a link from the wrong app or a newer version gets a clear message, not a field error.

---

## 5. Contract tests

`spec/fixtures/` holds:

| File | Purpose |
| --- | --- |
| `price-list.valid.json` | 7 menus: a variation, an incomplete menu (margin `null`), a loss, a menu with no category |
| `price-list.base-missing.json` | A variation without its base: accepted with `base_missing` |
| `batch-list.valid.json` | A batch with three UntungLab items and one JualanLab-only item |
| `invalid-cases.json` | 34 broken payloads, one per rule, each with the expected `code` and `path` |
| `*.link.txt` | The valid payloads as real links, to prove one app's encoder works with the other's decoder |

`npx tsx scripts/gen-fixtures.ts` regenerates the derived files from the two valid ones. `npm test` runs the whole contract. UntungLab copies `src/link/` and `spec/fixtures/` and must pass the same tests before Phase 2 is signed off.
