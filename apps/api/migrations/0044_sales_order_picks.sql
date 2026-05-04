CREATE TABLE IF NOT EXISTS "modbm_core"."sales_order_picks" (
	"pick_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text DEFAULT 'picked' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_pick_state_check" CHECK (state_code IN ('picked', 'shipped', 'cancelled'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_order_picks_order" ON "modbm_core"."sales_order_picks" ("sales_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_order_picks_line" ON "modbm_core"."sales_order_picks" ("sales_order_line_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."sales_order_picks" ADD CONSTRAINT "sales_order_picks_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
-- Backfill picks from legacy quantity_picked column
INSERT INTO modbm_core.sales_order_picks (
  sales_order_id,
  sales_order_line_id,
  product_id,
  quantity,
  state_code,
  created_by
)
SELECT 
  sales_order_id,
  sales_order_line_id,
  product_id,
  quantity_picked,
  'picked',
  'system_migration'
FROM modbm_core.sales_order_lines
WHERE quantity_picked IS NOT NULL AND quantity_picked > 0;
