-- ==============================================================================
-- ModBM Core Extensions
-- This file contains all custom Postgres logic (Views, Triggers, Functions)
-- that standard Drizzle ORM generation does not natively handle.
-- It is applied continuously and MUST remain fully idempotent 
-- (use OR REPLACE and DROP IF EXISTS).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCALABLE INVENTORY LEVELS VIEW
-- Consolidates the physical ledger with incoming/outgoing spatial commitments
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS modbm_core.inventory_levels;
CREATE OR REPLACE VIEW modbm_core.inventory_levels AS
SELECT
    gen_random_uuid() AS inventory_level_id,
    l.location_id,
    p.product_id,
    COALESCE(SUM(il.quantity), 0) AS quantity_on_hand,
    COALESCE((
        -- Committed: Backorders marked 'received_reserved' AND any confirmed sales orders that haven't been picked.
        -- We join explicitly targeting fulfillment_location_id securely matching line level tracking algebra
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


-- ------------------------------------------------------------------------------
-- 2. LOCATION TOPOGRAPHY TRIGGER
-- Automatically builds the universal default "HANDLING" zone and "RECEIVING"/"SHIPPING"
-- staging bins whenever a physical location is registered.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION modbm_core.trg_scaffold_system_bins()
RETURNS TRIGGER AS $$
DECLARE
    handling_zone_id UUID;
BEGIN
    handling_zone_id := gen_random_uuid();
    INSERT INTO modbm_core.zones (zone_id, location_id, code, name, source, created_by)
    VALUES (handling_zone_id, NEW.location_id, 'HANDLING', 'Handling Zone', 'system', 'system');

    INSERT INTO modbm_core.bins (bin_number, zone_id, bin_type, source, is_unavailable, created_by)
    VALUES 
        ('SHIPPING', handling_zone_id, 'staging', 'system', true, 'system'),
        ('RECEIVING', handling_zone_id, 'staging', 'system', true, 'system'),
        ('DEFAULT', handling_zone_id, 'storage', 'system', false, 'system');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scaffold_handling_bins ON modbm_core.locations;

CREATE TRIGGER scaffold_handling_bins
AFTER INSERT ON modbm_core.locations
FOR EACH ROW EXECUTE FUNCTION modbm_core.trg_scaffold_system_bins();

