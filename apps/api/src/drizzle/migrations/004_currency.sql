-- 004_currency.sql
-- Add currency_code to sales_orders.
-- Default to EUR (the company's home/base currency).

BEGIN;

ALTER TABLE modbm_core.sales_orders
  ADD COLUMN currency_code text NOT NULL DEFAULT 'EUR';

COMMIT;
