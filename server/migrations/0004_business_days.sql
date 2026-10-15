-- Business days (T-07). A day is opened and closed by hand and may run past midnight (a night stall open
-- from 5 pm to 2 am is one day). Every sale belongs to the day that was open on the phone that made it.
CREATE TABLE biz_days (
  id                TEXT PRIMARY KEY,          -- made on the phone that opened it, so opening works offline
  shop_id           TEXT NOT NULL REFERENCES shops (id),
  opened_at         TEXT NOT NULL,
  opened_device_id  TEXT NOT NULL,             -- 'auto' when a sale arrived before its day; 'legacy' for old sales
  float_sen         INTEGER NOT NULL DEFAULT 0,-- cash put in the drawer at opening (can be corrected at close)
  closed_at         TEXT,                      -- null while the day is open
  merged_into       TEXT,                      -- two phones opened offline at once: this one was joined to that one
  received_at       TEXT NOT NULL
);
CREATE INDEX biz_days_shop_opened ON biz_days (shop_id, opened_at);
-- At most one open day per shop.
CREATE UNIQUE INDEX biz_days_one_open ON biz_days (shop_id) WHERE closed_at IS NULL AND merged_into IS NULL;

ALTER TABLE sales ADD COLUMN day_id TEXT;
CREATE INDEX sales_shop_day ON sales (shop_id, day_id);
ALTER TABLE day_closes ADD COLUMN biz_day_id TEXT;
CREATE INDEX day_closes_biz_day ON day_closes (biz_day_id, closed_at);

-- Sales made before this change: one ended day per shop and Malaysian calendar date.
INSERT INTO biz_days (id, shop_id, opened_at, opened_device_id, float_sen, closed_at, merged_into, received_at)
SELECT 'legacy-' || shop_id || '-' || date(created_at, '+8 hours'), shop_id, MIN(created_at), 'legacy', 0, MAX(created_at), NULL, MAX(created_at)
FROM sales GROUP BY shop_id, date(created_at, '+8 hours');

INSERT OR IGNORE INTO biz_days (id, shop_id, opened_at, opened_device_id, float_sen, closed_at, merged_into, received_at)
SELECT 'legacy-' || shop_id || '-' || day, shop_id, MIN(closed_at), 'legacy', 0, MAX(closed_at), NULL, MAX(closed_at)
FROM day_closes GROUP BY shop_id, day;

UPDATE sales SET day_id = 'legacy-' || shop_id || '-' || date(created_at, '+8 hours');

UPDATE day_closes SET biz_day_id = 'legacy-' || shop_id || '-' || day;

UPDATE biz_days SET
  float_sen = (SELECT c.float_sen FROM day_closes c WHERE c.biz_day_id = biz_days.id ORDER BY c.closed_at DESC LIMIT 1),
  closed_at = (SELECT MIN(c.closed_at) FROM day_closes c WHERE c.biz_day_id = biz_days.id)
WHERE EXISTS (SELECT 1 FROM day_closes c WHERE c.biz_day_id = biz_days.id);
