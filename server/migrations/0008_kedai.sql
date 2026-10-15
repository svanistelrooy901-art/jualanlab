-- Kedai, the online store (DECISIONS K-01 to K-12).

-- One store per shop: its address and settings (checked by validateSettings before they are stored).
CREATE TABLE stores (
  shop_id     TEXT PRIMARY KEY REFERENCES shops (id),
  slug        TEXT NOT NULL UNIQUE,
  settings    TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- What a seller sets per item for the store: description, shown online or counter only, badge, featured.
CREATE TABLE item_store (
  item_id     TEXT PRIMARY KEY REFERENCES items (id),
  shop_id     TEXT NOT NULL REFERENCES shops (id),
  settings    TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX item_store_shop ON item_store (shop_id);

-- Orders from the store (the table "orders" holds the old in-app POS purchases, Phase 8). The id is long and random: it is the customer's link to their order page.
CREATE TABLE store_orders (
  id              TEXT PRIMARY KEY,
  shop_id         TEXT NOT NULL REFERENCES shops (id),
  seq             INTEGER NOT NULL,
  number          TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  fulfilment      TEXT NOT NULL CHECK (fulfilment IN ('pickup', 'delivery')),
  area            TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',
  note            TEXT NOT NULL DEFAULT '',
  pay             TEXT NOT NULL CHECK (pay IN ('qr', 'at_pickup')),
  subtotal_sen    INTEGER NOT NULL,
  delivery_sen    INTEGER NOT NULL,
  total_sen       INTEGER NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('awaiting_payment', 'confirmed', 'preparing', 'ready', 'done', 'cancelled')),
  expires_at      TEXT,                   -- unpaid QR orders cancel themselves after this
  paid_at         TEXT,
  cancel_reason   TEXT,
  sale_id         TEXT,                   -- the sale this order became once paid (counts in Jualan and Close Day)
  updated_at      TEXT NOT NULL,
  UNIQUE (shop_id, seq)
);
CREATE INDEX store_orders_shop_status ON store_orders (shop_id, status, created_at);

CREATE TABLE store_order_lines (
  order_id        TEXT NOT NULL REFERENCES store_orders (id),
  line_no         INTEGER NOT NULL,
  item_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  unit_price_sen  INTEGER NOT NULL,
  quantity        INTEGER NOT NULL,
  margin_pct      REAL,
  note            TEXT NOT NULL DEFAULT '',
  unit_cost_sen   REAL,
  list_price_sen  INTEGER,
  discount_pct    REAL,
  promo_id        TEXT,
  promo_name      TEXT,
  PRIMARY KEY (order_id, line_no)
);

-- Online sales: the sales table gains the channel 'online' (a CHECK cannot be changed in place, so the table is
-- rebuilt with the same columns and indexes). sale_lines is rebuilt with it and dropped first: dropping a parent
-- table that child rows still point at fails the foreign key check, even deferred (seen on D1, 15 Oct).
CREATE TABLE sales_new (
  id                 TEXT PRIMARY KEY,
  shop_id            TEXT NOT NULL REFERENCES shops (id),
  number             TEXT NOT NULL,
  device_id          TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  channel            TEXT NOT NULL CHECK (channel IN ('counter', 'bazaar', 'online')),
  subtotal_sen       INTEGER NOT NULL,
  discount_sen       INTEGER NOT NULL,
  total_sen          INTEGER NOT NULL,
  method             TEXT NOT NULL CHECK (method IN ('cash', 'qr', 'ewallet')),
  cash_received_sen  INTEGER,
  change_sen         INTEGER,
  status             TEXT NOT NULL CHECK (status IN ('done', 'void')),
  void_reason        TEXT,
  voided_at          TEXT,
  received_at        TEXT NOT NULL,
  day_id             TEXT
);
INSERT INTO sales_new (id, shop_id, number, device_id, created_at, channel, subtotal_sen, discount_sen, total_sen, method, cash_received_sen, change_sen, status, void_reason, voided_at, received_at, day_id)
SELECT id, shop_id, number, device_id, created_at, channel, subtotal_sen, discount_sen, total_sen, method, cash_received_sen, change_sen, status, void_reason, voided_at, received_at, day_id FROM sales;
CREATE TABLE sale_lines_new (
  sale_id         TEXT NOT NULL REFERENCES sales_new (id),   -- becomes "sales" when sales_new is renamed below
  line_no         INTEGER NOT NULL,
  item_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  unit_price_sen  INTEGER NOT NULL,
  quantity        INTEGER NOT NULL,
  margin_pct      REAL,
  note            TEXT NOT NULL DEFAULT '',
  unit_cost_sen   REAL,
  list_price_sen  INTEGER,
  discount_pct    REAL,
  promo_id        TEXT,
  promo_name      TEXT,
  PRIMARY KEY (sale_id, line_no)
);
INSERT INTO sale_lines_new (sale_id, line_no, item_id, name, unit_price_sen, quantity, margin_pct, note, unit_cost_sen, list_price_sen, discount_pct, promo_id, promo_name)
SELECT sale_id, line_no, item_id, name, unit_price_sen, quantity, margin_pct, note, unit_cost_sen, list_price_sen, discount_pct, promo_id, promo_name FROM sale_lines;
DROP TABLE sale_lines;
DROP TABLE sales;
ALTER TABLE sales_new RENAME TO sales;
ALTER TABLE sale_lines_new RENAME TO sale_lines;
CREATE INDEX sales_shop_time ON sales (shop_id, created_at);
CREATE INDEX sales_shop_day ON sales (shop_id, day_id);

-- Small images the store needs before photo storage arrives: the shop's DuitNow QR (moved off the phone, T-05).
CREATE TABLE store_assets (
  shop_id     TEXT NOT NULL REFERENCES shops (id),
  kind        TEXT NOT NULL CHECK (kind IN ('qr')),
  mime        TEXT NOT NULL,
  data        TEXT NOT NULL,              -- base64, at most about 300 KB
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (shop_id, kind)
);
