CREATE TABLE "herobm_core"."work_order_components" (
	"work_order_component_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"expected_quantity" numeric NOT NULL,
	"unit_cost" numeric
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."work_order_picks" (
	"pick_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"work_order_component_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "work_order_pick_state_check" CHECK (state_code IN ('pending', 'picked', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."work_orders" (
	"work_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"product_id" uuid NOT NULL,
	"target_quantity" numeric NOT NULL,
	"completed_quantity" numeric NOT NULL,
	"location_id" uuid NOT NULL,
	"wip_bin_id" uuid,
	"state_code" text NOT NULL,
	"total_cost" numeric,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "work_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "work_order_state_check" CHECK (state_code IN ('draft', 'planned', 'in_progress', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD COLUMN "work_order_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_components" ADD CONSTRAINT "work_order_components_work_order_id_work_orders_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "herobm_core"."work_orders"("work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_components" ADD CONSTRAINT "work_order_components_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_picks" ADD CONSTRAINT "work_order_picks_work_order_id_work_orders_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "herobm_core"."work_orders"("work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_picks" ADD CONSTRAINT "work_order_picks_work_order_component_id_work_order_components_work_order_component_id_fk" FOREIGN KEY ("work_order_component_id") REFERENCES "herobm_core"."work_order_components"("work_order_component_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_order_picks" ADD CONSTRAINT "work_order_picks_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_orders" ADD CONSTRAINT "work_orders_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_orders" ADD CONSTRAINT "work_orders_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."work_orders" ADD CONSTRAINT "work_orders_wip_bin_id_bins_bin_id_fk" FOREIGN KEY ("wip_bin_id") REFERENCES "herobm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_work_order_components_wo" ON "herobm_core"."work_order_components" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_work_order_picks_wo" ON "herobm_core"."work_order_picks" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_work_orders_location" ON "herobm_core"."work_orders" USING btree ("location_id");--> statement-breakpoint
ALTER TABLE "herobm_core"."backorders" ADD CONSTRAINT "backorders_work_order_id_work_orders_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "herobm_core"."work_orders"("work_order_id") ON DELETE no action ON UPDATE no action;