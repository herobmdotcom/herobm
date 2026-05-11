CREATE TABLE "modbm_core"."transfer_order_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_lines" (
	"transfer_order_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric NOT NULL,
	"quantity_shipped" numeric DEFAULT '0',
	"quantity_received" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_orders" (
	"transfer_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"source_location_id" uuid NOT NULL,
	"destination_location_id" uuid NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfer_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD COLUMN "transfer_order_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD COLUMN "transfer_order_line_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_events" ADD CONSTRAINT "transfer_order_events_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_lines" ADD CONSTRAINT "transfer_order_lines_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_lines" ADD CONSTRAINT "transfer_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_orders" ADD CONSTRAINT "transfer_orders_source_location_id_locations_location_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_orders" ADD CONSTRAINT "transfer_orders_destination_location_id_locations_location_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transfer_order_lines_product" ON "modbm_core"."transfer_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_orders_source_location" ON "modbm_core"."transfer_orders" USING btree ("source_location_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_orders_dest_location" ON "modbm_core"."transfer_orders" USING btree ("destination_location_id");--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "modbm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;