-- Kedai Online (KS-01): who may run a JualanLab online store beyond the free month. until NULL = for life.
-- KS-02: accounts that paid for JualanLab (alone or in the combo) before 24 Oct 2026 00:00 MYT keep it for life.
CREATE TABLE kedai_access (
  account_id  TEXT PRIMARY KEY REFERENCES accounts (id),
  until       TEXT,
  source      TEXT NOT NULL CHECK (source IN ('early_buyer', 'subscription', 'manual')),
  updated_at  TEXT NOT NULL
);
INSERT OR IGNORE INTO kedai_access (account_id, until, source, updated_at)
  SELECT DISTINCT account_id, NULL, 'early_buyer', '2026-10-23T16:00:00.000Z' FROM orders
  WHERE status = 'paid' AND item IN ('jualanlab', 'combo') AND paid_at < '2026-10-23T16:00:00.000Z';
