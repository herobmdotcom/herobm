-- 0028_drop_so_legacy_fields.sql
-- Remove redundant customer_discount and gst_category_id from sales_orders.
-- These concepts are strictly line-level going forward. Default values
-- are sourced directly from the account/customer.

-- Drop foreign key constraint on gst_category_id first
ALTER TABLE modbm_core.sales_orders
    DROP CONSTRAINT IF EXISTS sales_orders_gst_category_id_gst_categories_gst_category_id_fk;

-- Drop the columns
ALTER TABLE modbm_core.sales_orders
    DROP COLUMN IF EXISTS customer_discount;

ALTER TABLE modbm_core.sales_orders
    DROP COLUMN IF EXISTS gst_category_id;
