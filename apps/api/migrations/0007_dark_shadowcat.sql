CREATE TABLE "modbm_core"."backorders" (
	"backorder_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"purchase_order_line_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text DEFAULT 'pending_supply' NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."backorders" ADD CONSTRAINT "backorders_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

DROP VIEW IF EXISTS modbm_core.inventory_levels;
CREATE OR REPLACE VIEW modbm_core.inventory_levels AS
SELECT
    gen_random_uuid() AS inventory_level_id,
    l.location_id,
    p.product_id,
    COALESCE(SUM(il.quantity), 0) AS quantity_on_hand,
    COALESCE((
        SELECT SUM(b.quantity) 
        FROM modbm_core.backorders b 
        WHERE b.product_id = p.product_id 
        AND b.state_code = 'received_reserved'
    ), 0) AS quantity_committed,
    COALESCE((
        SELECT SUM(pol.quantity - pol.quantity_received) 
        FROM modbm_core.purchase_order_lines pol 
        JOIN modbm_core.purchase_orders po ON po.purchase_order_id = pol.purchase_order_id 
        WHERE pol.product_id = p.product_id 
        AND po.state_code NOT IN ('cancelled', 'completed')
    ), 0) AS quantity_on_order
FROM modbm_core.products p
CROSS JOIN modbm_core.locations l
LEFT JOIN modbm_core.inventory_ledger il 
    ON il.product_id = p.product_id 
    AND il.location_id = l.location_id
GROUP BY l.location_id, p.product_id;