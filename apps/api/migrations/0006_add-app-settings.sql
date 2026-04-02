CREATE TABLE "modbm_core"."app_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_fulfillment_location_id" uuid,
	"inventory_valuation_method" text DEFAULT 'weighted_average' NOT NULL,
	"non_stock_billing_mode" text DEFAULT 'per_shipment' NOT NULL,
	"setup_completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD COLUMN "revenue_routing_precedence" text DEFAULT 'product_first' NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD COLUMN "expense_routing_precedence" text DEFAULT 'product_first' NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."app_settings" ADD CONSTRAINT "app_settings_default_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("default_fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;