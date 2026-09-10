ALTER TABLE "herobm_core"."sales_order_shipments" ADD COLUMN IF NOT EXISTS "shipping_notes" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."tenant_settings" ADD COLUMN IF NOT EXISTS "pdf_theme_config" jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_order_shipments" ADD COLUMN IF NOT EXISTS "shipping_notes" text;--> statement-breakpoint
UPDATE "herobm_core"."sales_order_shipments" s
SET "shipping_notes" = o."shipping_notes"
FROM "herobm_core"."sales_orders" o
WHERE s."sales_order_id" = o."sales_order_id" AND s."shipping_notes" IS NULL;--> statement-breakpoint
UPDATE "herobm_core"."transfer_order_shipments" s
SET "shipping_notes" = o."shipping_notes"
FROM "herobm_core"."transfer_orders" o
WHERE s."transfer_order_id" = o."transfer_order_id" AND s."shipping_notes" IS NULL;