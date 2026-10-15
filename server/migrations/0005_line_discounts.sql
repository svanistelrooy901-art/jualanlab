-- Discounts on single items (15 Oct). Each sale line keeps the UntungLab cost of one unit at the time of sale,
-- so profit after a discount is the price charged minus that cost. Older lines keep only their margin.
ALTER TABLE sale_lines ADD COLUMN unit_cost_sen REAL;
ALTER TABLE sale_lines ADD COLUMN list_price_sen INTEGER;
ALTER TABLE sale_lines ADD COLUMN discount_pct REAL;
