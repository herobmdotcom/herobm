-- Migration: Add missing gst_categories and exchange_rates tables
-- Fixes missing DDL that was present in snapshots but absent from SQL files.

CREATE TABLE IF NOT EXISTS "modbm_core"."gst_categories" (
    "gst_category_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rate" NUMERIC DEFAULT '0',
    "is_default" BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "modbm_core"."exchange_rates" (
    "exchange_rate_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "currency_code" TEXT NOT NULL UNIQUE,
    "currency_name" TEXT NOT NULL,
    "buy_rate" NUMERIC NOT NULL,
    "sell_rate" NUMERIC NOT NULL,
    "effective_date" TIMESTAMPTZ DEFAULT now(),
    "updated_on" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE "modbm_core"."sales_orders" ADD COLUMN IF NOT EXISTS "gst_category_id" UUID;
ALTER TABLE "modbm_core"."sales_order_lines" ADD COLUMN IF NOT EXISTS "gst_category_id" UUID;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."sales_orders" ADD CONSTRAINT "sales_orders_gst_category_id_gst_categories_gst_category_id_fk" FOREIGN KEY ("gst_category_id") REFERENCES "modbm_core"."gst_categories"("gst_category_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_gst_category_id_gst_categories_gst_category_id_fk" FOREIGN KEY ("gst_category_id") REFERENCES "modbm_core"."gst_categories"("gst_category_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
