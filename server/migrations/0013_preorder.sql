-- Kedai pre-order batches (Mamu, 17 Oct): an order can be for a batch ("Sabtu 25 Okt"). The batch's name and ready
-- date are kept on the order as they were, so renaming or removing a batch never changes past orders.
ALTER TABLE store_orders ADD COLUMN batch_id TEXT;
ALTER TABLE store_orders ADD COLUMN batch_label TEXT;
ALTER TABLE store_orders ADD COLUMN ready_date TEXT;
CREATE INDEX store_orders_batch ON store_orders (shop_id, batch_id);
