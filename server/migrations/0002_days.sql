-- Close Day (Phase 6). A day can be closed more than once (a late sale or a void after closing);
-- every close is kept, the latest one is the day's current close.
CREATE TABLE day_closes (
  id                 TEXT PRIMARY KEY,
  shop_id            TEXT NOT NULL REFERENCES shops (id),
  day                TEXT NOT NULL,          -- YYYY-MM-DD, Malaysia time
  closed_at          TEXT NOT NULL,
  device_id          TEXT NOT NULL,
  float_sen          INTEGER NOT NULL,       -- cash put in the drawer for change at the start
  expected_cash_sen  INTEGER NOT NULL,       -- float + cash takings, worked out by the server
  counted_cash_sen   INTEGER NOT NULL,       -- what the seller counted
  totals_json        TEXT NOT NULL,          -- summary and envelopes at the moment of closing
  note               TEXT NOT NULL DEFAULT ''
);
CREATE INDEX day_closes_shop_day ON day_closes (shop_id, day, closed_at);
