-- Kedai stock (Mamu, 15 Oct): how many of an item the store can still sell. NULL = not counted (no limit).
-- Store orders take from it when placed; cancelled and expired orders give it back. The seller edits it any time.
ALTER TABLE item_store ADD COLUMN stock INTEGER;
