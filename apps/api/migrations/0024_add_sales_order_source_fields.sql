-- 0024_add_sales_order_source_fields.sql
-- Add source tracking to sales_orders for native ABM import.

ALTER TABLE modbm_core.sales_orders
  ADD COLUMN IF NOT EXISTS source_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';
