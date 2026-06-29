ALTER TABLE "herobm_core"."purchase_orders" DROP CONSTRAINT "purchase_order_state_check";--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" DROP CONSTRAINT "sales_order_state_check";--> statement-breakpoint
ALTER TABLE "herobm_core"."transfer_orders" ADD COLUMN "shipping_notes" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_orders" ADD CONSTRAINT "purchase_order_state_check" CHECK (state_code IN ('draft', 'ordered', 'partially_received', 'received', 'invoiced', 'cancelled', 'closed_short', 'archived'));--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD CONSTRAINT "sales_order_state_check" CHECK (state_code IN ('draft', 'quoted', 'confirmed', 'picking', 'shipped', 'invoiced', 'cancelled', 'archived'));