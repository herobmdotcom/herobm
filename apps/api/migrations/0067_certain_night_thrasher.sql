ALTER TABLE "herobm_core"."purchase_orders" DROP CONSTRAINT "purchase_order_state_check";--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" DROP CONSTRAINT "sales_order_state_check";--> statement-breakpoint
UPDATE "herobm_core"."purchase_orders" SET state_code = 'archived' WHERE state_code = 'legacy';--> statement-breakpoint
UPDATE "herobm_core"."sales_orders" SET state_code = 'archived' WHERE state_code = 'legacy';--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_orders" ADD COLUMN "shipping_notes" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_orders" ADD CONSTRAINT "purchase_order_state_check" CHECK (state_code IN ('draft', 'ordered', 'partially_received', 'received', 'invoiced', 'cancelled', 'closed_short', 'archived'));--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD CONSTRAINT "sales_order_state_check" CHECK (state_code IN ('draft', 'quoted', 'confirmed', 'picking', 'shipped', 'invoiced', 'cancelled', 'archived'));