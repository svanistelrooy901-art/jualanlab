-- ST-01: a counter (or bazaar) sale lowers the store's stock. What each sale actually took is kept here as JSON
-- ({ itemId: quantity }) so a void puts back exactly that, once. NULL = took nothing (or already put back).
ALTER TABLE sales ADD COLUMN stock_taken TEXT;
