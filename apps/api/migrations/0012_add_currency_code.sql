-- Migration to add currency_code to sales_orders
-- To sync the physical database with the Drizzle schema modbm-core-schema.ts

ALTER TABLE modbm_core.sales_orders ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'EUR';
