CREATE TABLE IF NOT EXISTS "modbm_core"."purchase_order_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD COLUMN IF NOT EXISTS "trade_price" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD COLUMN IF NOT EXISTS "price_level_3" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD COLUMN IF NOT EXISTS "price_level_4" numeric DEFAULT '0';--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "modbm_core"."purchase_order_events" ADD CONSTRAINT "purchase_order_events_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;