-- Kedai: the shop's logo and a cover photo for the store header (Mamu's test, 15 Oct), kept like the QR until photo
-- storage arrives. store_assets has no child tables, so it is rebuilt to widen the kind check.
CREATE TABLE store_assets_new (
  shop_id     TEXT NOT NULL REFERENCES shops (id),
  kind        TEXT NOT NULL CHECK (kind IN ('qr', 'logo', 'cover')),
  mime        TEXT NOT NULL,
  data        TEXT NOT NULL,              -- base64; at most about 300 KB (qr, logo) or 450 KB (cover)
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (shop_id, kind)
);
INSERT INTO store_assets_new (shop_id, kind, mime, data, updated_at) SELECT shop_id, kind, mime, data, updated_at FROM store_assets;
DROP TABLE store_assets;
ALTER TABLE store_assets_new RENAME TO store_assets;
