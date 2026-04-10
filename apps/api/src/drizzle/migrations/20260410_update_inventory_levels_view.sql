DROP VIEW IF EXISTS modbm_core.inventory_levels;

CREATE VIEW modbm_core.inventory_levels AS
SELECT gen_random_uuid() AS inventory_level_id,
    l.location_id,
    p.product_id,
    COALESCE(sum(il.quantity), 0::numeric) AS quantity_on_hand,
    GREATEST(
        COALESCE(
            (SELECT COALESCE(sum(sol.quantity - COALESCE(sol.quantity_picked, 0::numeric)), 0::numeric)
             FROM modbm_core.sales_order_lines sol
             JOIN modbm_core.sales_orders so ON so.sales_order_id = sol.sales_order_id
             WHERE sol.product_id = p.product_id 
               AND sol.fulfillment_location_id = l.location_id 
               AND so.state_code IN ('confirmed', 'picking', 'partially_picked', 'packed', 'partially_dispatched')), 
        0::numeric) 
        - 
        COALESCE(
            (SELECT COALESCE(sum(b.quantity), 0::numeric)
             FROM modbm_core.backorders b
             JOIN modbm_core.sales_order_lines sol ON b.sales_order_line_id = sol.sales_order_line_id
             WHERE sol.product_id = p.product_id 
               AND sol.fulfillment_location_id = l.location_id 
               AND b.state_code = 'received_reserved'), 
        0::numeric),
    0::numeric) AS quantity_committed,
    COALESCE(
        (SELECT COALESCE(sum(b.quantity), 0::numeric)
         FROM modbm_core.backorders b
         JOIN modbm_core.sales_order_lines sol ON b.sales_order_line_id = sol.sales_order_line_id
         WHERE sol.product_id = p.product_id 
           AND sol.fulfillment_location_id = l.location_id 
           AND b.state_code = 'received_reserved'), 
    0::numeric) AS quantity_reserved,
    COALESCE(
        (SELECT sum(pol.quantity - COALESCE(pol.quantity_received, 0::numeric))
         FROM modbm_core.purchase_order_lines pol
         JOIN modbm_core.purchase_orders po ON po.purchase_order_id = pol.purchase_order_id
         WHERE pol.product_id = p.product_id 
           AND po.delivery_location_id = l.location_id 
           AND po.state_code NOT IN ('draft', 'cancelled', 'completed')), 
    0::numeric) AS quantity_on_order
FROM modbm_core.products p
CROSS JOIN modbm_core.locations l
LEFT JOIN modbm_core.inventory_ledger il ON il.product_id = p.product_id AND il.location_id = l.location_id
GROUP BY l.location_id, p.product_id;
