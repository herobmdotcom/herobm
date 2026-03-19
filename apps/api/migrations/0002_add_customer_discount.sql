-- Migration: Add customer_discount to sales_orders
-- Snapshots the customer's discount percentage at order creation time.

ALTER TABLE "modbm_core"."sales_orders"
ADD COLUMN IF NOT EXISTS "customer_discount" numeric DEFAULT '0';

