-- Kedai item photos, one per item, shrunk on the phone (about 100 KB). Kept here until R2 is switched on for the
-- account; the store methods are the only code that knows where photos live, so moving them later is one change.
CREATE TABLE item_photos (
  item_id     TEXT PRIMARY KEY REFERENCES items (id),
  shop_id     TEXT NOT NULL REFERENCES shops (id),
  mime        TEXT NOT NULL,
  data        TEXT NOT NULL,              -- base64
  updated_at  TEXT NOT NULL
);
CREATE INDEX item_photos_shop ON item_photos (shop_id);
