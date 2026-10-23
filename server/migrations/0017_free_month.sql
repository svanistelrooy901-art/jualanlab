-- The free month (DECISIONS FT-01 to FT-03).
-- trial_ends: end of the free month for shops created from now on; NULL for shops created before it.
-- ul_owner: 1 when the owner's smeLab account owns UntungLab (lets own items carry a margin %, FT-03).
ALTER TABLE shops ADD COLUMN trial_ends TEXT;
ALTER TABLE shops ADD COLUMN ul_owner INTEGER NOT NULL DEFAULT 0;
