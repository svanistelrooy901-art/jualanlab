-- smeLab account service, migration 1. One account for every smeLab app (DECISIONS A-01).
-- Money is integer sen. Times are ISO 8601 UTC strings.

CREATE TABLE accounts (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,        -- lower case, trimmed
  name        TEXT,
  google_sub  TEXT UNIQUE,
  created_at  TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,            -- SHA-256 of the cookie token; the token itself is never stored
  account_id  TEXT NOT NULL REFERENCES accounts (id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX sessions_account ON sessions (account_id);

CREATE TABLE login_codes (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  sent_at     TEXT NOT NULL
);

CREATE TABLE hits (                        -- rate limiting; kept two days at most
  key  TEXT NOT NULL,
  at   TEXT NOT NULL
);
CREATE INDEX hits_key_at ON hits (key, at);

-- One-time codes that hand a signed-in account to an app (2 minutes, single use, bound to app and address).
CREATE TABLE app_codes (
  code_hash     TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts (id),
  app           TEXT NOT NULL,
  redirect_uri  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  used_at       TEXT
);

-- What an account owns. Complimentary accounts (COMP_EMAILS) are worked out on the fly, not stored.
CREATE TABLE entitlements (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts (id),
  product     TEXT NOT NULL CHECK (product IN ('untunglab', 'jualanlab')),
  source      TEXT NOT NULL CHECK (source IN ('purchase', 'untunglab_licence')),
  order_id    TEXT,
  ul_code     TEXT,                        -- the UntungLab licence code behind an untunglab entitlement
  created_at  TEXT NOT NULL,
  revoked_at  TEXT
);
CREATE UNIQUE INDEX entitlements_one ON entitlements (account_id, product) WHERE revoked_at IS NULL;

CREATE TABLE orders (
  id               TEXT PRIMARY KEY,       -- 32 hex, also ToyyibPay's external reference
  account_id       TEXT NOT NULL REFERENCES accounts (id),
  item             TEXT NOT NULL CHECK (item IN ('untunglab', 'jualanlab', 'combo')),
  price_kind       TEXT NOT NULL CHECK (price_kind IN ('normal', 'early', 'second', 'combo')),
  amount_sen       INTEGER NOT NULL,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('pending', 'paid')),
  bill_code        TEXT NOT NULL,
  ul_code          TEXT,                   -- UntungLab licence issued for this order
  created_at       TEXT NOT NULL,
  paid_at          TEXT,
  receipt_sent_at  TEXT
);
CREATE INDEX orders_account ON orders (account_id, created_at);

CREATE TABLE waitlist (
  email       TEXT NOT NULL,
  app         TEXT NOT NULL CHECK (app IN ('promolab', 'kiralab', 'jualanlab')),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (email, app)
);
