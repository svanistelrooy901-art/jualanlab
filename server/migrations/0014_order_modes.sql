-- Ordering modes (OM-01 to OM-06, 17 Oct 2026).
-- A batch's menu and stock: a row = the item is on that batch's menu; stock NULL = no limit. No rows = every item.
CREATE TABLE batch_items (
  shop_id   TEXT NOT NULL REFERENCES shops (id),
  batch_id  TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  stock     INTEGER,
  PRIMARY KEY (shop_id, batch_id, item_id)
);
-- Reminders already sent (the stock check before closing, OM-04): one per shop, kind and Malaysian date.
CREATE TABLE reminders (
  shop_id  TEXT NOT NULL REFERENCES shops (id),
  kind     TEXT NOT NULL,
  day      TEXT NOT NULL,
  at       TEXT NOT NULL,
  PRIMARY KEY (shop_id, kind, day)
);
