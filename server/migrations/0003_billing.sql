-- Plans and buying the full POS (Phase 8).
ALTER TABLE shops ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';   -- 'free' | 'pos'
ALTER TABLE shops ADD COLUMN plan_since TEXT;

CREATE TABLE orders (
  id               TEXT PRIMARY KEY,         -- 32 hex characters, sent to ToyyibPay as the external reference
  shop_id          TEXT NOT NULL REFERENCES shops (id),
  email            TEXT NOT NULL,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  product          TEXT NOT NULL CHECK (product IN ('pos', 'bundle')),
  price_kind       TEXT NOT NULL CHECK (price_kind IN ('normal', 'early', 'untunglab', 'bundle')),
  amount_sen       INTEGER NOT NULL,         -- decided by the server, never by the phone
  ul_code          TEXT,                     -- UntungLab licence code used for the UntungLab-user price
  status           TEXT NOT NULL CHECK (status IN ('pending', 'paid')),
  bill_code        TEXT NOT NULL,
  ul_issued_code   TEXT,                     -- bundle: the UntungLab code created for this buyer
  created_at       TEXT NOT NULL,
  paid_at          TEXT,
  email_sent_at    TEXT
);
CREATE INDEX orders_shop ON orders (shop_id, created_at);
-- One UntungLab code gives the UntungLab-user price once.
CREATE UNIQUE INDEX orders_ul_code_paid ON orders (ul_code) WHERE status = 'paid' AND ul_code IS NOT NULL;
