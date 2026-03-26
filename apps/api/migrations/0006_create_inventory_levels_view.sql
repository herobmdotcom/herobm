-- Custom Migration to recreate the inventory_levels view after it was removed from DBT.
-- We compute quantity_on_hand directly from the new native modbm_core.inventory_ledger table.

CREATE OR REPLACE VIEW modbm_core.inventory_levels AS
SELECT
    gen_random_uuid() AS inventory_level_id,
    l.location_id,
    p.product_id,
    COALESCE(SUM(il.quantity), 0) AS quantity_on_hand,
    0 AS quantity_committed,
    0 AS quantity_on_order
FROM modbm_core.products p
CROSS JOIN modbm_core.locations l
LEFT JOIN modbm_core.inventory_ledger il 
    ON il.product_id = p.product_id 
    AND il.location_id = l.location_id
GROUP BY l.location_id, p.product_id;
