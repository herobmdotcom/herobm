-- Custom Migration: Fix quantity_committed to include open sales orders and exclude draft POs from incoming.
DROP VIEW IF EXISTS modbm_core.inventory_levels;
CREATE OR REPLACE VIEW modbm_core.inventory_levels AS
SELECT
    gen_random_uuid() AS inventory_level_id,
    l.location_id,
    p.product_id,
    COALESCE(SUM(il.quantity), 0) AS quantity_on_hand,
    COALESCE((
        -- Committed: Backorders marked 'received_reserved' AND any confirmed sales orders that haven't been picked.
        -- Sum backorder quantities
        (SELECT COALESCE(SUM(b.quantity), 0)
         FROM modbm_core.backorders b
         WHERE b.product_id = p.product_id
         AND b.state_code = 'received_reserved')
        +
        -- Sum open sales order lines that are confirmed
        (SELECT COALESCE(SUM(sol.quantity - COALESCE(sol.quantity_picked, 0)), 0)
         FROM modbm_core.sales_order_lines sol
         JOIN modbm_core.sales_orders so ON so.sales_order_id = sol.sales_order_id
         WHERE sol.product_id = p.product_id
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