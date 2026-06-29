ALTER TABLE "herobm_core"."sales_orders" RENAME COLUMN "delivery_customer_name" TO "delivery_company_name";
ALTER TABLE "herobm_core"."sales_order_shipments" RENAME COLUMN "delivery_customer_name" TO "delivery_company_name";
ALTER TABLE "herobm_core"."suppliers" ADD COLUMN IF NOT EXISTS "bank_number" text;