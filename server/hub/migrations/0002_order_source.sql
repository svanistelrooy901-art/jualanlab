-- Where a buyer came from (the ?src= tag on the link they followed, e.g. fb, wa). Additive; NULL = no tag.
ALTER TABLE orders ADD COLUMN source TEXT;
