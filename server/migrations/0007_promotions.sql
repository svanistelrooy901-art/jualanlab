-- Promotions (Diskaun & Promosi, 15 Oct): set once, applied by the counter by itself. The definition is kept as
-- JSON (checked by validatePromo before it is stored); sale lines keep the promotion's id and name at the time.
CREATE TABLE promos (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX promos_shop ON promos (shop_id, created_at);

ALTER TABLE sale_lines ADD COLUMN promo_id TEXT;
ALTER TABLE sale_lines ADD COLUMN promo_name TEXT;

-- The shop's three quick discount buttons at payment, as a JSON array of percentages; null = 5, 10, 15.
ALTER TABLE shops ADD COLUMN discount_presets TEXT;
