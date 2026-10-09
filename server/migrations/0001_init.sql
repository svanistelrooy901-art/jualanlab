-- JualanLab D1 schema, migration 1. Money is integer sen. Times are ISO 8601 UTC strings.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,      -- lower case, trimmed
  name        TEXT,
  google_sub  TEXT UNIQUE,
  created_at  TEXT NOT NULL
);

CREATE TABLE shops (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL UNIQUE REFERENCES users (id),   -- V1: one account, one shop
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,          -- SHA-256 of the cookie token; the token itself is never stored
  user_id     TEXT NOT NULL REFERENCES users (id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE login_codes (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,             -- SHA-256 of pepper, email and code
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  sent_at     TEXT NOT NULL
);

CREATE TABLE hits (                      -- rate limiting
  key         TEXT NOT NULL,
  at          TEXT NOT NULL
);
CREATE INDEX hits_key_at ON hits (key, at);

CREATE TABLE items (
  id               TEXT PRIMARY KEY,
  shop_id          TEXT NOT NULL REFERENCES shops (id),
  source           TEXT NOT NULL CHECK (source IN ('untunglab', 'own')),
  ul_menu_id       TEXT,
  name             TEXT NOT NULL,
  category         TEXT,
  price_sen        INTEGER NOT NULL CHECK (price_sen >= 0),
  ul_price_sen     INTEGER,
  margin_pct       REAL,
  status           TEXT CHECK (status IN ('loss', 'low', 'watch', 'healthy')),
  base_ul_menu_id  TEXT,
  active           INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT NOT NULL,
  UNIQUE (shop_id, ul_menu_id)
);
CREATE INDEX items_shop ON items (shop_id);

CREATE TABLE price_imports (
  id           TEXT PRIMARY KEY,
  shop_id      TEXT NOT NULL REFERENCES shops (id),
  sent_at      TEXT NOT NULL,            -- when UntungLab built the list
  received_at  TEXT NOT NULL,
  menus        INTEGER NOT NULL
);
CREATE INDEX price_imports_shop ON price_imports (shop_id, received_at);

CREATE TABLE sales (
  id                 TEXT PRIMARY KEY,   -- made on the phone, so a resend never creates a second sale
  shop_id            TEXT NOT NULL REFERENCES shops (id),
  number             TEXT NOT NULL,
  device_id          TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  channel            TEXT NOT NULL CHECK (channel IN ('counter', 'bazaar')),
  subtotal_sen       INTEGER NOT NULL,
  discount_sen       INTEGER NOT NULL,
  total_sen          INTEGER NOT NULL,
  method             TEXT NOT NULL CHECK (method IN ('cash', 'qr', 'ewallet')),
  cash_received_sen  INTEGER,
  change_sen         INTEGER,
  status             TEXT NOT NULL CHECK (status IN ('done', 'void')),
  void_reason        TEXT,
  voided_at          TEXT,
  received_at        TEXT NOT NULL
);
CREATE INDEX sales_shop_time ON sales (shop_id, created_at);

CREATE TABLE sale_lines (
  sale_id         TEXT NOT NULL REFERENCES sales (id),
  line_no         INTEGER NOT NULL,
  item_id         TEXT NOT NULL,
  name            TEXT NOT NULL,         -- snapshot: renaming an item later does not change past receipts
  unit_price_sen  INTEGER NOT NULL,
  quantity        INTEGER NOT NULL,
  margin_pct      REAL,                  -- snapshot: profit of a past sale does not move when margins change
  note            TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (sale_id, line_no)
);
