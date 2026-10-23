-- KS-01: the online store runs beyond the free month only with Kedai Online (subscription, early buyer for life, or
-- an owner account). Synced from smeLab like the plan. NULL = none; '9999-12-31T00:00:00.000Z' = for life.
ALTER TABLE shops ADD COLUMN kedai_until TEXT;
-- Shops that bought before this change keep their store (KS-02): only owner accounts exist so far.
UPDATE shops SET kedai_until = '9999-12-31T00:00:00.000Z' WHERE plan = 'pos';
