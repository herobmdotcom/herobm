ALTER TABLE "modbm_core"."sales_order_lines" ADD COLUMN "fulfillment_location_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;

-- 1. Backfill legacy Sales Order Lines with the Header-level Location default mathematically 
UPDATE modbm_core.sales_order_lines sol
SET fulfillment_location_id = so.fulfillment_location_id
FROM modbm_core.sales_orders so
WHERE sol.sales_order_id = so.sales_order_id;

-- 2. Terminate global header commitments, shift exclusively to strictly tracking line-level spatial boundaries dynamically
DROP VIEW IF EXISTS modbm_core.inventory_levels;
CREATE OR REPLACE VIEW modbm_core.inventory_levels AS
SELECT
    gen_random_uuid() AS inventory_level_id,
    l.location_id,
    p.product_id,
    COALESCE(SUM(il.quantity), 0) AS quantity_on_hand,
    COALESCE((
        -- Committed: Backorders marked 'received_reserved' AND any confirmed sales orders that haven't been picked.
        -- We join `sol` explicitly targeting `sol.fulfillment_location_id` seamlessly resolving exact line level tracking algebraically
        (SELECT COALESCE(SUM(b.quantity), 0)
         FROM modbm_core.backorders b
         JOIN modbm_core.sales_order_lines sol ON b.sales_order_line_id = sol.sales_order_line_id
         WHERE sol.fulfillment_location_id = l.location_id
         AND b.state_code = 'received_reserved')
        +
        -- Sum open sales order lines that are confirmed
        (SELECT COALESCE(SUM(sol.quantity - COALESCE(sol.quantity_picked, 0)), 0)
         FROM modbm_core.sales_order_lines sol
         JOIN modbm_core.sales_orders so ON so.sales_order_id = sol.sales_order_id
         WHERE sol.product_id = p.product_id
         AND sol.fulfillment_location_id = l.location_id
         AND so.state_code IN ('confirmed', 'picking', 'partially_picked', 'packed', 'partially_dispatched')
        )
    ), 0) AS quantity_committed,
    COALESCE((
        -- Incoming: Active POs excluding 'draft'
        SELECT SUM(pol.quantity - pol.quantity_received) 
        FROM modbm_core.purchase_order_lines pol 
        JOIN modbm_core.purchase_orders po ON po.purchase_order_id = pol.purchase_order_id 
        WHERE pol.product_id = p.product_id 
        AND po.delivery_location_id = l.location_id
        AND po.state_code NOT IN ('draft', 'cancelled', 'completed')
    ), 0) AS quantity_on_order
FROM modbm_core.products p
CROSS JOIN modbm_core.locations l
LEFT JOIN modbm_core.inventory_ledger il 
    ON il.product_id = p.product_id 
    AND il.location_id = l.location_id
GROUP BY l.location_id, p.product_id;