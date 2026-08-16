ALTER TABLE "herobm_core"."sales_order_shipments" DROP CONSTRAINT "shipment_state_check";--> statement-breakpoint
ALTER TABLE "herobm_core"."product_components" ALTER COLUMN "fractional_behavior" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_images" ALTER COLUMN "is_primary" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."product_images" ALTER COLUMN "sort_order" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_shipments" ADD CONSTRAINT "shipment_state_check" CHECK (state_code IN ('draft', 'dispatched', 'partially_received', 'received', 'cancelled'));