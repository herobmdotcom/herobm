-- 0016_add_product_pricing_fields.sql
-- Add trade_price, price_level_3, price_level_4 to modbm_core.products
-- These pricing tiers were previously only available on legacy ABM products;
-- going forward new products can also have them.

ALTER TABLE modbm_core.products ADD COLUMN IF NOT EXISTS trade_price numeric DEFAULT '0';
ALTER TABLE modbm_core.products ADD COLUMN IF NOT EXISTS price_level_3 numeric DEFAULT '0';
ALTER TABLE modbm_core.products ADD COLUMN IF NOT EXISTS price_level_4 numeric DEFAULT '0';
